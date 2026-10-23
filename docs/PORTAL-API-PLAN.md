# portal-api 規劃

> 版本:v0.13(2026-10-23,**P7 臨時服務實作完成待驗收**(同意書一頁承接、員工持股、中華郵政、內部拍賣、電視看板、ISO 文件庫;隱藏 = Gateway 目錄 portal.group.services + 前端不列);**P6 ESH 證照管理實作完成待驗收**(公司範圍 LicenseManagerInfo、下次複訓日後端計算、複訓通知排程 + dry-run / Gateway 寄送、化學品 BPM 唯讀檢視同步);**P5 主管專區實作完成待驗收**(範圍 Token 部門含下層、portal-manager-all、D-26 預算);**P4 待我簽核與表單下載實作完成待驗收**(D-29 全部 BPM API 套用);P3 首頁聚合與集團公告實作完成待驗收;P2-2b 問卷調查實作完成待驗收;P2-2a 新人導覽實作完成待驗收;功能企劃決議 D-21~D-29;此前 P0 完成、P1 決議 D-9~D-13、P2-2 決議 D-18~D-20)。時程以 NexusPlan 甘特圖為準,本文件不列日期。
> 前提見 `docs/HANDOFF.md` §2、`docs/PRD.md` §6.7;舊庫對照見 `docs/DATABASE-MAP.md`(本文件 §1 補充盤點發現)。

## 0. 已定決議(2026-10-12 起)

