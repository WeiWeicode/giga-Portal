# 專案地圖 — giga-Portal(員工入口網)

> **最後更新: 2026-10-05**
> 0. 2026-10-05:每個功能頁都加上 menu 權限(PRD §6.5.1);主管專區、ESH 不再無權限開放,需 `portal-manager` / `portal-esh-admin` 角色;§1 目錄樹更正為實際檔案位置。
> 1. 對齊舊版入口網站 `old_PortalSolar`，全面完成前端六大模組排版與路由整合：**個人資訊** (13 頁)、**表單與簽核** (2 頁)、**行政資源** (7 頁)、**集團與公告** (4 頁)、**主管專區** (11 頁)、**ESH證照管理** (6 頁)。
> 2. `frontend/src/ui/index.ts` 補齊所有 `G*` 全域元件與圖表具名匯出。
> 3. CI/CD `Dockerfile` 修正為 `npm ci --include=dev`，確保容器建置包含 Vite 相關 devDependencies，測試區與生產區 pipeline 均已建置成功。
> 4. 開發新功能後，在同一個變更內更新本文件 (`AGENT.md` §9.1)。只寫結構與職責，細節連到 `docs/` 對應章節。

集團員工的單一入口：`/` (Vue 前端，含 `/login`) + `/api/portal/*` (portal-api，Fastify，port 51271，經 Gateway BFF；M4 起)；登入與權限由 Gateway 提供，權限由 GigaItApp 設定。

---

## 1. 目錄結構

