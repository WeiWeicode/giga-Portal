#!/bin/sh
# 主機 2(測試區 WSL)準備 portal-api 的機密與 Compose 變數:本人執行,SQL 密碼以隱藏輸入寫入,不經開發機(比照 giga-file-service)。
#   在主機 2 的 WSL:sudo sh host2-set-api-secrets.sh
# 產生(已存在的不覆寫;要重建先刪除該檔):
#   /srv/giganexus/portal-secrets/   portal_db_password(portal_app,隱藏輸入)、
#                                    gw_api_key(Gateway CLI client:create --code portal-api;自動註冊 OpenAPI 草稿用)、
#                                    monitor_api_key(giga-observe ingest Key,服務 portal-api)、
#                                    google_maps_api_key(通勤調查地址轉經緯度,隱藏輸入;可留空,留空則通勤調查不能送出)、
#                                    bpm_db_password(BPM 191 唯讀帳號 portal_bpm_ro,隱藏輸入;可留空,留空則 BPM 簽核資訊不可用)、
#                                    talk_author_key(3691 作者加密金鑰,自動產生 32 bytes;遺失則新站發文的作者無法解碼,需另行備份)
#   /srv/giganexus/deploy/portal.env 補上 portal-api 的 Compose 變數(既有的 SPA 變數保留;範本 test.env.example)
set -eu
# 暫存檔(含 Key)只有本人可讀,結束或中斷時刪除;中斷輸入密碼時恢復終端機回顯
umask 077
TMP="$(mktemp -d)"
trap 'stty echo 2>/dev/null || true; rm -rf "$TMP"' EXIT INT TERM
D=/srv/giganexus/portal-secrets
ENV_FILE=/srv/giganexus/deploy/portal.env
GW_ENV_FILE=/srv/giganexus/deploy/test.env
GW_SHARED=/srv/giganexus/shared
mkdir -p "$D"
# 目錄要讓 CI(gitlab-runner)確認檔案存在、docker compose 掛載;檔案本身於最後改為 uid 1000 / 400
chmod 755 "$D"

# ---------- SQL Server(portal_app)密碼 ----------
if [ ! -f "$D/portal_db_password" ]; then
  stty -echo; printf 'portal_app 密碼(giganexus_gw_test):'; read -r p; stty echo; echo
  [ -n "$p" ] || { echo "密碼空白,中止" >&2; exit 1; }
  printf '%s' "$p" > "$D/portal_db_password"; unset p
fi

# ---------- Gateway API Key(自動註冊 OpenAPI 草稿用;代碼必須等於上游 portal-api) ----------
if [ ! -f "$D/gw_api_key" ]; then
  G="$GW_SHARED/giga-api-gateway-bff/deploy"
  TAG="$(cat "$GW_SHARED/gateway-image-tag")"
  (cd "$G" && IMAGE_TAG="$TAG" REGISTRY=10.10.130.123:5050/giganexus/giga-api-gateway-bff \
    docker compose --env-file "$GW_ENV_FILE" -f docker-compose.yml -f docker-compose.test.yml --profile tools run --rm --no-deps -T \
    migrate node dist/bff/src/cli/index.js client:create --code portal-api --name "員工入口網 portal-api" --actor giga-Portal) > "$TMP/key.json"
  sed -n 's/^  "key": "\(.*\)",\{0,1\}$/\1/p' "$TMP/key.json" | tr -d '\n' > "$D/gw_api_key"
  grep -v '"key"' "$TMP/key.json"
  [ -s "$D/gw_api_key" ] || { echo "取不到 API Key,請檢查上方輸出" >&2; rm -f "$D/gw_api_key"; exit 1; }
fi

# ---------- giga-observe 監控 Key(ingest;已存在則略過) ----------
if [ ! -f "$D/monitor_api_key" ]; then
  (cd /srv/giganexus/giga-observe && docker compose --env-file deploy/test.env exec -T gno-backend \
    node src/scripts/createApiKey.js --service portal-api --scope ingest --label "員工入口網 portal-api") > "$TMP/obs.txt"
  sed -n 's/^  key *: *//p' "$TMP/obs.txt" | tr -d '\r\n' > "$D/monitor_api_key"
  [ -s "$D/monitor_api_key" ] || { echo "取不到監控 Key(監控會停用,服務仍可啟動);稍後可刪除此檔重跑" >&2; }
fi

# ---------- Google Maps Geocoding 金鑰(通勤調查;PORTAL-API-PLAN D-11) ----------
if [ ! -f "$D/google_maps_api_key" ]; then
  stty -echo; printf 'Google Maps Geocoding API 金鑰(可留空):'; read -r k; stty echo; echo
  printf '%s' "$k" > "$D/google_maps_api_key"; unset k
fi

# ---------- BPM 唯讀帳號 portal_bpm_ro(191;backend/db/dba/03-create-bpm-readonly.sql) ----------
if [ ! -f "$D/bpm_db_password" ]; then
  stty -echo; printf 'portal_bpm_ro 密碼(BPM 191,可留空):'; read -r b; stty echo; echo
  printf '%s' "$b" > "$D/bpm_db_password"
  unset b
fi

# ---------- 3691 作者加密金鑰(D-23;自動產生,不經開發機,不可覆寫:覆寫後舊發文的作者無法解碼) ----------
if [ ! -f "$D/talk_author_key" ]; then
  k="$(openssl rand -base64 32 | tr -d '\r\n')"
  [ -n "$k" ] || { echo "openssl 產生金鑰失敗,未寫入 talk_author_key" >&2; exit 1; }
  printf '%s' "$k" > "$D/talk_author_key"; unset k
  echo "已產生 talk_author_key;請依公司規定另行備份(遺失則新入口網發文的作者無法解碼)"
fi

# 只限縮檔案(目錄需讓 CI 的 docker compose 讀得到 secret 路徑)
chown 1000:1000 "$D"/*; chmod 400 "$D"/*

# ---------- Compose 變數(portal.env 已有 SPA 的設定,只補缺少的) ----------
touch "$ENV_FILE"
add() { grep -q "^$1=" "$ENV_FILE" || { echo "$1=$2" >> "$ENV_FILE"; echo "portal.env 新增 $1"; }; }
add GW_ENV test
add GW_BASE_URL https://giganexus-test.gigasolar.com.tw
add GW_NETWORK giganexus-gw_default
add PORTAL_DB_HOST 10.10.130.220
add PORTAL_DB_NAME giganexus_gw_test
add PORTAL_DB_USER portal_app
add PORTAL_SECRETS_DIR "$D"
if [ -s "$D/bpm_db_password" ]; then
  add BPM_DB_HOST 10.10.130.191
  add BPM_WEB_URL http://10.10.130.191:8080
  # D-29 碩禾系公司(Token cos 名稱;清單待確認,見 CONFIRM-NEEDED P3)
  add BPM_COMPANIES 碩禾,碩禾電子材料
fi

ls -l "$D"
echo "完成。之後推 develop 由 CI 部署 portal-api;部署後在 GigaItApp「服務與路由」審查 portal-api 的路由草稿並發佈。"
