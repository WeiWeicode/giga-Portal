# language: zh-TW
@P7
功能: 中華郵政寄件登記(臨時服務)
  為了讓總務依寄件人與費用部門結算郵資
  身為 員工
  我要登記掛號 / 快捷等寄件,並在總務填入郵資前修改或作廢

  # FEATURE-PLAN §9;舊程式 ChunghwaPost.aspx(.cs)。資料:MisDb SendMailLog(寫入)、LOS EmployeeInfo(在職寄件人)。
  # 網址 /services/post,不在選單;讀取 portal.api.svc.post.read,維護按鈕 portal.svc.post.edit。

  @auto
  場景: 本人清單
    當 開啟 /services/post(GET /api/portal/services/post?from=&to=)
    那麼 只列寄件人 = 本人、未作廢、寄件日期在區間內的登記(預設一個月內)

  @auto
  場景: 寄件人以工號精確選擇
    當 新增登記(POST /api/portal/services/post),寄件人工號不是在職員工
    那麼 回應 400(舊版以模糊比對取第一筆,可能選錯人)
    當 寄件人在職、費用部門 / 收件人 / 郵遞區號 / 類別都填寫
    那麼 寫入 SendMailLog(SenderID、SenderName、SendDate、Dept、Receiver、MailAreaNo、MailType、IsActive = 1)

  @auto
  場景: 只能修改或作廢自己的
    假如 登記的寄件人不是本人
    當 修改(PUT)或作廢(DELETE)
    那麼 回應 403 PORTAL_DATA_ACCESS_DENIED

  @auto
  場景: 有郵資後不可改或作廢
    假如 總務已填入郵資(MailMoney 不為空)
    當 修改或作廢
    那麼 回應 409 PORTAL_POST_LOCKED(舊版修改時只在開啟編輯時檢查)