```
giga-Portal/
├─ AGENT.md                       AI 協作準則
├─ README.md                      專案簡介
├─ .claude/launch.json            本機預覽設定 (npm --prefix frontend run dev, port 5179)
├─ docs/
│  ├─ PRD.md                      產品需求 (決策、FR、配合修改、待決事項)
│  ├─ ARCHITECTURE.md             架構、請求流程、權限流程、風格切換、部署
│  ├─ API.md                      portal-api 端點 (草案) 與使用的 BFF API
│  ├─ UI-GUIDE.md                 綠能 token、玻璃 / 扁平、全域元件差異、版面
│  ├─ PROJECT-MAP.md              本文件
│  ├─ Gherkin/                    驗收場景 (@auto / @manual / @wip)
│  └─ DevelopmentProcess/         修正紀錄 (NewFeatures、FrontendCorrection、BackendCorrection、BugFix)
├─ frontend/                      Vue 3 + Vite (base /; 框架複製自 GigaItApp)
│  ├─ index.html                  進入點; 先載入 public/theme-init.js 套用明暗 / 風格 (Gateway CSP 不允許 inline script)
│  ├─ public/                     favicon.svg、theme-init.js
│  ├─ vite.config.ts              base /、port 5179、/api proxy、@giganexus/web-kit alias
│  ├─ Dockerfile、publish.sh       SPA 映像檔與發佈 / 回滾 (npm ci --include=dev; releases/<版本> + current symlink)
│  ├─ src/
│  │  ├─ main.ts、App.vue         啟動: initTheme → router → ui
│  │  ├─ router.ts                路由與選單來源 (MENU_GROUPS、MENU_PAGES); 全域守衛 (me → 應用層 → 頁面權限)
│  │  ├─ api/gateway.ts           Gateway BFF 唯一入口 (web-kit 包裝): 登入、密碼、註冊、describeError、PortalMe 型別
│  │  ├─ api/format.ts            顯示格式 (時間等)
│  │  ├─ composables/             apps (應用切換 / 應用層守衛)、menu (選單過濾)、redirect (安全導回)、
│  │  │                           session (me 5 分鐘更新)、theme / themeRules (明暗 × 風格)、greeting、useAsync、usePaged
│  │  ├─ layouts/                 AppLayout (側欄、頂列、應用切換、帳號)、TabbedPage (頁籤容器)、AuthLayout、ChangePasswordModal
│  │  ├─ pages/                   各功能模組頁面 (對齊 old_PortalSolar):
│  │  │  ├─ auth/                 Login、Register、ResetPassword、SetPasswordForm、AuthHeader
│  │  │  ├─ home/                 Home.vue (員工入口首頁儀表板)
│  │  │  ├─ personal/             【個人資訊】(13 頁;權限見 PRD §6.5.1)
│  │  │  │  ├─ profile/           個人基本資料 portal.profile.read (6 Tabs: 基本資料/勞退新制/健保眷屬/所得稅扶養/勞健保級距/通勤調查)
│  │  │  │  ├─ query/             自助查詢 portal.attendance.read (9 Tabs: 刷卡/出勤/加班/請假/班表與訂餐/補休榮譽假/特休/勞健保明細/二代健保)
│  │  │  │  ├─ salary/            薪資獎金 portal.salary.read (2 Tabs: 薪資明細 / 獎金明細)
│  │  │  │  ├─ annualGains/       年度所得 portal.salary.read (2 Tabs: 年度所得清冊 / 扣繳憑單)
│  │  │  │  ├─ salaryAdjustment/  薪資異動 portal.salary.read
│  │  │  │  ├─ abnormalAttendance/ 出勤異常 portal.attendance-abnormal.read
│  │  │  │  ├─ abnormalRespond/   出勤時數異常回報 portal.attendance-abnormal.read
│  │  │  │  ├─ efInfo/            BPM 簽核資訊 bpm.approval.read (2 Tabs: 待簽核 / 未結案)
│  │  │  │  ├─ releaseMail/       郵件審核資訊 portal.release-mail.read
│  │  │  │  ├─ property/          個人資產明細 portal.asset.read (2 Tabs: 保管資產 / 移轉歷程)
│  │  │  │  ├─ cipherReset/       薪資金鑰重置 portal.salary.read (去留待決 PRD Q12)
│  │  │  │  ├─ annualCourses/     年度必上課程 portal.course.read
│  │  │  │  └─ notes/             個人提醒 portal.note.read
│  │  │  ├─ approval/             【表單與簽核】(2 頁)
│  │  │  │  ├─ Approval*Tab.vue   待我簽核 bpm.approval.read (3 Tabs: 待簽核/已簽核/我送出的)
│  │  │  │  └─ FormsPage.vue      表單下載 portal.form.read
│  │  │  ├─ resources/            【行政資源】(7 頁)
│  │  │  │  ├─ generalAffairs/    總務專區 portal.resource.read (5 Tabs: 服務項目/申請專區/個人資產/外送資產/湖口廠停車)
│  │  │  │  ├─ hr/                人資專區 portal.resource.read (2 Tabs: 團體保險 / 主管職務代理人)
│  │  │  │  ├─ jobOpening/        內部職缺 portal.resource.read
│  │  │  │  ├─ qa/                問卷調查 portal.survey.read
│  │  │  │  ├─ onboarding/        新人導覽 portal.onboarding.read (2 Tabs: 小叮嚀 / 驗收區)
│  │  │  │  ├─ directory/         分機表、聯絡窗口 portal.directory.read (2 Tabs)
│  │  │  │  └─ GuiNumberPage.vue  集團統編資訊 portal.gui-number.read
│  │  │  ├─ group/                【集團與公告】(4 頁)
│  │  │  │  ├─ news/              最新公告 portal.news.read (2 Tabs: 全部 / 未讀)
│  │  │  │  ├─ calendar/          行事曆 portal.calendar.read (2 Tabs: 月曆 / 清單)
│  │  │  │  ├─ LinksPage.vue      集團系統 portal.links.read
│  │  │  │  └─ TalkPage.vue       3691 全民開講 portal.talk.read
│  │  │  ├─ manager/              【主管專區】(11 頁,portal.mgr.*.read,角色 portal-manager)
│  │  │  │  ├─ rights/            主管權限說明 (4 Tabs: 課級/理級/處級/總經理室各級職責與核決)
│  │  │  │  ├─ shift/             部門班表匯入 (班表 Excel 批次上傳、解析預覽、班別代碼)
│  │  │  │  ├─ bossTrace/         主管工時追蹤 (理級以上工時追蹤、出差統計、健康超時警示)
│  │  │  │  ├─ attendance/        部屬出勤分析 (2 Tabs: 刷卡時間分佈 / 連續異常缺卡面談)
│  │  │  │  ├─ leaveBalance/      休假餘額控管 (60 天內即將失效特補休排行榜、排休提醒)
│  │  │  │  ├─ promotion/         職等晉升地圖 (各職系晉升資格、年資考績條件矩陣)
│  │  │  │  ├─ training/          部門訓練計畫 (年度開課計畫、預算與完訓達成率)
│  │  │  │  ├─ safetyCourses/     工安課程達成率 (部門全員 12 門必修工安課完訓名冊)
│  │  │  │  ├─ property/          部門財產清冊 (部門固定資產清冊、保管人及原值)
│  │  │  │  ├─ budget/            部門預算執行 (會計科目預算執行率長條圖、動支實績)
│  │  │  │  └─ budgetApply/       新年度預算編列 (CAPEX / OPEX 預算提案申請與審批)
│  │  │  ├─ esh/                  【ESH證照管理】(6 頁，無權限限制直接展示)
│  │  │  │  ├─ management/        證照管理 (全廠持照清冊、90 天屆期預警、過期警示)
│  │  │  │  ├─ itemEdit/          證照項目設定 (法定機械/安衛證照代碼庫、主管機關、回訓週期)
│  │  │  │  ├─ licenseNeed/       工作站法定需求 (各廠區作業站點法定持照配置與人力缺口)
│  │  │  │  ├─ personalLicense/   人員證照登記 (證書字號效期登錄審核、電子證照上傳)
│  │  │  │  ├─ managerSetup/      環安窗口設定 (廠區/部門法定專責人、緊急應變窗口名冊)
│  │  │  │  └─ chemicals/         危害性化學品資訊 (2 Tabs: 列管化學品 CAS No. / 一般非列管化學品)
│  │  │  └─ 共通頁面:             Placeholder、NoAccess、Unavailable、Forbidden、NotFound
│  │  ├─ ui/                      全域 UI 套件: G* 元件、styles/tokens.css (綠能 × 玻璃 / 扁平)、base.css、charts/、feedback
│  │  └─ components.d.ts          全域元件型別
│  └─ test/                       Vitest: redirect、apps、menu、theme、greeting (29 passed)
├─ deploy/
│  ├─ gateway-rbac.yaml           公司測試區 / 正式區的權限代碼與角色 (AD 群組 DN 由 IT 填入)
│  ├─ apply-gateway-rbac.sh       以 Gateway 正式 compose 的 migrate 映像套用上檔
│  ├─ test.env.example            公司環境 Compose 變數範本
│  └─ docker-compose.yml          spa-portal (發佈到 gw_www 的 portal, Nginx /); portal-api (M4 規劃)
└─ backend/ (規劃, M4)            portal-api (以 Gateway 後端樣本為基礎)
   ├─ src/                        server、app、config、errors、openapi、routes/、store/
   └─ test/                       OpenAPI 自我檢查、內部 Token、資料層級
```

