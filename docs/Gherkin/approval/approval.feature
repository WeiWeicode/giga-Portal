# language: zh-TW
@P4
功能: 待我簽核
  為了在入口網一次看到要簽的、簽過的與自己送出的 BPM 單據
  身為 碩禾系同仁
  我要看到單據清單,並以「前往簽核」到 BPM 原畫面完成核准 / 退回

  # FEATURE-PLAN §4;PORTAL-API-PLAN §4 P4、D-6(查詢規則同 BPM 快速開發 6_todo_viewer)、D-24(不提供核准 / 退回,改深連結)、D-29(限碩禾系)。
  # 資料:NaNa(測試區 191 / 正式區 190)唯讀帳號 portal_bpm_ro;API 與「BPM 簽核資訊」共用 GET /api/portal/bpm/*(權限 portal.api.bpm.read)。
  # 原 M4 / M5 草稿(bpm.approval.* 核准 / 退回 API)依 D-24 取消。

  @auto
  場景: 查看待簽核
    假如 同仁在 BPM 有 2 筆待簽核(關卡狀態 0 與 1)
    當 開啟「待我簽核 › 待簽核」(GET /api/portal/bpm/pending)
    那麼 每筆列出表單名稱、主旨、申請人(姓名與工號)、送出時間、目前關卡
    而且 每筆有「前往簽核」與「追蹤」按鈕,以新視窗開啟 BPM 原畫面;入口網沒有核准 / 退回按鈕

  @auto
  場景: 查看已簽核
    假如 同仁在 BPM 經辦完成 3 個關卡(WorkItem.performerOID = 本人、currentState = 3)
    當 開啟「待我簽核 › 已簽核」(GET /api/portal/bpm/handled?pageSize=2)
    那麼 依簽核時間新到舊分頁,total 為 3、本頁 2 筆
    而且 每筆列出表單名稱、主旨、申請人、送出時間、我經辦的關卡、簽核時間;流程仍進行中者列出目前關卡,已結案者顯示流程狀態
    而且 只有「追蹤」連結,沒有簽核連結

  @auto
  場景: 我送出的可列全部狀態
    假如 同仁送出的單據有 1 筆進行中、1 筆已結案、1 筆已撤銷
    當 開啟「待我簽核 › 我送出的」
    那麼 預設只列進行中的 1 筆(state=open,同「未結案」)
    當 切換為「全部」(state=all)
    那麼 列出 3 筆與各自的流程狀態;state 只接受 open / all

  @auto @security
  場景: 非碩禾系公司不查 BPM
    假如 同仁的 Token 公司不在設定 BPM_COMPANIES(碩禾系)內
    當 呼叫 GET /api/portal/bpm/pending、/requested、/handled
    那麼 回應 200、applicable 為 false、清單為空,且 portal-api 不查詢 NaNa
    而且 畫面顯示「BPM 簽核資訊不適用」
    而且 Token 公司有任一家在清單內即適用;BPM_COMPANIES 未設定時任何人都不查

  @auto @security
  場景: 前往簽核只開 http(s) 連結
    那麼 深連結只以新視窗開啟 http(s) 網址(noopener);javascript: 等其他協定不開啟

  @manual
  場景: 與 BPM 一致
    假如 同仁在 BPM 191 的待辦數為 N、經辦過 M 個關卡
    當 開啟「待我簽核」三個 Tab
    那麼 待簽核顯示 N 筆、已簽核 total 為 M;按「前往簽核」直接開啟 BPM 簽核畫面,簽完回來按「重新整理」該筆消失
