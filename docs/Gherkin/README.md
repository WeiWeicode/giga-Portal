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
| `home/home.feature` | 首頁區塊、聚合路由、部分失敗、模擬標示 | §6.4 | M4 |
| `home/approval.feature` | 待我簽核:核准 / 退回、權限 | §6.4 FR-4.5 | M4 / M5 |

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
- 帳號使用本機 Gateway 的種子帳號(虛構資料);權限代碼以 PRD §6.5 為準。
