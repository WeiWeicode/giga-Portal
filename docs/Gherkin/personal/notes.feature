# language: zh-TW
@P1
功能: 個人提醒
  為了記錄自己的待辦、截止日與備忘
  身為 員工
  我要新增、修改、標記完成與刪除只有自己看得到的提醒

  # PORTAL-API-PLAN P1-2;資料表 portal.personal_note(入口網新表,D-4)。

  @auto
  場景: 新增提醒
    當 新增標題「繳交報告」、類別「重要截止」、優先「high」、到期日 2026-10-31 的提醒
    那麼 回應 201 與新提醒,done 為 false

  @auto
  場景: 只看得到自己的提醒
    假如 同仁 A 與 B 各有提醒
    當 A 查詢個人提醒
    那麼 只回應 A 的提醒

  @auto
  場景: 未完成在前,依到期日排序
    假如 有已完成、無到期日、到期日較晚、到期日較早的提醒
    那麼 順序為 到期日較早、到期日較晚、無到期日、已完成

  @auto
  場景: 標記完成與修改
    當 以 PATCH 將 done 設為 true
    那麼 回應 200,done 為 true
    當 以 PATCH 修改標題
    那麼 回應新的標題

  @auto @security
  場景: 不能修改或刪除別人的提醒
    假如 提醒屬於同仁 B
    當 同仁 A 修改或刪除該提醒
    那麼 回應 404 PORTAL_NOTE_NOT_FOUND,資料不變

  @auto
  場景: 欄位驗證
    當 標題空白、類別不在選項內、優先不在 high / medium / low、到期日格式錯誤
    那麼 回應 400 VALIDATION_FAILED

  @auto
  場景: 每人最多 500 筆
    假如 同仁已有 500 筆提醒
    當 再新增一筆
    那麼 回應 409 PORTAL_NOTE_LIMIT

  @int
  場景: SQL Server 上的新增、排序、修改、刪除
    假如 整合測試庫 giganexus_gw_poc_test 已套用 migration
    那麼 DrizzleNoteRepo 的操作結果與上述場景相同,且 SQL 符合 2012 語法
