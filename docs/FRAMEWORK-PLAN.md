# giga-Portal 框架對齊計畫(FRAMEWORK-PLAN)

> 狀態:**完成(2026-10-12)**:P1–P4 已上測試區並驗收;F1–F3 依建議定案;GigaItApp `it-admin` 已修改;舊代碼整理 SQL 已由使用者執行。下一階段 portal-api 見 `HANDOFF.md`。時程以 NexusPlan 甘特圖為準,本文件不列日期。
> 範圍:登入、選單、Tab、按鈕、首頁儀表板與通知等**框架**,對齊 GigaItApp 現行做法;**Tab 內容(mock 資料、真實 API)不在本計畫**,屬下一階段(PRD M4 / M5)。
> 上位規範:`../giga-api-gateway-bff/docs/`(PRD §8.3 權限、FRONTEND-GUIDE §7、NOTIFY-PLAN §6.5);參考實作:`../GigaItApp/`(commit `85fe8c0`)。

---

## 1. 現況與差異

Portal 的 M1 框架(2026-09)複製自當時的 GigaItApp;之後 GigaItApp 改了選單目錄、Tab / 按鈕權限、通知中心與 web-kit 來源,Portal 沒跟上。選單與 Tab 的**畫面路由已建好**(`frontend/src/router.ts`,7 個大項、44 頁(另有 3 個隱藏的 M1 頁)、76 個 Tab),但 Gateway 資料庫還沒有對應的大項(group)與 Tab 資料;yaml 也只有舊版 menu 代碼(未逐筆確認測試區已套用哪些)。

| 項目 | GigaItApp(對齊目標) | giga-Portal 現況 | 要做 |
| --- | --- | --- | --- |
| 登入 | 經入口網 `/login`(web-kit `redirectToLogin`) | 本身就是 `/login` 提供者;AD / 本機帳號由 BFF 依公司網域判斷 | **不需改**;驗收時確認 `LOGIN_COMPANIES` 三家公司可登入 |
| web-kit 來源 | GitLab npm Registry `^0.3.0` | vite alias 指向兄弟 repo 原始碼 | 改用 Registry(`.npmrc` + `GITLAB_NPM_TOKEN`,CI 同 GigaItApp) |
| 側欄大項 | BFF `kind: group` 節點(名稱 / 圖示 / 順序在「選單管理」可改) | 前端寫死 `MENU_GROUPS` | 登記 `portal.group.*`,側欄改由 `kit.menuOf()` 組出 |
| 選單(頁) | 一頁一個 menu 代碼;名稱以 BFF 為準(`menuTitle`) | 多頁共用代碼(`portal.salary.read` 4 頁、`portal.resource.read` 3 頁…) | **一頁一碼**(§3.2),否則選單管理改名會一次改到多頁 |
| Tab | 每個 Tab 有 `kind: tab` 代碼,沒權限的 Tab 隱藏,全部沒權限則側欄不顯示該頁 | Tab 沒有權限碼 | 每個 Tab 登記代碼(附錄 A) |
| 按鈕 | `kind: button` 掛在 Tab 下,`includes` 綁 API 權限,`v-can` | 只有舊的 `portal.profile.edit` 等 | 規則先定;實際按鈕隨 Tab 內容登記(§3.4) |
| 頁面需要的 API | 路由 `meta.requires` + yaml `includes` | 無 | 機制帶過來;API 碼隨下一階段填 |
| 通知 | `NotifyHost` + `NotifyBell`(web-kit `useNotifyCenter`)、儀表板「最新公告」卡 | 無 | 複製,app 用 `portal`(BFF 已支援 `?app=portal`) |
| 首頁儀表板 | 多個 Tab、`GLazy`、最新公告 | 單頁提示文字 | 框架:問候 + 最新公告(真資料)+ 其他卡片位(標「模擬」) |
| 前端監控 | `installMonitor({ app: 'itapp-web' })` | 無 | 加 `portal-web`(giga-observe W9-9) |
| UI 套件 | `ui/icons.ts`(`hasIcon`)、`GTextarea`;GTabs 用 `@/api/auth` 的 `can` | 缺這兩個;Portal 另有 `GAlert`、`GHero`、`GStyleToggle`(保留) | 補齊缺的元件,`GIcon` 圖示合併 |

