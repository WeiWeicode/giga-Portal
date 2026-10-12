# giga-Portal 交接(HANDOFF)

> 新的工作階段(人或 AI)接手時先讀這份,再讀 `AGENT.md`、`docs/PROJECT-MAP.md`。時程以 NexusPlan 甘特圖為準,本文件只記狀態。
> **最後更新:2026-10-12**(框架對齊 GigaItApp 完成並通過測試區驗收;下一階段:規劃 portal-api)

## 1. 目前狀態

| 項目 | 狀態 | 說明 |
| --- | --- | --- |
| 前端框架(`frontend/`) | ✅ 測試區運作中 | 對齊 GigaItApp:Gateway 單一入口登入、兩層選單 + Tab、`v-can` 按鈕、應用切換、通知鈴鐺 / 公告對話框、前端監控(giga-observe 節點 `portal-web`);見 `docs/FRAMEWORK-PLAN.md` |
| 選單 / Tab 權限資料 | ✅ 測試區已登記 | `deploy/gateway-rbac.yaml`:大項 `portal.group.*` 7、menu 44、tab 76、按鈕 3;CI `rbac-test` 套用。舊代碼已由 `deploy/sql/2026-10-12-portal-menu-realign.sql` 整理(使用者 2026-10-12 執行) |
| 角色 | ✅ | `employee`、`portal-approver`、`portal-manager`、`portal-esh-admin`、`portal-editor`、`it-app-user`;`it-admin`(GigaItApp yaml)可查看全部 menu + tab。**yaml 套用順序:Portal 先、GigaItApp 後** |
| 首頁 | ✅ 框架 | 版面依 `old_PortalSolar/MainFormX.aspx` 兩欄卡片;「最新公告」為 BFF 通知中心真實資料,其餘卡片標示「待串接」 |
| 各功能頁 Tab 內容 | ⏳ mock | 43 頁的 Tab 內容是排版用 mock(畫面不呼叫 API);串接真實資料屬 M4 / M5 |
| portal-api(`backend/`) | ⏳ 未開始 | **下一階段**,在新的討論串規劃 |

## 2. 下一階段:portal-api 規劃起點

已定的前提(PRD、AGENT.md §7):

- **定位**:一般下游後端,port **51271**,服務代碼 `portal-api`、系統代碼 `portal`、`gateway.project = giga-Portal`;只接受 BFF 轉入的 `/api/portal/*`(服務內 `/v1/*`),以 `@giganexus/backend-sdk` 驗證 `X-Internal-Token`,test / prod 啟動時**自動註冊** OpenAPI(路由 + `x-permissions`)為 Gateway 草稿。起點是 Gateway 後端樣本 `../giga-api-gateway-bff/samples/node-backend/`,不是複製 itapp-api。
- **權限**:portal-api 上線後,選單 / Tab / 按鈕代碼改由其 OpenAPI 根層 `x-permissions` 宣告(含 `kind`、`parent`、`sort`),`deploy/gateway-rbac.yaml` 只留角色;每支寫入 API 的權限 = 前端按鈕 `v-can` 代碼(PRD D4);啟動測試檢查前端路由用到的代碼都已宣告(PRD FR-3.4)。
- **只存入口網自己的資料**:公告圖片輪播、行政資源、新人導覽、常用功能與外部連結、個人提醒等;出勤、假期、薪資、簽核**不經 portal-api**,由各系統經 BFF 提供(Gateway `AGENT.md` §10.4)。
- **監控**:backend-sdk 的 monitor 送紀錄與心跳到 giga-observe(同 itapp-api,W9-3)。
- **部署**:`deploy/docker-compose.yml` 加 `portal-api`(加入 Gateway Docker 網路,別名 `portal-api:51271`),CI deploy-test 一併建置(`--pull`、npm Registry Token 同前端)。

要在規劃時決定的(PRD §12.2 待決):

| # | 問題 |
| --- | --- |
| Q8 / Q13 | 首頁與各頁真實資料來源(HRM:LOS + ERP、BPM、LearnDB、Budget、資產、ReleaseMail)由誰提供 API |
| Q14 | portal-api 資料庫沿用 PortalSolar(SQL Server,166)或新建並移轉;舊庫對照見 `docs/DATABASE-MAP.md` |
| Q12 | 薪資類頁面二次驗證(舊「薪資金鑰」或 Gateway step-up) |
| Q15 | 舊系統未對應頁面(中華郵政、員工認股、內部拍賣、電視看板、垃圾信回報、ISO 文件)是否保留 |
| 新增 | 首頁聚合路由 `/api/portal/dashboard`(FR-4.8)的區塊:待辦事項、個人秘書(BPM 待簽核數、個人連結)、公告輪播、集團動態圖片(圖片放 giga-file-service?) |
| 新增 | ESH 資料控管:API 層權限(目前只有選單 / Tab 控管,頁面為 mock)、`portal-esh-admin` 成員來源(舊系統 `LicenseManagerInfo` 有資料者即為證照管理員) |
| 新增 | 主管專區資料層級:後端依內部 Token 的部門(含下層)過濾;`portal-manager` 成員以 Gateway 指派規則(職級)設定 |

## 3. 已知注意事項

- 舊系統 `old_PortalSolar` 的「只隱藏選單、後端不設防」不可沿用:每支 API 都要權限代碼,資料依身分過濾(違反回 403 `PORTAL_DATA_ACCESS_DENIED`)。
- `deploy/gateway-rbac.yaml` 只做首次登記;已存在的權限名稱 / 上層 / 排序以 GigaItApp「選單管理」為準,要批次修改測試區既有代碼時用一次性 SQL(範例 `deploy/sql/`),由使用者以 DB 帳號執行。
- 寫入測試區資料庫或共用設定前先詢問使用者;含密碼的動作由使用者執行。
