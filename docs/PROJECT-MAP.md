# 專案地圖 — giga-Portal(員工入口網)

> **最後更新:2026-09-26**(建立專案:PRD、AGENT、docs 文件組;尚無程式碼)。
> 開發新功能後,在同一個變更內更新本文件(`AGENT.md` §9.1、Gateway `AGENT.md` §10.7)。只寫結構與職責,細節連到 `docs/` 對應章節。
> 標示「(規劃)」的目錄與檔案尚未建立,依 [ARCHITECTURE.md](ARCHITECTURE.md) §6–§7 實作後移除標示。

集團員工的單一入口:`/`(Vue 前端,含 `/login`)+ `/api/portal/*`(portal-api,Fastify,port 51271,經 Gateway BFF);登入與權限由 Gateway 提供,權限由 GigaItApp 設定。

---

## 1. 目錄

```
giga-Portal/
├─ AGENT.md                       AI 協作準則
├─ README.md                      專案簡介
├─ docs/
│  ├─ PRD.md                      產品需求(決策、FR、配合修改、待決事項)
│  ├─ ARCHITECTURE.md             架構、請求流程、權限流程、風格切換、部署
│  ├─ API.md                      portal-api 端點(草案)與使用的 BFF API
│  ├─ UI-GUIDE.md                 綠能 token、玻璃 / 扁平、全域元件差異、版面
│  ├─ PROJECT-MAP.md              本文件
│  ├─ Gherkin/                    驗收場景(目前皆 @wip)
│  └─ DevelopmentProcess/         修正紀錄(NewFeatures、FrontendCorrection、BackendCorrection、BugFix)
├─ frontend/(規劃)                Vue 3 + Vite(base /)
│  └─ src/
│     ├─ main.ts、App.vue、router.ts   進入點與路由(全域守衛:me → 應用層 → 頁面權限)
│     ├─ pages/                   auth/(登入、註冊、忘記密碼、設定新密碼)、home/、personal/、approval/、resources/、group/、NoAccess、403、404
│     ├─ layouts/                 AppLayout(側欄、頂列、應用切換)、TabbedPage、AuthLayout
│     ├─ ui/                      全域 UI 套件(自 GigaItApp 複製):G* 元件、tokens.css(綠能 × 玻璃 / 扁平)、圖表
│     ├─ composables/             useMe、usePermission、useTheme、usePaged、useAsync
│     └─ api/                     gateway.ts(web-kit 包裝)、portal.ts、型別、顯示格式
├─ backend/(規劃)                 portal-api(以 Gateway 後端樣本為基礎)
│  ├─ src/                        server、app、config、errors、openapi(x-permissions 含前端權限)、routes/、store/
│  └─ test/                       OpenAPI 自我檢查、內部 Token、資料層級
└─ deploy/(規劃)                  docker-compose(portal-api、spa-portal 發佈)
```

## 2. 分層(Gateway `AGENT.md` §10.7.2 TypeScript / Vue 列)

| 層 | 後端(規劃) | 前端(規劃) |
| --- | --- | --- |
| 介面 | `routes/*.ts`(schema、權限宣告) | `pages/`、`layouts/` |
| 核心邏輯 | 服務模組(公告可見範圍、資料層級) | `composables/`(me、權限過濾、主題) |
| 基礎設施 | `store/`(JSON → SQL Server)、SDK(內部 Token、自動註冊) | `api/gateway.ts`、`api/portal.ts` |
| 共用 / 工具 | `config.ts`、`errors.ts` | `ui/`、`api/format.ts` |

## 3. 主要流程

| 流程 | 經過 |
| --- | --- |
| 登入 | `pages/auth/Login.vue` → `api/gateway.ts` → Gateway `/api/auth/login` → 導回 `redirect` |
| 啟動與權限 | `router.ts` 守衛 → `composables/useMe` → `/api/auth/me` → 應用層(`apps`)→ 頁面 `meta.permission` → 側欄過濾 |
| 應用切換 | `layouts/AppLayout` 的 `GAppSwitcher` → `me.apps` → 整頁導向 `basePath` |
| 首頁 | `pages/home/` → `/api/portal/dashboard`(BFF 聚合)→ 各區塊 |
| portal-api 資料 | 頁面 → `api/portal.ts` → BFF(權限)→ portal-api `routes/` → `store/` |
| 權限設定 | 不在本專案:GigaItApp → BFF 管理 API(Gateway PRD §8.7) |

## 4. 要改什麼 → 看哪裡

| 要做的事 | 位置 |
| --- | --- |
| 新增頁面 / 選單 / Tab / 按鈕 | PRD §6.5 登記權限 → `backend/src/openapi.ts` 的 `x-permissions` → `frontend/src/router.ts` → `pages/`;步驟見 [UI-GUIDE.md](UI-GUIDE.md) §6 |
| 顏色 / 風格 | `frontend/src/ui/styles/tokens.css`(明暗 × 玻璃 / 扁平四組) |
| 應用切換 | `frontend/src/ui/components/GAppSwitcher.vue`(與 GigaItApp 同步) |
| portal-api 新 API | `backend/src/routes/`、`openapi.ts`,同步 [API.md](API.md) |
| 錯誤代碼 | `backend/src/errors.ts`(`PORTAL_`),同步 API.md §5 |
| 登入 / 權限規則 | Gateway 規格(`../giga-api-gateway-bff/docs/PRD.md` §8.2–§8.3),先改 Gateway |

## 5. 測試地圖

| 類型 | 位置(規劃) | 指令 |
| --- | --- | --- |
| 後端 | `backend/test/` | `backend/`:`npm test` |
| 前端邏輯 | `frontend/test/`(Vitest:權限過濾、redirect 驗證、主題) | `frontend/`:`npm test` |
| 驗收場景 | `docs/Gherkin/*.feature`(`@auto` 對應測試名稱) | 同上 |
| 經 Gateway | `deploy/e2e-smoke.sh` | 根目錄 |

## 6. 與設計原則的已知差異

| 項目 | 說明 |
| --- | --- |
| 尚無程式碼 | 本地圖為規劃;M1 建立框架後更新 |
| UI 套件為複製 | 與 GigaItApp 各有一份 `ui/`;Registry 上線後抽成共用套件(PRD Q5) |
