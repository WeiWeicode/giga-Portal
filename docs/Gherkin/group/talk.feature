# language: zh-TW
@P3
功能: 3691 全民開講
  為了讓同仁匿名交流
  身為 員工
  我要瀏覽、發文、回覆與按讚,且發言者身分受保護

  # FEATURE-PLAN §5.1;PORTAL-API-PLAN D-23(作者加密、授權解碼與稽核;**上線前需人資 / 法務書面確認**,CONFIRM-NEEDED P3)。
  # 舊程式 Talktalk3691.aspx(.cs);As-Is ../old_PortalSolar/docs/behavior/company/company_tools.feature。
  # 資料 PortalSolar Talk3691Data / Talk3691Like(與舊入口網共用,D-7)、portal.talk_author(作者密文)、portal.talk_audit(稽核)。

  @auto
  場景: 瀏覽討論串
    當 呼叫 GET /api/portal/talk/posts?type=<分類>(全部文件 = 不篩選)
    那麼 回應主題與回覆(畫面組成樹狀:主題新到舊、回覆舊到新),含按讚數與本人是否按過,不含任何作者資訊

  @auto
  場景: 被屏蔽的發言對一般人遮蔽
    假如 某主題已屏蔽
    那麼 一般檢視的標題與內容改為「該發言已屏蔽」,其下所有回覆不列出(同舊版)

  @auto
  場景: 管理者看得到被屏蔽的原文
    假如 使用者具按鈕 portal.talk.moderate
    當 切換「管理檢視」(GET /api/portal/talk/moderation/posts)
    那麼 顯示被屏蔽發言的原文與其回覆,仍不含作者

  @auto
  場景: 匿名發文
    假如 使用者具按鈕 portal.talk.post
    當 發表新主題(分類必選 6 類、標題必填 ≤ 100 字、內容必填 ≤ 4000 字)
    那麼 寫一筆 Talk3691Data(CreateTime = 伺服器時間、IsBlack = 0、mark = NULL),< > 改為全形(舊站原樣輸出 HTML)
    而且 作者工號以 AES-256-GCM 加密(金鑰在 secret、AAD 綁定 SN)寫入 portal.talk_author,與舊表寫入同一交易
    而且 瀏覽器另外送來的作者欄位被忽略;Gateway 存取紀錄不記這支 API(x-audit-level none,避免以時間比對回推作者)

  @auto
  場景: 回覆沿用上層分類
    當 對某則發言回覆
    那麼 分類沿用上層、標題可空白(顯示「(無標題)」)

  @auto
  場景: 回覆被屏蔽的發言
    當 回覆或按讚的發言本身或任一上層已屏蔽
    那麼 回應 409 PORTAL_TALK_BLOCKED

  @auto
  場景: 按讚
    當 同一人對同一則按讚兩次
    那麼 Talk3691Like 只有一筆本人紀錄(每人每則一次)

  @auto
  場景: 屏蔽發言
    假如 使用者具按鈕 portal.talk.moderate(取代舊系統寫死的 5 個工號)
    當 屏蔽或取消屏蔽
    那麼 更新 Talk3691Data.IsBlack 並在同一交易寫 portal.talk_audit(block / unblock、操作者、時間)

  @auto @security
  場景: 解碼作者需核准文號並留稽核
    假如 使用者具按鈕 portal.talk.reveal(取代舊系統寫死 S094009 一鍵解碼)
    當 填寫核准文號(必填 ≤ 50 字)與理由後解碼
    那麼 回應作者工號,portal.talk_audit 先寫入 reveal(result = ok、核准文號、理由、操作者)
    而且 文章不存在、沒有作者資料、解不開時也寫稽核(none / error)

  @auto
  場景: 舊入口網發文不解碼
    假如 發言來自舊入口網(只有舊 DES mark)
    那麼 回應 409 PORTAL_TALK_AUTHOR_LEGACY 並寫稽核 legacy(新站不持有舊系統寫死的金鑰)

  @auto
  場景: 金鑰未設定時不能發文與解碼
    假如 portal-api 未設定 TALK_AUTHOR_KEY
    那麼 仍可瀏覽(canPost = false),發文與解碼回 503 PORTAL_TALK_KEY_UNAVAILABLE

  @manual
  場景: 版面
    那麼 內容一律以文字輸出(不使用 v-html);四種風格組合與 375px 寬度
