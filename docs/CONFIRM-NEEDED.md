# 待使用者確認事項

> 實作時遇到需要使用者決定的地方,先依舊系統行為做合理預設並實作,記錄在這裡;確認後把「狀態」改為「已確認」或「已修改」,必要時轉成 `PORTAL-API-PLAN.md` §0 的決議編號。
> 舊程式路徑皆相對於 `../old_PortalSolar/`。

## 1. 待確認的做法

| 批次 | 項目 | 目前做法與依據(舊程式檔案:行號) | 需要確認 / 修改什麼 | 狀態 |
| --- | --- | --- | --- | --- |
| P2-2a | 「我有話要說」長度 | 上限 500 字,完整寫入 `HRNewPtest.a01`(nvarchar(max))。舊程式參數宣告 `NVarChar, 50`,超過 50 字會被截斷(`HRnewPep05.aspx.cs:117`;測試區複本 a01 最長正好 50 字) | 是否改回 50 字上限,或維持 500 字(人資讀 a01 的報表若假設 ≤ 50 字需確認) | 待確認 |
| P2-2a | 通過狀態只認 `PGrade = "100"` | `GET /onboarding/status` 的 `passedAt` 只取 PGrade 為 "100" 的紀錄。舊表另有舊版測驗(t21~t31,滿分 155 等)的分數 1,4xx 人,現行舊程式只在滿分時寫 "100"(`HRnewPep05.aspx.cs:60`、`93`) | 舊版測驗的其他分數(155、110、105…)是否也算「已完成驗收」;影響首頁待辦的新人提醒 | 待確認 |
| P2-2a | 閱讀紀錄同一天不重複寫 | 同一工號同一天已有 `NewPepR` 就不再寫(舊版每按一次一筆,`HRnewPep01.aspx.cs:26-33`;舊報表 `HRNewPay.aspx.cs:55` 只取 MAX,不影響)。FEATURE-PLAN §3.5 建議 | 確認人資沒有依「閱讀次數」統計的報表 | 待確認 |
| P2-2a | 日期字串格式 | `NewPepR.LgTime` 寫 `yyyy/MM/dd`(同 `HRnewPep01.aspx.cs:29`);`HRNewPtest.MakeTime` 寫 `yyyy/M/d`(舊程式為 `ToShortDateString()`,`HRnewPep05.aspx.cs:118`,依測試區複本實際資料如 `2026/9/9` 判定舊伺服器格式) | 正式區(220)舊伺服器地區設定若不同,MakeTime 格式需跟著改 | 待確認 |
| P2-2a | 小叮嚀兩處舊頁內容互相矛盾 | 以 HRnewPep01(選單實際連到的頁)為準:來賓鞋櫃在「B棟5樓」(`HRnewPep01.aspx:126`;`HRnewPepAnw06.aspx:99` 寫 A棟5樓)、公用冰箱「每週一上班前」清潔(`HRnewPep01.aspx:138`;`HRnewPepAnw06.aspx:159` 寫每週五下班前) | 請人資確認正確內容;其他內容(班表、颱風假、特休、試用期 2 個月等)也是照搬舊頁,是否仍正確 | 待確認 |
| P2-2a | 小叮嚀 Q&A 合併方式 | HRnewPepAnw01~05、07 的 Q&A 全部照搬成分段卡片;Anw06(廠區禁令)與 HRnewPep01 大多重複,只收錄 HRnewPep01 沒有的 6 條(無塵室、加班訓練、微波爐、廁所、飲水機濾芯、制服)。舊站沒有任何連結到 Anw 頁(行為規格 onboarding.feature) | 是否要全部照搬 Anw06,或刪減過時內容(例如 Anw05「往後 Portal 將有 E-learning 功能」、「NOTE 填報來賓訪客單」) | 待確認 |
| P2-2a | 驗收題目照搬 | 20 題題目與標準答案完全照舊(`HRnewPep05.aspx:55-410`、`HRnewPep05.aspx.cs:18-56`);第 10 題「吸煙區位於A棟6樓」為刻意的錯誤敘述(正解「否」) | 題目內容是否需要人資更新 | 待確認 |
| P2-2a | 不限新人 | 同舊系統,任何有「新人導覽」頁權限的員工都能閱讀與測驗(`employee` 角色含 Tab 與兩個按鈕) | 是否只開放到職 N 天內的人(需人事資料,目前 TIPTOP 轉移中,D-1) | 待確認 |
| P2-2a | 舊按鈕代碼 `portal.onboarding.edit` | 小叮嚀內容照搬在前端(改內容要改程式,同 D-14),「維護新人導覽」按鈕(portal-editor)目前沒有對應功能,保留不刪 | 是否需要線上維護小叮嚀 / 題目;不需要的話刪除此代碼 | 待確認 |

## 2. 需要使用者執行的動作

| 批次 | 動作 | 說明 | 狀態 |
| --- | --- | --- | --- |
| P2-2a | 合併 `feature/portal-p2-2a-onboarding` → `develop`(10/27 後) | 10/22~10/26 不合併、不部署(FEATURE-PLAN §11)。合併後 CI 部署 portal-api 與前端,`rbac-test` 套用 `deploy/gateway-rbac.yaml`(新增兩個按鈕 `portal.onboarding.confirm` / `portal.onboarding.submit`、兩個 Tab 的 includes,employee 角色加兩個按鈕)。不需要 Drizzle migration(只寫舊表 NewPepR / HRNewPtest) | 待執行 |
| P2-2a | 確認 Tab includes 已生效 | yaml 對「已存在的權限」只首次登記;若套用後 GigaItApp「選單管理」中 `portal.onboarding.tips` / `portal.onboarding.quiz` 沒有綁定 `portal.api.onboarding.read`,請在選單管理手動綁定(同 P2-1 的作法) | 待執行 |
| P2-2a | 測試區驗收 | 以測試帳號開「行政資源 › 新人導覽」:① 小叮嚀內容與舊站一致,按「我已閱讀完畢」後顯示今天日期,`giganexus_gw_test.src_portalsolar.NewPepR` 多一筆(同一天再按不增加)② 驗收區故意答錯 → 顯示答對題數、HRNewPtest 無新增 ③ 全對 → 顯示通過日期,HRNewPtest 只剩本人一筆(PGrade 100)④ 四種風格組合與 375px 寬度版面 | 待執行 |
