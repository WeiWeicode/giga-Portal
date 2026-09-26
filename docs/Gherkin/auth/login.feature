# language: zh-TW
@M1
功能: 登入頁
  為了用一組帳號進入所有應用
  身為 員工
  我要在員工入口網 /login 以 AD 或本機帳號登入

  # PRD FR-1.1–1.2;Gateway PRD §8.2.1、§8.1.1。

  @manual
  場景: 登入成功後導回原頁
    假如 未登入的使用者開啟 "/personal/leave"
    那麼 導向 "/login?redirect=%2Fpersonal%2Fleave"
    當 以工號 "S112009" 與正確密碼登入
    那麼 回到 "/personal/leave"

  @wip
  場景大綱: 依 Gateway 錯誤代碼顯示訊息
    當 登入回應 code 為 "<code>"
    那麼 畫面顯示「<訊息>」

    例子:
      | code                   | 訊息                         |
      | INVALID_CREDENTIALS    | 帳號或密碼錯誤               |
      | ACCOUNT_NOT_REGISTERED | 尚未註冊,前往註冊(連結)   |
      | LOGIN_THROTTLED        | 嘗試次數過多,請稍後再試     |
      | ACCOUNT_LOCKED         | 帳號已鎖定,請稍後再試或洽 IT |

  @security @auto
  場景大綱: redirect 只接受同網域相對路徑
    當 以 "/login?redirect=<redirect>" 登入成功
    那麼 導向 "<結果>"

    例子:
      | redirect               | 結果     |
      | %2Fit%2F               | /it/     |
      | https%3A%2F%2Fevil.com | /        |
      | %2F%2Fevil.com         | /        |
