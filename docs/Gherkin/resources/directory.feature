# language: zh-TW
@P2
功能: 分機表
  為了找同仁的分機與聯絡方式,並維護自己的分機
  身為 員工
  我要以關鍵字查詢分機表,並更新本人分機(與舊入口網共用 NotesPhone)

  # 舊程式 ExtensionTable.aspx、ExtansionUp.aspx;PORTAL-API-PLAN P2-1。

  @auto
  場景: 以關鍵字查分機
    當 以「資訊,2109」查詢
    那麼 回應同時符合兩個關鍵字的同仁,最多 200 筆,不含 Email;關鍵字至少 2 字

  @auto
  場景: 不列系統帳號
    假如 分機表有工號「A001」「F12345」「S1」的帳號
    那麼 查詢結果不含這些帳號(同舊系統)

  @auto
  場景: 關鍵字最多兩個
    當 輸入「a b c」
    那麼 只以「a」「b」查詢

  @auto
  場景: 更新本人分機
    當 以 PUT /v1/directory/me/phone 送出分機「2109」
    那麼 回應 200,分機表本人的分機為 2109(同時記錄異動;分機未變不寫入,不寄通知)

  @auto
  場景: 分機格式驗證與本人不在分機表
    當 分機含英文字母或超過 30 字
    那麼 回應 400 VALIDATION_FAILED
    假如 本人不在分機表
    那麼 回應 404 PORTAL_DIRECTORY_NOT_FOUND
