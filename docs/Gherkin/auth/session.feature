# language: zh-TW
@M1 @wip
功能: Session 與登出
  為了安全又不中斷地使用各應用
  身為 員工
  我要在 Token 到期時自動更新,登出時所有應用一起登出

  # PRD FR-1.5–1.6;Gateway PRD §8.2.2;FRONTEND-GUIDE §6.3。

  場景: Access Token 過期時自動更新
    假如 使用者已登入且 Access Token 已過期
    當 呼叫任一 /api/* 回應 401
    那麼 web-kit 呼叫 /api/auth/refresh 成功後重送原請求,畫面不中斷

  場景: Refresh 失敗導向登入頁
    假如 Refresh Token 已撤銷
    當 呼叫任一 /api/*
    那麼 導向 "/login?redirect=<目前路徑>"

  場景: 登出後所有應用都需重新登入
    當 在員工入口網按「登出」
    那麼 導向 "/login"
    而且 開啟 "/it/" 也會被導向 "/login"