| # | 決議 |
| --- | --- |
| D-1 | **人事暫不做**:人事系統轉移中、不再走鼎新 TIPTOP。凡資料來自 TIPTOP(人事、出勤、薪資、資產)的頁面或欄位,前端顯示「系統轉移中」,不呈現資料;**來源在 220 或 BPM 能帶出的就照常帶出**(以欄位為單位判斷) |
| D-2 | 來源在 10.10.130.220 的舊庫,複製到 `giganexus_gw_test`,**一個來源 schema 一個目標 schema**(`src_portalsolar`、`src_los`…);**先實作這一段** |
| D-3 | 複本**全部原樣複製**(含個資與登入表);`giganexus_gw_test` 開發與測試共用帳密,複本不得匯出到其他地方 |
| D-4 | 入口網新建的表:正式 `giganexus_gw.portal`、測試 `giganexus_gw_test.portal`、整合測試 `giganexus_gw_poc_test.portal`(比照 `file_svc`;舊庫不做 DDL) |
| D-5 | 員工 / 部門身分以 **Gateway 內部 Token** 為準(工號、部門含下層、職級);LOS 只在舊表需要對照時查(部門名稱、主管工號等) |
| D-6 | BPM 相關邏輯參考 `D:\檔案分享\Tools\BPM快速開發`(特別是 `6_todo_viewer`:待簽核 / 我申請的 / 經辦過、表單內容、簽核歷程、BPM 深連結) |
| D-7 | **新舊系統並行**:2026-12 設定正式區、2027-01 正式上線,正式區直接讀寫**原本的資料庫與資料表**(PortalSolar 等,與舊系統共用) |
| D-8 | 舊系統未對應頁面(員工認股、中華郵政、內部拍賣、電視看板、垃圾信回報、ISO 文件,及有日期的同意書)多為**臨時服務**:人事發信附 URL,員工點連結進入。新入口網**要有 URL 路徑,但不出現在選單**(P7) |
| D-9 | 年度必上課程**完全照舊規則**(公司別 DS11 / DS15 / DS36、12 門課與各自適用對象、工安 5 門未完成各扣 2 分;舊主管職稱清單的漏逗號也照舊) |
| D-10 | 個人基本資料**只開「溫室氣體盤查員工通勤調查」**;所得稅扶養眷屬、基本資料異動申請等人資匯入 TIPTOP 的流程與其餘 Tab 系統轉移中(Tab 層級) |
| D-11 | 通勤調查送出時由 portal-api 呼叫 Google Geocoding 轉經緯度(同舊系統,解析不到不能送出);金鑰為主機 2 Docker secret。與舊系統的刻意差異:GoogleAddress 用正向查詢的 formatted_address(舊系統另以經緯度反查,多一次計費);同一人 10 秒內不能重複送出、地址未變沿用既有座標 |
| D-12 | 個人資產明細**保留 PortalSolar 的備註與照片**(資產清單本身在 TIPTOP;只列已有備註的資產) |
| D-13 | BPM 另建唯讀帳號 `portal_bpm_ro`(只 GRANT 用到的表),測試區 191 由使用者以 sa 執行 |
| D-14 | 行政資源的靜態內容(集團統編、人資專區、聯絡窗口、總務服務項目 / 申請專區 / 湖口廠停車)**照搬舊頁**(改內容要改程式,同舊系統);舊站 166 的 30 個 PDF / 圖片經使用者同意下載到 `frontend/public/legacy-docs/`(網址 `/legacy-docs/…`,`/docs` 為 Gateway 保留路徑),不需登入可讀(同舊站);**含人員姓名的主管職務代理人名單例外**,放 `backend/assets/hr/` 經 portal-api 驗證後下載(`GET /hr/manager-agents`);Gateway 送 X-Frame-Options DENY,PDF 以新分頁開啟;舊頁已隱藏的「宿舍」說明不搬 |
| D-15 | 內部職缺**不寄信**(應徵 / 推薦請洽人資);維護由舊系統寫死的兩個工號改為按鈕權限 `portal.job.edit`(角色 portal-editor) |
| D-16 | 總務專區「個人資產明細」沿用個人資產備註;「外送資產明細」(TIPTOP)系統轉移中 |
| D-17 | 分機表更新本人分機**不寄**「人員分機異動通知」給總機(舊系統會寄);異動仍記錄於 NotesPhoneTemp;分機表不回傳 Email |
| D-18 | 問卷作答**人事屬性留空**:`QAAnnualC` 的 `CPF*` / `CPK02` 寫 NULL,即舊程式查不到 TIPTOP 時的寫法(`QuestView.aspx.cs` 533 行 else 分支:`INSERT INTO QAAnnualC (QANo, LgNo, No, Answer, QATimes)`);統計依人事屬性分組的部分顯示「系統轉移中」 |
| D-19 | 問卷建立 / 維護 / 統計改按鈕權限 `portal.qa.edit`(角色 portal-editor;舊系統任何人都能建),只看自己建立的(`CLgNo` = 本人);舊系統寫死 S094009 的「代查他人問卷」改為 `portal.qa.admin`(portal-editor) |
| D-20 | 新人驗收測驗**照搬**:20 題是非題、每題 5 分、滿分才通過並寫入 `HRNewPtest`(先刪本人舊紀錄,同舊系統),不及格不寫;正解只放 portal-api、由後端計分;不寄通知信(舊系統已註解) |
| D-21 | (2026-10-22,Q-F1)並行期舊站 `ContentX` 公告**唯讀併入**首頁「最新公告」,標來源「舊入口網」;舊站下線後移除 |
| D-22 | (Q-F3)舊站以 DES 金鑰跳轉的外部系統(訂便當、E-Learning、ERMS、福委會、WebApp、NotesApp、年考核、環安衛資料庫、好書分享、健康系統)過渡期**只顯示「DES 跳轉(待重構)」,無任何功能**(不產生 token、不帶連結)。使用者向主管取得原始檔後再分:小功能(如訂便當、福委會)日後在 giga-Portal 實作;邏輯複雜者(如 E-Learning、預約資源)為獨立應用 |
| D-23 | (Q-F8)3691 作者以伺服器密鑰加密(secret),解碼需 `portal.talk.reveal` + 核准文號 + 稽核紀錄;**實作前需人資 / 法務確認** |
| D-24 | (Q-F6)首頁 / 待我簽核不提供「核准 / 退回」,改「前往簽核」深連結到 BPM(維持 D-6) |
| D-25 | (Q-F7)表單下載:編輯者上傳到 giga-file-service、分類維護(`portal.forms.edit`,portal-editor) |
| D-26 | (Q-F10)部門預算可看範圍沿用 Budget 庫 `UserInfo.Competence`(以 Token 工號查),且須同時具 `portal-manager` |
| D-27 | (Q-F2、Q-F5、Q-F9、Q-F12)**退場 / 不做**:薪資金鑰重置、新人缺繳資料 HRNewPay、資安演練點擊紀錄(spam / spamview);舊站高風險頁(ForgetPassword、LoginNewAccount、EipLogin 等)不在 giga-Portal 範圍,另行通報 IT |
| D-28 | (Q-F4)並行期新建問卷的題目圖片存 file-service,舊站顯示不出,接受 |
| D-29 | (Q-D13)BPM 查詢**限定碩禾系**:只有 Token 公司屬碩禾系者才查 NaNa(公司清單以設定提供,不寫死),其他公司本機帳號回空清單;修正 P1-3 既有查詢,隨 P4 一併實作(P3 首頁聚合已先套用:設定 `BPM_COMPANIES`)。**P4 已實作:所有 `/bpm/*` 回 `applicable`** |

## 1. 盤點發現(補充 DATABASE-MAP)

以舊程式碼掃描,**尚未連線資料庫確認**;確認用 `deploy/sql/2026-10-12-portal-db-inventory.sql`,或直接看 `02-refresh-test-data.sql` dry run 的 ①–③。

