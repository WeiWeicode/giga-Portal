# 待使用者確認事項

> 實作時遇到需要使用者決定的地方,先依舊系統行為做合理預設並實作,記錄在這裡;確認後把「狀態」改為「已確認」或「已修改」,必要時轉成 `PORTAL-API-PLAN.md` §0 的決議編號。
> 舊程式路徑皆相對於 `../old_PortalSolar/`。

## 1. 待確認的做法

| 批次 | 項目 | 目前做法與依據(舊程式檔案:行號) | 需要確認 / 修改什麼 | 狀態 |
| --- | --- | --- | --- | --- |
| P2-2a | 「我有話要說」長度 | 上限 500 字,完整寫入 `HRNewPtest.a01`(nvarchar(max))。舊程式參數宣告 `NVarChar, 50`,超過 50 字會被截斷(`HRnewPep05.aspx.cs:117`;測試區複本 a01 最長正好 50 字) | 是否改回 50 字上限,或維持 500 字(人資讀 a01 的報表若假設 ≤ 50 字需確認) | 待確認 |
| P2-2a | 通過狀態只認 `PGrade = "100"` | `GET /onboarding/status` 的 `passedAt` 只取 PGrade 為 "100" 的紀錄。舊表另有舊版測驗(t21~t31,滿分 155 等)的分數 1,4xx 人,現行舊程式只在滿分時寫 "100"(`HRnewPep05.aspx.cs:60`、`93`) | 舊版測驗的其他分數(155、110、105…)是否也算「已完成驗收」;影響首頁待辦的新人提醒 | 待確認 |
| P2-2a | 閱讀紀錄同一天不重複寫 | 同一工號同一天已有 `NewPepR` 就不再寫(舊版每按一次一筆,`HRnewPep01.aspx.cs:26-33`;舊報表 `HRNewPay.aspx.cs:55` 只取 MAX,不影響)。FEATURE-PLAN §3.5 建議 | 確認人資沒有依「閱讀次數」統計的報表 | 待確認 |
| P2-2a | 日期字串格式 | `NewPepR.LgTime` 寫 `yyyy/MM/dd`(同 `HRnewPep01.aspx.cs:29`);`HRNewPtest.MakeTime` 寫 `yyyy/M/d`(舊程式為 `ToShortDateString()`,`HRnewPep05.aspx.cs:118`,依測試區複本實際資料如 `2026/9/9` 判定舊伺服器格式) | 正式區(220)舊伺服器地區設定若不同,MakeTime 格式需跟著改 | 待確認 |
| P2-2a | 小叮嚀兩處舊頁內容互相矛盾 | 以 HRnewPep01(選單實際連到的頁)為準:來賓鞋櫃在「B棟5樓」(`HRnewPep01.aspx:126`;`HRnewPepAnw06.aspx:99` 寫 A棟5樓)、公用冰箱「每週一上班前」清潔(`HRnewPep01.aspx:138`;`HRnewPepAnw06.aspx:159` 寫每週五下班前) | 請人資確認正確內容;其他內容(班表、颱風假、特休、試用期 2 個月等)也是照搬舊頁,是否仍正確 | 待確認 |
| P2-2a | 小叮嚀 Q&A 合併方式 | HRnewPepAnw01~05、07 的 Q&A 全部照搬成分段卡片;Anw06(廠區禁令)與 HRnewPep01 大多重複,只收錄 HRnewPep01 沒有的 6 條(無塵室、加班訓練、微波爐、廁所、飲水機濾芯、制服)。舊站沒有任何連結到 Anw 頁(行為規格 onboarding.feature) | 是否要全部照搬 Anw06,或刪減過時內容(例如 Anw05「往後 Portal 將有 E-learning 功能」、「NOTE 填報來賓訪客單」) | 待確認 |
| P2-2a | 驗收題目照搬 | 20 題題目與標準答案完全照舊(`HRnewPep05.aspx:55-410`、`HRnewPep05.aspx.cs:18-56`);第 10 題「吸煙區位於A棟6樓」為刻意的錯誤敘述(正解「否」) | 題目內容是否需要人資更新 | 待確認 |
| P2-2a | 不限新人 | 同舊系統,任何有「新人導覽」頁權限的員工都能閱讀與測驗(`employee` 角色含 Tab 與兩個按鈕) | 是否只開放到職 N 天內的人(需人事資料,目前 TIPTOP 轉移中,D-1) | 待確認 |
| P2-2a | 舊按鈕代碼 `portal.onboarding.edit` | 小叮嚀內容照搬在前端(改內容要改程式,同 D-14),「維護新人導覽」按鈕(portal-editor)目前沒有對應功能,保留不刪 | 是否需要線上維護小叮嚀 / 題目;不需要的話刪除此代碼 | 待確認 |
| P2-2b | 對象部門改為**完整比對**、部門取自 Token | 填答資格以內部 Token 的 `dept` 與 Kdept 清單逐一完整比對(FEATURE-PLAN §3.4)。舊首頁以 LOS `RankInfo` 主要部門做 `kdept LIKE '%部門%'` 部分比對(`MainFormX.aspx.cs:197`),Kdept 若填上層代碼(例 S14)會連下層一起比到 | 新站在出題時把「部門 + 全部下層」展開成清單(與舊站並行時舊站仍是部分比對);確認 Token 部門與 LOS 主要部門代碼一致、舊問卷以上層代碼當對象的情況可接受 | 待確認 |
| P2-2b | 「理級以上 / 課級以上」快速帶入 | 依 FEATURE-PLAN 改用 Gateway 職級(PRD §8.3.4 門檻:課級 ≤ 7、理級 ≤ 6),但 Gateway 沒有提供「依職級列出在職工號」的 API(只有本人 `/api/auth/me` 與管理端 `/api/admin/*`);LOS `EmployeeInfo.JobLevel` 尺度不同(00~55)不採用。portal-api 已做介面 `JobTierDirectory` 與 `GET /qa/org/job-tier`,目前回 503 `PORTAL_JOB_TIER_UNAVAILABLE`,畫面按鈕顯示「職級資料尚未由 Gateway 提供」 | **跨 repo**:請 Gateway 提供下游可用的職級查詢(例:服務帳號 `GET /api/directory/employees?jobTier=manager&companies=`,或允許入口網以 API Key 查 `gw.user`);提供後在 `server.ts` 接上實作即可 | 待確認 |
| P2-2b | 題目圖片經 giga-file-service | 出題畫面直接 `POST /api/file/files` 上傳(sourceApp `portal-qa`),問卷存檔後 `POST /api/file/files/bind`(refType `portal-qa`、refNo = 問卷編號);QAAnnualD 寫 `Item = "#題號"`、`FileName = UUID`、Position 0 題目前 / 1 題目後(D-28,舊站顯示不出)。舊站上傳在 `UploadFiles\`、以題目文字綁定的圖片,新站只標示「此題有舊入口網圖片」不顯示 | ① 出題者需 `file.object.upload` + `file.object.read`、填答者需 `file.object.read`(GigaItApp 權限設定,**跨系統權限**);② file-service 第一版資料範圍是「自己上傳或同公司」(file-service API.md §1.2),**其他公司的填答者看不到圖片**(畫面顯示「圖片無法顯示」);③ portal-api 只檢查 UUID 格式,沒有服務對服務介面確認檔案存在 / 屬於出題者。是否需要 file-service 提供「公開給已登入者」的檔案類型或服務帳號查詢 | 待確認 |
| P2-2b | 前言 / 結語的 HTML | 舊站以 CKEditor 編輯、原樣輸出;新站寫入前與讀出時都以白名單過濾(`modules/qa/html.ts`:保留排版標籤、顏色 / 對齊 / 字級、https / mailto 連結,圖片只留 data:image 與 file-service),畫面再以 web-kit `sanitizeHtml` 清洗——**web-kit 只允許通知中心圖片,舊問卷內嵌的 data: 圖片在新站不顯示**(測試區複本 8 份問卷有 HTML)。新站編輯器為純文字框(可貼 HTML),沒有所見即所得編輯器 | 是否需要所見即所得編輯器與前言內嵌圖片;若需要,web-kit 白名單要加 file-service 圖片(跨 repo) | 待確認 |
| P2-2b | 已有作答後可改的範圍 | 鎖定:題數、題號順序、題型、選項、複選上限、必填;可改:標題、主辦單位、前言 / 結語、起訖日、對象、**題目文字**、題目圖片(作答以題號對應,改文字不影響對應)。FEATURE-PLAN 原寫「只能改文字說明與起訖日」 | 確認對象與題目文字在作答後可修改;改題目文字會讓舊站以題目文字綁定的舊圖片脫鉤 | 待確認 |
| P2-2b | 複製問卷的建立者 | 新編號用操作者工號、`CLgNo` = 操作者、`IsActive = 1`、標題加 "Copy"(舊版 `MyQAList.aspx.cs:131-160` 沿用原出題者,複製者在自己的清單看不到) | 是否維持「複製者為新問卷的建立者」 | 待確認 |
| P2-2b | 問答題的 < > 改全形 | 作答文字中的 `<`、`>` 寫入時改為全形 `＜`、`＞`:舊站統計頁以 Label 輸出不做 HTML 編碼(`MyQAList.aspx:181`),避免並行期在舊站被執行;標題、題目、選項則直接拒絕 < > | 確認可接受(匯出與統計會看到全形符號) | 待確認 |
| P2-2b | 統計分母與空白答案 | 百分比分母 = 作答人數(複選題加總可超過 100%;舊版分母 = 答案列數);空白答案不列、計入未作答;不在選項中的舊答案列在最後 | 確認人資的報表口徑 | 待確認 |
| P2-2b | 匯出欄位 | 部門、工號、姓名(LOS `EmployeeInfo`;舊版取 `GenInfo` gen03 / gen02)、題號、題目、答案、填答時間;性別 / 年齡 / 年資等人事屬性與固定空白的「班別」不匯出(D-18);舊頁隱藏的「眷屬資料」匯出不做 | 確認欄位;人事系統上線後再補人事屬性 | 待確認 |
| P2-2b | 開始 / 結束日與對象必填 | 新增 / 修改時起訖日必填、結束日不可早於開始日、至少設定一種對象(舊版日期可空白,空白的問卷永遠不會出現在待辦);問卷維護清單預設列出全部啟用中(舊版預設只列進行中,新版以「只看進行中」切換) | 確認 | 待確認 |
| P2-2b | Kdept / Kpep 寫法 | 清單加結尾逗號(`A,B,`;舊首頁以 `LIKE '%,工號,%'` 比對,單一工號沒有逗號時舊站比對不到)、工號轉大寫並去重複;部門 "all" 表示全集團 | 確認舊報表沒有依字串格式解析 Kpep | 待確認 |
| P2-2b | IT 管理員看不到「問卷維護」Tab | 新 Tab `portal.survey.manage` 只登記在本 repo yaml(portal-editor);GigaItApp 的 `it-admin` 角色清單沒有此代碼 | **跨 repo**:是否在 GigaItApp `deploy/gateway-rbac.yaml` 的 it-admin 加入 `portal.survey.manage` | 待確認 |

## 2. 需要使用者執行的動作

| 批次 | 動作 | 說明 | 狀態 |
| --- | --- | --- | --- |
| P2-2a | 合併 `feature/portal-p2-2a-onboarding` → `develop`(10/27 後) | 10/22~10/26 不合併、不部署(FEATURE-PLAN §11)。合併後 CI 部署 portal-api 與前端,`rbac-test` 套用 `deploy/gateway-rbac.yaml`(新增兩個按鈕 `portal.onboarding.confirm` / `portal.onboarding.submit`、兩個 Tab 的 includes,employee 角色加兩個按鈕)。不需要 Drizzle migration(只寫舊表 NewPepR / HRNewPtest) | 待執行 |
| P2-2a | 確認 Tab includes 已生效 | yaml 對「已存在的權限」只首次登記;若套用後 GigaItApp「選單管理」中 `portal.onboarding.tips` / `portal.onboarding.quiz` 沒有綁定 `portal.api.onboarding.read`,請在選單管理手動綁定(同 P2-1 的作法) | 待執行 |
| P2-2a | 測試區驗收 | 以測試帳號開「行政資源 › 新人導覽」:① 小叮嚀內容與舊站一致,按「我已閱讀完畢」後顯示今天日期,`giganexus_gw_test.src_portalsolar.NewPepR` 多一筆(同一天再按不增加)② 驗收區故意答錯 → 顯示答對題數、HRNewPtest 無新增 ③ 全對 → 顯示通過日期,HRNewPtest 只剩本人一筆(PGrade 100)④ 四種風格組合與 375px 寬度版面 | 待執行 |
| P2-2b | 合併 `feature/portal-p2-2b-qa` → `develop`(10/27 後,先合併 P2-2a) | 10/22~10/26 不合併、不部署。合併後 CI 部署 portal-api(新相依 `exceljs`、`sanitize-html`,lock 已更新)與前端,`rbac-test` 套用 yaml:新增 Tab `portal.survey.manage`(問卷維護)、按鈕 `portal.survey.submit`(employee)、`portal.qa.edit` / `portal.qa.admin`(portal-editor)。**不需要 Drizzle migration**(只讀寫舊表 QAAnnual*,讀 LOS) | 待執行 |
| P2-2b | 確認 Tab includes 與名稱 | `portal.survey.list` 已存在,yaml 不會覆寫:請在 GigaItApp「選單管理」把它綁定 `portal.api.qa.read`(並可改名「我的問卷」);確認三個新按鈕已綁定 `portal.api.qa.write` / `.edit` / `.admin` | 待執行 |
| P2-2b | 授予附件服務權限 | 在 GigaItApp 權限設定:portal-editor 加 `file.object.upload`、`file.object.read`(上傳 / 預覽題目圖片),employee 加 `file.object.read`(填答時看題目圖片);見待確認「題目圖片經 giga-file-service」 | 待執行 |
| P2-2b | 測試區驗收 | ① 以 portal-editor 測試帳號在「問卷維護」新增問卷(對象 = 測試帳號部門,含單選 / 複選上限 / 問答必填、一題圖片),`src_portalsolar.QAAnnual` 多一筆 CLgNo = 本人 ② 以 employee 測試帳號在「我的問卷」看到並填答:必填 / 上限訊息、送出後清單消失、QAAnnualC 複選每個勾選項一列、CPF* 為 NULL;再送出回「已作過」③ 出題者看統計(人事屬性分組顯示系統轉移中)、匯出 Excel、複製、刪除;已有作答後刪題被擋、改結束日可存 ④ 非 portal-editor 看不到「問卷維護」;portal.qa.admin 可切換「代管全部」⑤ 四種風格組合與 375px 寬度 | 待執行 |
