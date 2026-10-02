/**
 * 路由(History 模式,base = /):
 *   第一層:選單群組(MENU_GROUPS)
 *   第二層:功能頁(TabbedPage),meta 定義標題、英文副標、圖示、menu 權限與 Tab
 *   第三層:Tab = 子路由(網址對應 Tab,重新整理停在同一個 Tab)
 * 權限代碼與 PRD §6.5 一致;新增代碼先在 PRD 登記(portal-api 上線後同步 OpenAPI x-permissions,PRD FR-3.4)。
 * 全域守衛:me → 應用層(portal.app.access)→ 頁面權限(menu / tab),見 ARCHITECTURE §3.1。
 */
import { createRouter, createWebHistory, type RouteComponent, type RouteRecordRaw } from 'vue-router';
import AppLayout from './layouts/AppLayout.vue';
import AuthLayout from './layouts/AuthLayout.vue';
import TabbedPage from './layouts/TabbedPage.vue';
import { CURRENT_APP, hasApp, resolveApps } from './composables/apps';
import type { MenuGroupDef, MenuPage } from './composables/menu';
import { ensureMe } from './composables/session';
import type { TabItem } from './ui/components/GTabs.vue';

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    /** 英文副標(選單與頁首) */
    subtitle?: string;
    description?: string;
    icon?: string;
    /** 功能頁所屬的選單群組(MENU_GROUPS.key);沒有 group 的頁面不列在選單 */
    group?: string;
    tab?: string;
    tabs?: TabItem[];
    /** 應用層守衛不檢查(無權限頁本身,避免迴圈,PRD FR-2.4) */
    noAppGuard?: boolean;
    /** 模擬或尚未串接的頁面:標示預計完成的里程碑 */
    milestone?: string;
  }
}

export const MENU_GROUPS: readonly MenuGroupDef[] = [
  { key: 'home', title: '首頁', subtitle: 'Home', icon: 'home' },
  { key: 'personal', title: '個人資訊', subtitle: 'Personal Information', icon: 'user' },
  { key: 'approval', title: '表單與簽核', subtitle: 'Forms & Approvals', icon: 'file-check' },
  { key: 'resources', title: '行政資源', subtitle: 'Resources', icon: 'folder' },
  { key: 'group', title: '集團與公告', subtitle: 'Group & News', icon: 'megaphone' },
];

const Placeholder = () => import('./pages/Placeholder.vue');

type TabDef = TabItem & {
  path: string;
  component?: RouteComponent | (() => Promise<{ default: RouteComponent }>);
};

/** 功能頁(TabbedPage);tabs 省略時只有一個內容頁 */
function page(path: string, meta: RouteRecordRaw['meta'] & { title: string; group?: string }, tabs: TabDef[] = []): RouteRecordRaw {
  const base = `/${path}`;
  const children: RouteRecordRaw[] = tabs.length
    ? tabs.map((t) => ({
        path: t.path,
        component: t.component ?? Placeholder,
        meta: { tab: t.label, ...(t.permission ? { permission: t.permission } : {}) },
      }))
    : [{ path: '', component: Placeholder }];
  return {
    path,
    component: TabbedPage,
    meta: { ...meta, tabs: tabs.map(({ path: p, component: _c, ...t }) => ({ ...t, to: p ? `${base}/${p}` : base })) },
    children,
  };
}