---

## 2. 選單群組架構 (`MENU_GROUPS`)

| 群組 Key | 群組名稱 | 英文名稱 | 圖示 | 頁面數量 | 權限規範 |
| --- | --- | --- | --- | --- | --- |
| `home` | 首頁 | Home | `home` | 1 | `portal.home.read` |
| `personal` | 個人資訊 | Personal Information | `user` | 10 | 依頁面權限規範 (`portal.profile.read` 等) |
| `approval` | 表單與簽核 | Forms & Approvals | `file-check` | 3 | 依頁面權限規範 (`portal.approval.read` 等) |
| `resources` | 行政資源 | Resources | `folder` | 7 | 依頁面權限規範 (`portal.directory.read` 等) |
| `group` | 集團與公告 | Group & News | `megaphone` | 6 | 依頁面權限規範 (`portal.news.read` 等) |
| `manager` | 主管專區 | Manager Menu | `user-check` | 11 | **無權限限制直接開放** (全員可檢視排版欄位) |
| `esh` | ESH證照管理 | License of ESH | `shield` | 6 | **無權限限制直接開放** (全員可檢視排版欄位) |

---

## 3. 分層職責 (Gateway `AGENT.md` §10.7.2)

| 層 | 後端 (規劃) | 前端 (目前架構) |
| --- | --- | --- |
| 介面 | `routes/*.ts` (schema、權限宣告) | `pages/` (各模組功能頁)、`layouts/` (`AppLayout`, `TabbedPage`) |
| 核心邏輯 | 服務模組 (公告可見範圍、資料層級) | `composables/` (應用、選單過濾、導回 redirect、主題 theme、會話 session) |
| 基礎設施 | `store/` (JSON → SQL Server)、SDK | `api/gateway.ts` (web-kit BFF 連線)、`api/format.ts` |
| 共用 / 工具 | `config.ts`、`errors.ts` | `ui/` (全域 G* 元件庫、tokens.css 樣式變數、SVG 圖示) |

