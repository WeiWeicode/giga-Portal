# 員工入口網 — API 規格

> **狀態:規劃中**。portal-api 端點為設計草案,實作時以 OpenAPI(`/openapi.json`,自動註冊到 Gateway)為準並回頭更新本文件。
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
| POST | `/api/auth/register`、`/register/verify` | 自行註冊 | 無網域子公司;送出 `{ employeeNo, name, hireDate? }` / `{ token, password }`(**`/register` 本機 Gateway 尚未實作**,畫面會顯示 BFF 錯誤) |
| POST | `/api/auth/password/forgot`、`/reset`、`/change` | 忘記 / 重設 / 變更密碼 | 送出 `{ employeeNo }` / `{ token, password }` / `{ currentPassword?, newPassword }`(**forgot、reset 本機 Gateway 尚未實作**;change 已實作,`PASSWORD_CHANGE_REQUIRED` 後以限定憑證呼叫不需目前密碼) |

> 註冊、忘記密碼的請求欄位依 Gateway PRD §8.2.5 推定,Gateway 實作時以其規格為準並回頭更新本表。

### 2.1 應用切換的導回參數(前端,提議)

| 項目 | 規則 |
| --- | --- |
| `/?denied=<應用代碼>` | 其他應用的應用層守衛沒有權限時導回入口網並帶此參數(例 GigaItApp:`/?denied=it`);入口網顯示「您沒有{應用名稱}的使用權限」後移除參數。尚未寫入 Gateway FRONTEND-GUIDE §7.4,需與 Gateway、GigaItApp(I3)確認 |
| GET | `/api/portal/dashboard` | 首頁聚合(BFF aggregate) | 步驟:個人資料、出勤、假期、待簽核、公告、行程;非必要步驟失敗時 `_meta.errors` |
| GET | `/api/bpm/approvals`、POST `/api/bpm/approvals/:id/approve`、`/reject` | 待我簽核、核准 / 退回 | 權限 `bpm.approval.read` / `approve` / `reject`(需 BPM 負責人提供,PRD Q8) |
| GET | `/api/hrm/profile`、`/api/hrm/attendance`、`/api/hrm/leaves` | 個人資料、出勤、假期 | 需 HRM 負責人提供(PRD Q8);目前本機只有模擬的 `/api/hrm/profile`、`/api/hrm/todos` |

> 新增使用的 API 前先查 BFF 路由表(Gateway `AGENT.md` §10.4):`node ../giga-api-gateway-bff/sdk/node/dist/lookup-cli.js <關鍵字> --gherkin`。

## 3. portal-api 端點一覽(草案)

| 方法 | 對外路徑 | 權限 | 說明 |
| --- | --- | --- | --- |
| GET | `/api/portal/news?category=&unread=&page=&pageSize=` | `portal.news.read` | 公告清單(依公司 / 部門可見範圍),含未讀 |
| GET | `/api/portal/news/:id` | `portal.news.read` | 公告內容;讀取即標記已讀 |
| POST | `/api/portal/news` | `portal.news.publish` | 發布公告(標題、內容、分類、可見範圍、置頂、期限) |
| PATCH / DELETE | `/api/portal/news/:id` | `portal.news.publish` | 修改 / 下架(只能管理自己部門發布的,主管理角色除外) |
| GET | `/api/portal/resources?category=` | `portal.resource.read` | 行政資源(文件、連結、說明) |
| PUT | `/api/portal/resources/:id` | `portal.resource.edit` | 維護行政資源 |
| GET | `/api/portal/onboarding` | `portal.onboarding.read` | 新人導覽內容 |
| PUT | `/api/portal/onboarding` | `portal.onboarding.edit` | 維護新人導覽 |
| GET | `/api/portal/links` | `portal.links.read` | 集團系統 / 外部連結(含舊單一入口) |
| GET | `/api/portal/calendar?from=&to=` | `portal.calendar.read` | 公司行事曆與個人行程(個人部分待資料來源) |
| GET | `/v1/healthz`、`/v1/readyz`、`/openapi.json` | 無(不經 BFF 對外) | 健康檢查、規格 |

## 4. 首頁聚合回應(草案)

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
| `PORTAL_VALIDATION_FAILED` | 400 | 參數錯誤(`details` 列出欄位) |
| `PORTAL_NOT_FOUND` | 404 | 公告、資源不存在 |
| `PORTAL_DATA_ACCESS_DENIED` | 403 | 不在可見 / 可管理範圍(例:管理其他部門的公告) |
| `PORTAL_CONFLICT` | 409 | 同時編輯(版本不符) |

Gateway 層的錯誤(`UNAUTHENTICATED`、`PERMISSION_DENIED`、`ROUTE_NOT_FOUND`、`UPSTREAM_*`…)依 Gateway PRD §8.1.1 處理。
