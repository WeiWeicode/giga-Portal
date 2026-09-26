#!/bin/sh
# SPA 發佈 / 回滾(複製自 GigaItApp frontend/publish.sh;Gateway DEPLOYMENT.md §3.4、PRD §7.2.3),在一次性容器內執行,/srv/www 為 Nginx 共用的 named volume gw_www:
#   docker run --rm -v gw_www:/srv/www <registry>/spa/<app>:<SHA> publish <app>
#   docker run --rm -v gw_www:/srv/www <registry>/spa/<app>:<SHA> rollback <app>
# 以 symlink current 指向 releases/<SHA>,以 rename 原子切換;保留最近 5 版;不需重啟或 reload Nginx。
set -eu
ACTION="${1:?publish|rollback}"
APP="${2:?app}"
SHA="${RELEASE_SHA:-$(cat /dist/RELEASE 2>/dev/null || date +%Y%m%d%H%M%S)}"
ROOT="/srv/www/$APP"
KEEP="${KEEP_RELEASES:-5}"
mkdir -p "$ROOT/releases"

switch_to() {
  ln -sfn "releases/$1" "$ROOT/.current.tmp"
  mv -Tf "$ROOT/.current.tmp" "$ROOT/current"
  echo "$APP:current → $1"
}

case "$ACTION" in
  publish)
    [ -d "/dist/$APP" ] || { echo "映像檔內沒有 /dist/$APP"; exit 1; }
    rm -rf "$ROOT/releases/$SHA.tmp"
    cp -a "/dist/$APP" "$ROOT/releases/$SHA.tmp"
    rm -rf "$ROOT/releases/$SHA"
    mv "$ROOT/releases/$SHA.tmp" "$ROOT/releases/$SHA"
    switch_to "$SHA"
    # 保留最近 $KEEP 版(不刪除 current 指向的版本)
    CUR="$(readlink "$ROOT/current" | sed 's#releases/##')"
    ls -1t "$ROOT/releases" | grep -v "^$CUR\$" | tail -n +"$KEEP" | while read -r old; do rm -rf "$ROOT/releases/$old"; done
    ;;
  rollback)
    CUR="$(readlink "$ROOT/current" | sed 's#releases/##')"
    PREV="$(ls -1t "$ROOT/releases" | grep -v "^$CUR\$" | head -n 1)"
    [ -n "$PREV" ] || { echo "沒有可回滾的版本"; exit 1; }
    switch_to "$PREV"
    ;;
  *) echo "未知動作:$ACTION"; exit 1 ;;
esac
