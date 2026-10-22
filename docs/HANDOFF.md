# giga-Portal 交接(HANDOFF)

> 新的工作階段(人或 AI)接手時先讀這份,再讀 `AGENT.md`、`docs/PROJECT-MAP.md`。時程以 NexusPlan 甘特圖為準,本文件只記狀態。
> **最後更新:2026-10-23**(P2-2a 新人導覽、P2-2b 問卷調查、P3 首頁聚合與集團公告、**P4 待我簽核與表單下載**已實作於工作分支 `feature/portal-p2-2a-onboarding` → `feature/portal-p2-2b-qa` → `feature/portal-p3-home` → `feature/portal-p4-approval`,10/27 後依序合併驗收;P3 的 3691 作者解碼上線前需人資 / 法務確認;P4 合併前需在 191 執行 `04-bpm-readonly-p4.sql`;下一批 P5 主管專區)

## 1. 目前狀態

| 項目 | 狀態 | 說明 |
| --- | --- | --- |
| 前端框架(`frontend/`) | ✅ 測試區運作中 | 對齊 GigaItApp:Gateway 單一入口登入、兩層選單 + Tab、`v-can` 按鈕、應用切換、通知鈴鐺 / 公告對話框、前端監控(giga-observe 節點 `portal-web`);見 `docs/FRAMEWORK-PLAN.md` |
| 選單 / Tab 權限資料 | ✅ 測試區已登記 | `deploy/gateway-rbac.yaml`:大項 `portal.group.*` 7、menu 44、tab 76、按鈕 3;CI `rbac-test` 套用。舊代碼已由 `deploy/sql/2026-10-12-portal-menu-realign.sql` 整理(使用者 2026-10-12 執行) |
| 角色 | ✅ | `employee`、`portal-approver`、`portal-manager`、`portal-esh-admin`、`portal-editor`、`it-app-user`;`it-admin`(GigaItApp yaml)可查看全部 menu + tab。**yaml 套用順序:Portal 先、GigaItApp 後** |
| 首頁 | 🔨 P3 已實作(未合併) | 聚合路由 `GET /api/portal/dashboard`:待辦(BPM 待簽核 / 未結案、未填問卷、到職 90 天內新人導覽、今天到期提醒)、個人秘書(BPM 筆數、常用連結)、最新公告(通知中心 + 舊入口網公告唯讀,D-21)、公告輪播 / 集團動態(file-service 圖片,編輯者維護);單一區塊失敗只該區塊顯示「暫時無法取得」 |
| 各功能頁 Tab 內容 | ⏳ mock(逐批替換) | 已串接真實資料:P1 個人資訊、P2-1 行政資源、P2-2a 新人導覽、P2-2b 問卷調查(我的問卷 / 問卷維護)、P3 集團與公告(最新公告、行事曆、集團系統、3691 全民開講)、P4 表單與簽核(待我簽核三個 Tab、表單下載);其餘 Tab 仍是排版用 mock |
| portal-api(`backend/`) | ✅ 測試區運作中(部分) | P0、P1、P2-1 已驗收;**P2-2a 新人導覽、P2-2b 問卷調查已實作**(分支 `feature/portal-p2-2a-onboarding`、`feature/portal-p2-2b-qa`(由 2a 切出),未合併 / 未部署;合併後 CI rbac-test 套用 yaml,另需授予 file-service 權限;驗收步驟與待確認見 `docs/CONFIRM-NEEDED.md`);**P3 首頁聚合與集團公告已實作**(分支 `feature/portal-p3-home`,由 2b 切出;新 Drizzle migration `20261022134559_p3_home_group` 未對測試區執行;合併前需重跑主機 2 `host2-set-api-secrets.sh` 產生 secret `talk_author_key`,否則 CI 部署失敗;見 `docs/CONFIRM-NEEDED.md` P3);**P4 待我簽核與表單下載已實作**(分支 `feature/portal-p4-approval`,由 P3 切出;BPM 新增 `/bpm/handled`、`/bpm/requested?state=`、申請人欄位,所有 `/bpm/*` 套用 D-29 `BPM_COMPANIES`;表單下載新 migration `20261022224624_p4_forms` 未對測試區執行;合併前使用者需在 191 以 sa 執行 `backend/db/dba/04-bpm-readonly-p4.sql`(191 帳號目前是表層級 SELECT,含 Users.password);Q-D11 SP 定義取不到、Q-D12 待 BPM 管理者;見 `docs/CONFIRM-NEEDED.md` P4);下一批 P5,順序見 `docs/FEATURE-PLAN.md` §11 |

## 2. 下一階段:portal-api 規劃起點