## 2. 為什麼 IT 管理員看不到主管專區

主管專區要 `portal-manager` 角色,ESH 要 `portal-esh-admin`;兩個角色在 yaml 裡**沒有指派任何成員**(沒有 AD 群組、規則或公司),所以沒有人看得到。

Gateway `apply` 對角色的 `permissions` 是**整組取代**,而且沒有角色繼承,所以 Portal 不能在自己的 yaml 裡改 `it-admin`(否則 GigaItApp 下次 CI 套用時會被蓋掉,或反過來蓋掉 GigaItApp 的設定)。

**做法(建議)**:在 `GigaItApp/deploy/gateway-rbac.yaml` 的 `it-admin` 加上 Portal **所有 menu + tab 代碼**(含主管專區、ESH),**不含按鈕**(「查看」不給寫入)。

- 這是跨 repo 修改,動 GigaItApp 前要先取得同意,並在 GigaItApp 留紀錄。
- 順序限制:`apply` 遇到不存在的權限碼會整批失敗,所以**Portal 的 yaml 要先套用**,GigaItApp 才能套用。測試區第一次手動依序執行,之後兩邊 CI 各自套用即可。
- 一般主管的成員設定(依職級的指派規則)仍由 IT 在 GigaItApp「角色與指派規則」設定,不在本計畫。

## 3. 權限資料設計

### 3.1 代碼規則(同 GigaItApp)

| kind | 代碼格式 | parent | 例 |
| --- | --- | --- | --- |
| app | `portal.app.access` | — | 已存在 |
| group | `portal.group.<大項>` | `portal.app.access` | `portal.group.manager`(含 `icon`) |
| menu | `portal.<頁>.read` | 所屬 group | `portal.mgr.rights.read` |
| tab | `portal.<頁>.<tab>` | 所屬 menu | `portal.mgr.rights.level1` |
| button | `portal.<頁>.<動作>` | 所屬 tab | `portal.news.publish`;`includes` = 呼叫的 API 權限 |

- 第三方系統的 API 碼(`bpm.*`、`hrm.*`)只放在 `includes`,不當作選單碼。例:「待我簽核」選單改用 `portal.approval.read`,`includes: [bpm.approval.read]`(BPM API 登記後再加)。
- 大項(group)、頁、Tab 的代碼與排序定在附錄 A;名稱、圖示、順序之後由 IT 在 GigaItApp「選單管理」調整,以 BFF 為準。

### 3.2 舊代碼處理

| 舊代碼 | 處理 |
| --- | --- |
| 沿用的 menu 碼(`portal.profile.read`、`portal.salary.read`、`portal.mgr.*`、`portal.esh.*`…) | 已存在的權限 `apply` **不會改上層與排序**:套用後在 GigaItApp「選單管理」把頁面移到對應目錄,或執行一次性 SQL(要寫入測試區前先確認) |
| 拆出新碼的頁(年度所得、薪資異動、金鑰重置、異常回報、總務 / 人資 / 職缺、BPM 簽核資訊、待我簽核) | 新增代碼;`employee` 角色同步加入,使用者看到的範圍不變 |
| 隱藏的 M1 頁:`personal/leave`、`personal/attendance`、`resources/admin` 及其代碼(`portal.leave.*`、`portal.attendance.punch`、`portal.resource.edit`…) | **待決 F1**:建議刪除路由;代碼從角色移除後由 IT 在選單管理停用 |

### 3.3 角色

