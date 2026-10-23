# language: zh-TW
@P5
功能: 年度教育訓練計畫
  為了在年度開始前提出部門的訓練開課計畫
  身為 ELPlanDept 中被指定負責部門的主管
  我要新增 / 修改 / 刪除課程,確認後提交,提交後鎖定

  # FEATURE-PLAN §7.1;舊程式 ELlessionplan.aspx(.cs)。資料:PortalSolar ELClassAnnual(目前編列年度)、ELPlanDept(年度 × 部門 × 負責主管)、
  # ELClassForm(課程)、ELClassStatus(提交狀態,BossID × Dept);LearnDB TB_COURSE_FORM / TB_COURSE_SESSION(去年申請紀錄,唯讀)。
  # 讀取 portal.api.mgr.training.read;寫入按鈕 portal.mgr.training.edit(includes portal.api.mgr.training.write)。
  # 寫入舊表與舊系統一致(D-7):ClassID = "N" + yyMM + 3 碼流水、Annual 字串、Season 以逗號分隔、Hour 一位小數、Cost = 三項費用加總。
  # 舊頁「職能評核平均」(skillbfile)不做;WPORTALZ(Q-D10)本功能沒有用到。

  背景:
    假如 ELClassAnnual 為 "2026"
    而且 ELPlanDept 2026 年度主管 A 負責 "S1800"、"S1810",兩者都在 A 的 Token 部門範圍內

  @auto
  場景: 開啟訓練計畫
    當 主管 A 呼叫 GET /api/portal/manager/training
    那麼 回應年度 2026、可編部門 "S1800"、"S1810"、兩部門的課程、是否已提交(locked)
    而且 另列去年(2025)同部門(含下層)的計畫課程與 E-Learning 申請紀錄,供「帶入」
    而且 ELPlanDept 有指定、但不在 Token 範圍內的部門列在 outOfScope,不能編輯

  @auto
  場景: 不是年度負責主管
    假如 ELPlanDept 2026 沒有主管 B
    當 主管 B 開啟訓練計畫
    那麼 depts 為空、canEdit 為 false;新增課程回 403 PORTAL_DATA_ACCESS_DENIED

  @auto
  場景: 新增課程與驗證
    當 主管 A POST /api/portal/manager/training/courses:部門 "S1810"、課程名稱、參加部門、性質「內訓」、實施方式「實體」、評核方式「測驗」、
      類別「專業職能」/ 子類「在職訓練課程」、季別 [1, 3]、大綱、時數 1.5、講師費 1000、報名費 0、雜費 200
    那麼 回應 201,ELClassForm 新增一筆 ClassID 為 "N2610###"、Annual "2026"、Season "1,3"、Hour 1.5、Cost 1200
    而且 必填缺漏、時數小於 0.5、費用不是 0 以上整數、子類不屬於該類別時回 400 VALIDATION_FAILED(列出欄位)
    而且 同部門同年度已有同名課程回 409 PORTAL_MGR_TRAINING_DUPLICATE
    而且 部門不是本人可編部門回 403 PORTAL_DATA_ACCESS_DENIED

  @auto
  場景: 從去年 / 申請紀錄帶入
    當 主管 A 在去年課程按「帶入」
    那麼 畫面把該課程填入新增表單,仍走同一支新增 API(同樣驗證;舊版字串拼接直接寫入)

  @auto
  場景: 修改與刪除課程
    當 主管 A PUT / DELETE 本年度、可編部門的課程
    那麼 回應 200 / 204
    而且 課程不存在或不屬於本年度可編部門回 404 PORTAL_MGR_TRAINING_NOT_FOUND

  @auto
  場景: 提交訓練計畫
    假如 "S1800" 有 2 門子類「在職訓練課程」、"S1810" 只有 1 門
    當 POST /api/portal/manager/training/submit
    那麼 回應 422 PORTAL_MGR_TRAINING_INCOMPLETE,details 指出 "S1810" 需開 2 門以上
    當 "S1810" 再新增 1 門且所有課程講師、訓練單位等必填齊全後提交
    那麼 在同一交易內刪除本人該年度 ELClassStatus,逐部門新增 Status「提交」,回應 locked = true

  @auto
  場景: 提交後鎖定(後端檢查)
    假如 主管 A 2026 年度已提交,或部門 "S1810" 已由其他負責主管提交
    當 新增 / 修改 / 刪除該部門的課程或再次提交
    那麼 回應 409 PORTAL_MGR_TRAINING_LOCKED(舊版只停用按鈕)

  @auto
  場景: 匯出訓練計畫
    當 GET /api/portal/manager/training/export?dept=S1800
    那麼 下載 "S1800_115年度教育訓練計劃.xlsx"(標題年度取自 ELClassAnnual,不寫死 2024 範本)
    而且 欄位:部門、類別、子類、性質、課程名稱、大綱、時數、訓練單位 / 講師、參加部門、季別、實施方式、講師費 / 雜費 / 報名費 / 合計、評核方式
    而且 部門不是本人可看的部門回 403
