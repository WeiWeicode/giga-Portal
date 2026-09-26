# language: zh-TW
@M4 @M5 @wip
功能: 待我簽核
  為了在入口網直接處理簽核
  身為 主管
  我要看到待簽核單據,並核准或退回

  # PRD FR-4.5;BPM API 待 BPM 負責人提供(PRD Q8)。

  場景: 列出待簽核單據
    假如 使用者有 "bpm.approval.read",有 4 件待簽核、其中 2 件急件
    當 開啟首頁
    那麼 「待我簽核」顯示「共 4 件待處理,其中 2 件為急件」與前 4 筆

  場景: 核准需確認
    假如 使用者有 "bpm.approval.approve"
    當 在單據 "BPM-2026-09-0411" 按「核准」並確認
    那麼 呼叫 POST /api/bpm/approvals/BPM-2026-09-0411/approve
    而且 該筆自清單移除並顯示「已核准」

  場景: 沒有核准權限時不顯示按鈕
    假如 使用者有 "bpm.approval.read",沒有 "bpm.approval.approve" 與 "bpm.approval.reject"
    當 開啟「待我簽核」
    那麼 不顯示「核准」「退回」按鈕
