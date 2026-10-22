# language: zh-TW
@P2
功能: 新人導覽(小叮嚀、驗收區)
  為了讓新進同仁了解公司規定並完成新人測驗
  身為 員工
  我要閱讀小叮嚀並記錄已閱讀,再完成 20 題是非題驗收測驗

  # 舊程式 HRnewPep01.aspx(.cs)、HRnewPep05.aspx(.cs)、HRnewPepAnw01~07.aspx;As-Is 規格 ../old_PortalSolar/docs/behavior/onboarding/onboarding.feature
  # FEATURE-PLAN §3.5、PORTAL-API-PLAN D-20。資料 PortalSolar NewPepR / HRNewPtest(與舊入口網共用,並行期舊系統讀得到)。
  # 與舊系統一樣不限新人,任何有權限的員工都能閱讀與測驗;不寄通知信;不做舊頁已失效的「求救」提示。

  @manual
  場景: 閱讀小叮嚀
    當 員工開啟「新人導覽 › 小叮嚀」
    那麼 顯示舊頁照搬的 29 條注意事項、各班別出勤表、其他生活規範與 Q&A(人資規章、門禁、離職、試用期、其他、請假)
    而且 頁尾有「我已閱讀完畢」按鈕(按鈕權限 portal.onboarding.confirm)與最近一次閱讀日期

  @auto
  場景: 記錄已閱讀
    當 按「我已閱讀完畢」(POST /api/portal/onboarding/read)
    那麼 寫一筆 NewPepR(LgNo = Token 工號、LgTime = 今天 yyyy/MM/dd,同舊程式格式)並回應今天的 readAt
    而且 同一天再按不會多寫一筆(舊版每按一次一筆;舊報表只取 MAX,不影響相容)

  @auto
  場景: 查詢本人完成狀態
    當 呼叫 GET /api/portal/onboarding/status
    那麼 回應 { readAt, passedAt }(YYYY-MM-DD,沒有紀錄為 null),供首頁待辦使用
    而且 passedAt 只認 PGrade = "100" 的紀錄(舊版題目較多時期的其他分數不算通過)

  @auto
  場景: 取得驗收測驗題目
    當 呼叫 GET /api/portal/onboarding/quiz
    那麼 回應 20 題題號與題目(照搬舊頁),不含標準答案

  @auto
  場景: 標準答案(寫死在後端)
    那麼 各題正確答案與舊程式 HRnewPep05.aspx.cs 相同(是是否是是 是否是是否 否否是是否 否是否是是),每題 5 分

  @auto
  場景: 未全對
    當 送出 20 題作答且答對少於 20 題
    那麼 回應 passed=false 與答對題數、分數
    而且 不寫入、也不刪除任何 HRNewPtest 紀錄

  @auto
  場景: 全對通過
    當 送出 20 題全對的作答與「我有話要說」
    那麼 回應 passed=true 與 passedAt = 今天
    而且 同一交易內先刪除本人所有舊 HRNewPtest 紀錄,再新增一筆(t1~t20「是 / 否」、a01 意見、MakeTime = 今天 yyyy/M/d、PGrade = "100")
    而且 不動其他人的紀錄

  @auto
  場景: 作答格式驗證
    當 作答不是 20 個是 / 否(true / false),或意見超過 500 字
    那麼 回應 400 VALIDATION_FAILED,不寫入
    而且 瀏覽器另外送來的工號會被忽略,一律以 Token 工號寫入

  @auto @security
  場景: 未經 Gateway 或系統帳號不能使用
    當 未帶內部 Token 呼叫
    那麼 回應 401
    當 以 API Key 等系統身分呼叫
    那麼 回應 403 PORTAL_DATA_ACCESS_DENIED

  @manual
  場景: 驗收區作答
    當 員工開啟「新人導覽 › 驗收區」
    那麼 20 題都未預選答案(舊版預設全為「是」),全部作答後才能按「上傳答案」(按鈕權限 portal.onboarding.submit)
    而且 不及格顯示「您答對 N 題,不及格,請重新測驗」並可重新作答;通過顯示「恭喜您已完成測驗」與通過日期
