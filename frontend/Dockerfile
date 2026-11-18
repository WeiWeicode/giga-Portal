# 員工入口網 SPA 映像檔:內含 dist,部署時以一次性容器發佈到 Nginx 的 gw_www volume
#   由 deploy/docker-compose.yml 的 spa-portal 建置(@giganexus/web-kit 取自公司 GitLab npm Registry,需 BuildKit secret npm_token)
#   docker run --rm -v <gw_www>:/srv/www spa/portal:<版本> publish portal     # 原子切換 /srv/www/portal/current(Nginx /)
#   docker run --rm -v <gw_www>:/srv/www spa/portal:<版本> rollback portal    # 指回上一版
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN --mount=type=secret,id=npm_token GITLAB_NPM_TOKEN="$(cat /run/secrets/npm_token)" npm ci --include=dev --no-audit --no-fund
COPY . .
# 版本名稱:未指定時用建置時間;不可為 dev(Gateway 範例入口網佔用 releases/dev,回滾時要能退回)
ARG RELEASE_SHA=
RUN npm run build && mkdir -p /out && mv dist /out/portal \
  && SHA="${RELEASE_SHA:-portal-$(date +%Y%m%d%H%M%S)}" && [ "$SHA" != dev ] && echo "$SHA" > /out/RELEASE

FROM alpine:3.20
RUN apk add --no-cache coreutils
COPY --from=build /out /dist
COPY publish.sh /usr/local/bin/spa
RUN chmod +x /usr/local/bin/spa
ENTRYPOINT ["spa"]
CMD ["publish", "portal"]
