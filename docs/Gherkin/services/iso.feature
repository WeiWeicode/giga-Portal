# language: zh-TW
@P7
功能: ISO 文件庫(臨時服務,唯讀)
  為了查閱公司現行有效的 ISO 文件
  身為 員工
  我要依條文分類或關鍵字找到文件,開啟現行版本與相關文件

  # FEATURE-PLAN §9;舊程式 ISOInfo.aspx(.cs)(連 190 NaNa 的 sa 帳號)。資料:NaNa 檢視 v_ISO_Docs_Clause_Solar / v_ISO_Docs_Clause_ALL、
  # Documents、ISOFile、ISODocCmItem、DocCmItem_RefDoc、Doc_Level(唯讀 portal_bpm_ro,授權見 db/dba/06-bpm-readonly-p7.sql,**來源待確認**)。
  # 網址 /services/iso,不在選單;讀取 portal.api.svc.iso.read。文件檔連結 ISO_DOC_BASE_URL/<文件編號>/<版本>/<檔名>(舊版 http://10.10.130.190/ISO2)。

  @auto
  場景: 依條文分類列出文件
    當 開啟 /services/iso(GET /api/portal/services/iso/clauses)
    那麼 列出條文分類(排除「合約」「矽晶材料」開頭)
    當 選一個分類(GET /api/portal/services/iso/docs?clause=)
    那麼 列出現行有效(validTo 空白或未過期)的文件

  @auto
  場景: 關鍵字查詢
    當 GET /api/portal/services/iso/docs?q=<關鍵字>
    那麼 以文件名稱、條文、文件編號部分比對(參數化,舊版字串拼接)

  @auto
  場景: 文件明細
    當 GET /api/portal/services/iso/docs/<文件編號>
    那麼 回應現行版本、生效 / 失效日、檔案連結與參考 / 上階 / 下階文件
    而且 BPM 來源未設定或未授權時回應 503 PORTAL_SOURCE_UNAVAILABLE,畫面顯示「資料來源待確認」