---

## 4. 主要請求與導向流程

| 流程 | 經過路徑 |
| --- | --- |
| 登入與驗證 | `pages/auth/Login.vue` → `api/gateway.ts login()` → Gateway `/api/auth/login` → 導回首頁或目標頁 |
| 首次登入改密碼 | `Login.vue` (`PASSWORD_CHANGE_REQUIRED`) → `SetPasswordForm` → `/api/auth/password/change` |
| 路由與權限檢查 | `router.ts` 守衛 → `session.ensureMe()` → `apps.hasApp()` (應用層) → 頁面 `meta.permission` (若無則直接放行) |
| 選單生成 | `router.ts` `MENU_PAGES` (取自 `appPages` 中具 `group` 者) → `composables/menu.ts` 依用戶權限篩選 |
| 應用切換 | `AppLayout` → `GAppSwitcher` → `resolveApps(me)` → 整頁跳轉至該應用 `basePath` |
| 風格切換 | `GStyleToggle` → `composables/theme` → `<html data-theme data-style>` → `tokens.css` 即時變色 |
| 功能頁 Tab 切換 | `TabbedPage.vue` 結合 `GTabs.vue`，子路由對應各 Tab，重新整理 URL 不失聯 |

---

## 5. 要改什麼 → 看哪裡

| 要做的事 | 位置 |
| --- | --- |
| 個人資訊頁面 / 欄位 | `frontend/src/pages/personal/` (對齊 `old_PortalSolar` 各 Tab 欄位) |
| 表單簽核流程 / 常用表單 | `frontend/src/pages/approval/` |
| 行政資源 / 通訊錄 / 總務 | `frontend/src/pages/resources/` |
| 集團公告 / 行事曆 / 新人專區 | `frontend/src/pages/group/` |
| 主管專區各項報表與權限 | `frontend/src/pages/manager/` |
| ESH 證照清冊 / 法定需求 / 化學品 | `frontend/src/pages/esh/` |
| 新增選單群組或功能路由 | `frontend/src/router.ts` (`MENU_GROUPS`, `appPages`) |
| 全域 UI 元件與圖示 | `frontend/src/ui/components/`、`frontend/src/ui/icons/`、`frontend/src/ui/index.ts` |
| 品牌色彩 / 明暗主題變數 | `frontend/src/ui/styles/tokens.css` (綠能、玻璃 / 扁平四組變數) |
| CI/CD 容器打包設定 | `frontend/Dockerfile` (`npm ci --include=dev`)、`deploy/docker-compose.yml` |

---

## 6. 測試與驗證

| 類型 | 位置 | 執行指令 | 狀態 |
| --- | --- | --- | --- |
| 前端單元測試 | `frontend/test/` (redirect、apps、menu、theme、greeting) | `npm test` (在 `frontend/` 下) | 5 passed (29 tests) |
| 前端生產打包 | `frontend/src/` 全體 Vue / TS | `npm run build` | 乾淨通過 (Vite build < 5s) |
| CI/CD 自動部署 | GitLab Runner (`develop` 測試區 / `main` 生產區) | `git push gitlab develop/main` | Docker Compose 自動建置與掛載 |

---

## 7. 與設計原則的已知差異

| 項目 | 現況說明 | 未來規劃 |
| --- | --- | --- |
| UI 套件為複製品 | 與 GigaItApp 各有一份 `ui/` | 等 npm / NuGet 私有 Registry 上線後抽成獨立共用套件 |
| web-kit 以 alias 引用 | 依賴工作區同級兄弟 repo 目錄結構 | Registry 上線後改為正式套件相依 |
| 主管與 ESH 專區權限放行 | 配合現階段僅需前端排版與欄位展示，路由不設權限卡控 | 未來串接正式 API 後，依主管級別與環安角色設定權限守衛 |
| portal-api 資料層 | 現階段各功能頁以靜態 Mock 資料展示排版與欄位 | M4 里程碑起實作 Fastify 後端與資料庫 CRUD |