| 角色 | 所在 yaml | 權限 |
| --- | --- | --- |
| `employee` | Portal | 個人資訊、表單與簽核、行政資源、集團與公告的 menu + tab;ESH 化學品清單 |
| `portal-manager` | Portal | 主管專區 menu + tab(成員由 IT 用職級規則指派) |
| `portal-esh-admin` | Portal | ESH 證照管理 menu + tab(化學品除外) |
| `portal-editor` / `portal-approver` | Portal | 維持;按鈕隨內容階段補 |
| `it-admin` | **GigaItApp** | 原有 `it.*` + Portal 全部 menu + tab(§2) |

### 3.4 按鈕

框架階段只定規則與機制,不先登記空按鈕:

- 頁面按鈕一律 `v-can="UI.xxx"`;代碼登記在 yaml(`kind: button`、parent = Tab、`includes` = API 權限),常數放 `frontend/src/api/auth.ts` 的 `UI`。
- 下一階段每做一個 Tab 內容,同一個變更內登記它的按鈕與 API。

## 4. 工作項目(分批交付)

每批做完先給你測,同時進行下一批。

### P1 前端框架對齊(不寫資料庫)

1. web-kit 改 Registry `^0.3.0`(`package.json`、`.npmrc`、`vite.config.ts` 移除 alias、Dockerfile / CI 帶 Token,同 GigaItApp)。
2. 選單:沿用 Portal 的結構(路由 meta 為預設值),`composables/menu.ts buildMenu` 改為依 `kit.menuOf` 的 group / 名稱 / 排序組側欄(同 GigaItApp `buildMenus`);`api/gateway.ts` 加 `can` / `canAll` / `menuOf` / `menuTitle` / `menuIcon`。
3. `router.ts`:每個 Tab 子路由加 `permission`;支援 `meta.requires`;Tab 無權限時轉到同頁第一個可看的 Tab;側欄隱藏沒有可看 Tab 的頁(`setPageHasTab`)。
4. `TabbedPage.vue`、`GTabs.vue`:標題與 Tab 名稱以 BFF 為準;只有一個 Tab 時維持不顯示頁籤列(Portal 現行行為)。
5. `ui/icons.ts`、`GTextarea`、`GIcon` 圖示合併;`components.d.ts` 更新。
6. `installMonitor({ app: 'portal-web' })`。
7. 測試:`menu.test.ts` 改測 `buildMenus`(BFF 有 / 無資料、頁面改掛目錄、無 Tab 隱藏)。

BFF 還沒有新代碼時,側欄退回前端預設值,畫面行為與現在相同,所以 P1 可以先上測試區。

### P2 權限資料(寫入測試區資料庫,執行前先問)

1. 改寫 `deploy/gateway-rbac.yaml`:group、一頁一碼的 menu、全部 tab(附錄 A)、角色。
2. 測試區套用 Portal yaml(CI `rbac-test`,或手動 `sh deploy/apply-gateway-rbac.sh test …`)。
3. 舊代碼搬到 group 下(選單管理或一次性 SQL,§3.2)。
4. 取得同意後改 GigaItApp `it-admin`(§2),套用。
5. GigaItApp「選單管理」確認 Portal 樹狀:7 個大項 → 44 頁 → 76 個 Tab。

### P3 通知與首頁儀表板

1. 複製 `components/notify/`(`NotifyHost`、`NotifyBell`、`LatestAnnouncements`;發布用的 `RichEditor`、`AudiencePicker` 不帶)與 `composables/notify.ts`,`useNotifyCenter('portal')`,內文樣式 `notify-content.css`。
2. `AppLayout.vue` 頂列加鈴鐺;`NotifyHost` 掛在版面(Toast、強制閱讀公告對話框)。
3. 首頁框架:問候、最新公告卡(真實資料)、其他卡片位(今日出勤、待我簽核、我的假期)標示「待串接」,不放假資料(PRD FR-4.9)。
4. 「集團與公告 › 最新公告」的資料改接 BFF `/api/notify/*`,屬下一階段內容,本批只確認路由與權限。

### P4 驗收

