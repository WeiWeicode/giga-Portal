# language: zh-TW
@P3
功能: 年度行事曆
  為了查公司放假、補班與廠慶
  身為 員工
  我要依年度開啟公司行事曆 PDF

  # FEATURE-PLAN §5「行事曆」;舊程式 Schedule.aspx(Document/<年>.pdf)。個人 / 部門行程不做(PCalendar 自 2021 未使用)。

  @auto
  場景: 依年度切換行事曆
    假如 已上傳 2026、2027 年度行事曆
    當 開啟「行事曆 › 年度行事曆」(GET /api/portal/calendar)
    那麼 年度下拉列出兩個年度,預設今年(沒有今年時取最新),按「開啟 PDF」以新分頁開啟 file-service 檔案

  @auto
  場景: 上傳年度行事曆
    假如 使用者具按鈕 portal.calendar.edit(portal-editor)
    當 在「年度清單」上傳 PDF(file-service,sourceApp / refType portal-calendar)並 PUT /api/portal/calendar/<年>
    那麼 該年度登記此 PDF;同年度重新上傳即取代;刪除後不再列出
    而且 年度需介於 2000 ~ 2100、只接受 .pdf、檔案編號需為 UUID,否則回 400
