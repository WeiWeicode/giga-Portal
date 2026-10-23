# language: zh-TW
@P5
功能: 主管專區(共通、主管權益、部門必上課程、部門資產明細、系統轉移中頁面)
  為了讓主管掌握部屬的訓練與保管資產
  身為 具 portal-manager 角色的主管
  我要只看到自己部門(含下層)的資料

  # FEATURE-PLAN §7;PORTAL-API-PLAN §4 P5、D-1、D-9、D-12。舊程式:ManagerRightInfo、AnnualCurse、DeptPropertyInfo、HRShiftUp、HRBossTrace、
  # HRAnalysisChart3 / 3_2、HRMPromoteMap(As-Is:old_PortalSolar/docs/behavior/manager/manager_portal.feature)。
  # 資料範圍:內部 Token 的 dept + LOS DeptInfo.ParentDept 往下展開的全部下層;角色 portal-manager-all 可指定全公司任一部門。
  # 舊系統的 LoadDept(RankInfo 正 / 副主管)、IsBoss、寫死工號 860000 與 3~4 個特權工號一律不沿用。

  背景:
    假如 主管 A 的 Token 部門為 "S1800"
    而且 LOS 部門樹中 "S1810"、"S1820" 的上層為 "S1800","S1300" 為 "S1800" 的上層

  @auto
  場景: 主管可選的部門
    當 主管 A 呼叫 GET /api/portal/manager/depts
    那麼 回應 "S1800"、"S1810"、"S1820"(代碼、名稱、上層),不含 "S1300"
    而且 all 為 false

  @auto
  場景: 全公司角色
    假如 使用者的 Token roles 含 "portal-manager-all"
    當 呼叫 GET /api/portal/manager/depts
    那麼 all 為 true,回應全部部門
    而且 各清單 API 未指定 dept 時回 400 PORTAL_MGR_DEPT_REQUIRED(避免一次查全公司)

  @auto
  場景: 指定範圍外的部門
    當 主管 A 以 dept=S1300 查詢部門必上課程或部門資產
    那麼 回應 403 PORTAL_DATA_ACCESS_DENIED

  @auto
  場景: Token 沒有部門
    假如 使用者 Token 沒有 dept 且不具 portal-manager-all
    當 呼叫 GET /api/portal/manager/depts
    那麼 回應空清單;查詢任何部門回 403 PORTAL_DATA_ACCESS_DENIED

  # ───────── 主管權益(靜態)─────────
  @manual
  場景: 主管權益照搬舊頁
    當 開啟「主管專區 › 主管權限說明」
    那麼 4 個 Tab(課級 / 理級 / 處級 / 群組主管)內容與舊 ManagerRightInfo 相同(核決權限、特支費、電話費、座車補助、接班人管理辦法)
    而且 頁尾顯示「以上資訊僅供參考,詳細內容請閱最新管理辦法」與「舊入口網內容未標示生效日」
    而且 不呼叫任何 API

  # ───────── TIPTOP 來源頁 ─────────
  @auto
  場景大綱: TIPTOP 來源的主管頁面顯示系統轉移中
    當 開啟「<頁面>」
    那麼 整頁顯示「系統轉移中」,不載入 Tab、不呼叫 API(選單與權限保留)

    例子:
      | 頁面         |
      | 部門班表匯入 |
      | 主管工時追蹤 |
      | 部屬出勤分析 |
      | 休假餘額控管 |
      | 職等晉升地圖 |

  # ───────── 部門年度必上課程(AnnualCurse 主管版)─────────
  @auto
  場景: 部屬年度必上課程
    假如 "S1810" 有 2 位 DS11 在職同仁,其中 1 位工安課程「自衛消防編組訓練」未完成
    當 主管 A 呼叫 GET /api/portal/manager/courses?dept=S1800
    那麼 列出 "S1800" 與下層部門的同仁(工號、姓名、部門),每人 12 門課的 done / missing / na
    而且 規則與個人版相同(D-9:公司別、9/30 到職、名單、時數門檻),未完成工安課程者 deduction 為 -2(舊主管版固定 0.0 不沿用)
    而且 includeSub=false 時只列 "S1800" 本身

  # ───────── 部門資產明細(DeptPropertyInfo)─────────
  @auto
  場景: 部門資產備註
    假如 "S1810" 同仁 B 在舊入口網為資產 "A001" 填了備註
    當 主管 A 呼叫 GET /api/portal/manager/property?dept=S1800
    那麼 列出 B 的資產 "A001"(保管人、部門、財編、附號、備註、是否有照片)
    而且 只列已有備註的資產(資產清單本身在 TIPTOP,轉移中)

  @auto
  場景: 主管修改部屬資產備註(備註歸屬保管人)
    假如 主管 A 具按鈕 portal.mgr.property.edit
    當 PUT /api/portal/manager/property/note,保管人 = B、財編 "A001"、備註「放置於 B 棟 3 樓」
    那麼 更新 PersonalPropertyInfo 中 UserID = B 的那一筆(舊版以主管工號寫入,保管人讀不到)
    而且 B 在「個人資產明細」看到新備註;照片欄位不變
    而且 保管人不在範圍內回 403 PORTAL_DATA_ACCESS_DENIED;該資產沒有備註紀錄回 404 PORTAL_MGR_PROPERTY_NOT_FOUND;備註超過 150 字回 400