const appPages: RouteRecordRaw[] = [
  {
    path: '',
    component: () => import('./pages/home/Home.vue'),
    meta: { title: '首頁', subtitle: 'Home', icon: 'home', group: 'home', permission: 'portal.home.read', milestone: 'M4' },
  },
  // 個人資訊 (對齊 old_PortalSolar)
  page(
    'personal/profile',
    {
      title: '個人基本資料',
      subtitle: 'Personal Data',
      icon: 'id-card',
      group: 'personal',
      permission: 'portal.profile.read',
      milestone: 'M5',
      description: '個人基本資料、勞退新制、健保眷屬、所得稅扶養、勞健保級距與通勤調查',
    },
    [
      { label: '基本資料', path: '', icon: 'user', component: () => import('./pages/personal/profile/ProfileBasicTab.vue') },
      { label: '勞退新制資料', path: 'pension', icon: 'shield', component: () => import('./pages/personal/profile/ProfilePensionTab.vue') },
      { label: '健保眷屬加退保異動', path: 'health-family', icon: 'users', component: () => import('./pages/personal/profile/ProfileHealthFamilyTab.vue') },
      { label: '所得稅扶養眷屬異動', path: 'tax-dependents', icon: 'file-check', component: () => import('./pages/personal/profile/ProfileTaxDependentsTab.vue') },
      { label: '勞健保/勞退級距', path: 'insurance-bracket', icon: 'layers', component: () => import('./pages/personal/profile/ProfileInsuranceBracketTab.vue') },
      { label: '溫室氣體盤查員工通勤調查', path: 'commute', icon: 'leaf', component: () => import('./pages/personal/profile/ProfileCommuteTab.vue') },
    ],
  ),
  page(
    'personal/query',
    {
      title: '自助查詢',
      subtitle: 'Self-help inquiry',
      icon: 'search',
      group: 'personal',
      permission: 'portal.profile.read',
      milestone: 'M5',
      description: '出勤年月之刷卡、出勤、加班、請假、班表、補休、特休、勞健保與二代健保明細',
    },
    [
      { label: '刷卡記錄', path: '', icon: 'clock', component: () => import('./pages/personal/query/QueryCardRecordsTab.vue') },
      { label: '出勤記錄', path: 'attendance', icon: 'calendar', component: () => import('./pages/personal/query/QueryAttendanceTab.vue') },
      { label: '加班紀錄', path: 'overtime', icon: 'zap', component: () => import('./pages/personal/query/QueryOvertimeTab.vue') },
      { label: '請假紀錄', path: 'leave', icon: 'palm', component: () => import('./pages/personal/query/QueryLeaveTab.vue') },
      { label: '班表&訂餐記錄', path: 'schedule', icon: 'grid', component: () => import('./pages/personal/query/QueryScheduleMealTab.vue') },
      { label: '補休/榮譽假', path: 'comp-time', icon: 'check-circle', component: () => import('./pages/personal/query/QueryCompTimeTab.vue') },
      { label: '特休', path: 'annual-leave', icon: 'sun', component: () => import('./pages/personal/query/QueryAnnualLeaveTab.vue') },
      { label: '勞健保明細', path: 'insurance-detail', icon: 'shield', component: () => import('./pages/personal/query/QueryInsuranceDetailTab.vue') },
      { label: '二代健保', path: 'nhi2', icon: 'file-check', component: () => import('./pages/personal/query/QueryNhi2Tab.vue') },
    ],
  ),
  page(
    'personal/salary',
    {
      title: '薪資獎金',
      subtitle: 'Salary & Bonus',
      icon: 'audit',
      group: 'personal',
      permission: 'portal.profile.read',
      milestone: 'M5',
      description: '每月薪資單明細、年終/績效/節日獎金明細與二代健保代扣說明',
    },
    [
      { label: '薪資明細', path: '', icon: 'audit', component: () => import('./pages/personal/salary/SalarySlipTab.vue') },
      { label: '獎金明細', path: 'bonus', icon: 'coin', component: () => import('./pages/personal/salary/BonusDetailTab.vue') },
    ],
  ),
  page(
    'personal/annual-gains',
    {
      title: '年度所得',
      subtitle: 'Annual Salary & Bonus',
      icon: 'layers',
      group: 'personal',
      permission: 'portal.profile.read',
      milestone: 'M5',
      description: '年度薪資彙整總額清冊、所得扣繳憑單與申報證明',
    },
    [
      { label: '年度所得清冊', path: '', icon: 'list', component: () => import('./pages/personal/annualGains/AnnualGainsListTab.vue') },
      { label: '扣繳憑單 / 申報證明', path: 'tax-proof', icon: 'file-check', component: () => import('./pages/personal/annualGains/AnnualGainsTaxTab.vue') },
    ],
  ),
  page(
    'personal/salary-adjustment',
    {
      title: '薪資異動',
      subtitle: 'Salary Adjustment',
      icon: 'trend-up',
      group: 'personal',
      permission: 'portal.profile.read',
      milestone: 'M5',
      description: '歷年年度調薪紀錄、升遷職級異動與核定公文清冊',
    },
    [
      { label: '調薪紀錄', path: '', icon: 'trend-up', component: () => import('./pages/personal/salaryAdjustment/SalaryAdjustmentPage.vue') },
    ],
  ),
  page(
    'personal/abnormal-attendance',
    {
      title: '出勤異常',
      subtitle: 'Abnormal Attendance',
      icon: 'alert',
      group: 'personal',
      permission: 'portal.profile.read',
      milestone: 'M5',
      description: '出勤打卡刷卡未刷、遲到、早退、曠職異常統計清單',
    },
    [
      { label: '出勤異常清單', path: '', icon: 'alert', component: () => import('./pages/personal/abnormalAttendance/AbnormalAttendancePage.vue') },
    ],
  ),
  page(
    'personal/abnormal-respond',
    {
      title: '出勤時數異常回報',
      subtitle: 'Abnormal Respond',
      icon: 'alert-circle',
      group: 'personal',
      permission: 'portal.profile.read',
      milestone: 'M5',
      description: '異常出勤工時說明、下班滯留原因申報與補登回報',
    },
    [
      { label: '異常回報', path: '', icon: 'alert-circle', component: () => import('./pages/personal/abnormalRespond/AbnormalRespondPage.vue') },
    ],
  ),
  page(
    'personal/ef-info',
    {
      title: 'BPM 簽核資訊',
      subtitle: 'EasyFlow Info.',
      icon: 'workflow',
      group: 'personal',
      permission: 'bpm.approval.read',
      milestone: 'M5',
      description: 'EasyFlow BPM 流程表單待簽核單據與未結案追蹤清單',
    },
    [
      { label: '待簽核', path: '', icon: 'inbox', component: () => import('./pages/personal/efInfo/EfPendingTab.vue') },
      { label: '未結案', path: 'unclosed', icon: 'clock', component: () => import('./pages/personal/efInfo/EfUnclosedTab.vue') },
    ],
  ),
  page(
    'personal/release-mail',
    {
      title: '郵件審核資訊',
      subtitle: 'Release Mail Info.',
      icon: 'mail',
      group: 'personal',
      permission: 'portal.profile.read',
      milestone: 'M5',
      description: '外寄郵件安全性稽核、機敏外發審批狀態與投遞歷程',
    },
    [
      { label: '郵件審核', path: '', icon: 'mail', component: () => import('./pages/personal/releaseMail/ReleaseMailPage.vue') },
    ],
  ),
  page(
    'personal/property',
    {
      title: '個人資產明細',
      subtitle: 'Personal Property Info.',
      icon: 'boxes',
      group: 'personal',
      permission: 'portal.profile.read',
      milestone: 'M5',
      description: '個人名下保管之固定資產、筆電、周邊設備與移轉歷程',
    },
    [
      { label: '保管資產清冊', path: '', icon: 'boxes', component: () => import('./pages/personal/property/PropertyCurrentTab.vue') },
      { label: '資產移轉歷程', path: 'transfer', icon: 'clock', component: () => import('./pages/personal/property/PropertyTransferTab.vue') },
    ],
  ),
  page(
    'personal/cipher-reset',
    {
      title: '薪資金鑰重置',
      subtitle: 'Reset Security Password',
      icon: 'key',
      group: 'personal',
      permission: 'portal.profile.read',
      milestone: 'M5',
      description: '薪資查詢安全金鑰與二階段查詢密碼線上重置',
    },
    [
      { label: '金鑰重置', path: '', icon: 'key', component: () => import('./pages/personal/cipherReset/CipherResetPage.vue') },
    ],
  ),
  page(
    'personal/annual-courses',
    {
      title: '年度必上課程',
      subtitle: 'Annual Courses',
      icon: 'spec',
      group: 'personal',
      permission: 'portal.profile.read',
      milestone: 'M5',
      description: '職業安全衛生、資安防護、法令遵循等年度必修課程進度',
    },
    [
      { label: '必修課程', path: '', icon: 'spec', component: () => import('./pages/personal/annualCourses/AnnualCoursesPage.vue') },
    ],
  ),
  page(
    'personal/notes',
    {
      title: '個人提醒',
      subtitle: 'Reminder System',
      icon: 'bell',
      group: 'personal',
      permission: 'portal.profile.read',
      milestone: 'M5',
      description: '個人日常重要待辦、交辦備忘與行事提醒備忘錄',
    },
    [
      { label: '個人備忘', path: '', icon: 'bell', component: () => import('./pages/personal/notes/NotesPage.vue') },
    ],
  ),
  // 保留原有路由以相容首頁快捷鍵與現有測試
  page(
    'personal/leave',
    {
      title: '我的假期',
      subtitle: 'Leave',
      icon: 'palm',
      permission: 'portal.leave.read',
      milestone: 'M5',
      description: '假期餘額與請假紀錄',
    },
    [
      { label: '假期餘額', path: '', icon: 'gauge' },
      { label: '請假紀錄', path: 'history', icon: 'list', permission: 'portal.leave-history.read' },
    ],
  ),
  page(
    'personal/attendance',
    {
      title: '出勤紀錄',
      subtitle: 'Attendance',
      icon: 'clock',
      permission: 'portal.attendance.read',
      milestone: 'M5',
      description: '打卡與出勤狀況',
    },
    [
      { label: '本月', path: '', icon: 'calendar' },
      { label: '歷史', path: 'history', icon: 'list' },
    ],
  ),
  // 表單與簽核
  page(
    'approval',
    {
      title: '待我簽核',
      subtitle: 'Approvals',
      icon: 'check-circle',
      group: 'approval',
      permission: 'bpm.approval.read',
      milestone: 'M5',
      description: 'BPM 流程表單簽核：核准、退回與單據歷程審查',
    },
    [
      { label: '待簽核', path: '', icon: 'inbox', component: () => import('./pages/approval/ApprovalPendingTab.vue') },
      { label: '已簽核', path: 'done', icon: 'check', component: () => import('./pages/approval/ApprovalDoneTab.vue') },
      { label: '我送出的', path: 'sent', icon: 'send', component: () => import('./pages/approval/ApprovalSentTab.vue') },
    ],
  ),
  page(
    'forms',
    {
      title: '表單下載',
      subtitle: 'Forms',
      icon: 'download',
      group: 'approval',
      permission: 'portal.form.read',
      milestone: 'M5',
      description: '依部門分類下載各類人事、總務、財務與工安申請表單',
    },
    [
      { label: '表單清單', path: '', icon: 'download', component: () => import('./pages/approval/FormsPage.vue') },
    ],
  ),
  // 行政資源
  page(
    'resources',
    {
      title: '總務專區',
      subtitle: 'General Affairs',
      icon: 'folder',
      group: 'resources',
      permission: 'portal.resource.read',
      milestone: 'M5',
      description: '宿舍、停車證、公務車預約、修繕與文具申領及資產管理',
    },
    [
      { label: '總務服務項目', path: '', icon: 'list', component: () => import('./pages/resources/generalAffairs/GeneralAffairsServiceTab.vue') },
      { label: '申請專區', path: 'apply', icon: 'edit', component: () => import('./pages/resources/generalAffairs/GeneralAffairsApplyTab.vue') },
      { label: '個人資產明細', path: 'property', icon: 'boxes', component: () => import('./pages/resources/generalAffairs/GeneralAffairsPropertyTab.vue') },
      { label: '外送資產明細', path: 'outbound', icon: 'send', component: () => import('./pages/resources/generalAffairs/GeneralAffairsOutboundTab.vue') },
      { label: '湖口廠停車資訊', path: 'parking', icon: 'compass', component: () => import('./pages/resources/generalAffairs/GeneralAffairsParkingTab.vue') },
    ],
  ),
  page(
    'resources/hr',
    {
      title: '人資專區',
      subtitle: 'Human Resource',
      icon: 'users',
      group: 'resources',
      permission: 'portal.resource.read',
      milestone: 'M5',
      description: '全員團體福利保險、理賠流程與各部門主管職務代理人名冊',
    },
    [
      { label: '團體保險', path: '', icon: 'shield', component: () => import('./pages/resources/hr/HrWelfareTab.vue') },
      { label: '主管職務代理人', path: 'agents', icon: 'users', component: () => import('./pages/resources/hr/HrAgentTab.vue') },
    ],
  ),
  page(
    'resources/job-opening',
    {
      title: '內部職缺',
      subtitle: 'Job Opening',
      icon: 'bell',
      group: 'resources',
      permission: 'portal.resource.read',
      milestone: 'M5',
      description: '集團內部轉調機會、開放職缺與應徵管道',
    },
    [
      { label: '內部職缺', path: '', icon: 'bell', component: () => import('./pages/resources/jobOpening/JobOpeningPage.vue') },
    ],
  ),
  page(
    'resources/qa',
    {
      title: '問卷調查',
      subtitle: 'Question Docs',
      icon: 'trello',
      group: 'resources',
      permission: 'portal.resource.read',
      milestone: 'M5',
      description: '企業滿意度、員工健康保護與各項活動意見調查',
    },
    [
      { label: '問卷清單', path: '', icon: 'trello', component: () => import('./pages/resources/qa/QaListPage.vue') },
    ],
  ),
  page(
    'onboarding',
    {
      title: '新人導覽',
      subtitle: 'Onboarding',
      icon: 'compass',
      group: 'resources',
      permission: 'portal.onboarding.read',
      milestone: 'M5',
      description: '新進人員工作守則小叮嚀與新人 20 題自我測驗驗收',
    },
    [
      { label: '小叮嚀', path: '', icon: 'bell', component: () => import('./pages/resources/onboarding/OnboardingTipsTab.vue') },
      { label: '驗收區', path: 'quiz', icon: 'file-check', component: () => import('./pages/resources/onboarding/OnboardingQuizTab.vue') },
    ],
  ),
  page(
    'directory',
    {
      title: '分機表、聯絡窗口',
      subtitle: 'Directory',
      icon: 'phone',
      group: 'resources',
      permission: 'portal.directory.read',
      milestone: 'M5',
      description: '全體同仁簡易分機查詢與廠區緊急聯絡通報窗口',
    },
    [
      { label: '分機表', path: '', icon: 'phone', component: () => import('./pages/resources/directory/DirectoryExtensionTab.vue') },
      { label: '聯絡窗口', path: 'contacts', icon: 'users', component: () => import('./pages/resources/directory/DirectoryContactTab.vue') },
    ],
  ),
  page(
    'gui-number',
    {
      title: '集團統編資訊',
      subtitle: 'Company Tax ID',
      icon: 'hash',
      group: 'resources',
      permission: 'portal.gui-number.read',
      milestone: 'M5',
      description: '碩禾集團及各關係企業統一編號、登記地址與用途指南',
    },
    [
      { label: '集團統編', path: '', icon: 'hash', component: () => import('./pages/resources/GuiNumberPage.vue') },
    ],
  ),
  // 集團與公告
  page(
    'news',
    {
      title: '最新公告',
      subtitle: 'News',
      icon: 'megaphone',
      group: 'group',
      permission: 'portal.news.read',
      milestone: 'M4',
      description: '公司全體公告、行政公告、人事發布與 IT 維護通知',
    },
    [
      { label: '全部', path: '', icon: 'list', component: () => import('./pages/group/news/NewsAllTab.vue') },
      { label: '未讀', path: 'unread', icon: 'bell', component: () => import('./pages/group/news/NewsUnreadTab.vue') },
    ],
  ),
  page(
    'calendar',
    {
      title: '行事曆',
      subtitle: 'Schedule Calendar',
      icon: 'calendar',
      group: 'group',
      permission: 'portal.calendar.read',
      milestone: 'M4',
      description: '年度人事行政總處放假日曆、公司廠慶、盤點日與補班排程',
    },
    [
      { label: '月曆視圖', path: '', icon: 'calendar', component: () => import('./pages/group/calendar/CalendarMonthTab.vue') },
      { label: '年度清單', path: 'list', icon: 'list', component: () => import('./pages/group/calendar/CalendarListTab.vue') },
    ],
  ),
  page(
    'links',
    {
      title: '集團系統',
      subtitle: 'Group Systems',
      icon: 'external',
      group: 'group',
      permission: 'portal.links.read',
      milestone: 'M4',
      description: '單一簽入 (SSO) 快速跳轉至集團 17 個核心營運外部系統',
    },
    [
      { label: '系統入口', path: '', icon: 'external', component: () => import('./pages/group/LinksPage.vue') },
    ],
  ),
  page(
    'talk',
    {
      title: '3691 全民開講',
      subtitle: '3691 Talk Talk',
      icon: 'message',
      group: 'group',
      permission: 'portal.talk.read',
      milestone: 'M5',
      description: '同仁自由交流討論看板、經驗分享與不法侵害申訴管道',
    },
    [
      { label: '討論看板', path: '', icon: 'message', component: () => import('./pages/group/TalkPage.vue') },
    ],
  ),
  // 不列在選單的管理頁(按鈕權限進入)
  {
    path: 'resources/admin',
    component: TabbedPage,
    meta: { title: '行政資源維護', subtitle: 'Resources Admin', icon: 'edit', permission: 'portal.resource.edit', milestone: 'M4' },
    children: [{ path: '', component: Placeholder }],
  },
  { path: '403', component: () => import('./pages/Forbidden.vue'), meta: { title: '沒有權限' } },
  { path: ':pathMatch(.*)*', component: () => import('./pages/NotFound.vue'), meta: { title: '找不到頁面' } },
];

