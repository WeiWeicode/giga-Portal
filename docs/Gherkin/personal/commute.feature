# language: zh-TW
@P1
功能: 溫室氣體盤查員工通勤調查
  為了溫室氣體盤查統計員工通勤排放
  身為 員工
  我要填寫上班通勤現居地與通勤方式,並與舊入口網共用同一份資料

  # PORTAL-API-PLAN D-10、D-11;舊程式 HRPDatabase03.aspx;資料 PortalSolar.dbo.CpfExInfo(測試區為複本)。

  @auto
  場景: 查看本人通勤調查
    假如 同仁曾填寫通勤調查
    當 呼叫 GET /v1/commute
    那麼 回應最新一筆有效資料、通勤方式選項與能否送出

  @auto
  場景: 送出通勤調查
    假如 同仁填寫地址與主要通勤方式「機車」
    當 呼叫 PUT /v1/commute
    那麼 舊資料失效並新增一筆含經緯度與 Google 地址的資料
    而且 回應新的資料

  @auto
  場景: 大眾運輸要填起點與終點站
    當 主要通勤方式為「捷運」但未填終點站
    那麼 回應 400 VALIDATION_FAILED,訊息「選取大眾交通工具,未填入起點/終點站」
    當 次要通勤方式為「公車」但未填起點站
    那麼 回應 400 VALIDATION_FAILED

  @auto
  場景: 通勤方式要在選項內
    當 主要通勤方式為「飛機」
    那麼 回應 400 VALIDATION_FAILED

  @auto
  場景: 地址解析不到不能送出
    假如 Google 地圖找不到該地址
    那麼 回應 422 PORTAL_ADDRESS_UNRESOLVED,不寫入資料

  @auto
  場景: 地址定位服務異常或未設定
    假如 Google 地圖服務逾時
    那麼 回應 502 PORTAL_GEOCODE_FAILED
    假如 未設定 Google 金鑰
    那麼 GET 的 canSubmit 為 false,PUT 回應 503 PORTAL_GEOCODE_UNAVAILABLE

  @auto
  場景: 沒有次要通勤方式時次要欄位寫入空值
    假如 只填主要通勤方式
    那麼 新增的資料 TransTools2、StartStation2、EndStation2 為 NULL

  @auto @security
  場景: Google 回應解析(OK / ZERO_RESULTS / 其他狀態,錯誤不含金鑰)
    那麼 OK 取第一筆經緯度與地址、ZERO_RESULTS 視為解析不到、其他狀態為服務異常
    而且 錯誤訊息不含 API 金鑰

  @auto @security
  場景: 重複送出的保護(間隔限制、地址未變沿用座標)
    當 同一人 10 秒內再次送出
    那麼 回應 429 PORTAL_TOO_MANY_REQUESTS
    而且 地址與目前有效資料相同時沿用既有座標,不再呼叫 Google

  @manual
  場景: 新舊入口網看到同一份資料
    假如 同仁在新入口網送出通勤調查
    當 開啟舊入口網「溫室氣體盤查員工通勤調查」
    那麼 顯示剛送出的地址與通勤方式
