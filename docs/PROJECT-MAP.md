# 專案地圖 — giga-Portal(員工入口網)

> **最後更新:2026-09-26**(M1:建立 `frontend/` 框架;本機 Gateway 權限設定 `deploy/gateway-dev-rbac.yaml`;`spa-portal` 發佈到本機 Nginx;公司測試區權限範本與 env 範本)。
> 開發新功能後,在同一個變更內更新本文件(`AGENT.md` §9.1、Gateway `AGENT.md` §10.7)。只寫結構與職責,細節連到 `docs/` 對應章節。
> 標示「(規劃)」的目錄與檔案尚未建立,依 [ARCHITECTURE.md](ARCHITECTURE.md) §6–§7 實作後移除標示。

集團員工的單一入口:`/`(Vue 前端,含 `/login`)+ `/api/portal/*`(portal-api,Fastify,port 51271,經 Gateway BFF;M4 起);登入與權限由 Gateway 提供,權限由 GigaItApp 設定。

---

## 1. 目錄

```
giga-Portal/
├─ AGENT.md                       AI 協作準則
├─ README.md                      專案簡介
├─ .claude/launch.json            本機預覽設定(npm --prefix frontend run dev,port 5179)
├─ docs/
│  ├─ PRD.md                      產品需求(決策、FR、配合修改、待決事項)
│  ├─ ARCHITECTURE.md             架構、請求流程、權限流程、風格切換、部署
│  ├─ API.md                      portal-api 端點(草案)與使用的 BFF API
│  ├─ UI-GUIDE.md                 綠能 token、玻璃 / 扁平、全域元件差異、版面
│  ├─ PROJECT-MAP.md              本文件
│  ├─ Gherkin/                    驗收場景(@auto / @manual / @wip)
│  └─ DevelopmentProcess/         修正紀錄(NewFeatures、FrontendCorrection、BackendCorrection、BugFix)
├─ frontend/                      Vue 3 + Vite(base /;框架複製自 GigaItApp,見 NewFeatures 2026-09-26)
│  ├─ index.html                  進入點;先載入 public/theme-init.js 套用明暗 / 風格(Gateway CSP 不允許 inline script)
│  ├─ public/                     favicon.svg、theme-init.js
│  ├─ vite.config.ts              base /、port 5179、/api proxy、@giganexus/web-kit alias(兄弟 repo;建置時 WEB_KIT_DIR)
│  ├─ Dockerfile、publish.sh       SPA 映像檔與發佈 / 回滾(releases/<版本> + current symlink;publish.sh 複製自 GigaItApp)
│  ├─ src/
│  │  ├─ main.ts、App.vue         啟動:initTheme → router → ui
│  │  ├─ router.ts                路由與選單來源(MENU_GROUPS、MENU_PAGES);全域守衛:me → 應用層 → 頁面權限
│  │  ├─ api/gateway.ts           Gateway BFF 唯一入口(web-kit 包裝):登入、密碼、註冊、describeError、PortalMe 型別
│  │  ├─ api/format.ts            顯示格式(時間)
│  │  ├─ composables/             apps(應用切換 / 應用層守衛,含 TEMP_APPS 暫時推導)、menu(選單過濾)、redirect(安全導回)、
│  │  │                           session(me 5 分鐘更新)、theme / themeRules(明暗 × 風格)、greeting、useAsync、usePaged
│  │  ├─ layouts/                 AppLayout(側欄、頂列、應用切換、帳號)、TabbedPage、AuthLayout(品牌面板 + 表單卡片)、ChangePasswordModal
│  │  ├─ pages/                   auth/(Login、Register、ResetPassword、SetPasswordForm、AuthHeader)、home/Home、
│  │  │                           Placeholder(未實作功能頁)、NoAccess、Unavailable、Forbidden、NotFound
│  │  ├─ ui/                      全域 UI 套件:G* 元件、styles/tokens.css(綠能 × 玻璃 / 扁平)、base.css、charts/、feedback
│  │  └─ components.d.ts          全域元件型別(新增 G* 元件時同步)
│  └─ test/                       Vitest:redirect、apps、menu、theme、greeting(測試名稱 = Gherkin 場景名稱)
├─ deploy/
│  ├─ gateway-dev-rbac.yaml       本機 Gateway 的入口網權限代碼與測試角色(暫時做法,Gateway CLI apply 格式)
│  ├─ apply-gateway-dev-rbac.sh   套用上檔到本機 Gateway
│  ├─ gateway-rbac.yaml           公司測試區 / 正式區的權限代碼與角色(AD 群組 DN 由 IT 填入)
│  ├─ apply-gateway-rbac.sh       以 Gateway 正式 compose 的 migrate 映像套用上檔(Git Bash 可用)
│  ├─ test.env.example            公司環境 Compose 變數範本(gw_www volume 名稱、版本名稱)
│  └─ docker-compose.yml          spa-portal(發佈到 gw_www 的 portal,Nginx /;web-kit 以 additional_contexts 帶入);portal-api(M4 規劃)
└─ backend/(規劃,M4)            portal-api(以 Gateway 後端樣本為基礎)
   ├─ src/                        server、app、config、errors、openapi(x-permissions 含前端權限)、routes/、store/
   └─ test/                       OpenAPI 自我檢查、內部 Token、資料層級
```