/** 登入前的頁面與無權限頁:使用 AuthLayout(品牌面板 + 表單卡片) */
function auth(path: string, component: () => Promise<{ default: RouteComponent }>, meta: RouteRecordRaw['meta']): RouteRecordRaw {
  return { path, component: AuthLayout, meta, children: [{ path: '', component }] };
}

const routes: RouteRecordRaw[] = [
  auth('/login', () => import('./pages/auth/Login.vue'), { public: true, title: '登入' }),
  auth('/register', () => import('./pages/auth/Register.vue'), { public: true, title: '註冊帳號' }),
  // Gateway CLI 代建帳號的啟用連結(/register/activate?token=)
  auth('/register/activate', () => import('./pages/auth/Register.vue'), { public: true, title: '啟用帳號' }),
  auth('/reset-password', () => import('./pages/auth/ResetPassword.vue'), { public: true, title: '忘記密碼' }),
  auth('/unavailable', () => import('./pages/Unavailable.vue'), { public: true, title: '暫時無法使用' }),
  auth('/no-access', () => import('./pages/NoAccess.vue'), { noAppGuard: true, title: '沒有使用權限' }),
  { path: '/', component: AppLayout, children: appPages },
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

/** 選單來源:有 group 的功能頁(路徑、名稱、圖示、權限皆取自路由 meta) */
export const MENU_PAGES: MenuPage[] = appPages
  .filter((r) => r.meta?.group)
  .map((r) => ({
    path: `/${r.path}`,
    group: r.meta!.group!,
    title: r.meta!.title!,
    subtitle: r.meta!.subtitle,
    icon: r.meta!.icon,
    permission: r.meta!.permission,
  }));

router.beforeEach(async (to) => {
  if (to.meta.public) return true;
  let me;
  try {
    me = await ensureMe();
  } catch {
    // BFF 無法連線(非 401):顯示維護頁,不導向登入(PRD §10 可用性)
    return { path: '/unavailable', query: { redirect: to.fullPath } };
  }
  if (!me) return { path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} };

  // 應用層守衛:沒有入口網權限 → 無權限頁(不可導回 / 造成迴圈)
  const apps = resolveApps(me);
  if (!to.meta.noAppGuard && !hasApp(apps, CURRENT_APP)) return '/no-access';
  if (to.meta.noAppGuard && hasApp(apps, CURRENT_APP)) return '/';

  // 頁面守衛:任一層(menu / tab)缺少權限 → 403,不導回首頁(FR-2.6)
  const need = to.matched.map((r) => r.meta.permission).filter((p): p is string => !!p);
  if (need.some((p) => !me.permissions.includes(p))) {
    // 首頁沒有權限時改到第一個可見功能
    if (to.path === '/') {
      const first = MENU_PAGES.find((p) => !p.permission || me.permissions.includes(p.permission));
      if (first && first.path !== '/') return first.path;
    }
    return '/403';
  }
  return true;
});