> **2026-10-22 功能邏輯企劃:`docs/FEATURE-PLAN.md`**(每頁業務規則、不照抄清單、實作順序 P2-2a → P7;待決 Q-F1~Q-F10、Q-F12 已決為 D-21~D-29,剩 Q-F11 於 P7 前查舊報表);舊系統實際行為見 `../old_PortalSolar/docs/behavior/`。

> **2026-10-12 規劃 v0.2:`docs/PORTAL-API-PLAN.md`**(決議 D-1~D-7:人事 / TIPTOP 暫不做、顯示「系統轉移中」;220 舊庫複製到 `giganexus_gw_test` 的 `src_*`;新表放 `giganexus_gw[_test].portal`;2027-01 上線時正式區直接讀寫原庫)。
> 進度:`01-create-schema.sql` 已執行;`02-refresh-test-data.sql` 已複製完成(10 庫 899 表、0 失敗,`giganexus_gw_test` 的 `src_*`)。**P0 完成(2026-10-12)**:portal-api 測試區上線(容器 `giganexus-portal-portal-api-1`,機密 `/srv/giganexus/portal-secrets`,變數在 `portal.env`);`/api/portal/me` 已發佈(Gateway v43);人事 7 頁顯示「系統轉移中」。**P1-1(2026-10-12)**:年度必上課程、通勤調查(Google 地址轉座標)、個人基本資料其餘 Tab 轉移中;部署前主機 2 需重跑 `deploy/host2-set-api-secrets.sh` 補 `google_maps_api_key`(可留空,留空則通勤調查不能送出),否則 CI deploy-api-test 會失敗。**P1-2**:個人提醒(`portal.personal_note`,首個 Drizzle migration)、個人資產備註、郵件審核退場(GigaItApp yaml 同步移除;測試區代碼刪除 SQL 由使用者執行)。部署前使用者需以 `portal_migrate` 執行 `npm run db:migrate`(backend/.env)。P1-2 migration 已套用、整合測試通過。**P1-3**:BPM 待簽核 / 未結案(NaNa 唯讀,規則同 BPM 快速開發 6_todo_viewer);部署前使用者需在 191 執行 `backend/db/dba/03-create-bpm-readonly.sql`,再重跑主機 2 `host2-set-api-secrets.sh` 填 `portal_bpm_ro` 密碼(會補 `BPM_DB_HOST` / `BPM_WEB_URL`),否則 CI 缺 `bpm_db_password` 會失敗。**P1 已驗收**。**P2-1**:行政資源靜態內容照搬(舊站文件放 `frontend/public/legacy-docs/`)、總務專區、分機表、內部職缺;P2-1 已發佈驗收(2026-10-12)。**下一批 P2-2 問卷調查、新人導覽**,盤點見 PORTAL-API-PLAN §4「P2-2 盤點」;待決已由使用者決定(D-18~D-20,2026-10-12):先 P2-2a 新人導覽、再 P2-2b 問卷。Q15 已決(D-8:臨時服務有 URL 不在選單)。以下 Q14 等待決項以 PORTAL-API-PLAN 為準。

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
| Q14 | portal-api 資料庫沿用 PortalSolar(SQL Server,220)或新建並移轉;舊庫對照見 `docs/DATABASE-MAP.md` |
| Q12 | 薪資類頁面二次驗證(舊「薪資金鑰」或 Gateway step-up) |
| Q15 | 舊系統未對應頁面(中華郵政、員工認股、內部拍賣、電視看板、垃圾信回報、ISO 文件)是否保留 |
| 新增 | 首頁聚合路由 `/api/portal/dashboard`(FR-4.8)的區塊:待辦事項、個人秘書(BPM 待簽核數、個人連結)、公告輪播、集團動態圖片(圖片放 giga-file-service?) |
| 新增 | ESH 資料控管:API 層權限(目前只有選單 / Tab 控管,頁面為 mock)、`portal-esh-admin` 成員來源(舊系統 `LicenseManagerInfo` 有資料者即為證照管理員) |
| 新增 | 主管專區資料層級:後端依內部 Token 的部門(含下層)過濾;`portal-manager` 成員以 Gateway 指派規則(職級)設定 |

## 3. 已知注意事項

- 舊系統 `old_PortalSolar` 的「只隱藏選單、後端不設防」不可沿用:每支 API 都要權限代碼,資料依身分過濾(違反回 403 `PORTAL_DATA_ACCESS_DENIED`)。
- `deploy/gateway-rbac.yaml` 只做首次登記;已存在的權限名稱 / 上層 / 排序以 GigaItApp「選單管理」為準,要批次修改測試區既有代碼時用一次性 SQL(範例 `deploy/sql/`),由使用者以 DB 帳號執行。
- 寫入測試區資料庫或共用設定前先詢問使用者;含密碼的動作由使用者執行。
