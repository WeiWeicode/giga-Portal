# language: zh-TW
@P1
功能: BPM 簽核資訊
  為了在入口網就看到要簽的單與自己申請中的單
  身為 員工
  我要看到 BPM 的待簽核與我申請的未結案單據,並能一鍵到 BPM 簽核或追蹤

  # PORTAL-API-PLAN §3.3、D-6、D-13;查詢規則同 BPM 快速開發工具包 6_todo_viewer(docs/待辦狀態語意.md)。
  # 舊程式 EFInfo.aspx(LOS 預存程序 SP_EFInfoUnProcess_*);資料 NaNa(測試區 191 / 正式區 190),唯讀帳號 portal_bpm_ro。

  @auto
  場景: 查看待簽核
    假如 同仁在 BPM 有 2 筆待簽核(關卡狀態 0 與 1)與 1 筆已完成的關卡
    當 查詢待簽核
    那麼 total 為 2,每筆附「簽核」與「追蹤」連結,連結指向資料來源同一台 BPM

  @auto
  場景: 異常關卡另外標示
    假如 同仁有 1 筆關卡狀態 97 的待辦
    那麼 該筆列出並標示異常、沒有簽核連結,abnormal 為 1,不計入 total

  @auto
  場景: 查看我申請的未結案
    假如 同仁申請的單據有 1 筆進行中
    當 查詢我申請的未結案
    那麼 回應該筆、目前關卡名稱與追蹤連結,並分頁

  @auto
  場景: BPM 沒有帳號
    假如 同仁的工號在 BPM Users 找不到
    那麼 hasAccount 為 false,清單為空

  @auto
  場景: BPM 未設定
    假如 portal-api 未設定 BPM 資料來源
    那麼 回應 503 PORTAL_BPM_UNAVAILABLE

  @auto @security
  場景: 深連結參數經 URL 編碼
    假如 工號或 OID 含特殊字元
    那麼 產生的連結參數經過編碼,不會改變網址結構

  @auto
  場景: 待簽核超過上限時標示截斷
    假如 同仁有超過 500 筆待辦
    那麼 只回應最新 500 筆,truncated 為 true

  @auto @security
  場景: BPM 設定檢查
    那麼 BPM_WEB_URL 只接受 http(s)://主機[:port],不含帳密與路徑

  # 帳號對應:工號與 NaNa Users.id 逐字元比對(大小寫須相同),只認在職且唯一的一筆;非碩禾系本機帳號工號通常不在 BPM,顯示「BPM 沒有您的帳號」。

  @manual
  場景: 與 BPM 待辦數一致
    假如 同仁在 BPM 191 的待辦數為 N
    當 開啟新入口網「個人資訊 → BPM 簽核資訊 → 待簽核」
    那麼 顯示 N 筆,點「簽核」直接開啟 BPM 簽核畫面
