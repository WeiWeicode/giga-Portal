# language: zh-TW
@P4
功能: 表單下載
  為了找到並下載公司的標準申請表單
  身為 員工
  我要依分類或關鍵字找到表單並下載;編輯者可上傳表單與維護分類

  # FEATURE-PLAN §4「表單下載」、PORTAL-API-PLAN D-25(舊系統沒有此頁)。
  # 資料:portal.form_category、portal.form_doc(Drizzle migration 20261022224624_p4_forms);檔案本體在 giga-file-service
  # (sourceApp / refType portal-forms、refNo = 表單 id)。讀取 portal.api.form.read;維護按鈕 portal.forms.edit(includes portal.api.form.edit,portal-editor)。

  @auto
  場景: 依分類下載表單
    假如 「人事」分類有 2 份啟用中、1 份停用的表單
    當 開啟「表單下載」(GET /api/portal/forms)
    那麼 依分類分組列出 2 份啟用中的表單(名稱、說明、檔案類型、更新時間),沒有表單的分類不列
    而且 可依分類下拉與關鍵字(名稱、說明、檔名)篩選
    當 按「下載」
    那麼 由 file-service 下載原檔(GET /api/file/files/<UUID>/content,需 file.object.read)

  @auto
  場景: 維護表單分類
    假如 使用者具按鈕 portal.forms.edit
    當 在「分類維護」新增「人事」
    那麼 回應 201;再新增同名分類回 409 PORTAL_FORM_CATEGORY_DUPLICATE;名稱含 < > 回 400

  @auto
  場景: 上傳表單
    假如 使用者具按鈕 portal.forms.edit
    當 選擇 .docx 檔上傳(file-service,sourceApp portal-forms)並 POST /api/portal/forms,再以表單 id 綁定檔案
    那麼 員工清單出現此表單
    而且 檔名只接受 pdf / doc / docx / xls / xlsx / ppt / pptx / odt / ods / odp、檔案編號需為 UUID,否則回 400;分類不存在回 404
    而且 操作者取自內部 Token,請求中的 id、updatedBy 等多餘欄位不寫入

  @auto
  場景: 停用與刪除表單
    當 編輯者把表單設為停用
    那麼 員工清單不再列出,維護清單(含停用,GET /api/portal/forms/admin)仍看得到
    當 刪除表單
    那麼 回應 204;不存在回 404 PORTAL_FORM_NOT_FOUND(file-service 的檔案不刪)

  @auto
  場景: 有表單的分類不能刪
    假如 分類下還有表單(含停用)
    當 刪除該分類
    那麼 回應 409 PORTAL_FORM_CATEGORY_IN_USE

  @auto @security
  場景: 表單 API 權限
    那麼 GET /api/portal/forms 宣告 portal.api.form.read,其餘(維護清單、新增、修改、刪除、分類)宣告 portal.api.form.edit
    而且 系統呼叫(API Key)沒有員工身分,回 403

  @manual
  場景: 其他公司同仁下載
    假如 編輯者為碩禾同仁、下載者為其他公司同仁
    當 下載表單
    那麼 依 file-service 第一版資料範圍(自己上傳或同公司)可能被拒,需待 file-service 提供「公開給已登入者」的類型(CONFIRM-NEEDED P4)