| # | 發現 | 影響 |
| --- | --- | --- |
| 1 | Oracle ERP(TIPTOP)經 220 的連結伺服器 `OLDERPDB` / `ERPSOURCE` 讀取,約 300 處;DATABASE-MAP §3 寫「已停用」不正確 | 依 D-1 不做;凡 `OPENQUERY` 取得的欄位 = 系統轉移中 |
| 2 | DATABASE-MAP 未列、舊程式以三段式名稱引用的庫:dry run 確認 **220 有** `Safety`、`welfare_s`、`MisDb`、`Notes`、`GscSystem`、`NotesAppDb`、`LearnDB`;**220 沒有** `MBO`、`ReleasemailDB`、`WPORTALZ`、`HEALTH`、`EF_DB` | 220 有的照 D-2 複製;沒有的見 Q-D9、Q-D10 |
| 3 | `MBO`:舊程式連線字串指 220,但 220 已無此庫 | 新入口網沒有對應頁面,不處理 |
| 4b | `ReleasemailDB`:舊程式經連結伺服器 `OPENQUERY(RMailDB, …)` 讀取,不在 220 | 郵件審核已不實施,頁面退場(Q-D9) |
| 4 | BPM 簽核資訊呼叫 `LOS.dbo.SP_EFInfoUnProcess_ByUserID_Solar`(資料在 NaNa) | 預存程序不複製;改以 BPM 工具包 `6_todo_viewer` 的查詢直讀 NaNa(§3.3) |
| 5 | HANDOFF / PRD Q14 寫 PortalSolar 在 166;實際為 **220**(166 是附件檔案主機) | 已修正 HANDOFF |

## 2. 測試資料複製(P0,先實作)

腳本:`backend/db/dba/01-create-schema.sql`(帳號,使用者執行一次)、`backend/db/dba/02-refresh-test-data.sql`(複製 / 重置,可重跑)。

| 項目 | 做法 |
| --- | --- |
| 方式 | 來源與 `giganexus_gw_test` 同在 220 → 同執行個體 `SELECT * INTO` 跨庫複製,不必匯出匯入 |
| 命名 | `PortalSolar.dbo` → `src_portalsolar`;非 dbo 加 schema 名(`LearnDB.learn` → `src_learndb_learn`) |
| 帶過去的 | 結構、資料、主鍵 / 唯一 / 一般索引、預設值、CHECK;識別欄重新校正 |
| 不帶的 | 外部索引鍵、觸發程序、檢視、預存程序、函數(腳本結果 ④ 列出有 FK / 觸發程序 / 計算欄的表,portal-api 寫入這些表時要特別確認行為與正式區一致) |
| dry run 結果(2026-10-12) | 10 個庫、899 張表、約 2,535 萬列、**約 3.6 GB**(Budget 1.67 GB / 1,480 萬列、PortalSolar 0.97 GB、LOS 0.46 GB、MisDb 0.20 GB、Notes 0.19 GB,其餘 < 0.1 GB);沒有單表超過 1 GB,全部複製 |
| 範圍控制 | 先 `@dry_run = 1` 看計畫;單表超過 `@max_table_mb`(預設 1 GB)略過,要複製加入 `@force`;`@skip` 排除;`@only_db` 只重跑某一庫 |
| 授權 | 新建的 `src_*` schema 授權給 `portal_app_role` 讀寫;`portal_app` 不能動 `gw`、`file_svc` |
| 重置 | 重跑 = 以正式資料覆蓋測試區(測試區寫入會消失);Gateway `reset-test-db` 只清 `gw`、`drizzle`,不影響 `src_*`、`portal` |

## 3. portal-api 設計重點

### 3.1 資料來源前綴(測試 / 正式同一份程式)

portal-api 連 `giganexus_gw[_test]`,舊表一律以**設定的前綴 + 表名**組成三段式名稱:

| 來源 | 測試區 | 正式區 |
| --- | --- | --- |
| `PORTAL_SRC_PORTALSOLAR` | `giganexus_gw_test.src_portalsolar` | `PortalSolar.dbo` |
| `PORTAL_SRC_LOS` | `giganexus_gw_test.src_los` | `LOS.dbo` |
| 其他(Safety、ReleasemailDB…) | 同規則 | 同規則 |
| 新表 | `portal`(連線庫本身) | `portal` |

- 前綴只從設定讀、啟動時以白名單格式檢查(`^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$`),不接受請求參數;值一律參數化。
- **並行期相容(D-7)**:舊表不改結構;寫入舊表的欄位與值要與舊系統寫法一致(旗標、日期、建立者欄位…),每支寫入 API 在 Gherkin 寫明「舊系統讀得到」的場景。
- 舊程式的觸發程序 / 預存程序如有寫入副作用,新程式不可依賴複本(複本沒有),要在正式區行為確認後才上線。

### 3.2 「系統轉移中」(D-1)

