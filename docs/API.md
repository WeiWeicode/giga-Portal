# 員工入口網 — API 規格

> **狀態:P0 骨架(2026-10-12)**。已實作的端點見 §3.0,其餘為設計草案;實作時以 OpenAPI(`/openapi.json`,自動註冊到 Gateway)為準並回頭更新本文件。分批見 [PORTAL-API-PLAN.md](PORTAL-API-PLAN.md)。
> 對應 [PRD.md](PRD.md) v0.1.2;錯誤格式與內部 Token 依 Gateway BACKEND-GUIDE §4、§5.3。

---

## 1. 共通規則

| 項目 | 規則 |
| --- | --- |
| 對外路徑 | `/api/portal/{resource}`(經 BFF);服務內 `/v1/{resource}` |
| 身分 | BFF 轉入的 `X-Internal-Token`(工號 `emp`、部門 `dept`、角色 `roles`);portal-api 不接受直接連線 |
| 權限 | 每支 API 的 `x-permission` 由 BFF 檢查;寫入 API 的代碼 = 前端按鈕 `v-can` 代碼 |
| 分頁 | `page`(預設 1)、`pageSize`(預設 10,上限 100);回應 `{ items, total, page, pageSize }` |
| 錯誤 | `{ code, message, requestId, details? }`;本服務代碼 `PORTAL_` 開頭(§5) |
| 模擬資料 | 回應含 `mock: true` 或 `mockSections: [...]` 時,前端必須顯示「模擬」標籤 |

## 2. 本專案使用的 Gateway BFF API

| 方法 | 路徑 | 用途 | 說明 |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | 登入 | 錯誤代碼依 Gateway PRD §8.1.1(`INVALID_CREDENTIALS`、`ACCOUNT_NOT_REGISTERED`、`PASSWORD_CHANGE_REQUIRED`…) |
| POST | `/api/auth/logout`、`/api/auth/refresh` | 登出、換發 | web-kit 處理 |
| GET | `/api/auth/me` | 使用者、`permissions`、**`apps`**(v0.7) | 應用切換、守衛、選單過濾 |
| POST | `/api/auth/register`、`/register/verify` | 自行註冊 | 無網域子公司;送出 `{ employeeNo, name, hireDate?, password? }`(填到職日時一併設定密碼,比對通過直接啟用)/ `{ token, password }` |
| POST | `/api/auth/password/forgot`、`/reset`、`/change` | 忘記 / 重設 / 變更密碼 | 送出 `{ employeeNo }` / `{ token, password }` / `{ currentPassword?, newPassword }`(`PASSWORD_CHANGE_REQUIRED` 後以限定憑證呼叫 change 不需目前密碼;forgot 不論帳號是否存在一律回 202) |

> 註冊、忘記密碼的請求欄位依 Gateway PRD §8.2.5 推定,Gateway 實作時以其規格為準並回頭更新本表。

### 2.1 應用切換的導回參數(前端,提議)

| 項目 | 規則 |
| --- | --- |
| `/?denied=<應用代碼>` | 其他應用的應用層守衛沒有權限時導回入口網並帶此參數(例 GigaItApp:`/?denied=it`);入口網顯示「您沒有{應用名稱}的使用權限」後移除參數。尚未寫入 Gateway FRONTEND-GUIDE §7.4,需與 Gateway、GigaItApp(I3)確認 |
| GET | `/api/portal/dashboard` | 首頁聚合(BFF aggregate) | 步驟:個人資料、出勤、假期、待簽核、公告、行程;非必要步驟失敗時 `_meta.errors` |
| GET | `/api/bpm/approvals`、POST `/api/bpm/approvals/:id/approve`、`/reject` | 待我簽核、核准 / 退回 | 權限 `bpm.approval.read` / `approve` / `reject`(需 BPM 負責人提供,PRD Q8) |
| GET | `/api/hrm/profile`、`/api/hrm/attendance`、`/api/hrm/leaves` | 個人資料、出勤、假期 | 需 HRM 負責人提供(PRD Q8);目前本機只有模擬的 `/api/hrm/profile`、`/api/hrm/todos` |

> 新增使用的 API 前先查 BFF 路由表(Gateway `AGENT.md` §10.4):`node ../giga-api-gateway-bff/sdk/node/dist/lookup-cli.js <關鍵字> --gherkin`。

## 3. portal-api 端點一覽

### 3.0 已實作