| 場景 | 預期 |
| --- | --- |
| `it-admin` 成員登入 | 看得到主管專區、ESH 全部頁與 Tab;看不到按鈕 |
| 只有 `employee` 的帳號 | 看不到主管專區、ESH 管理頁;化學品清單可看;直接輸入主管專區網址 → 403 |
| GigaItApp 選單管理改頁名 / 大項圖示 / 移除某 Tab 權限 | Portal 換頁後(5 分鐘內)反映,Tab 隱藏且網址轉到第一個可看 Tab |
| GigaItApp 發布公告(管道含員工入口網) | Portal 鈴鐺即時出現,首頁最新公告卡更新 |
| 應用切換 | Portal ⇄ GigaItApp 不需重新登入 |
| 畫面 | 玻璃 / 扁平 × 明亮 / 黑暗 四種組合、375px 寬 |

**驗收結果(2026-10-12,S112009,角色 employee / gw-super-admin / it-admin)**:`/api/auth/me` 的入口網大項 7 個名稱正確、menu 44 個全部掛在 `portal.group.*` 下、tab 76 個、已移除代碼不再出現;側欄「首頁」為直接連結;主管專區 11 頁可見,「主管權限說明」4 個 Tab 與麵包屑正確;首頁兩欄卡片與最新公告(即時連線)正常;giga-observe `portal-web` 節點健康並收到事件。發布公告即時推送與 375px 實機未在測試區另行驗證(本機已驗)。

**驗收後依需求方回饋調整**:首頁大項不摺疊;移除首頁「功能導覽」;首頁版面改依 old_PortalSolar(待辦事項、個人秘書、最新公告、公告輪播、集團動態)。

同步更新:`PRD.md`(§6.5.1 代碼表、修訂紀錄)、`Gherkin/rbac/*`、`PROJECT-MAP.md`、`UI-GUIDE.md`、`DevelopmentProcess/NewFeatures.md`;架構資料 `GigaNexusAIPlan/architecture/` 若有關係變更一併改。

## 5. 待決事項

| # | 問題 | 建議 |
| --- | --- | --- |
| F1 | 隱藏的 M1 頁(我的假期、出勤紀錄、行政資源維護)要刪嗎 | **已決定**(2026-10-12):刪除 |
| F2 | `it-admin` 是看 Portal 全部,還是只看主管專區 + ESH | **已決定**:全部 menu + tab,不含按鈕 |
| F3 | 共用代碼拆成一頁一碼(§3.2) | **已決定**:拆 |
| F4 | 首頁儀表板要不要像 IT 一樣分 Tab | 先單頁;內容階段再看 |

---

## 附錄 A:選單與 Tab 代碼(P2 登記用)

group 排序 10、20…;頁的 sort 依表中順序 10、20…;Tab sort 依表中順序。★ = 新代碼(其餘已在 yaml)。