| 情況 | 做法 |
| --- | --- |
| 整頁資料都來自 TIPTOP | 前端不呼叫 API,頁面顯示「系統轉移中」(共用元件);選單與權限保留 |
| 部分欄位來自 TIPTOP | API 照常回傳 220 / BPM 的欄位,TIPTOP 欄位回 `null`,並帶 `unavailable: ["hr"]`;前端該欄位顯示「系統轉移中」 |

### 3.3 BPM(D-6)

- 參考 `BPM快速開發/6_todo_viewer`:待辦以 `LocalToDoWorkItem` 定位(不用 `WorkItem.performerOID`)、`LocalRelevantData` 單獨查詢再 `JOIN FormInstance`、同人多公司帳號、表單欄位中文名由 `FormDefinition.defSerialize` 解析並快取、深連結依主機產生(簽核 `PerformWorkFromMail`、追蹤 `TraceProcessMain`)。
- 只用 SQL **唯讀**查 NaNa(不呼叫 SOAP、不寫入);測試區 191、正式區 190。
- 帳號:比照 file-service 的 `file_bpm_ro`,另建 `portal_bpm_ro`,**只對用到的表 GRANT SELECT**(不給 `db_datareader`);P1 確定查詢後再出建帳號腳本。

### 3.4 骨架

- 起點 `../giga-api-gateway-bff/samples/node-backend/`(Fastify、`@giganexus/backend-sdk` 驗 `X-Internal-Token`、自動註冊 OpenAPI + `x-permissions`、monitor 送 giga-observe);程式放 `backend/`。
- 資料存取:舊表與 NaNa 用 `mssql` 參數化查詢;`portal` schema 新表用 Drizzle(版本同 Gateway / file-service,migration 紀錄表放 `portal`)。
- 權限:每支 API 一個代碼,寫入 API = 前端 `v-can` 按鈕代碼;資料一律以內部 Token 的工號 / 部門過濾,違反回 403 `PORTAL_DATA_ACCESS_DENIED`。
- 部署:`deploy/docker-compose.yml` 加 `portal-api`(Gateway Docker 網路別名 `portal-api:51271`)、CI deploy-test 建置(`--pull`)。

## 4. 分階段工作項目

每批:Gherkin → API + 測試 → 前端 Tab 換成真實資料或「系統轉移中」→ 測試區給使用者驗收,同時開始下一批。

### P0 測試資料與骨架

| 項目 | 內容 | 狀態 |
| --- | --- | --- |
| P0-1 | `01-create-schema.sql`:`portal` schema、`portal_app` / `portal_migrate`(使用者執行) | ✅ 2026-10-12 使用者執行 |
| P0-2 | `02-refresh-test-data.sql`:dry run 確認範圍 → 實際複製 | ✅ 2026-10-12 使用者執行:10 庫 899 表全部成功,0 失敗;只有 `PortalSolar.dbo.TEST`(測試表)有觸發程序,無 FK / 計算欄 → 複本與正式區寫入行為一致 |
| P0-3 | `backend/` 骨架、健康檢查、自動註冊、monitor、CI / compose 部署到測試區 | ✅ 2026-10-12 測試區上線(e0ebbe3):`/readyz` SQL 與 11 個來源 ok;`/api/portal/me` 經 Gateway v43 發佈並由使用者驗證 |
| P0-4 | 共用:來源前綴設定、身分(內部 Token)、「系統轉移中」前端元件 | ✅ 完成(`db/sources.ts`、`identity.ts`、前端 `MigratingPage` + `composables/migrating.ts` 7 頁,測試區使用者驗證);部分欄位的 `unavailable` 標示隨 P1 頁面實作 |

### P1 個人資訊

| 頁面 | 資料來源 | 處理 |
| --- | --- | --- |
| 個人提醒 | `portal.personal_note`(新表,Drizzle migration) | **P1-2 完成**(`/notes` CRUD;舊 PCalendar 自 2021 未使用,不沿用) |
| BPM 簽核資訊 | NaNa(191 / 190) | **P1-3 完成**:`GET /bpm/pending`(待簽核,LocalToDoWorkItem 狀態 0/1,97 標示異常)、`GET /bpm/requested`(我申請的未結案,分頁);深連結開 BPM 原畫面;帳號 `portal_bpm_ro`(`backend/db/dba/03-create-bpm-readonly.sql`) |
| 郵件審核資訊 | `ReleasemailDB`(經連結伺服器 `RMailDB`) | **退場**(Q-D9,P1-2):前端路由、Portal 與 GigaItApp 的 yaml 已移除;測試區代碼以 `deploy/sql/2026-10-12-portal-release-mail-remove.sql` 刪除 |
| 年度必上課程 | LOS `EmployeeInfo`、`Safety` 名單、LearnDB 完訓紀錄 | **P1-1 完成**(D-9;`GET /courses/required`) |
| 個人基本資料 | TIPTOP `cpf_file` + PortalSolar `CpfExInfo` | **P1-1 完成**:通勤調查(`GET / PUT /commute`,D-10 / D-11);其餘 5 個 Tab 系統轉移中 |
| 個人資產明細 | PortalSolar `PersonalPropertyInfo`(備註、照片) | **P1-2 完成**:保管資產清冊 Tab 顯示備註(`GET /assets/notes`,唯讀);資產移轉歷程 Tab 轉移中;照片待 giga-file-service F4 |
| 自助查詢、薪資獎金、年度所得、薪資異動、出勤異常、出勤時數異常回報、薪資金鑰重置 | TIPTOP | **整頁系統轉移中** |