| 方法 | 對外路徑 | 權限 | 說明 |
| --- | --- | --- | --- |
| GET | `/api/portal/me` | `authenticated` | 目前登入者:`{ empNo, name, dept, companies }`(內部 Token);系統對系統呼叫回 403 `PORTAL_DATA_ACCESS_DENIED` |
| GET | `/api/portal/courses/required?year=` | `portal.api.course.read` | 本人年度必上課程:`{ year, eligible, inYear, deduction, courses[{ key, name, category, status: done/missing/na, hours?, minHours? }] }`(規則同舊入口網,PORTAL-API-PLAN D-9) |
| GET | `/api/portal/commute` | `portal.api.commute.read` | 本人通勤調查最新一筆有效資料、通勤方式選項、`canSubmit`(Google 金鑰是否設定) |
| PUT | `/api/portal/commute` | `portal.api.commute.write` | 送出通勤調查(與舊入口網共用 PortalSolar CpfExInfo);400 驗證、422 `PORTAL_ADDRESS_UNRESOLVED`、502 `PORTAL_GEOCODE_FAILED`、503 `PORTAL_GEOCODE_UNAVAILABLE` |
| GET / POST | `/api/portal/notes` | `portal.api.note.read` / `.write` | 本人個人提醒清單(未完成在前、依到期日)/ 新增(每人上限 500,409 `PORTAL_NOTE_LIMIT`) |
| PATCH / DELETE | `/api/portal/notes/:id` | `portal.api.note.write` | 修改、標記完成 / 刪除;別人的提醒回 404 `PORTAL_NOTE_NOT_FOUND` |
| GET | `/api/portal/assets/notes` | `portal.api.asset.read` | 本人在舊入口網填寫的保管資產備註(PortalSolar PersonalPropertyInfo;唯讀) |
| GET | `/api/portal/bpm/pending` | `portal.api.bpm.read` | 本人 BPM 待簽核 `{ applicable, total, abnormal, hasAccount, truncated, items[{ processName, subject, serialNumber, workItemName(目前關卡), requesterId, requesterName, submittedAt, createdAt(派送), abnormal, performUrl, traceUrl… }] }`;未設定 BPM 回 503 `PORTAL_BPM_UNAVAILABLE`。**所有 `/bpm/*` 只對 Token 公司屬 `BPM_COMPANIES`(碩禾系)者查 NaNa,其他公司回 200、`applicable: false`、空清單(D-29,P4)** |
| GET | `/api/portal/bpm/requested?page=&pageSize=&state=open|all` | `portal.api.bpm.read` | 我送出的(P1-3「未結案」/ P4「我送出的」):`state=open`(預設)只列流程進行中、`all` 全部狀態;分頁(pageSize ≤ 100),附目前關卡、追蹤連結 |
| GET | `/api/portal/bpm/handled?page=&pageSize=` | `portal.api.bpm.read` | 已簽核 / 經辦過(P4;WorkItem.performerOID = 本人、currentState = 3):`{ applicable, total, page, pageSize, hasAccount, items[{ workItemName, completedAt, processName, subject, serialNumber, processState, currentActivities, requesterId, requesterName, submittedAt, traceUrl }] }`,簽核時間新到舊 |
| GET | `/api/portal/forms` | `portal.api.form.read` | 表單下載(P4,D-25):`{ categories[{ id, name, sort }], items[{ id, categoryId, name, description, fileId, fileName, sort, active, updatedAt }] }`(只列啟用中);下載走 file-service `GET /api/file/files/:uuid/content` |
| GET | `/api/portal/forms/admin` | `portal.api.form.edit` | 維護清單(含停用) |
| POST / PUT / DELETE | `/api/portal/forms`、`/forms/:id` | `portal.api.form.edit` | 新增(201)/ 修改 / 刪除表單(按鈕 `portal.forms.edit`;`{ categoryId, name ≤ 100, description? ≤ 300, fileId(file-service UUID,sourceApp / refType `portal-forms`、refNo = 表單 id), fileName(pdf / doc(x) / xls(x) / ppt(x) / odt / ods / odp), sort, active }`);404 `PORTAL_FORM_NOT_FOUND`、分類不存在 404 `PORTAL_FORM_CATEGORY_NOT_FOUND` |
| POST / PUT / DELETE | `/api/portal/forms/categories`、`/forms/categories/:id` | `portal.api.form.edit` | 表單分類維護 `{ name ≤ 30, sort }`;同名 409 `PORTAL_FORM_CATEGORY_DUPLICATE`、分類下仍有表單(含停用)不能刪 409 `PORTAL_FORM_CATEGORY_IN_USE` |
| GET | `/api/portal/directory?q=` | `portal.api.directory.read` | 分機表查詢(1–2 個關鍵字、至少 2 字,最多 200 筆,`truncated`;不含 Email) |
| GET | `/api/portal/hr/manager-agents` | `portal.api.hr.read` | 主管職務代理人名單 PDF(需登入) |
| PUT | `/api/portal/directory/me/phone` | `portal.api.directory.write` | 更新本人分機(記錄 NotesPhoneTemp 後更新 NotesPhone);不在分機表回 404 `PORTAL_DIRECTORY_NOT_FOUND` |
| GET | `/api/portal/jobs?all=` | `portal.api.job.read` | 內部職缺(預設開放中) |
| POST / PUT / DELETE | `/api/portal/jobs`、`/jobs/:no` | `portal.api.job.write` | 維護職缺(按鈕 `portal.job.edit`,portal-editor);不存在回 404 `PORTAL_JOB_NOT_FOUND` |
| GET | `/api/portal/onboarding/status` | `portal.api.onboarding.read` | 本人新人導覽完成狀態 `{ readAt, passedAt }`(YYYY-MM-DD 或 null;passedAt 只認 HRNewPtest PGrade 100),供首頁待辦 |
| POST | `/api/portal/onboarding/read` | `portal.api.onboarding.write` | 小叮嚀「我已閱讀完畢」(按鈕 `portal.onboarding.confirm`):寫 NewPepR(LgTime yyyy/MM/dd,同一天不重複),回應狀態 |
| GET | `/api/portal/onboarding/quiz` | `portal.api.onboarding.read` | 驗收測驗 20 題題目 `{ questions[{ no, text }], passScore }`(不含答案) |
| POST | `/api/portal/onboarding/quiz` | `portal.api.onboarding.write` | 送出驗收測驗(按鈕 `portal.onboarding.submit`)`{ answers: boolean[20], comment? ≤ 500 }` → `{ correct, total, score, passed, passedAt }`;後端計分,全對才在同一交易先刪本人舊紀錄再寫 HRNewPtest(D-20) |
| GET | `/api/portal/qa/pending` | `portal.api.qa.read` | 我的待填問卷(啟用、今天在起訖日內、在對象內:全集團 / Token 部門**完整比對** / 工號,且未作答);P2-2b |
| GET | `/api/portal/qa/pending/:qaNo` | `portal.api.qa.read` | 填答內容 `{ qaNo, title, dept, intro, outro, startDate, endDate, questions[{ no, type: single/multi/text/null, text, options, limit, required, image, legacyImage }] }`(前言 / 結語白名單清洗);不符資格 404 `PORTAL_QA_NOT_FOUND`、已作答 409 `PORTAL_QA_ANSWERED` |
| POST | `/api/portal/qa/pending/:qaNo/answers` | `portal.api.qa.write` | 送出作答(按鈕 `portal.survey.submit`)`{ answers[{ no, choices?, text? }] }` → 201 `{ answeredAt }`;後端再驗資格、必填、單選一項、複選上限,整份一個交易寫 QAAnnualC(複選每個勾選項一列、人事屬性 NULL,D-18);400 `PORTAL_QA_INVALID`(details 逐題)、409 `PORTAL_QA_ANSWERED` |
| GET / POST | `/api/portal/qa/surveys` | `portal.api.qa.edit` | 本人建立的問卷清單(`q`、`current`、分頁)/ 新增(按鈕 `portal.qa.edit`;編號 Q + yyyyMMddHHmmss + 工號,201 `{ qaNo }`) |
| GET / PUT / DELETE | `/api/portal/qa/surveys/:qaNo` | `portal.api.qa.edit` | 內容(含 `targets`、`respondents`、`locked`;亦供預覽)/ 修改(已有作答時結構鎖定,409 `PORTAL_QA_LOCKED`)/ 軟刪(IsActive = 0);他人的問卷 403 `PORTAL_DATA_ACCESS_DENIED` |
| POST | `/api/portal/qa/surveys/:qaNo/copy` | `portal.api.qa.edit` | 複製主檔、題目、圖片(不含作答),建立者 = 操作者,標題加 Copy;201 `{ qaNo }` |
| GET | `/api/portal/qa/surveys/:qaNo/stats` | `portal.api.qa.edit` | 每題答案人數與百分比(分母 = 作答人數);`unavailable: ["hr"]` 人事屬性分組系統轉移中 |
| GET | `/api/portal/qa/surveys/:qaNo/export` | `portal.api.qa.edit` | 作答明細 .xlsx(部門、工號、姓名、題號、題目、答案、填答時間) |
| 同上 | `/api/portal/qa/admin/surveys[/:qaNo[/copy\|/stats\|/export]]` | `portal.api.qa.admin` | 代管全部出題者(按鈕 `portal.qa.admin`;清單另可 `creator` 篩選);不改原建立者 |
| GET | `/api/portal/qa/org/departments` | `portal.api.qa.edit` | 設定對象用的部門清單(LOS DeptInfo `{ code, name, parent }`),畫面展開下層 |
| GET | `/api/portal/qa/org/job-tier?tier=section\|manager` | `portal.api.qa.edit` | 職級快速帶入(課級 / 理級以上工號);Gateway 尚未提供職級查詢,目前回 503 `PORTAL_JOB_TIER_UNAVAILABLE`(CONFIRM-NEEDED P2-2b) |
| GET | `/api/portal/dashboard` | `portal.api.home.read` | 首頁聚合(P3,§4):`{ todos.items[{ kind, title, count, date, to, href }], secretary{ bpm{ pending, abnormal, unclosed, hasAccount, homeUrl } \| null, links[] \| null }, news{ total, items } \| null, slides{ policy[], gallery[] } \| null, _meta{ errors[{ section, message }], unavailable[] } }`;單一來源失敗只標在 `_meta.errors`(區塊代碼 `bpm`、`todos.qa`、`todos.onboarding`、`todos.notes`、`secretary.links`、`news`、`slides`),未設定 / 未實作列在 `_meta.unavailable`(`todos.consent` P7;BPM 只對 `BPM_COMPANIES` 公司查詢,D-29) |
| GET | `/api/portal/home/slides` | `portal.api.home.edit` | 首頁輪播維護清單(含停用、過期) |
| POST / PUT / DELETE | `/api/portal/home/slides`、`/home/slides/:id` | `portal.api.home.edit` | 新增 / 修改 / 刪除輪播(按鈕 `portal.home.edit`;`{ kind: policy\|gallery, title, fileId(file-service UUID), linkUrl?, startDate?, endDate?, sort, active }`);404 `PORTAL_SLIDE_NOT_FOUND` |
| GET | `/api/portal/news/legacy?q=&page=&pageSize=` | `portal.api.news.read` | 舊入口網公告(ContentX 唯讀,D-21;條件同舊首頁;`url` 為舊站公告頁,未設定 `LEGACY_PORTAL_URL` 時 null) |
| GET | `/api/portal/calendar` | `portal.api.calendar.read` | 年度行事曆 `{ items[{ year, fileId, fileName, updatedAt }] }` |
| PUT / DELETE | `/api/portal/calendar/:year` | `portal.api.calendar.edit` | 登記 / 取代(`{ fileId, fileName(.pdf) }`)/ 刪除年度行事曆(按鈕 `portal.calendar.edit`);404 `PORTAL_CALENDAR_NOT_FOUND` |
| GET | `/api/portal/links` | `portal.api.link.read` | 啟用中的集團系統;`legacyDes = true` 的 `url` 一律 null(D-22) |
| GET | `/api/portal/links/admin` | `portal.api.link.edit` | 全部集團系統(含停用) |
| POST / PUT / DELETE | `/api/portal/links`、`/links/:id` | `portal.api.link.edit` | 維護集團系統(按鈕 `portal.links.edit`;網址只接受 http(s) 或站內路徑);404 `PORTAL_LINK_NOT_FOUND` |
| GET / POST | `/api/portal/personal-links` | `portal.api.personal-link.read` / `.write` | 本人常用連結 / 新增(每人 20 筆,409 `PORTAL_LINK_LIMIT`) |
| PUT / DELETE | `/api/portal/personal-links/:id` | `portal.api.personal-link.write` | 修改 / 刪除本人的(別人的 404);按鈕 `portal.home.link-edit` |
| PUT | `/api/portal/personal-links/order` | `portal.api.personal-link.write` | `{ ids }` 依序重設排序(必須是本人全部連結) |
| GET | `/api/portal/talk/posts?type=` | `portal.api.talk.read` | 3691 主題與回覆(扁平,`parentSn` 組樹;不含作者;屏蔽的遮蔽內容、回覆不列);`types`、`canPost`(金鑰是否設定) |
| GET | `/api/portal/talk/moderation/posts?type=` | `portal.api.talk.moderate` | 管理檢視(含屏蔽原文與回覆,不含作者) |
| POST | `/api/portal/talk/posts` | `portal.api.talk.write` | 發新主題(`type`、`title`、`content`)或回覆(`parentSn`、`content`,分類沿用上層);作者加密存 `portal.talk_author`(D-23);`< >` 轉全形;屏蔽的(含上層)409 `PORTAL_TALK_BLOCKED`;金鑰未設定 503 `PORTAL_TALK_KEY_UNAVAILABLE`;**不寫 Gateway 存取紀錄**(x-audit-level none) |
| POST | `/api/portal/talk/posts/:sn/like` | `portal.api.talk.write` | 按讚(每人每則一次)`{ likes }` |
| PUT | `/api/portal/talk/posts/:sn/block` | `portal.api.talk.moderate` | `{ blocked }` 屏蔽 / 取消屏蔽並寫稽核(按鈕 `portal.talk.moderate`) |
| POST | `/api/portal/talk/posts/:sn/reveal` | `portal.api.talk.reveal` | `{ approvalNo(必填 ≤ 50), reason? }` → `{ sn, empNo }`;每次嘗試都寫 `portal.talk_audit`;舊站發文 409 `PORTAL_TALK_AUTHOR_LEGACY`、無資料 404 `PORTAL_TALK_AUTHOR_NOT_FOUND`、解不開 500 `PORTAL_TALK_AUTHOR_DECRYPT_FAILED`(按鈕 `portal.talk.reveal`;**上線前需人資 / 法務確認**) |
| GET | `/api/portal/manager/depts` | `portal.api.mgr.dept.read` | 主管可選部門 `{ all, items[{ code, name, parent }] }`:Token 部門含下層;`portal-manager-all` 全公司;**所有 `/manager/*` 須具 portal-manager 或 portal-manager-all**,否則 403(P5) |
| GET | `/api/portal/manager/courses?dept=&includeSub=&year=` | `portal.api.mgr.course.read` | 部屬年度必上課程 `{ year, courses[{ key, name, category }], items[{ empNo, name, dept, deptName, inYear, deduction, courses[{ key, status }] }] }`(D-9);範圍外 403;全公司角色未指定 dept 400 `PORTAL_MGR_DEPT_REQUIRED` |
| GET | `/api/portal/manager/property?dept=&includeSub=` | `portal.api.mgr.property.read` | 部門資產備註(在職部屬的 PersonalPropertyInfo,D-12) |
| PUT | `/api/portal/manager/property/note` | `portal.api.mgr.property.edit` | `{ empNo, compDb, assetNo, assetSub, note(≤150) }` 更新**保管人**那筆備註(按鈕 `portal.mgr.property.edit`);保管人不在範圍 403、無紀錄 404 `PORTAL_MGR_PROPERTY_NOT_FOUND` |
| GET | `/api/portal/manager/training` | `portal.api.mgr.training.read` | 年度教育訓練計畫:`year`(ELClassAnnual)、`depts`(ELPlanDept ∩ 範圍)、`outOfScope`、`canEdit`、`submitted`、`lockedDepts`、`courses`、`lastYear`、`applied`、`options`;年度未設定 503 `PORTAL_MGR_TRAINING_YEAR_UNSET` |
| POST / PUT / DELETE | `/api/portal/manager/training/courses`、`/courses/:classId` | `portal.api.mgr.training.write` | 新增(201)/ 修改 / 刪除課程(按鈕 `portal.mgr.training.edit`);驗證 400 `VALIDATION_FAILED`、同部門同名 409 `PORTAL_MGR_TRAINING_DUPLICATE`、已提交 409 `PORTAL_MGR_TRAINING_LOCKED`、非本年度可編部門 404 `PORTAL_MGR_TRAINING_NOT_FOUND`、非負責部門 403 |
| POST | `/api/portal/manager/training/submit` | `portal.api.mgr.training.write` | 提交(每部門 ≥ 2 門在職訓練課程且必填齊全,否則 422 `PORTAL_MGR_TRAINING_INCOMPLETE`,`details` 列問題);回應同 GET |
| GET | `/api/portal/manager/training/export?dept=` | `portal.api.mgr.training.read` | 下載 `<部門>_<民國年>年度教育訓練計劃.xlsx` |
| GET | `/api/portal/manager/budget/options` | `portal.api.mgr.budget.read` | `{ company, year, versions[], depts[] }`(D-26:Budget UserInfo 管理者 / 部門主管) |
| GET | `/api/portal/manager/budget?flag=&dept=&includeZero=` | `portal.api.mgr.budget.read` | 部門預算 1~12 月與合計;`actual: null`、`unavailable: ["actual"]`(TIPTOP);版本不符 404 `PORTAL_MGR_BUDGET_VERSION_NOT_FOUND` |
| GET | `/api/portal/manager/budget-apply/options`、`/budget-apply?flag=&dept=` | `portal.api.mgr.budget-apply.read` | 未結案版本;編列資料(科目 `editable`、每月 `{ amount, mark }`、部門備註、`status`、`locked`) |
| PUT | `/api/portal/manager/budget-apply` | `portal.api.mgr.budget-apply.write` | `{ flag, dept, remark?, cells[{ code, month, amount, mark? }](≤1200) }` 一個交易更新(按鈕 `portal.mgr.budget-apply.edit`);已送出 / 結案 409 `PORTAL_MGR_BUDGET_LOCKED`;資料列已不存在 409 `PORTAL_MGR_BUDGET_CHANGED` |
| POST | `/api/portal/manager/budget-apply/submit` | `portal.api.mgr.budget-apply.write` | `{ flag, dept }` 送出(部門狀態 1) |
| GET | `/api/portal/esh/dashboard?company=` | `portal.api.esh.license.read` | P6 證照儀表板 `{ companies, company, items[{ licenseId, name, months, permanent, description(清洗後 HTML), logo, legacyLogoUrl, required, valid, ratio, ok, notes }] }`;**所有 `/esh/*` 證照 API 須具 `portal-esh-admin`,公司限本人在 LicenseManagerInfo 的公司**,否則 403 |
| GET | `/api/portal/esh/dashboard/holders?company=&licenseId=` | `portal.api.esh.license.read` | 有效持證人(在職、未刪除、下次複訓日 ≥ 今天)與證照影本 |
| GET / POST / PUT / DELETE | `/api/portal/esh/items`、`/items/:id` | `.item.read` / `portal.api.esh.item.edit` | 證照項目(各公司共用;須至少管理一間公司);`{ name ≤50, months 1~600 \| permanent, description }`;重名 409 `PORTAL_ESH_ITEM_DUPLICATE`;描述清洗後含單引號 / `&lt;` 等實體 400;仍有需求或持證人時刪除 409 `PORTAL_ESH_ITEM_IN_USE`;刪除為軟刪 |
| PUT / DELETE | `/api/portal/esh/items/:id/logo` | `portal.api.esh.item.edit` | `{ fileId, fileName }` 登記 file-service Logo(refType `portal-esh-logo`,只收圖片) |
| GET / POST / PUT / DELETE | `/api/portal/esh/needs`、`/needs/:licenseId?company=` | `.need.read` / `portal.api.esh.need.edit` | 證照需求 `{ company, licenseId, required ≥0, notes ≤350 }`;重複 409 `PORTAL_ESH_NEED_DUPLICATE`;刪除為硬刪(同舊版) |
| GET | `/api/portal/esh/holders?company=&licenseId=&view=current\|history\|untracked` | `portal.api.esh.holder.read` | 人員證照(狀態 `left / unset / expired / notify / ok`、`daysLeft`、`docs`) |
| POST / PUT / DELETE | `/api/portal/esh/holders`、`/holders/:id` | `portal.api.esh.holder.edit` | 新增 `{ empNo, licenseId, company, trainingDate?, gatDate?, retrainDate?, notifyDays }`(在職檢查 400 `PORTAL_ESH_EMP_NOT_ACTIVE`、重複 409 `PORTAL_ESH_HOLDER_DUPLICATE`);**下次複訓日由後端計算**;刪除為軟刪 |
| POST / DELETE | `/api/portal/esh/holders/:id/docs`、`/docs/:docId`、`/legacy-docs?fileName=` | `portal.api.esh.holder.edit` | 證照影本(file-service refType `portal-esh-license`,pdf / jpg / png);舊站 LicenseFileC 刪除需同工號 |
| POST | `/api/portal/esh/notify` | `portal.api.esh.notify.send` | 立即通知(本人管理的公司);`{ runId, mode, total, counts }`;同公司 10 分鐘內 409 `PORTAL_ESH_NOTIFY_TOO_SOON` |
| GET | `/api/portal/esh/notify/runs`、`/runs/:id` | `portal.api.esh.notify.read` | 通知紀錄(排程 + 手動)與寄送明細(只列範圍內公司);`mode` = `dry-run` / `gateway` |
| GET / POST / PUT / DELETE | `/api/portal/esh/managers` | `.manager.read` / `portal.api.esh.manager.edit` | 證照管理員 `{ company, empNo, sendMail }`;重複 409 `PORTAL_ESH_MANAGER_DUPLICATE`;最後一位 409 `PORTAL_ESH_MANAGER_LAST` |
| GET | `/api/portal/esh/chemicals?restrict=列管\|不列管&from=&to=&keyword=&page=&pageSize=`、`/chemicals/:efId` | `portal.api.esh.chemical.read` | 危害性化學品(所有員工;分頁;成份以 EF_ID 對應;SDS `file / url / legacy`) |
| POST | `/api/portal/esh/chemicals/sync` | `portal.api.esh.chemical.edit` | `{ from?, to? }`(≤36 個月)由 BPM 唯讀同步,整批一個交易;另須 `portal-esh-admin`;執行中 409 `PORTAL_ESH_SYNC_RUNNING`;BPM 未設定 503 |
| GET / PUT / DELETE | `/api/portal/esh/chemicals/sync/runs`、`/chemicals/:efId/sds` | `portal.api.esh.chemical.edit` | 同步紀錄;上傳 SDS(file-service refType `portal-esh-sds`,同步不覆寫) |
| GET | `/healthz`、`/readyz`、`/openapi.json` | 無(不經 BFF 對外) | `/readyz` 的 `checks` 含 `sql` 與每個舊庫來源 `src:<來源>` |

