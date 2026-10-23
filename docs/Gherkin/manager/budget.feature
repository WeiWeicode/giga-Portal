# language: zh-TW
@P5
功能: 部門預算與預算編列
  為了掌握部門預算並在編列期間填寫新年度預算
  身為 Budget 系統登記的部門主管或管理者(且具 portal-manager)
  我要查看預算執行並編列、送出部門預算

  # FEATURE-PLAN §7.2;PORTAL-API-PLAN D-26。舊程式:Budget_DeptInfoV2(查詢)、Budget_DeptData(編列);
  # Budget_DeptDataHR(無權限、無鎖定)與 Budget_DeptInfo(舊版)不做。
  # 資料:Budget 庫 CurrentFlag、BudgetVersionInfo、UserInfo、DeptInfo、AccountingCourses、DeptBudgetList、BudgetData、DeptBudgetMark、
  # 部門狀態、部門備註、AcctProductFuncDept / AcctFunc / AcctProduct / AcctProductItem。
  # 公司:LOS EmployeeInfo.CompDB 對應 Budget 公司(設定 BUDGET_COMPANY_MAP,預設 DS11=GSMC、DS36=WHOLESUN、DS15=GEE)。
  # 實際金額(TIPTOP 傳票 OPENQUERY ERPSOURCE)系統轉移中:回 actual = null、unavailable ["actual"]。
  # 讀取 portal.api.mgr.budget.read / portal.api.mgr.budget-apply.read;寫入按鈕 portal.mgr.budget-apply.edit(includes portal.api.mgr.budget-apply.write)。

  背景:
    假如 主管 A 的 Token roles 含 "portal-manager",LOS 公司別 DS11(GSMC)
    而且 Budget UserInfo 有 A 在 GSMC 的「部門主管」紀錄,部門 "S1800"

  @auto
  場景: 可看部門(D-26)
    當 主管 A 呼叫 GET /api/portal/manager/budget/options
    那麼 回應公司 GSMC、CurrentFlag 年度、該年度版本清單(預設最新)與部門 "S1800"
    而且 UserInfo 為「管理者」者看到該公司全部啟用部門
    而且 Token 沒有 portal-manager(或 portal-manager-all)回 403 PORTAL_DATA_ACCESS_DENIED;UserInfo 沒有紀錄者部門清單為空

  @auto
  場景: 預算執行(只顯示預算)
    當 GET /api/portal/manager/budget?flag=153&dept=S1800
    那麼 列出各會計科目 1~12 月預算與年度合計、每月總計;合計科目(5500、6100、6200…)與 6210 不列,代碼 0 開頭的科目預設不列
    而且 actual 為 null、unavailable 含 "actual"(畫面顯示實際金額「系統轉移中」)
    而且 部門不在可看清單回 403;版本不屬於該公司當期年度回 404 PORTAL_MGR_BUDGET_VERSION_NOT_FOUND

  @auto
  場景: 預算編列清單
    當 GET /api/portal/manager/budget-apply/options
    那麼 只列該公司未結案(IsFinal = 0)的版本
    當 GET /api/portal/manager/budget-apply?flag=154&dept=S1800
    那麼 列出科目(DeptBudgetList 該部門第 1 月的科目 + 產品功能部門展開的合計 / 明細科目)、1~12 月金額與備註、部門備註、部門狀態
    而且 每個科目標示 editable:合計科目不可填(例外清單 6234、6134、6334、5534 可填)、禁填清單不可填、DeptBudgetList 沒有該月資料不可填
    而且 去年實際金額系統轉移中

  @auto
  場景: 更新預算(後端鎖定檢查、交易)
    當 PUT /api/portal/manager/budget-apply:flag 154、dept "S1800"、cells [{code "6211", month 3, amount 1500, mark "教育訓練"}]、remark「說明」
    那麼 在同一交易內更新 DeptBudgetList.Amount 與 BudgetData.amt、刪除後新增 DeptBudgetMark 與部門備註,回應更新後的資料
    而且 金額不是數字或超過 2 位小數、月份不在 1~12、科目不可填回 400 VALIDATION_FAILED(列出科目與月份)
    而且 部門已送出(部門狀態 1 / 2 / 5)或版本已結案回 409 PORTAL_MGR_BUDGET_LOCKED(舊版只隱藏按鈕);資料庫錯誤整筆回復並回 500(舊版吞掉後顯示成功)

  @auto
  場景: 送出部門預算
    當 POST /api/portal/manager/budget-apply/submit
    那麼 刪除後新增部門狀態(Flag、DeptID、CompanyID、IsFinish 0、Status 1),回應 locked = true
    而且 畫面上有未儲存的修改時不送出,提示「預算資料未上傳更新」
    而且 已送出或已結案回 409 PORTAL_MGR_BUDGET_LOCKED
