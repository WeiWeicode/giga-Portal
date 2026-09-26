# GigaNexus 員工入口網 — AI 協作準則(AGENT.md)

> 本文件是 AI 程式助手(Claude、Gemini 等)在本專案中的行為準則,所有 AI 協作開發必須遵守。
> 通用準則(先思考、簡單優先、外科手術式修改、目標導向、失敗要明確說)同 `../giga-api-gateway-bff/AGENT.md` §1–§6;本文件列出本專案的部分。
> 本專案與 Gateway、GigaItApp 等專案放在**同一層目錄**、彼此相依;跨專案規則(相對路徑、用 BFF 路由表找 API、跨 repo 修改)見 `../giga-api-gateway-bff/AGENT.md` **§10 多專案工作區**。
> Gateway 的規格(`../giga-api-gateway-bff/docs/`)是上位規範;本文件與之不一致時,**先指出差異,不要自行決定以哪一邊為準**。

---

## 0. 專案定位(先讀)

| 項目 | 內容 |
| --- | --- |
| 做什麼 | 集團員工的**單一入口**:登入 / 註冊 / 忘記密碼頁、首頁、個人服務、簽核、公告與行政資源;所有應用(員工入口網、IT 管理系統…)的**應用切換起點** |
| 子路徑 | `/`(Gateway PRD §7.2.1);`/login`、`/register`、`/reset-password` 只由本專案提供。發佈到 `gw_www/portal` |
| 前端呼叫 | 一律同網域 `/api/*` 經 BFF(使用者 Cookie);頁面不直接 `fetch` |
| 自有後端 | `portal-api`(port **51271**,服務代碼 `portal-api`、系統代碼 `portal`),**一般下游後端**:只接受 BFF 轉入的 `/api/portal/*`,驗證 `X-Internal-Token`,test / prod 啟動時自動註冊(BACKEND-GUIDE §7.5) |
| 登入 | **Gateway 單一入口**(`/api/auth/*`,AD / 本機帳號);本專案不保存帳號、密碼、Session |
| 權限 | **Gateway BFF 是唯一來源**:應用 / 選單 / Tab / 按鈕權限依角色、部門(含下層)、職級(職稱選配)由 BFF 計算,**由 GigaItApp 設定**(Gateway PRD §8.3.1–§8.3.3);按鈕權限代碼 = 其呼叫的 API 權限代碼 |
| 開發專案名稱 | `giga-Portal`(`backend/package.json` 的 `gateway.project`,自動註冊時寫入 `x-gateway.project`) |
| 風格 | 淺綠 / 科技綠(綠能:太陽能、儲能);使用者可切換**玻璃 / 扁平**與**明亮 / 黑暗**(PRD §6.6、UI-GUIDE) |
| 狀態 | **M1 進行中**:`frontend/` 框架已建立(登入 / 註冊 / 忘記密碼頁、兩層選單與 Tab、權限過濾、應用切換、玻璃 / 扁平 × 明亮 / 黑暗);`backend/`(portal-api)自 M4 開始;需求見 `docs/PRD.md` |
| 目錄 | `frontend/`(Vue 3 + Vite,已建立)、`deploy/`(`spa-portal` 發佈、本機 Gateway 權限設定)、`docs/`;`backend/`(portal-api,Fastify)自 M4 建立;各目錄職責見 `docs/PROJECT-MAP.md` |

### 0.1 工作區與相依

| 兄弟專案 | 本專案用到的部分 | 規則 |
| --- | --- | --- |
| `../giga-api-gateway-bff/` | 登入 API、`/api/auth/me`(`permissions`、`apps`)、RBAC、路由表、Nginx `/`、`gw_www`、web-kit、Node SDK、後端樣本 | 上位規範;介面變更**先改 Gateway 規格**(§10.3) |
| `../GigaItApp/` | 設定本專案的選單 / Tab / 按鈕權限;應用切換的另一個應用(`/it/`) | 不呼叫 itapp-api;兩邊的應用切換外觀與行為一致(FRONTEND-GUIDE §7.4) |
| 其他系統(HRM、BPM…) | 出勤、假期、簽核等資料 | **一律經 BFF 路由表**找 API(Gateway `AGENT.md` §10.4),不直接連對方主機或資料庫 |

### 0.2 從 GigaItApp 複製框架時

本專案的前後端框架**複製自 `../GigaItApp/` 後分離**(PRD §8)。複製時:

