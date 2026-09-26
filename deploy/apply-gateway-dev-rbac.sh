#!/bin/sh
# 將 deploy/gateway-dev-rbac.yaml 套用到本機 Gateway(以 Gateway 的 gw-setup 映像執行 CLI apply)。
# 需要:兄弟目錄 ../giga-api-gateway-bff 的本機環境已啟動(deploy/dev/up.sh)。
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
GW="${GATEWAY_DIR:-$HERE/../../giga-api-gateway-bff}/deploy"
cd "$GW"
docker compose --env-file dev.env -f docker-compose.yml -f docker-compose.dev.yml --profile setup run --rm --no-deps \
  -v "$HERE/gateway-dev-rbac.yaml:/portal/gateway-dev-rbac.yaml:ro" \
  gw-setup node dist/bff/src/cli/index.js apply --file /portal/gateway-dev-rbac.yaml --actor giga-Portal
