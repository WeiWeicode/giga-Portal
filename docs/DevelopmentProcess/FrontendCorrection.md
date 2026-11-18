# 前端修改紀錄

> 新紀錄加在最上方;範圍 `frontend/`;格式見 `AGENT.md` §11。

## 2026-11-18 註冊頁:此工號已有帳號時引導登入 / 忘記密碼
- 內容:正式區問題 #2(需求方決定方案 A)。BFF 對已有本機帳號的工號改回 `REGISTRATION_ACCOUNT_EXISTS`(「此工號可能已有帳號,請直接登入或使用忘記密碼」),註冊頁顯示該訊息並附「回到登入」「使用忘記密碼」連結;新增 `isAccountExists()`。其他被拒原因維持統一訊息
- 檔案:`frontend/src/api/gateway.ts`、`frontend/src/pages/auth/Register.vue`、`frontend/test/register-error.test.ts`
- 驗證:typecheck、`npm test` 40 項、build 通過。依賴 BFF `feature/register-exists-and-auth-log`;測試區步驟:/register 輸入已啟用帳號的工號(例 V112001)→ 看到訊息與兩個連結