| 大項(group) | 頁(路由) | menu 代碼 | Tab 代碼(`portal.` 省略) |
| --- | --- | --- | --- |
| 首頁 `portal.group.home` | `/` | `portal.home.read` | (無 Tab) |
| 個人資訊 `portal.group.personal` | `personal/profile` | `portal.profile.read` | `profile.basic`、`profile.pension`、`profile.health-family`、`profile.tax-dependents`、`profile.insurance-bracket`、`profile.commute` |
| | `personal/query` | ★`portal.query.read`(原 `attendance.read`) | `query.card`、`query.attendance`、`query.overtime`、`query.leave`、`query.schedule`、`query.comp-time`、`query.annual-leave`、`query.insurance-detail`、`query.nhi2` |
| | `personal/salary` | `portal.salary.read` | `salary.slip`、`salary.bonus` |
| | `personal/annual-gains` | ★`portal.annual-gains.read` | `annual-gains.list`、`annual-gains.tax-proof` |
| | `personal/salary-adjustment` | ★`portal.salary-adjust.read` | `salary-adjust.history` |
| | `personal/abnormal-attendance` | `portal.attendance-abnormal.read` | `attendance-abnormal.list` |
| | `personal/abnormal-respond` | ★`portal.abnormal-respond.read` | `abnormal-respond.report` |
| | `personal/ef-info` | ★`portal.ef-info.read`(includes `bpm.approval.read`) | `ef-info.pending`、`ef-info.unclosed` |
| | `personal/release-mail` | `portal.release-mail.read` | `release-mail.list` |
| | `personal/property` | `portal.asset.read` | `asset.current`、`asset.transfer` |
| | `personal/cipher-reset` | ★`portal.cipher-reset.read`(Q12 可能退場) | `cipher-reset.reset` |
| | `personal/annual-courses` | `portal.course.read` | `course.required` |
| | `personal/notes` | `portal.note.read` | `note.list` |
| 表單與簽核 `portal.group.approval` | `approval` | ★`portal.approval.read`(includes `bpm.approval.read`) | `approval.pending`、`approval.done`、`approval.sent` |
| | `forms` | `portal.form.read` | `form.list` |
| 行政資源 `portal.group.resources` | `resources` | ★`portal.ga.read`(總務專區) | `ga.service`、`ga.apply`、`ga.property`、`ga.outbound`、`ga.parking` |
| | `resources/hr` | ★`portal.hr.read` | `hr.welfare`、`hr.agent` |
| | `resources/job-opening` | ★`portal.job.read` | `job.list` |
| | `resources/qa` | `portal.survey.read` | `survey.list` |
| | `onboarding` | `portal.onboarding.read` | `onboarding.tips`、`onboarding.quiz` |
| | `directory` | `portal.directory.read` | `directory.extension`、`directory.contact` |
| | `gui-number` | `portal.gui-number.read` | `gui-number.list` |
| 集團與公告 `portal.group.news` | `news` | `portal.news.read` | `news.all`、`news.unread` |
| | `calendar` | `portal.calendar.read` | `calendar.month`、`calendar.list` |
| | `links` | `portal.links.read` | `links.list` |
| | `talk` | `portal.talk.read` | `talk.board` |
| 主管專區 `portal.group.manager` | `manager/rights` | `portal.mgr.rights.read` | `mgr.rights.level1` ~ `level4` |
| | `manager/shift` | `portal.mgr.shift.read` | `mgr.shift.upload` |
| | `manager/boss-trace` | `portal.mgr.boss-trace.read` | `mgr.boss-trace.trace` |
| | `manager/attendance` | `portal.mgr.attendance.read` | `mgr.attendance.punch`、`mgr.attendance.abnormal` |
| | `manager/leave-balance` | `portal.mgr.leave-balance.read` | `mgr.leave-balance.rank` |
| | `manager/promotion-map` | `portal.mgr.promotion.read` | `mgr.promotion.map` |
| | `manager/training-plan` | `portal.mgr.training.read` | `mgr.training.plan` |
| | `manager/safety-courses` | `portal.mgr.safety-course.read` | `mgr.safety-course.rate` |
| | `manager/property` | `portal.mgr.property.read` | `mgr.property.list` |
| | `manager/budget` | `portal.mgr.budget.read` | `mgr.budget.exec` |
| | `manager/budget-apply` | `portal.mgr.budget-apply.read` | `mgr.budget-apply.apply` |
| ESH 證照管理 `portal.group.esh` | `esh/management` | `portal.esh.license.read` | `esh.license.list` |
| | `esh/items` | `portal.esh.item.read` | `esh.item.list` |
| | `esh/needs` | `portal.esh.need.read` | `esh.need.list` |
| | `esh/personal` | `portal.esh.personal.read` | `esh.personal.list` |
| | `esh/managers` | `portal.esh.manager.read` | `esh.manager.list` |
| | `esh/chemicals` | `portal.esh.chemical.read` | `esh.chemical.regulated`、`esh.chemical.unregulated` |

合計:group 7、menu 44(★ 新增 10)、tab 76。