- **要帶過來**:`frontend/src/ui/`(G* 元件、tokens、圖表)、`layouts/`(選單、TabbedPage)、`composables/`(useAsync、usePaged、主題)、路由結構、`v-can`、Prettier / tsconfig 設定。
- **不要帶過來**:GigaItApp 的自有登入(`backend/src/auth/`、登入頁、`it_at` Cookie、CSRF 實作)、`rbac/`(職級 × 部門)、`store/`(itapp.json)、`bff/`(服務帳號)、IT 專屬頁面。登入與權限改用 Gateway(web-kit、`/api/auth/me`)。
- 後端改以 **Gateway 後端樣本** `../giga-api-gateway-bff/samples/node-backend/` 為基礎(內部 Token、自動註冊、`gateway.project`),不是複製 itapp-api。
- 複製後在 `docs/DevelopmentProcess/` 記錄來源 repo 與 commit。

---

## 1. 先思考再動手

- **動手之前,先說明你的理解與假設**:用 1–3 句話摘要打算做什麼、為什麼這樣做。
- **有疑問先問,不要猜**;需求有多種解讀時,列出選項讓人類選擇。
- 規格以 Gateway `docs/` 與本專案 `docs/PRD.md` 為準;程式與規格不一致時先指出差異。

```
❌ BFF 還沒有 /api/auth/me 的 apps,先在前端寫死應用清單
✅ 「Gateway PRD v0.7 §8.3.3 的 apps 尚未實作(P2-3a)。M1 先以 permissions 是否含 it.app.access 推導,
    並標示為暫時做法;要這樣做,還是等 BFF?」
```

## 2. 簡單優先

- 用最少的程式碼解決當前問題,不寫「未來可能用到」的程式碼。
- 不要「順便」引入新套件或抽象層;新增套件前先說明理由(Gateway `docs/TECH-STACK.md` 已列的優先)。

## 3. 外科手術式修改

- **只改必須改的地方**;不順手整理、重構、改名不相關的程式碼,格式交給 Prettier。
- 需要改其他 repo(Gateway、GigaItApp)時,先說明要改什麼、為什麼,取得同意後再改,並在**那個 repo** 留紀錄(Gateway `AGENT.md` §10.5)。

## 4. 目標導向執行

- 先定義成功標準,**對應 `docs/PRD.md` 的需求編號(FR-x.y)與 `docs/Gherkin/*.feature` 場景**,自己迭代到達成為止;遇到阻塞(缺資訊、BFF 尚無 API)才停下來回報。
- 行為變更時同步更新:PRD 需求 → Gherkin 場景(`@auto` / `@manual` / `@e2e` / `@wip`)→ 測試;API 變更同步 `docs/API.md`,UI 元件變更同步 `docs/UI-GUIDE.md`,結構變更同步 `docs/PROJECT-MAP.md`。
- 有畫面的修改要用瀏覽器實際操作,**四種風格組合**(玻璃 / 扁平 × 明亮 / 黑暗)與手機寬度都要看。

## 5. 失敗要明確說

- **失敗就說失敗**,不能把「靜默跳過」包裝成「完成」;附上錯誤訊息與 `requestId`。
- 資料來源尚未提供真實 API 時使用模擬資料,**畫面與回應都要標示「模擬」**(PRD FR-4.9),不可假裝是真實資料。
- 不要刪除或放寬失敗的測試來讓測試通過。

---

## 6. 部署區與設定

| 項目 | `dev`(本機開發) | `test`(測試區) | `prod`(正式區) |
| --- | --- | --- | --- |
| `GW_ENV`(portal-api) | `dev`:不自動註冊 | `test`:啟動時註冊為測試區 Gateway 草稿 | `prod`:註冊為正式區草稿 |
| API Key | `GW_API_KEY` 或 `GW_API_KEY_FILE` | `GW_API_KEY_FILE` | **只接受** `GW_API_KEY_FILE`(Docker secret) |
| 前端開發 | Vite proxy `/api` → 本機 Gateway(`https://localhost`) | 建置映像發佈到 `gw_www` | 同左 |

- 部署區只有這三個值;缺少必要設定時**啟動失敗**,不要加預設值繞過檢查(SDK `loadGatewayEnv`)。
- Port `51271`(BACKEND-GUIDE §3.3 已登記,規劃中);不可自行換 port。

---

## 7. 後端規則(`backend/`,portal-api)

