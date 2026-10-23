# language: zh-TW
@P7
功能: 內部拍賣(臨時服務)
  為了公開拍賣公司的閒置物品
  身為 員工
  我要看到期間內的拍賣品並出價;管理員可看出價人、刪除出價與匯出

  # FEATURE-PLAN §9;舊程式 GSMC_Auction.aspx(.cs)。資料:PortalSolar ContentX(ContentType = 購物台,唯讀)、ContentXMessage(寫入)。
  # 網址 /services/auction,不在選單;讀取 portal.api.svc.auction.read,出價按鈕 portal.svc.auction.bid,管理按鈕 portal.svc.auction.admin
  # (取代舊版寫死的 3 個工號)。

  @auto
  場景: 列出期間內的拍賣品
    當 開啟 /services/auction(GET /api/portal/services/auction)
    那麼 列出 ContentType = 購物台、未下架、今天在起訖日內的拍賣品,含目前最高價與出價紀錄
    而且 出價人姓名只在本人的出價顯示,其他人顯示「其他同仁」

  @auto
  場景: 出價至少比目前最高價高 1000
    假如 拍賣品目前最高價 10000
    當 出價 10500(POST /api/portal/services/auction/<GUID>/bids)
    那麼 回應 409 PORTAL_AUCTION_BID_TOO_LOW
    當 出價 11000
    那麼 寫入 ContentXMessage(GUID、ContentType、LgNo、LgName、Message = 金額、UpDateTime、IsActive = 1)
    # 舊版以「全部拍賣品中最新一筆出價」比較(不同品項互相影響);新版以該品項有效出價的最高金額比較

  @auto
  場景: 同時出價不會低於規則
    假如 兩人同時以相同金額出價
    那麼 只有一筆成功,另一筆回應 409(交易內鎖定該品項的出價)

  @auto
  場景: 過期的拍賣品不能出價
    假如 拍賣品已過結束日或已下架
    當 出價
    那麼 回應 410 PORTAL_SERVICE_ENDED

  @auto
  場景: 管理員刪除出價與匯出
    假如 使用者具 portal.svc.auction.admin
    當 開啟管理清單(GET /api/portal/services/auction/admin)
    那麼 看得到每筆出價的工號與姓名
    當 刪除一筆出價(DELETE /api/portal/services/auction/<GUID>/bids?key=)
    那麼 該筆 IsActive = 0、DeleteDate = 現在,最高價重新計算
    當 匯出(GET /api/portal/services/auction/<GUID>/export)
    那麼 下載 xlsx(上傳日期、工號、姓名、出價)
