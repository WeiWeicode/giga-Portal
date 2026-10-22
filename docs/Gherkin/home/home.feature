# language: zh-TW
@P3
功能: 首頁
  為了一登入就掌握今天要做的事
  身為 員工
  我要在首頁看到問候、待辦事項、個人秘書、最新公告與圖片輪播

  # FEATURE-PLAN §1;PRD §6.4 FR-4.1、FR-4.7、FR-4.8;PORTAL-API-PLAN D-21、D-24、D-29;API.md §3.0「首頁」。
  # 舊程式 MainFormX.aspx(.cs);As-Is 規格 ../old_PortalSolar/docs/behavior/home/home.feature。
  # 舊首頁 15 種提醒中的出勤異常、二代健保、勞健保異動、加班費扣款、薪資異動、密碼到期為 TIPTOP / AD 來源(D-1),不顯示。

  @auto
  場景: 首屏只呼叫兩支 API
    當 開啟首頁
    那麼 只呼叫 GET /api/auth/me 與 GET /api/portal/dashboard(最新公告另由通知中心 /api/notify/* 即時推送)

  @manual
  場景: 依時段問候
    假如 現在時間為 "08:30"
    當 開啟首頁
    那麼 問候橫幅顯示「早安,<姓名>」與工號、部門、職稱

  @auto
  場景: 首屏聚合回應各區塊
    當 呼叫 GET /api/portal/dashboard
    那麼 待辦事項依序為 BPM 待簽核筆數、BPM 未結案筆數、未填問卷、未完成新人導覽(閱讀 / 驗收)、今天到期且未完成的個人提醒,每項附連結
    而且 BPM 待簽核附「前往簽核」深連結到 BPM(D-24,首頁不提供核准 / 退回)
    而且 個人秘書含 BPM 待簽核 / 未結案 / 異常筆數、前往 BPM 網址與本人常用連結
    而且 最新公告附舊入口網公告最多 8 則(D-21)
    而且 公告輪播 / 集團動態只含啟用中且今天在起訖日內的圖片
    而且 待簽同意書(P7 未實作)列在 _meta.unavailable 的 todos.consent

  @auto
  場景: 新人導覽提醒只對到職 90 天內且未完成者
    假如 本人 LOS EmployeeInfo.JobDate 為 30 天前(人事主檔 TIPTOP 轉移中,以 LOS 代替)
    而且 尚未閱讀小叮嚀、尚未通過驗收測驗
    那麼 待辦顯示「新人導覽:請閱讀小叮嚀」「新人導覽:請完成驗收測驗」
    但是 到職超過 90 天、查無到職日或已完成的不顯示

  @auto
  場景: BPM 只對碩禾系公司查詢
    假如 Token 公司不在設定 BPM_COMPANIES 的清單內(或清單未設定)
    當 呼叫 GET /api/portal/dashboard
    那麼 不查 BPM,_meta.unavailable 含 bpm,個人秘書顯示「BPM 簽核資訊不適用」(D-29)

  @auto
  場景: 部分區塊失敗不影響其他區塊
    假如 BPM 與舊公告查詢失敗
    當 呼叫 GET /api/portal/dashboard
    那麼 回應 200,_meta.errors 含 bpm 與 news(訊息只寫「暫時無法取得」,不含內部錯誤)
    而且 其他待辦、常用連結、輪播照常;畫面該區塊顯示「暫時無法取得」

  @auto
  場景: 沒有任何待辦
    那麼 待辦事項顯示「無重要事項」

  @auto
  場景: 維護首頁輪播
    假如 使用者具按鈕 portal.home.edit(portal-editor)
    當 上傳圖片到 file-service(sourceApp / refType portal-home)後 POST /api/portal/home/slides
    那麼 期間內首頁對應的輪播顯示此圖;停用、刪除、修改起訖日即時生效
    而且 圖片編號必須是 UUID、連結只接受 http(s) 或站內路徑、結束日不可早於開始日,否則回 400

  @auto
  場景: 個人常用連結只看得到、改得到自己的
    假如 使用者具按鈕 portal.home.link-edit
    當 在個人秘書新增、修改、刪除、上移 / 下移常用連結(/api/portal/personal-links)
    那麼 只影響本人的連結;別人的回 404;每人最多 20 筆(409 PORTAL_LINK_LIMIT);javascript: 等網址回 400

  @manual
  場景: 版面
    那麼 四種風格組合(玻璃 / 扁平 × 明亮 / 黑暗)與 375px 寬度不整頁水平捲動;輪播每 5 秒切換、滑鼠移入暫停
