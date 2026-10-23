# language: zh-TW
@P7
功能: 員工持股會滿 3 年領回確認(臨時服務)
  為了讓持股滿 3 年的同仁決定是否領回自提持股
  身為 員工
  我要看到本人當年度可領股數,選擇領回(填集保帳號)或不領回

  # FEATURE-PLAN §9;舊程式 EmployeeStockOwnershipCheck.aspx(.cs)、首頁 MainFormX.aspx.cs:592。
  # 資料:PortalSolar EmployeeStockInfo(唯讀)、EmployeeStockLog(寫入)。網址 /services/stock,不在選單;
  # 讀取 portal.api.svc.stock.read,送出按鈕 portal.svc.stock.submit。
  # Q-F11:EmployeeStockLog.UserName 舊版寫工號(測試區複本 293 筆全部 = UserID,未找到讀此欄的程式),新站預設照舊寫工號(CONFIRM-NEEDED P7)。

  @auto
  場景: 只列本人資料
    當 開啟 /services/stock(GET /api/portal/services/stock)
    那麼 列出本人當年度的持股(執行年度、入會年月、可領年月、持股類別、總持股數、可領股數)與歷年紀錄
    而且 集保帳號只顯示末 4 碼

  @auto
  場景: 可領回才可送出
    假如 本人當年度自提持股 CanBack = N
    當 送出領回(POST /api/portal/services/stock/decision)
    那麼 回應 409 PORTAL_STOCK_NOT_ELIGIBLE(舊版只隱藏按鈕)

  @auto
  場景: 領回需 11 碼集保帳號
    當 選擇領回,集保帳號去除 - 後不是 11 碼數字
    那麼 回應 400
    當 填 11 碼送出
    那麼 寫入 EmployeeStockLog(Annual、UserID、UserName = 工號、ConfirmTime、BackStockNo = 可領股數、DoBack = Y、BankAccount = 11 碼)

  @auto
  場景: 每年度一筆
    假如 本人當年度已有回覆紀錄
    當 再送出(含同時送出兩次)
    那麼 回應 409 PORTAL_STOCK_DECIDED,紀錄仍只有一筆

  @auto
  場景: 當年度沒有資料顯示服務已結束
    假如 EmployeeStockInfo 沒有本人當年度資料
    當 開啟或送出
    那麼 開啟回應 open = false;送出回應 410 PORTAL_SERVICE_ENDED
