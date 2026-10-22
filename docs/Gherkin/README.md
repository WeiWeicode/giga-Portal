# 員工入口網 — Gherkin 行為規格

> 以 Gherkin(繁體中文關鍵字,`# language: zh-TW`)描述員工入口網的驗收行為,對應 [PRD.md](../PRD.md) **v0.1.2**。
> 寫法沿用 Gateway 專案 `docs/Gherkin/README.md`;場景以**可觀察的行為**(HTTP 狀態、`code`、畫面)描述。標籤標在場景上:已驗證的為 `@auto` / `@manual` / `@e2e`,尚未實作或依賴未完成的 Gateway 功能者為 `@wip`(M1 的驗證紀錄見 `../DevelopmentProcess/NewFeatures.md`)。

## 檔案一覽

| 檔案 | 內容 | PRD | 里程碑 |
| --- | --- | --- | --- |
| `auth/login.feature` | 登入頁、錯誤訊息、導回原頁、拒絕外部 redirect | §6.1 FR-1.1–1.2 | M1 |
| `auth/password.feature` | 首次登入設定新密碼、忘記密碼、變更密碼 | §6.1 FR-1.3–1.4 | M1 |
| `auth/register.feature` | 無網域子公司自行註冊 | §6.1 FR-1.4 | M1 |
| `auth/session.feature` | Token 自動更新、登出、所有應用同時登出 | §6.1 FR-1.5–1.6 | M1 |
| `auth/app-switch.feature` | 應用切換只列有權限的應用、整頁導向、不需再登入 | §6.2 FR-2.1–2.3 | M1 / M3 |
| `auth/app-guard.feature` | 應用層守衛:入口網無權限頁、GigaItApp 導回入口網 | §6.2 FR-2.4–2.5 | M1 / M3 |
| `rbac/button.feature` | 選單 / Tab / 按鈕依權限顯示、依部門與職級生效、按鈕 = API 權限 | §6.3 | M2 |
| `ui/navigation.feature` | 兩層選單、Tab、403、收合、手機寬度 | §6.3、§6.6 | M1 |
| `ui/theme.feature` | 玻璃 / 扁平 × 明亮 / 黑暗切換與記憶、自動扁平 | §6.6 FR-6.2–6.4 | M1 |
| `ui/search.feature` | 全域搜尋(有權限的功能) | §6.6 FR-6.8 | M4 |
| `home/home.feature` | 首頁聚合(待辦、個人秘書與常用連結、舊公告、輪播與維護)、部分失敗 | §6.4、FEATURE-PLAN §1 | P3 |
| `api/skeleton.feature` | portal-api 骨架:內部 Token、`/me`、OpenAPI、舊庫來源前綴 | PORTAL-API-PLAN §3 | P0 |
| `personal/courses.feature` | 年度必上課程(照舊規則) | PORTAL-API-PLAN D-9 | P1 |
| `personal/notes.feature` | 個人提醒(portal.personal_note) | PORTAL-API-PLAN P1-2 | P1 |
| `personal/assets.feature` | 個人資產明細(備註) | PORTAL-API-PLAN D-12 | P1 |
| `resources/directory.feature` | 分機表查詢與更新本人分機 | PORTAL-API-PLAN P2-1 | P2 |
| `resources/jobs.feature` | 內部職缺 | PORTAL-API-PLAN D-15 | P2 |
| `resources/onboarding.feature` | 新人導覽(小叮嚀已讀、驗收測驗) | FEATURE-PLAN §3.5、PORTAL-API-PLAN D-20 | P2 |
| `resources/qa.feature` | 問卷調查(我的問卷、填答、出題 / 代管、統計、匯出) | FEATURE-PLAN §3.4、PORTAL-API-PLAN D-18、D-19、D-28 | P2 |
| `group/news.feature` | 最新公告(通知中心、舊入口網公告唯讀併入) | FEATURE-PLAN §5、PORTAL-API-PLAN D-21 | P3 |
| `group/calendar.feature` | 年度行事曆 PDF(依年度切換、編輯者上傳) | FEATURE-PLAN §5 | P3 |
| `group/links.feature` | 集團系統(DES 跳轉系統只顯示待重構) | FEATURE-PLAN §5、§6.3、PORTAL-API-PLAN D-22 | P3 |
| `group/talk.feature` | 3691 全民開講(匿名發文、屏蔽、作者加密與授權解碼稽核) | FEATURE-PLAN §5.1、PORTAL-API-PLAN D-23 | P3 |
| `personal/bpm.feature` | BPM 簽核資訊(待簽核 / 未結案) | PORTAL-API-PLAN §3.3、D-13 | P1 |
| `personal/commute.feature` | 溫室氣體盤查員工通勤調查 | PORTAL-API-PLAN D-10、D-11 | P1 |
| `ui/migrating.feature` | 人事資料「系統轉移中」 | PORTAL-API-PLAN D-1 | P0 |
| `approval/approval.feature` | 待我簽核(待簽核 / 已簽核 / 我送出的,「前往簽核」深連結;非碩禾系不查 BPM) | FEATURE-PLAN §4、PORTAL-API-PLAN D-6、D-24、D-29 | P4 |
| `approval/forms.feature` | 表單下載(分類、file-service 檔案、編輯者維護) | FEATURE-PLAN §4、PORTAL-API-PLAN D-25 | P4 |

## 標籤慣例

| 標籤 | 意義 | 如何驗證 |
| --- | --- | --- |
| `@M1` … `@M5` | 所屬里程碑(PRD §11) | — |
| `@wip` | 尚未實作或依賴未完成的 Gateway 功能(P2-3a),暫不列入 CI | — |
| `@auto` | 已有自動化測試(測試名稱 = 場景名稱) | `backend/`、`frontend/`:`npm test` |
| `@manual` | 以瀏覽器操作驗證(四種風格組合、375px) | 修正紀錄寫明操作步驟 |
| `@e2e` | 需經 Gateway Nginx 的環境 | `sh deploy/e2e-smoke.sh`(規劃) |
| `@security` | 安全相關 | — |

## 撰寫原則

- 關鍵字使用 zh-TW 官方詞彙:`功能`、`背景`、`場景`、`場景大綱`、`例子`、`假如`、`當`、`那麼`、`而且`、`但是`;**Rule 須寫 `Rule:`**。
- 帳號使用假工號在測試區自行註冊的本機帳號;權限代碼以 PRD §6.5 為準。