| 項目 | 規範 |
| --- | --- |
| 基礎 | Gateway 後端樣本(`@giganexus/backend-sdk`):`createTokenVerifier` 驗證 `X-Internal-Token`,身分取自 Token(工號、部門、角色),**不信任瀏覽器送來的身分欄位** |
| 路徑 | 服務內 `/v1/{resource}`,對外 `/api/portal/{resource}`(BACKEND-GUIDE §6) |
| OpenAPI | 每個 operation:`operationId`、`summary`、`description`、`x-permission`、`x-gherkin`;根層 `x-permissions` **連同前端的選單 / Tab / 按鈕權限一起宣告**(`kind`、`parent`、`sort`,BACKEND-GUIDE §6.1),由啟動測試檢查前端路由 meta 用到的代碼都已宣告(PRD FR-3.4) |
| 寫入 API | 一律宣告權限代碼,且等於前端對應按鈕的 `v-can` 代碼(PRD D4) |
| 分頁 | 清單 API 由後端篩選與分頁(`{ items, total, page, pageSize }`) |
| 錯誤 | `{ code, message, requestId, details? }`,代碼一律 `PORTAL_` 開頭,登記於 `src/errors.ts` 與 `docs/API.md` |
| 資料 | 只存入口網自己的資料(公告、行政資源、新人導覽、常用功能與外部連結設定);出勤、假期、簽核等**不經 portal-api**,前端直接呼叫各系統經 BFF 的 API |
| 資料層級 | 依內部 Token 的 `dept`、`roles` 過濾;違反回 403 `PORTAL_DATA_ACCESS_DENIED` |

---

## 8. 前端規則(`frontend/`)

| 項目 | 規範 |
| --- | --- |
| 框架 | Vue 3 Composition API(`<script setup lang="ts">`)+ Vite + vue-router(History 模式,`base: '/'`) |
| 登入與權限 | 一律經 Gateway web-kit(`useAuth()`、`can()`;CSRF、Token 自動更新);啟動時取得 `/api/auth/me`;**不存 Token、不解析 JWT** |
| 應用切換 | 頂列帳號旁,列出 `me.apps`(FRONTEND-GUIDE §7.4);只有一個應用時不顯示;元件外觀與 GigaItApp 一致 |
| 應用層守衛 | 沒有 `portal.app.access` → 顯示無權限頁(含登出),**不可導回 `/` 造成迴圈** |
| 選單 / Tab / 按鈕 | 路由 `meta.permission`(menu / tab 代碼)、Tab `permission`、按鈕 `v-can`;沒有可見功能的群組不顯示;直接輸入網址無權限顯示 403 |
| `redirect` 參數 | 登入後導回前只接受同網域相對路徑(以 `/` 開頭、不是 `//`),否則導回 `/` |
| **UI 全域套用** | 基本元件一律用 `src/ui/` 的 `G*` 元件;頁面不自己刻按鈕 / 卡片 / 表格 / 表單 / 對話框樣式 |
| **顏色與風格** | 只用 `tokens.css` 的 CSS 變數;新增顏色時**明亮 / 黑暗 × 玻璃 / 扁平**都要定義;元件不判斷目前風格,差異只放在 token(`data-theme`、`data-style`) |
| 圖示 | `<GIcon name="...">`,新圖示在 `GIcon.vue` 的 `ICONS` 登記 |
| 回饋 | `toast.*` / `await confirm({...})`;錯誤顯示 `describeError(e)`(含 requestId) |
| 懶加載 | 頁面 `() => import()`;清單 `usePaged`;首屏以外 `<GLazy>`;Tab 切換才載入;首頁用聚合路由一次取得(PRD FR-4.8) |
| 版面 | 375px 不可整頁水平捲動;表格在卡片內捲動 |
| 禁止 | Token / 密碼存 localStorage、sessionStorage;寫死主機與 port;`/` 開頭的寫死資源路徑(用 `import.meta.env.BASE_URL`);前端寫死應用清單或權限 |

新增全域元件時,同步更新 `src/components.d.ts`。

---

## 9. 專案慣例

| 項目 | 規範 |
| --- | --- |
| 語言 | TypeScript(ESM、`strict`、`noUncheckedIndexedAccess`) |
| 命名 | 變數 / 函式 `camelCase`,型別 / 元件 `PascalCase`,常數 `UPPER_SNAKE_CASE`;後端檔名 `kebab-case.ts`,Vue 元件 `PascalCase.vue` |
| 格式 | Prettier(單引號、`printWidth` 160、尾逗號) |
| 註解語言 | 繁體中文,註明對應規格章節(例 `(PRD FR-2.4)`、`(Gateway PRD §8.3.3)`) |
| 測試帳號 | 使用本機 Gateway 的種子帳號(虛構資料);**不可在瀏覽器輸入真實帳密** |

### 9.1 專案地圖與設計原則

