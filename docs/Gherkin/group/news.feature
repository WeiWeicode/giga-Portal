# language: zh-TW
@P3
功能: 最新公告
  為了掌握公司公告
  身為 員工
  我要看通知中心的公告與並行期的舊入口網公告

  # FEATURE-PLAN §5「最新公告」;PORTAL-API-PLAN D-21。公告在 GigaItApp 發布(Gateway 通知中心),入口網不另做發布頁(舊 PublicEdit 不沿用)。
  # 舊程式 MainFormX.aspx.cs:61(最新消息條件);As-Is ../old_PortalSolar/docs/behavior/home/home.feature、company/company_tools.feature。

  @manual
  場景: 通知中心公告
    當 開啟「最新公告 › 全部 / 未讀」
    那麼 列出 /api/notify/feed?app=portal 的公告(分頁),點選開啟閱讀對話框並標記已讀

  @auto
  場景: 舊入口網公告唯讀併入
    當 呼叫 GET /api/portal/news/legacy?q=&page=&pageSize=
    那麼 回應舊站 ContentX 中符合舊首頁條件的公告(新到舊、分頁,pageSize ≤ 100),畫面標示來源「舊入口網」
    而且 條件同舊首頁:PublicContentX / NotesPublic 兩種、StartDate ≤ 今天、EndDate ≥ 今天或空字串、類型 最新消息 / 環安公告 / 集團Notes公告、未下架、
         Notes 公告對象空白或含「碩禾全體」「禾迅全體」「芯和全體」
    而且 關鍵字的 % _ [ 視為一般字元
    而且 有設定舊站網址(LEGACY_PORTAL_URL)時附舊站公告頁連結,路徑只接受兩種格式(不可含 ..);未設定時只顯示標題
    而且 舊站下線後移除
