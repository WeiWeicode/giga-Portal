# language: zh-TW
@P2
功能: 問卷調查(我的問卷、問卷維護)
  為了讓各單位調查同仁意見並統計結果
  身為 員工 / 出題者(portal.qa.edit)/ 代管者(portal.qa.admin)
  我要填寫屬於我的問卷,出題者要能建立、維護、統計與匯出自己的問卷

  # 舊程式 QA/MyQAList.aspx(.cs)、QA/QuestSetting.aspx(.cs)、QA/QuestView.aspx(.cs)、MainFormX.aspx.cs:194-292;
  # As-Is 規格 ../old_PortalSolar/docs/behavior/administrative/questionnaire.feature。
  # FEATURE-PLAN §3.4、PORTAL-API-PLAN D-18、D-19、D-28。資料 PortalSolar QAAnnual / QAAnnualB / QAAnnualC / QAAnnualD(與舊入口網共用,D-7)。
  # 測試:backend/test/qa.test.ts(場景名稱即測試名稱)、backend/test/int/qa.int.test.ts(SQL)、frontend/test/qa.test.ts(畫面邏輯)。

  # ───────────── 填答者 ─────────────

  @auto
  場景: 只列待填問卷
    假設 本人部門 "S1420"(內部 Token dept),工號 "S112009"
    當 呼叫 GET /api/portal/qa/pending
    那麼 只列出同時符合下列條件的問卷,依結束日排序:
      | 條件                                                                  |
      | IsActive = 1                                                          |
      | 今天(台灣時間)介於 QAStartDate 與 QAEndDate(含兩端;日期未設定不列) |
      | Kdept = "all";或 "S1420" **完整比對**在 Kdept 清單;或工號在 Kpep 清單(不分大小寫) |
      | QAAnnualC 沒有本人對此問卷的作答                                      |
    而且 Kdept 為 "S14" 的問卷不列出(舊版 LIKE 部分比對會列出)

  @auto
  場景: 非對象不可開啟
    假設 問卷的對象部門不含本人部門、對象人員不含本人
    當 呼叫 GET /api/portal/qa/pending/{QANo} 或 POST /api/portal/qa/pending/{QANo}/answers
    那麼 回應 404 PORTAL_QA_NOT_FOUND(已刪除、不在期間的問卷相同;舊版填答頁不檢查資格)

  @auto
  場景: 填答畫面的題目與清洗後的前言
    當 呼叫 GET /api/portal/qa/pending/{QANo}
    那麼 回應標題、主辦單位、期間、前言 / 結語(白名單過濾:script、事件屬性、外部圖片、javascript 連結移除)與題目
    而且 題目含題型(single / multi / text;舊資料題型空白為 null,只顯示不作答)、選項、複選上限(null = 不限)、必填、圖片

  @auto
  場景: 送出作答:複選題全部勾選項都寫入、人事屬性留空
    當 送出 { answers: [{ no: 1, choices: ["普通"] }, { no: 2, choices: ["C", "A"] }, { no: 3, text: "很好" }] }
    那麼 回應 201 與 answeredAt(台灣時間)
    而且 QAAnnualC 每題一列、複選題每個勾選項一列(依選項順序;舊版遇到第一個未勾選項就停止)
    而且 CPF03 / CPF04 / CPF19 / CPF24 / CPF70 / CPF14 / CPF31 / CPF29 / CPF34 / CPK02 為 NULL(D-18)
    而且 問答題的 < > 轉為全形(舊站統計頁不做 HTML 編碼)

  @auto
  場景: 未作答的非必填單選 / 問答寫空字串,複選不寫
    那麼 同舊程式:非必填單選、問答未作答寫 Answer = "",複選未勾選不寫,題型空白的舊題目不寫

  @auto
  場景大綱: 送出前檢查
    當 送出時 <情況>
    那麼 回應 400 PORTAL_QA_INVALID,details 含 "<訊息>",不寫入任何作答

    例子:
      | 情況                   | 訊息                                     |
      | 必填單選題未選         | 題1 單選題為必填,請確認選項!             |
      | 必填問答題空白         | 題3 問答題為必填,請確認填寫內容!         |
      | 複選題勾選數超過上限   | 題2 複選題選項超過2項,請確認選項!        |
      | 選項不在題目選項中     | 題 1 選項不存在                           |
      | 單選題選兩項           | 題 1 單選題只能選一項                     |
      | 問答題超過 300 字      | 題 3 回答超過 300 字                      |
      | 送來不存在的題號       | 題 9 不存在                               |

  @auto
  場景: 已填過
    假設 本人已作答此問卷
    當 再次送出,或開啟填答內容
    那麼 回應 409 PORTAL_QA_ANSWERED,不寫入
    而且 兩個請求同時送出時只有一份寫入(交易內以 UPDLOCK + HOLDLOCK 鎖定後再檢查;舊版可能寫入兩份)

  @auto
  場景: 寫入失敗時整份不寫
    當 寫入 QAAnnualC 途中失敗
    那麼 整份作答回復,不留下部分答案

  @manual
  場景: 我的問卷畫面
    當 開啟「行政資源 › 問卷調查 › 我的問卷」
    那麼 列出待填問卷卡片;按「填寫問卷」開啟對話框,送出按鈕需 portal.survey.submit
    而且 必填未填、複選超過上限時在畫面列出訊息(後端仍會再驗)
    而且 送出成功後該問卷從清單消失

  # ───────────── 出題者 ─────────────

  @auto
  場景: 新增問卷
    當 具 portal.qa.edit 者呼叫 POST /api/portal/qa/surveys
    那麼 回應 201 與新編號 "Q" + yyyyMMddHHmmss(台灣時間)+ 工號;同一秒重複時順延一秒
    而且 QAAnnual.CLgNo = 本人、IsActive = 1;主檔、題目、圖片同一交易寫入(題目以參數寫入,含單引號也不會失敗)
    而且 Kdept / Kpep 寫成逗號清單並加結尾逗號(舊首頁以 LIKE '%,工號,%' 比對,單一工號也比對得到)
    而且 QAAnnualB:Type 單選題 / 複選題 / 問答題、選項以「●」串接、LimNo 不限為 -1、IsWrite Y / N
    而且 前言 / 結語以白名單過濾後寫入

  @auto
  場景: 新增問卷的輸入檢查
    當 標題含 < >、結束日早於開始日、沒有任何對象、部門代碼格式錯誤、單 / 複選題沒有選項、選項含「●」、複選上限超過選項數、題目空白
    那麼 回應 400 PORTAL_QA_INVALID,不寫入

  @auto
  場景: 只列自己建立的問卷
    假設 S100001 與 S100002 各建立一份問卷
    當 S100001 呼叫 GET /api/portal/qa/surveys
    那麼 只回應 S100001 的問卷(分頁 { items, total, page, pageSize })
    而且 S100001 讀取、修改、刪除、複製、統計、匯出 S100002 的問卷時回應 403 PORTAL_DATA_ACCESS_DENIED

  @auto
  場景: 代管查看全部問卷
    當 具 portal.qa.admin 者呼叫 GET /api/portal/qa/admin/surveys?creator=S100002
    那麼 回應該出題者的問卷;不帶 creator 時列出全部(取代舊系統寫死 S094009 的「人員轉換」)
    而且 代管者可經 /api/portal/qa/admin/surveys/{QANo} 讀取與維護

  @auto
  場景: 編輯不改建立者;未作答時可重建題目與圖片
    當 代管者修改他人的問卷(尚未有人作答),刪掉一題並為題 1 加圖片
    那麼 回應 204,CLgNo 仍為原出題者(舊版先刪後插會改成編輯者)
    而且 題目依新內容重建;圖片寫 QAAnnualD(Item = "#1"、FileName = file-service UUID、Position 0 題目前 / 1 題目後)

  @auto
  場景: 已有作答後不可改題目結構
    假設 問卷已有 1 人作答
    當 修改題數、題型、選項、複選上限或必填
    那麼 回應 409 PORTAL_QA_LOCKED,資料不變
    當 只修改題目文字、圖片、說明、對象或起訖日
    那麼 回應 204,只更新這些欄位(題目不重建,作答仍以題號對應)

  @auto
  場景: 刪除問卷
    當 呼叫 DELETE /api/portal/qa/surveys/{QANo}
    那麼 回應 204,QAAnnual.IsActive = 0,題目與作答保留;之後清單不列出、讀取回 404

  @auto
  場景: 複製問卷
    當 呼叫 POST /api/portal/qa/surveys/{QANo}/copy
    那麼 回應 201 與新編號(Q + 時間 + 操作者工號)
    而且 複製主檔(標題加 "Copy"、建立者 = 操作者)、全部題目與圖片,不複製作答
    # 舊版複製後 CLgNo 仍是原出題者,複製者在自己的清單看不到

  @auto
  場景: 單題統計
    假設 2 人作答,題 1(單選)1 人選「滿意」、1 人的答案為舊選項「舊選項」
    當 呼叫 GET /api/portal/qa/surveys/{QANo}/stats
    那麼 respondents = 2;題 1 列出所有選項(0 人也列)再列不在選項中的答案,「滿意」1 人 50%
    而且 百分比分母 = 作答人數(複選題加總可超過 100%;舊版分母為答案列數)
    而且 空白答案不列入,answered 為有非空白作答的人數
    而且 unavailable 含 "hr":依人事屬性分組顯示「系統轉移中」(D-18)

  @auto
  場景: 匯出作答明細
    當 呼叫 GET /api/portal/qa/surveys/{QANo}/export
    那麼 下載 "<標題>.xlsx"(檔名不允許的字元換成 _),工作表「作答明細」一列一個答案
    而且 欄位:部門、工號、姓名(LOS EmployeeInfo)、題號、題目、答案、填答時間;人事屬性不匯出(系統轉移中)
    而且 答案以 "=" 開頭時仍為文字,不當成公式

  @auto
  場景: 取得部門樹 / 職級資料未提供
    當 呼叫 GET /api/portal/qa/org/departments
    那麼 回應 LOS DeptInfo 的部門代碼、名稱、上層代碼(畫面組成部門樹,加入部門時展開所有下層)
    當 呼叫 GET /api/portal/qa/org/job-tier?tier=manager
    那麼 Gateway 尚未提供職級查詢前回應 503 PORTAL_JOB_TIER_UNAVAILABLE

  @manual
  場景: 問卷維護畫面
    當 portal-editor 開啟「行政資源 › 問卷調查 › 問卷維護」
    那麼 列出自己建立的問卷,可搜尋標題、只看進行中;具 portal.qa.admin 者可切換「代管全部」並以出題者工號篩選
    而且 每份問卷可 編輯、預覽(不會送出)、統計、匯出、複製、刪除;已有作答的顯示「題目已鎖定」
    而且 編輯對話框:主辦單位下拉、起訖日、前言 / 結語、填寫對象(全集團 / 部門搜尋加入含下層 / 工號清單 / 理級、課級以上)、
         題目(題型、必填、選項範本「滿意程度 / 滿意分數 / 同意程度」、複選上限、上移 / 下移 / 刪除、上傳圖片)
    而且 圖片上傳到 giga-file-service,問卷存檔後綁定(refType portal-qa、refNo = 問卷編號)

  @manual
  場景: 舊入口網讀得到新站的問卷與作答(並行期,D-7)
    假設 在新入口網建立問卷(對象含測試帳號)並填答
    那麼 舊入口網首頁待辦列出該問卷、舊「問卷編輯」以建立者登入看得到、舊統計 / 匯出讀得到新站寫入的作答
    但是 新站上傳的題目圖片在舊站顯示不出(D-28,接受)
