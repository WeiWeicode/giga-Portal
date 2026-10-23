# language: zh-TW
@P6
功能: 危害性化學品清單
  為了查詢廠內申報的危害性化學品與 SDS
  身為 員工
  我要依列管 / 不列管、日期與關鍵字查詢;ESH 管理員可由 BPM 同步與上傳 SDS

  # FEATURE-PLAN §8 最後一列;舊程式 EHS/EHCHEMICALInfo.aspx(.cs)。資料:PortalSolar ESHChemicalDataA / B / C(與舊入口網共用);
  # 來源:NaNa「化學品申報單」(SHR008_、已結案),唯讀帳號 portal_bpm_ro 只查檢視 dbo.portal_esh_chemical_forms(db/dba/05-bpm-readonly-p6.sql)。
  # 新站上傳的 SDS:portal.esh_chemical_sds(file-service UUID)。讀取 portal.api.esh.chemical.read(所有員工);
  # 同步 / SDS 按鈕 portal.esh.chemical.edit(includes portal.api.esh.chemical.edit),另須角色 portal-esh-admin。

  @auto
  場景: 查詢化學品
    當 員工開啟「危害性化學品資訊」的「列管化學品」或「一般非列管化學品」Tab
    那麼 預設列出申請日期「去年本月 1 日」~ 今天的申報(後端分頁,每頁 20 筆),填表人空白者不列(同舊版)
    而且 每筆的成份以化學品 ID(EF_ID)對應(修正舊版以列索引對應而錯位)
    而且 SDS:新站上傳的優先;否則 BPM 附件網址(只接受 http / https)或舊站 EHS/SDS 檔名
    而且 明細的「使用人」欄位為使用人工號與姓名(修正舊版錯置為使用部門)
    而且 關鍵字可查化學品名稱、流程序號、成份名稱與 CAS No.

  @auto
  場景: 解析 BPM 表單欄位
    當 解析化學品申報單的欄位 XML(葉節點 id 屬性 = 舊表欄位名稱)
    那麼 代碼轉中文同舊版(列管 0 → 不列管;用途、入場途徑、種類、狀態),成份最多 5 組、空白不寫
    而且 補上舊版漏寫的 s_DeptName_txt、s_UseApplyUserID_txt、成份登錄碼
    而且 寫入舊表前把 < > 改為全形(舊站以 Label 原樣輸出)

  @auto
  場景: 欄位超長或沒有填表人的表單略過
    當 某張表單欄位超過舊表長度、沒有填表人、流程序號格式不符或含控制字元
    那麼 該張表單略過並列在結果中,不截斷資料

  @auto
  場景: 由 BPM 同步
    當 管理員按「由 BPM 同步」(POST /api/portal/esh/chemicals/sync,區間最多 36 個月)
    那麼 唯讀查 NaNa,整批在同一個交易內逐筆先刪後寫 ESHChemicalDataA / B / C;任一句失敗全部回復(舊版逐筆、無交易)
    而且 同一流程序號只寫一次;新站上傳的 SDS 不受影響
    而且 不具 portal-esh-admin 回 403
    而且 每日排程(台灣時間 02:00 後)同步最近 13 個月一次,上次失敗可重跑

  @auto
  場景: 手動上傳 SDS
    當 管理員在明細上傳 SDS(pdf / doc / docx / jpg / png,refType portal-esh-sds,refNo = 流程序號)
    那麼 明細顯示新上傳的 SDS;之後同步不覆寫;移除後改回顯示 BPM 附件

  @manual
  場景: 測試區同步驗收
    假如 使用者已在 191 以 sa 執行 05-bpm-readonly-p6.sql
    當 以 portal-esh-admin 帳號按「由 BPM 同步」
    那麼 結果顯示表單數 / 寫入數 / 略過清單,`giganexus_gw_test.src_portalsolar.ESHChemicalDataA` 筆數與 BPM 已結案申報單一致