### 3.1 草案

> P3 決定:公告一律由 Gateway 通知中心(GigaItApp 發布)提供,下表 `/api/portal/news*` 發布類草案**不實作**(FEATURE-PLAN §5);集團系統、行事曆已實作(§3.0)。

| 方法 | 對外路徑 | 權限 | 說明 |
| --- | --- | --- | --- |
| GET | `/api/portal/news?category=&unread=&page=&pageSize=` | `portal.news.read` | 公告清單(依公司 / 部門可見範圍),含未讀 |
| GET | `/api/portal/news/:id` | `portal.news.read` | 公告內容;讀取即標記已讀 |
| POST | `/api/portal/news` | `portal.news.publish` | 發布公告(標題、內容、分類、可見範圍、置頂、期限) |
| PATCH / DELETE | `/api/portal/news/:id` | `portal.news.publish` | 修改 / 下架(只能管理自己部門發布的,主管理角色除外) |
| GET | `/api/portal/resources?category=` | `portal.resource.read` | 行政資源(文件、連結、說明) |
| PUT | `/api/portal/resources/:id` | `portal.resource.edit` | 維護行政資源 |
| GET | `/v1/healthz`、`/v1/readyz`、`/openapi.json` | 無(不經 BFF 對外) | 健康檢查、規格 |