### P2 行政資源

| 頁面 | 資料來源 | 處理 |
| --- | --- | --- |
| 集團統編、人資專區(團險 / 主管職務代理人)、聯絡窗口 | 舊頁靜態內容 + 166 文件 | **P2-1 完成**(D-14) |
| 總務專區 | 服務項目 / 申請專區 / 停車:靜態;個人資產:PersonalPropertyInfo 備註;外送資產:TIPTOP | **P2-1 完成**(D-14、D-16) |
| 分機表 | PortalSolar `NotesPhone`(查詢)、`NotesPhoneTemp`(異動紀錄) | **P2-1 完成**:`GET /directory`、`PUT /directory/me/phone` |
| 內部職缺 | PortalSolar `EnlistTB`(2023-06 後無開放職缺) | **P2-1 完成**(D-15):`/jobs` CRUD |
| 問卷調查 | PortalSolar `QAAnnual*`(寫入)、LOS `DeptInfo` / `EmployeeInfo`(唯讀) | **P2-2b 已實作(2026-10-22,工作分支 `feature/portal-p2-2b-qa`,未合併、未上測試區)**:`/qa/pending*`(待填、填答、送出)、`/qa/surveys*`(本人出題 CRUD、複製、統計、Excel 匯出)、`/qa/admin/surveys*`(代管)、`/qa/org/departments`、`/qa/org/job-tier`(待 Gateway 職級介面,目前 503);題目圖片經 file-service(Item = `#題號`);待確認見 `CONFIRM-NEEDED.md` P2-2b |
| 新人導覽 | PortalSolar `NewPepR`、`HRNewPtest`(寫入) | **P2-2a 已實作(2026-10-22,工作分支 `feature/portal-p2-2a-onboarding`,未合併、未上測試區)**:`GET /onboarding/status`、`POST /onboarding/read`、`GET / POST /onboarding/quiz`;小叮嚀內容照搬到前端;待確認見 `CONFIRM-NEEDED.md` |

#### P2-2 盤點(2026-10-12;P2-2a、P2-2b 已於 2026-10-22 實作)

| 舊程式 | 行數 | 資料(測試區複本筆數) | 重點 |
| --- | --- | --- | --- |
| `QA/MyQAList.aspx(.cs)` | 627 | `QAAnnual`(204,問卷主檔:QANo、名稱、對象部門 `Kdept` / 人員 `Kpep`、起訖日、IsActive)、`QAAnnualB`(1,701,題目:Type、No、LimNo、Item、SubItem、IsWrite)、`QAAnnualC`(176,141,作答:QANo、LgNo、No、Answer + `CPF03/04/19/24/70/14/31/29/34`、`CPK02` 人事屬性、QATimes)、`QAAnnualD`(85,題目圖片) | 同仁可填的問卷清單與填答 |
| `QA/QuestView.aspx(.cs)` | 635 | 同上 + NaNa `Users` / `OrganizationUnit` / `FunctionDefinition`(OPENQUERY) | 填答畫面;作答時寫入 TIPTOP 人事屬性(CPF*),人事轉移中**取不到** |
| `QA/QuestSetting.aspx(.cs)` | 1,128 | 同上 + LOS `DeptInfo` / `EmployeeInfo`、`PromoteLevelInfo`、`welfare_s.WelfareCompanyInfo` | 問卷維護(建問卷、題目、對象、統計);舊系統寫死管理者,新版改按鈕權限 |
| `HRnewPep01.aspx(.cs)` | 48 | `NewPepR`(2,786:LgNo、LgTime) | 新人導覽閱讀紀錄 |
| `HRnewPep05.aspx(.cs)` | 279 | `HRNewPtest`(11,782:t1–t31 答案、a01、MakeTime、PGrade) | 新人驗收測驗(作答與成績) |
| `HRnewPepAnw01–07.aspx` | 各約 150 | 無(靜態) | 小叮嚀內容(照搬,同 D-14) |

P2-2 決議(2026-10-12 使用者決定,見 D-18~D-20):分兩批,**P2-2a 新人導覽 → P2-2b 問卷**。


### P3 集團與公告 + 首頁

**P3 已實作(2026-10-23,工作分支 `feature/portal-p3-home`,未合併、未上測試區;待確認見 `CONFIRM-NEEDED.md` P3)**:

