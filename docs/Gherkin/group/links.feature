# language: zh-TW
@P3
功能: 集團系統
  為了快速前往集團各外部系統
  身為 員工
  我要看到集團系統清單,舊站以 DES 跳轉的系統只顯示待重構標示

  # FEATURE-PLAN §5「集團系統」、§6.3;PORTAL-API-PLAN D-22;As-Is ../old_PortalSolar/docs/behavior/common/master_layout.feature。

  @auto
  場景: DES 跳轉系統只顯示標示
    假如 migration 已建立 10 個舊站 DES / 同步碼 / Base64 跳轉系統(訂便當、E-Learning、資源預約、福委會、WebApp、NotesApp、年考核、環安衛資料庫、好書分享、健康系統)
    當 呼叫 GET /api/portal/links
    那麼 這些系統 legacyDes=true、url=null,畫面只顯示「DES 跳轉(待重構)」,沒有任何連結或 token

  @auto
  場景: 編輯者維護集團系統
    假如 使用者具按鈕 portal.links.edit(portal-editor)
    當 新增、修改、停用、刪除集團系統(/api/portal/links、/links/admin 含停用)
    那麼 一般員工只看到啟用中的系統,依分類分組、依排序
    而且 勾選 DES 跳轉時不存網址

  @auto @security
  場景: 拒絕不安全的網址
    當 網址為 javascript:、data:、//other、含帳密或非 http(s) 協定
    那麼 回應 400 VALIDATION_FAILED