## 4. 首頁聚合回應

> **P3 已實作為 portal-api 自己的 `GET /api/portal/dashboard`**(回應格式見 §3.0;不是 BFF aggregate)。出勤、假期、KPI 等 TIPTOP / HRM 區塊不提供(D-1);下方為 PRD 初版草案,保留供人事系統上線後參考。

### 4.1 初版草案(未實作)

```jsonc
// GET /api/portal/dashboard
{
  "profile":    { "employeeNo": "V112001", "name": "蔣佳緯", "department": "資訊服務部", "title": "資深系統工程師", "ext": "2120" },
  "attendance": { "date": "2026-09-23", "clockIn": "08:24", "clockOut": null, "status": "punched" },
  "kpis":       { "attendanceDays": 11, "overtimeHours": 4, "pendingApprovals": 4, "trainingHours": 18, "delta": { "attendanceDays": 0.98 } },
  "leave":      { "annual": { "used": 6.5, "remaining": 8.5 }, "compensatory": { "used": 1, "total": 3 }, "sick": { "used": 2, "total": 30 } },
  "approvals":  { "total": 4, "urgent": 2, "items": [ /* 前 4 筆 */ ] },
  "news":       { "unread": 3, "items": [ /* 前 5 筆 */ ] },
  "schedule":   [ /* 近期行程 */ ],
  "_meta":      { "errors": [], "mockSections": ["kpis", "leave", "schedule"] }
}
```