## 2. 分層(Gateway `AGENT.md` §10.7.2 TypeScript / Vue 列)

| 層 | 後端(規劃) | 前端 |
| --- | --- | --- |
| 介面 | `routes/*.ts`(schema、權限宣告) | `pages/`、`layouts/` |
| 核心邏輯 | 服務模組(公告可見範圍、資料層級) | `composables/`(應用、選單、redirect、主題、session) |
| 基礎設施 | `store/`(JSON → SQL Server)、SDK(內部 Token、自動註冊) | `api/gateway.ts`(web-kit) |
| 共用 / 工具 | `config.ts`、`errors.ts` | `ui/`、`api/format.ts` |

## 3. 主要流程

| 流程 | 經過 |
| --- | --- |
| 登入 | `pages/auth/Login.vue` → `api/gateway.ts` `login()` → Gateway `/api/auth/login` → `composables/redirect` 導回(其他應用路徑整頁導向) |
| 首次登入設定密碼 | `Login.vue`(`PASSWORD_CHANGE_REQUIRED`)→ `SetPasswordForm` → `/api/auth/password/change`(限定憑證)→ 完成登入 |
| 啟動與權限 | `router.ts` 守衛 → `composables/session` `ensureMe()`(web-kit `loadMe`)→ `composables/apps`(應用層)→ 頁面 `meta.permission` → `composables/menu` 側欄過濾 |
| 應用切換 | `layouts/AppLayout` → `GAppSwitcher` → `resolveApps(me)`(`me.apps`,尚無時暫以權限推導)→ 整頁導向 `basePath` |
| 其他應用拒絕導回 | `/?denied=<應用代碼>` → `AppLayout` toast 提示後移除參數 |
| 風格切換 | `GStyleToggle` → `composables/theme` → `<html data-theme data-style>` → `tokens.css` |
| 首頁 | `pages/home/Home.vue`(M1:只用 me);M4 起 `/api/portal/dashboard`(BFF 聚合) |
| portal-api 資料(M4) | 頁面 → `api/portal.ts`(規劃)→ BFF(權限)→ portal-api `routes/` → `store/` |
| 權限設定 | 不在本專案:GigaItApp → BFF 管理 API(Gateway PRD §8.7);本機暫用 `deploy/gateway-dev-rbac.yaml` |

## 4. 要改什麼 → 看哪裡

| 要做的事 | 位置 |
| --- | --- |
| 新增頁面 / 選單 / Tab / 按鈕 | PRD §6.5 登記權限 → `deploy/gateway-dev-rbac.yaml`(portal-api 上線後改 `backend/src/openapi.ts` 的 `x-permissions`)→ `frontend/src/router.ts` → `pages/`;步驟見 [UI-GUIDE.md](UI-GUIDE.md) §6 |
| 顏色 / 風格 | `frontend/src/ui/styles/tokens.css`(明暗 × 玻璃 / 扁平四組) |
| 應用切換 | `frontend/src/ui/components/GAppSwitcher.vue`(與 GigaItApp 同步)、`composables/apps.ts` |
| 登入 / 註冊 / 密碼頁 | `frontend/src/pages/auth/`、`api/gateway.ts` |
| portal-api 新 API(M4) | `backend/src/routes/`、`openapi.ts`,同步 [API.md](API.md) |
| 錯誤代碼 | `backend/src/errors.ts`(`PORTAL_`),同步 API.md §5 |
| 登入 / 權限規則 | Gateway 規格(`../giga-api-gateway-bff/docs/PRD.md` §8.2–§8.3),先改 Gateway |

## 5. 測試地圖

| 類型 | 位置 | 指令 |
| --- | --- | --- |
| 前端邏輯 | `frontend/test/`(redirect 驗證、應用推導與守衛、選單過濾、風格規則、問候) | `frontend/`:`npm test` |
| 後端(規劃) | `backend/test/` | `backend/`:`npm test` |
| 驗收場景 | `docs/Gherkin/*.feature`(`@auto` 對應測試名稱) | 同上 |
| 經 Gateway(規劃) | `deploy/e2e-smoke.sh` | 根目錄 |

## 6. 與設計原則的已知差異

| 項目 | 說明 |
| --- | --- |
| UI 套件為複製 | 與 GigaItApp 各有一份 `ui/`;Registry 上線後抽成共用套件(PRD Q5) |
| web-kit 以 alias 引用兄弟 repo | 依賴工作區目錄結構;Registry 上線後改為套件相依(ARCHITECTURE §8) |
| 應用清單暫時推導 | `composables/apps.ts` 的 `TEMP_APPS`:Gateway G3(`me.apps`)上線後移除 |
| 權限代碼暫存本 repo | `deploy/gateway-dev-rbac.yaml`:Gateway G2 與 portal-api 自動註冊上線後移除 |