| 項目 | 資料 | 做法 |
| --- | --- | --- |
| 首頁聚合 `GET /dashboard` | BPM(NaNa)、QAAnnual*、NewPepR / HRNewPtest + LOS `EmployeeInfo.JobDate`、`portal.personal_note`、`portal.personal_link`、ContentX、`portal.home_slide` | 各來源各自 try/catch(`_meta.errors` / `unavailable`);待簽同意書 P7;BPM 只對 `BPM_COMPANIES` 公司查(D-29 首頁部分) |
| 最新公告 | Gateway 通知中心 + PortalSolar `ContentX`(唯讀) | `GET /news/legacy`,條件同舊首頁(D-21);入口網不做發布頁 |
| 行事曆 | `portal.calendar_pdf`(file-service PDF) | 年度 PDF,編輯者上傳;PCalendar 不沿用 |
| 集團系統 | `portal.system_link` | 編輯者維護;10 個舊 DES 跳轉系統只顯示「DES 跳轉(待重構)」(D-22);舊 `PersonalSystemLink` / `ImageLink` 不沿用 |
| 個人常用連結 | `portal.personal_link` | 本人 CRUD + 排序 |
| 3691 全民開講 | PortalSolar `Talk3691Data` / `Talk3691Like`(寫入)、`portal.talk_author`、`portal.talk_audit` | 作者 AES-256-GCM 加密(secret)、mark 留 NULL、解碼需 `portal.talk.reveal` + 核准文號 + 稽核(D-23,**上線前需人資 / 法務確認**) |

### P4 表單與簽核

**P4 已實作(2026-10-23,工作分支 `feature/portal-p4-approval`,由 P3 切出;未合併、未上測試區;待確認見 `CONFIRM-NEEDED.md` P4)**:

| 項目 | 資料 | 做法 |
| --- | --- | --- |
| 待我簽核 › 待簽核 | NaNa `LocalToDoWorkItem` + `WorkItem` + `ProcessInstance` + `Users`(申請人) | 沿用 `GET /bpm/pending`,加申請人、送出時間;「前往簽核」深連結(D-24,不寫 NaNa) |
| 待我簽核 › 已簽核 | NaNa `WorkItem.performerOID = 本人、currentState = 3` | 新 `GET /bpm/handled`(分頁,簽核時間新到舊;進行中流程列目前關卡) |
| 待我簽核 › 我送出的 | NaNa `ProcessInstance.requesterOID = 本人` | `GET /bpm/requested` 加 `state=open|all`(預設 open = 未結案) |
| D-29 | 設定 `BPM_COMPANIES` | `BpmService.applies`:所有 `/bpm/*` 與首頁聚合共用;非碩禾系回 200 `applicable: false` 空清單、不查 NaNa |
| 表單下載 | `portal.form_category`、`portal.form_doc`(migration `20261022224624_p4_forms`)+ file-service | `/forms`(員工)、`/forms/admin`、`/forms*` 與 `/forms/categories*` 維護(`portal.api.form.edit`,按鈕 `portal.forms.edit`,D-25) |
| BPM 唯讀授權 | 191 `portal_bpm_ro` | 新增欄位 Users.userName、WorkItem.performerOID / completedTime;191 實測為表層級 SELECT,`db/dba/04-bpm-readonly-p4.sql` 改回欄位層級並 DENY 密碼欄位(使用者執行) |

### P5 主管專區

**P5 已實作(2026-10-23,工作分支 `feature/portal-p5-manager`,由 P4 切出;未合併、未上測試區;待確認見 `CONFIRM-NEEDED.md` P5)**:

| 項目 | 資料 | 做法 |
| --- | --- | --- |
| 共通範圍 | Token `dept` + LOS `DeptInfo` 部門樹(快取 10 分鐘) | `modules/manager/scope.ts`:含下層;`portal-manager-all` 全公司(清單須指定部門);所有 `/manager/*` 須具 portal-manager / portal-manager-all;違反 403 `PORTAL_DATA_ACCESS_DENIED` |
| 主管權益 | 靜態(前端 rightsContent.ts) | 照搬 ManagerRightInfo 4 Tab |
| 班表上傳、主管工時追蹤、部屬出勤、休假餘額、晉升地圖 | TIPTOP(晉升地圖另需 WPORTALZ) | 整頁系統轉移中(前端 `MIGRATING_PAGES`) |
| 部門必上課程 | LOS EmployeeInfo、Safety 名單、LearnDB | `GET /manager/courses`:個人版規則(D-9)逐人計算 |
| 部門資產明細 | PortalSolar PersonalPropertyInfo + LOS EmployeeInfo | `GET /manager/property`、`PUT /manager/property/note`(更新保管人那筆,按鈕 `portal.mgr.property.edit`) |
| 年度教育訓練計畫 | PortalSolar ELClassAnnual / ELPlanDept / ELClassForm / ELClassStatus;LearnDB(去年申請) | `/manager/training*`:CRUD、提交(檢查與寫入同一交易)、鎖定、xlsx 匯出(按鈕 `portal.mgr.training.edit`) |
| 部門預算 | Budget CurrentFlag / BudgetVersionInfo / UserInfo / DeptInfo / AccountingCourses / DeptBudgetList | `/manager/budget*`(D-26);實際金額 TIPTOP 轉移中 |
| 預算編列 | 同上 + BudgetData / DeptBudgetMark / 部門狀態 / 部門備註 / AcctProduct* | `/manager/budget-apply*`:未結案版本、合計 / 禁填清單設定化(`BUDGET_*`)、後端鎖定、更新包交易、送出(按鈕 `portal.mgr.budget-apply.edit`) |
| 新表 | — | **不需要**(只讀寫舊表);`db/sources.ts` 表名白名單允許中文 |

