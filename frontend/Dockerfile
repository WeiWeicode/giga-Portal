# 員工入口網 SPA 映像檔:內含 dist,部署時以一次性容器發佈到 Nginx 的 gw_www volume
#   由 deploy/docker-compose.yml 的 spa-portal 建置(需 additional_contexts webkit = Gateway web-kit 原始碼)
#   docker run --rm -v <gw_www>:/srv/www spa/portal:<版本> publish portal     # 原子切換 /srv/www/portal/current(Nginx /)
#   docker run --rm -v <gw_www>:/srv/www spa/portal:<版本> rollback portal    # 指回上一版
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --prefer-offline --no-audit --no-fund
COPY . .
# Gateway web-kit 尚未發佈到 Registry:由 build context「webkit」帶入,vite.config.ts 以 WEB_KIT_DIR 指向(ARCHITECTURE §8)
COPY --from=webkit . /web-kit/src
ENV WEB_KIT_DIR=/web-kit/src
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
