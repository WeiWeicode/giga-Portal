# portal-api 規劃

> 版本:v0.4(2026-10-12,P0 完成;P1 決議 D-9~D-13)。時程以 NexusPlan 甘特圖為準,本文件不列日期。
> 前提見 `docs/HANDOFF.md` §2、`docs/PRD.md` §6.7;舊庫對照見 `docs/DATABASE-MAP.md`(本文件 §1 補充盤點發現)。

## 0. 已定決議(2026-10-12)

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

總務專區(資產相關 Tab 轉移中;`welfare_s` 等 220 資料實作)、人資專區、內部職缺(`EnlistTB`)、問卷調查(`QAAnnual*`,寫入)、新人導覽(`NewPepR`、`HRNewPtest`,寫入)、分機表 / 聯絡窗口(`NotesPhone`,寫入)、集團統編。

### P3 集團與公告 + 首頁

最新公告(BFF 通知中心;`ContentX` 舊公告是否顯示待確認)、行事曆(`PCalendar`)、集團系統(`PersonalSystemLink` / `ImageLink`)、3691 全民開講(`Talk3691*`,寫入)、首頁聚合 `/api/portal/dashboard`(BPM 待簽核數、公告、個人連結;TIPTOP 卡片轉移中)。

### P4 表單與簽核

待我簽核(待簽核 / 已簽核 / 我送出的)以 §3.3 直讀 NaNa;表單下載。

### P5 主管專區

220 / LearnDB / Budget 可帶出的實作(部門訓練計畫、工安課程、部門財產的 PortalSolar 部分、預算);TIPTOP 來源(班表、工時、出勤、休假餘額、晉升地圖的人事欄位)轉移中。資料依內部 Token 部門(含下層)過濾。

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

做法(草案):前端路由標記 `hidden`(側欄、搜尋、麵包屑不列),仍需登入與權限代碼(例 `portal.svc.stock.read`,kind `menu`、上層新增目錄 `portal.group.services` 並在選單管理設為不顯示,或 Gateway 支援隱藏旗標;待 P7 開始時與 Gateway 規格對齊);開放期間由 API 依資料表的期間設定判斷,過期回「服務已結束」。

### P6 ESH 證照管理

`EHS/*`:`License*`、`ESHChemicalData*`(寫入);`portal-esh-admin` 成員來源 = `LicenseManagerInfo`。

## 5. 待決事項

| # | 問題 | 狀態 |
| --- | --- | --- |
| Q-D4 | 複製範圍 | ✅ 全部複製(3.6 GB) |
| Q-D6 | 正式區(2026-12)`portal_prod_app` 在舊庫的授權:只對用到的表 GRANT(建議),由 DBA 建 | 12 月前定 |
| Q-D8 | 舊庫觸發程序是否有寫入副作用 | ✅ 只有 `PortalSolar.dbo.TEST` 有觸發程序,不影響;預存程序不複製,用到時改寫 |
| Q12 | 薪資類二次驗證 | 依 D-1 暫緩(薪資頁轉移中) |
| Q15 | 舊系統未對應頁面 | ✅ D-8:有 URL、不在選單(P7) |
| Q-D11 | BPM「未結案」定義(我申請且 ProcessInstance.currentState = 1)尚未與舊 LOS 預存程序 `SP_EFInfoUnProcess_ByCreateUserID_Solar` 比對(SP 本體不在 repo) | 191 帳號建立後,對同一人比對 SP 與新查詢筆數 |
| Q-D12 | BPM 深連結以網址參數帶工號(BPM 通知信既有格式),請 BPM 管理者確認 191 / 190 會驗證登入者與 `hdnUserId` 一致;正式區 BPM 網站位址為 `http://10.10.130.190:9090`(與測試區 8080 不同),可行時改 https | 待確認 |
| Q-D13 | 跨公司工號撞號:其他公司本機帳號工號若剛好等於 BPM 上碩禾同仁的 id 會對到對方;目前以逐字元比對 + 在職唯一降低風險,是否再依公司限定只查碩禾系 | 待決 |
| Q-D9 | 郵件審核 | ✅ 主管確認已不實施,頁面退場 |
| Q-D10 | `WPORTALZ`(晉升地圖、訓練計畫、舊公告編輯引用)不在 220,位置待確認 | P3 / P5 前確認 |
