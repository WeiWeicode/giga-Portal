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
  page('personal/salary', {
    title: '薪資獎金',
    subtitle: 'Salary & Bonus',
    icon: 'audit',
    group: 'personal',
    permission: 'portal.profile.read',
    milestone: 'M5',
  }),
  page('personal/annual-gains', {
    title: '年度所得',
    subtitle: 'Annual Salary & Bonus',
    icon: 'layers',
    group: 'personal',
    permission: 'portal.profile.read',
    milestone: 'M5',
  }),
  page('personal/salary-adjustment', {
    title: '薪資異動',
    subtitle: 'Salary Adjustment',
    icon: 'trend-up',
    group: 'personal',
    permission: 'portal.profile.read',
    milestone: 'M5',
  }),
  page('personal/abnormal-attendance', {
    title: '出勤異常',
    subtitle: 'Abnormal Attendance',
    icon: 'alert',
    group: 'personal',
    permission: 'portal.profile.read',
    milestone: 'M5',
  }),
  page('personal/abnormal-respond', {
    title: '出勤時數異常回報',
    subtitle: 'Abnormal Respond',
    icon: 'alert-circle',
    group: 'personal',
    permission: 'portal.profile.read',
    milestone: 'M5',
  }),
  page('personal/ef-info', {
    title: 'BPM 簽核資訊',
    subtitle: 'EasyFlow Info.',
    icon: 'workflow',
    group: 'personal',
    permission: 'bpm.approval.read',
    milestone: 'M5',
  }),
  page('personal/release-mail', {
    title: '郵件審核資訊',
    subtitle: 'Release Mail Info.',
    icon: 'mail',
    group: 'personal',
    permission: 'portal.profile.read',
    milestone: 'M5',
  }),
  page('personal/property', {
    title: '個人資產明細',
    subtitle: 'Personal Property Info.',
    icon: 'boxes',
    group: 'personal',
    permission: 'portal.profile.read',
    milestone: 'M5',
  }),
  page('personal/cipher-reset', {
    title: '薪資金鑰重置',
    subtitle: 'Reset Security Password',
    icon: 'key',
    group: 'personal',
    permission: 'portal.profile.read',
    milestone: 'M5',
  }),
  page('personal/annual-courses', {
    title: '年度必上課程',
    subtitle: 'Annual Courses',
    icon: 'spec',
    group: 'personal',
    permission: 'portal.profile.read',
    milestone: 'M5',
  }),
  page('personal/notes', {
    title: '個人提醒',
    subtitle: 'Reminder System',
    icon: 'bell',
    group: 'personal',
    permission: 'portal.profile.read',
    milestone: 'M5',
  }),
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
      description: 'BPM 簽核:核准與退回',
    },
    [
      { label: '待簽核', path: '', icon: 'inbox' },
      { label: '已簽核', path: 'done', icon: 'check' },
      { label: '我送出的', path: 'sent', icon: 'send' },
    ],
  ),
  page('forms', {
    title: '表單下載',
    subtitle: 'Forms',
    icon: 'download',
    group: 'approval',
    permission: 'portal.form.read',
    milestone: 'M5',
    description: '依分類下載各類申請表單',
  }),
  // 行政資源
  page('resources', {
    title: '行政資源',
    subtitle: 'Resources',
    icon: 'folder',
    group: 'resources',
    permission: 'portal.resource.read',
    milestone: 'M4',
    description: '行政文件、連結與說明',
  }),
  page('onboarding', { title: '新人導覽', subtitle: 'Onboarding', icon: 'compass', group: 'resources', permission: 'portal.onboarding.read', milestone: 'M4' }),
  page(
    'directory',
    { title: '分機表、聯絡窗口', subtitle: 'Directory', icon: 'phone', group: 'resources', permission: 'portal.directory.read', milestone: 'M5' },
    [
      { label: '分機表', path: '', icon: 'phone' },
      { label: '聯絡窗口', path: 'contacts', icon: 'users' },
    ],
  ),
  page('gui-number', { title: '集團統編資訊', subtitle: 'Tax ID', icon: 'hash', group: 'resources', permission: 'portal.gui-number.read', milestone: 'M5' }),
  // 集團與公告
  page('news', { title: '公告', subtitle: 'News', icon: 'megaphone', group: 'group', permission: 'portal.news.read', milestone: 'M4' }, [
    { label: '全部', path: '', icon: 'list' },
    { label: '未讀', path: 'unread', icon: 'bell' },
  ]),
  page('calendar', { title: '行事曆', subtitle: 'Calendar', icon: 'calendar', group: 'group', permission: 'portal.calendar.read', milestone: 'M4' }, [
    { label: '月', path: '', icon: 'calendar' },
    { label: '清單', path: 'list', icon: 'list' },
  ]),
  page('links', { title: '集團系統', subtitle: 'Group Systems', icon: 'external', group: 'group', permission: 'portal.links.read', milestone: 'M4' }),
  page('talk', { title: '3691 全民開講', subtitle: 'Talk', icon: 'message', group: 'group', permission: 'portal.talk.read', milestone: 'M5' }),
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