- **專案地圖:`docs/PROJECT-MAP.md`**。開發新功能後,在同一個變更內更新,並更新開頭的「最後更新」(Gateway `AGENT.md` §10.7.1)。
- 核心設計原則依 Gateway `AGENT.md` §10.7.2 的 **TypeScript / Node.js**(`backend/`)與 **Vue**(`frontend/`)兩列:

| 原則 | 本專案做法 |
| --- | --- |
| 職責分離 | 後端:`routes/` 只做 schema 驗證與權限宣告,邏輯在服務模組,資料在 `store/`;前端:`pages/` 只組合畫面,邏輯在 `composables/`,HTTP 只在 `api/`,共用元件只在 `ui/` |
| 原始碼根目錄 | `backend/src/`、`frontend/src/`;建置只取 `src/` |
| 集中測試 | `backend/test/`、`frontend/test/`(Vitest,composables 與權限過濾邏輯) |

### 常用指令

| 位置 | 指令 | 說明 |
| --- | --- | --- |
| `frontend/` | `npm run dev` | http://localhost:5179/,proxy `/api` 經本機 Gateway(`https://localhost`);web-kit 以 alias 取自 `../giga-api-gateway-bff/web-kit/src` |
| `frontend/` | `npm run typecheck` / `npm test` / `npm run build` | 型別 / Vitest / 建置 |
| 根目錄 | `sh deploy/apply-gateway-dev-rbac.sh` | 把入口網的權限代碼與測試角色套用到本機 Gateway(`deploy/gateway-dev-rbac.yaml`;Gateway DB 重建後需再跑) |
| `backend/`(M4 起) | `npm run dev` / `npm test` / `npm run typecheck` | portal-api 開發 / 測試 / 型別 |
| 根目錄(M4 起) | `docker compose -f deploy/docker-compose.yml up -d --build --wait portal-api` | 部署後端到本機 Gateway 網路 |
| 根目錄 | `docker compose -f deploy/docker-compose.yml run --rm --build spa-portal` | 發佈前端到 `/`(`... run --rm spa-portal rollback portal` 回滾) |

---

## 10. 參考文件

| 文件 | 路徑 | 說明 |
| --- | --- | --- |
| **產品需求** | `docs/PRD.md` | 已定決策、需求編號 FR-x.y、配合修改(Gateway G1–G7、GigaItApp I1–I5)、待決事項 |
| 專案地圖 | `docs/PROJECT-MAP.md` | 目錄與檔案職責、主要流程;**開發新功能後必須更新** |
| 架構 | `docs/ARCHITECTURE.md` | 決策、請求流程、權限流程、風格切換、部署 |
| API | `docs/API.md` | portal-api 端點與本專案使用的 BFF API |
| UI 規範 | `docs/UI-GUIDE.md` | 綠能 token、玻璃 / 扁平、全域元件、版面、應用切換 |
| 驗收場景 | `docs/Gherkin/*.feature` | 標籤慣例見 `docs/Gherkin/README.md` |
| Gateway 開發手冊 | `../giga-api-gateway-bff/AGENT.md` | 通用準則;§10 多專案工作區 |
| Gateway 規格 | `../giga-api-gateway-bff/docs/PRD.md` | §7.2.1 子路徑、§8.2 登入、§8.3.1–§8.3.3 權限與應用、§8.7 管理 API |
| 前端規範 | `../giga-api-gateway-bff/docs/FRONTEND-GUIDE.md` | §7 登入與權限、§7.4 應用切換、§7.5 選單 / Tab / 按鈕 |
| 後端規範 | `../giga-api-gateway-bff/docs/BACKEND-GUIDE.md` | §3.3 port、§4 內部 Token、§6.1 OpenAPI、§7.5 自動註冊 |
| 後端樣本 | `../giga-api-gateway-bff/samples/node-backend/` | portal-api 的起點(含 AGENT.md §0 專案命名) |
| 框架來源 | `../GigaItApp/` | 前端 UI 套件、版面、composables 的來源(§0.2) |

---

## 11. 修正紀錄

新紀錄加在 `docs/DevelopmentProcess/` 對應檔案的最上方:`NewFeatures.md`(新功能)、`FrontendCorrection.md` / `BackendCorrection.md`(修改)、`BugFix.md`(錯誤修正)。格式:

```
## YYYY-MM-DD 標題
- 內容:做了什麼、為什麼(對應 PRD / Gherkin)
- 檔案:改了哪些檔案(有更新專案地圖時列出 docs/PROJECT-MAP.md)
- 驗證:執行了哪些指令、結果;未驗證的項目要寫明
```