## 5. 錯誤代碼(草案)

| code | HTTP | 情境 |
| --- | --- | --- |
| `PORTAL_INTERNAL_TOKEN_INVALID` | 401 | 缺少或無效的內部 Token(不經 BFF 直接呼叫) |
| `VALIDATION_FAILED` | 400 | 參數錯誤(`details` 列出欄位;沿用 Gateway 共用代碼) |
| `PORTAL_NOT_FOUND` | 404 | 公告、資源不存在 |
| `PORTAL_DATA_ACCESS_DENIED` | 403 | 不在可見 / 可管理範圍(例:管理其他部門的公告) |
| `PORTAL_CONFLICT` | 409 | 同時編輯(版本不符) |
| `PORTAL_QA_NOT_FOUND` | 404 | 問卷不存在、已刪除,或(填答)不在期間 / 不在對象內 |
| `PORTAL_QA_ANSWERED` | 409 | 本人已作答過此問卷 |
| `PORTAL_QA_LOCKED` | 409 | 問卷已有作答,題目結構不可變更(`details` 列出變更項目) |
| `PORTAL_QA_INVALID` | 400 | 問卷設定或作答內容不合規則(`details` 逐欄 / 逐題) |
| `PORTAL_QA_CONFLICT` | 409 | 新問卷編號連續重複(同一秒大量建立) |
| `PORTAL_JOB_TIER_UNAVAILABLE` | 503 | 職級快速帶入的資料來源(Gateway)尚未提供 |
| `PORTAL_SLIDE_NOT_FOUND` | 404 | 首頁輪播圖片不存在 |
| `PORTAL_CALENDAR_NOT_FOUND` | 404 | 該年度沒有行事曆 |
| `PORTAL_LINK_NOT_FOUND` | 404 | 集團系統 / 個人常用連結不存在(或不是本人的) |
| `PORTAL_LINK_LIMIT` | 409 | 個人常用連結已達上限(20) |
| `PORTAL_TALK_NOT_FOUND` | 404 | 3691 發言不存在 |
| `PORTAL_TALK_BLOCKED` | 409 | 發言(或其上層)已屏蔽,不能回覆或按讚 |
| `PORTAL_TALK_KEY_UNAVAILABLE` | 503 | 3691 作者加密金鑰未設定,不能發文 / 解碼 |
| `PORTAL_TALK_AUTHOR_LEGACY` | 409 | 舊入口網發文(舊 DES mark),新站不解碼 |
| `PORTAL_TALK_AUTHOR_NOT_FOUND` | 404 | 發言沒有作者資料 |
| `PORTAL_TALK_AUTHOR_DECRYPT_FAILED` | 500 | 作者資料解不開(金鑰不符或資料毀損) |
| `PORTAL_BPM_UNAVAILABLE` | 503 | portal-api 未設定 BPM 資料來源 |
| `PORTAL_FORM_NOT_FOUND` | 404 | 表單不存在 |
| `PORTAL_FORM_CATEGORY_NOT_FOUND` | 404 | 表單分類不存在 |
| `PORTAL_FORM_CATEGORY_DUPLICATE` | 409 | 已有同名的表單分類 |
| `PORTAL_FORM_CATEGORY_IN_USE` | 409 | 分類下還有表單,不能刪除 |
| `PORTAL_MGR_DEPT_REQUIRED` | 400 | 全公司主管角色查詢清單時未指定部門 |
| `PORTAL_MGR_PROPERTY_NOT_FOUND` | 404 | 保管人該資產沒有備註紀錄 |
| `PORTAL_MGR_TRAINING_YEAR_UNSET` | 503 | 舊系統未設定編列年度(ELClassAnnual) |
| `PORTAL_MGR_TRAINING_NOT_FOUND` | 404 | 課程不存在或不屬於本人本年度負責部門 |
| `PORTAL_MGR_TRAINING_DUPLICATE` | 409 | 同年度同部門已有同名課程 |
| `PORTAL_MGR_TRAINING_LOCKED` | 409 | 訓練計畫已提交(本人或該部門) |
| `PORTAL_MGR_TRAINING_INCOMPLETE` | 422 | 提交檢查未通過(`details` 列出部門 / 課程問題) |
| `PORTAL_MGR_BUDGET_VERSION_NOT_FOUND` | 404 | 預算版本不存在、不屬於本人公司或已結案(編列) |
| `PORTAL_MGR_BUDGET_LOCKED` | 409 | 部門預算已送出或版本已結案 |
| `PORTAL_MGR_BUDGET_CHANGED` | 409 | 預算資料列已不存在(需重新整理) |
| `PORTAL_ESH_ITEM_NOT_FOUND` | 404 | 證照項目不存在或已刪除 |
| `PORTAL_ESH_ITEM_DUPLICATE` | 409 | 啟用中已有同名證照項目 |
| `PORTAL_ESH_ITEM_IN_USE` | 409 | 證照項目仍有公司需求或啟用中的持證人 |
| `PORTAL_ESH_NEED_NOT_FOUND` | 404 | 證照需求不存在 |
| `PORTAL_ESH_NEED_DUPLICATE` | 409 | 同公司同證照已有需求 |
| `PORTAL_ESH_HOLDER_NOT_FOUND` | 404 | 人員證照不存在或已刪除 |
| `PORTAL_ESH_HOLDER_DUPLICATE` | 409 | 同人同證照同公司已有啟用中紀錄 |
| `PORTAL_ESH_EMP_NOT_ACTIVE` | 400 | 工號查無在職的 LOS 人事資料 |
| `PORTAL_ESH_DOC_NOT_FOUND` | 404 | 證照影本不存在 |
| `PORTAL_ESH_MANAGER_NOT_FOUND` | 404 | 證照管理員不存在 |
| `PORTAL_ESH_MANAGER_DUPLICATE` | 409 | 已是該公司的證照管理員 |
| `PORTAL_ESH_MANAGER_LAST` | 409 | 不可刪除公司最後一位證照管理員 |
| `PORTAL_ESH_NOTIFY_TOO_SOON` | 409 | 10 分鐘內已手動通知過 |
| `PORTAL_ESH_RUN_NOT_FOUND` | 404 | 通知紀錄不存在或不在範圍內 |
| `PORTAL_ESH_CHEMICAL_NOT_FOUND` | 404 | 化學品申報不存在(或沒有新站上傳的 SDS) |
| `PORTAL_ESH_SYNC_RUNNING` | 409 | 化學品同步執行中 |

Gateway 層的錯誤(`UNAUTHENTICATED`、`PERMISSION_DENIED`、`ROUTE_NOT_FOUND`、`UPSTREAM_*`…)依 Gateway PRD §8.1.1 處理。