### P7 臨時服務(D-8:有 URL、不在選單)

| 頁面 | 舊程式 | 資料來源 |
| --- | --- | --- |
| 員工認股 | `EmployeeStockOwnershipCheck.aspx` | PortalSolar `EmployeeStockInfo`、`EmployeeStockLog`(寫入) |
| 同意書(各版本合併) | `GSMCConsent*`、`GSCConsent*`、`Consent8` | PortalSolar `Consent*`(寫入) |
| 中華郵政 | `ChunghwaPost.aspx` | `MisDb.dbo.SendMailLog`(寫入) |
| 內部拍賣 | `GSMC_Auction.aspx` | PortalSolar `ContentX`、`ContentXMessage`(寫入) |
| 垃圾信回報 | `spam.aspx`、`spamview.aspx` | PortalSolar `SpamXB`、`SpamXC`(寫入) |
| 電視看板 | `TVDemo.aspx`、`TVDemoSetting.aspx` | PortalSolar `TVShowInfo`、`TVImgInfo`(寫入) |
| ISO 文件 | `ISOInfo.aspx` | NaNa 與檢視 `v_ISO_Docs_*`(來源待確認) |

**P7 已實作(2026-10-23,工作分支 `feature/portal-p7-services`,由 P6 切出;未合併、未上測試區;待確認見 `CONFIRM-NEEDED.md` P7)**:

| 項目 | 資料 | 做法 |
| --- | --- | --- |
| 隱藏(D-8) | — | Gateway 沒有選單隱藏旗標:yaml 目錄 `portal.group.services` + menu `portal.svc.*.read` + 按鈕;前端 `service()` 路由沒有 group(側欄不列)、`meta.hidden`(麵包屑不列),仍檢查權限 |
| 同意書 | ConsentX / ConsentXB(GUID 版)、ConsentCInfo / ConsentBInfo(編號版)、`portal.consent_def`、`portal.consent_sign`、LOS EmployeeInfo | `/services/consents*`:部門完整比對、勾選 + 簽名(file-service,先綁定再簽署)、後端擋重簽(sp_getapplock)、過期 410、身分證末 4 碼;首頁待辦 `todos.consent` |
| 員工持股 | EmployeeStockInfo(唯讀)、EmployeeStockLog | `/services/stock*`:今年有資料才開放、自提 CanBack = Y 才送出、每年度一筆、集保帳號 11 碼;Q-F11 預設寫工號(`STOCK_LOG_USERNAME`,待確認) |
| 中華郵政 | MisDb SendMailLog、LOS EmployeeInfo | `/services/post*`:寄件人 = 本人清單、在職寄件人精確選擇、修改不可換寄件人、有郵資 409 |
| 內部拍賣 | ContentX(購物台,唯讀)、ContentXMessage | `/services/auction*`:該品項最高價 + 1000、應用鎖、出價人遮蔽、管理刪除 / 匯出(portal-service-admin) |
| 垃圾信回報 | SpamXB、SpamXC | ⛔ D-27 不做 |
| 電視看板 | TVShowInfo、TVImgInfo、`portal.tv_image` | `GET /tv/board` public(不驗 Token);設定 `/services/tv*` 需權限,圖片經 file-service |
| ISO 文件 | NaNa v_ISO_Docs_Clause_* + Documents 等(唯讀 portal_bpm_ro,`db/dba/06-bpm-readonly-p7.sql`) | `/services/iso/*`:參數化,來源待確認(未授權 503) |
| 新表 | — | migration `20261023082527_p7_services`(consent_def、consent_sign、tv_image) |

### P6 ESH 證照管理

`EHS/*`:`License*`、`ESHChemicalData*`(寫入);`portal-esh-admin` 成員來源 = `LicenseManagerInfo`。

**P6 已實作(2026-10-23,工作分支 `feature/portal-p6-esh`,由 P5 切出;未合併、未上測試區;待確認見 `CONFIRM-NEEDED.md` P6)**:

