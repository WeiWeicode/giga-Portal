# language: zh-TW
@P7
功能: 電視看板(臨時服務)
  為了在公共螢幕輪播公司訊息
  身為 行政人員
  我要在設定頁維護跑馬燈與輪播圖片;看板頁不需登入

  # FEATURE-PLAN §9;舊程式 TVDemo.aspx、TVDemoSetting.aspx(舊設定頁不需登入、可上傳任意檔到網站目錄)。
  # 資料:PortalSolar TVShowInfo(跑馬燈)、TVImgInfo(舊圖片,唯讀顯示 / 切換顯示與順序)、portal.tv_image(新圖片,file-service UUID)。
  # 看板 /tv 與 GET /api/portal/tv/board 為 public(需 IT 在 Gateway 核准);設定頁 /services/tv 讀取 portal.api.svc.tv.read,
  # 維護按鈕 portal.svc.tv.edit。

  @auto
  場景: 看板不需登入
    當 未登入開啟 /tv(GET /api/portal/tv/board,無內部 Token)
    那麼 回應跑馬燈文字、字級與顯示中的圖片(舊圖以舊入口網 Document 網址、新圖以 file-service 編號)
    而且 不回應任何人員資料

  @auto
  場景: 設定頁需登入與權限
    當 未登入或沒有 portal.api.svc.tv.read 呼叫 GET /api/portal/services/tv
    那麼 由 Gateway 回 401 / 403;portal-api 也拒絕沒有員工身分的請求

  @auto
  場景: 更新跑馬燈
    當 PUT /api/portal/services/tv/message,文字含 < > 或字級超出 8~200
    那麼 回應 400
    當 文字與字級合格
    那麼 更新 TVShowInfo(舊看板也顯示新文字)

  @auto
  場景: 新增圖片只收圖片
    當 上傳圖片到 file-service(sourceApp portal-tv)後 POST /api/portal/services/tv/images,檔名不是 jpg / png / gif / webp
    那麼 回應 400
    當 檔名合格
    那麼 portal.tv_image 新增一筆(不寫網站目錄)

  @auto
  場景: 調整順序與顯示
    當 PUT /api/portal/services/tv/images,舊圖或新圖的順序與顯示 / 隱藏
    那麼 舊圖更新 TVImgInfo._Index / IsActive,新圖更新 portal.tv_image