| 項目 | 資料 | 做法 |
| --- | --- | --- |
| 共通範圍 | PortalSolar LicenseManagerInfo / LicenseCompanyInfo | `modules/esh/license.ts`:須具 `portal-esh-admin`,公司 = 本人在 LicenseManagerInfo 的公司;每支 API 檢查(含以 ID 操作的持證、影本);違反 403 |
| 儀表板 | LicenseBInfo、LicenseInfo、LicenseFileA、LOS RankInfo(在職) | `GET /esh/dashboard`、`/dashboard/holders`:應有 / 有效 / 符合度(同舊 EHManagement) |
| 證照項目 | LicenseInfo + `portal.esh_license_logo` | `/esh/items*`:啟用中不重名(含編輯)、有效期 1~600 月或永久(9999999)、描述白名單清洗且拒收舊站會還原的實體 / 單引號、軟刪(使用中 409)、Logo 經 file-service |
| 證照需求 | LicenseBInfo | `/esh/needs*`:整數 ≥ 0、重複 409、硬刪(舊表無 IsActive) |
| 人員證照 | LicenseFileA、LicenseFileC(舊影本)、`portal.esh_license_doc` | `/esh/holders*`:在職檢查、下次複訓日 `rules.ts nextTrainingDate` 後端計算、軟刪、已刪除同筆復原、影本經 file-service |
| 證照管理員 | LicenseManagerInfo | `/esh/managers`:在職、不重複、不可刪最後一位(交易內檢查) |
| 複訓通知 | 同上 + `portal.esh_job_run` / `esh_notify_log` | `modules/esh/notify.ts`:每週一排程(`scheduler.ts`,run_key 唯一)+ `POST /esh/notify`;寄送介面 `EshMailer`(`dry-run` 預設 / `GatewayNotifyMailer` 呼叫 `/api/notify/send`) |
| 危害性化學品 | ESHChemicalDataA / B / C、`portal.esh_chemical_sds`;NaNa 檢視 `dbo.portal_esh_chemical_forms`(05 檔) | `/esh/chemicals*`:所有員工查詢(分頁、成份以 EF_ID 對應);同步 `POST /esh/chemicals/sync` + 每日排程,解析 XML、整批一個交易;SDS 經 file-service |
| 新表 | — | migration `20261023034541_p6_esh`(5 表) |

## 5. 待決事項

| # | 問題 | 狀態 |
| --- | --- | --- |
| Q-D4 | 複製範圍 | ✅ 全部複製(3.6 GB) |
| Q-D6 | 正式區(2026-12)`portal_prod_app` 在舊庫的授權:只對用到的表 GRANT(建議),由 DBA 建 | 12 月前定 |
| Q-D8 | 舊庫觸發程序是否有寫入副作用 | ✅ 只有 `PortalSolar.dbo.TEST` 有觸發程序,不影響;預存程序不複製,用到時改寫 |
| Q12 | 薪資類二次驗證 | 依 D-1 暫緩(薪資頁轉移中) |
| Q15 | 舊系統未對應頁面 | ✅ D-8:有 URL、不在選單(P7) |
| Q-D11 | BPM「未結案」定義(我申請且 ProcessInstance.currentState = 1)尚未與舊 LOS 預存程序 `SP_EFInfoUnProcess_ByCreateUserID_Solar` 比對(SP 本體不在 repo) | ⏳ P4 時仍取不到:`portal_app` 無 220 LOS 權限、src_* 不含預存程序;請使用者提供 `sp_helptext` 或筆數比對(CONFIRM-NEEDED P4),新站先依 6_todo_viewer 規則 |
| Q-D12 | BPM 深連結以網址參數帶工號(BPM 通知信既有格式),請 BPM 管理者確認 191 / 190 會驗證登入者與 `hdnUserId` 一致;正式區 BPM 網站位址為 `http://10.10.130.190:9090`(與測試區 8080 不同),可行時改 https | ⏳ 待 BPM 管理者確認(P4 沿用既有格式,列入 CONFIRM-NEEDED P4) |
| Q-D13 | 跨公司工號撞號:其他公司本機帳號工號若剛好等於 BPM 上碩禾同仁的 id 會對到對方 | ✅ D-29 限定碩禾系 |
| Q-D9 | 郵件審核 | ✅ 主管確認已不實施,頁面退場 |
| Q-D10 | `WPORTALZ`(晉升地圖、訓練計畫、舊公告編輯引用)不在 220,位置待確認 | P3 未用到;**P5 盤點:訓練計畫(ELPlanDept 等)在 PortalSolar,未用到 WPORTALZ**;只有晉升地圖(HRPromoteMap)讀 WPORTALZ,該頁 TIPTOP 轉移中,待人事系統上線重做時再確認 |
