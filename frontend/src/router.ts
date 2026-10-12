/**
 * 路由(History 模式,base = /):
 *   第一層:選單群組(MENU_GROUPS)
 *   第二層:功能頁(TabbedPage),meta 定義標題、英文副標、圖示、menu 權限與 Tab
 *   第三層:Tab = 子路由(網址對應 Tab,重新整理停在同一個 Tab)
 * 權限代碼(FRAMEWORK-PLAN §3、附錄 A):大項 portal.group.*(kind group)、功能頁 meta.permission(kind menu)、
 *   Tab = `${menu 代碼去掉 .read}.${key}`(kind tab);代碼登記在 deploy/gateway-rbac.yaml,名稱 / 排序 / 圖示以 BFF 為準(GigaItApp「選單管理」)。
 * 全域守衛:me → 應用層(portal.app.access)→ 頁面權限(menu / tab / requires),見 ARCHITECTURE §3.1;
 *   Tab 沒有權限時改到同頁第一個可看的 Tab,整頁都沒有才 403(同 GigaItApp)。
 */
import { createRouter, createWebHistory, type RouteComponent, type RouteRecordRaw } from 'vue-router';
import AppLayout from './layouts/AppLayout.vue';
import AuthLayout from './layouts/AuthLayout.vue';
import TabbedPage from './layouts/TabbedPage.vue';
import { can, canAll, menuOf } from './api/gateway';
import { CURRENT_APP, hasApp, resolveApps } from './composables/apps';
import { buildMenu, type MenuGroupDef, type MenuPage } from './composables/menu';
import { ensureMe } from './composables/session';
import type { TabItem } from './ui/components/GTabs.vue';
import { hasIcon } from './ui/icons';

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    /** 英文副標(選單與頁首) */
    subtitle?: string;
    description?: string;
    icon?: string;
    /** 功能頁所屬的選單群組(MENU_GROUPS.key);沒有 group 的頁面不列在選單 */
    group?: string;
    /** 該頁 / Tab 需要的 API 讀取權限(Gateway includes);前端只是體驗,BFF 一定會再檢查 */
    requires?: readonly string[];
    tab?: string;
    tabs?: TabItem[];
    /** 應用層守衛不檢查(無權限頁本身,避免迴圈,PRD FR-2.4) */
    noAppGuard?: boolean;
    /** 模擬或尚未串接的頁面:標示預計完成的里程碑 */
    milestone?: string;
  }
}

/** 側欄大項的預設值;BFF 代碼 code 登記在 deploy/gateway-rbac.yaml(kind group) */
export const MENU_GROUPS: readonly MenuGroupDef[] = [
  { key: 'home', code: 'portal.group.home', title: '首頁', subtitle: 'Home', icon: 'home' },
  { key: 'personal', code: 'portal.group.personal', title: '個人資訊', subtitle: 'Personal Information', icon: 'user' },
  { key: 'approval', code: 'portal.group.approval', title: '表單與簽核', subtitle: 'Forms & Approvals', icon: 'file-check' },
  { key: 'resources', code: 'portal.group.resources', title: '行政資源', subtitle: 'Resources', icon: 'folder' },
  { key: 'group', code: 'portal.group.news', title: '集團與公告', subtitle: 'Group & News', icon: 'megaphone' },
  { key: 'manager', code: 'portal.group.manager', title: '主管專區', subtitle: 'Manager Menu', icon: 'user-check' },
  { key: 'esh', code: 'portal.group.esh', title: 'ESH證照管理', subtitle: 'License of ESH', icon: 'shield' },
];

const Placeholder = () => import('./pages/Placeholder.vue');

type TabDef = Omit<TabItem, 'permission' | 'to'> & {
  /** Tab 代碼的最後一段:權限 = `${menu 代碼去掉 .read}.${key}` */
  key: string;
  path: string;
  requires?: readonly string[];
  component?: RouteComponent | (() => Promise<{ default: RouteComponent }>);
};

/** Tab 權限代碼(FRAMEWORK-PLAN §3.1) */
export const tabCode = (menu: string, key: string) => `${menu.replace(/\.read$/, '')}.${key}`;

/** 功能頁(TabbedPage):每個 Tab 是子路由,權限代碼由 menu 代碼與 key 組成 */
function page(path: string, meta: RouteRecordRaw['meta'] & { title: string; group?: string; permission: string }, tabs: TabDef[]): RouteRecordRaw {
  const base = `/${path}`;
  const defs = tabs.map(({ key, path: p, component, requires, ...t }) => ({
    ...t,
    path: p,
    component,
    requires,
    permission: tabCode(meta.permission, key),
    to: p ? `${base}/${p}` : base,
  }));
  return {
    path,
    component: TabbedPage,
    meta: { ...meta, tabs: defs.map(({ path: _p, component: _c, requires: _r, ...t }) => t) },
    children: defs.map((t) => ({
      path: t.path,
      component: t.component ?? Placeholder,
      meta: { tab: t.label, permission: t.permission, ...(t.requires ? { requires: t.requires } : {}) },
    })),
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
      { key: 'basic', label: '基本資料', path: '', icon: 'user', component: () => import('./pages/personal/profile/ProfileBasicTab.vue') },
      { key: 'pension', label: '勞退新制資料', path: 'pension', icon: 'shield', component: () => import('./pages/personal/profile/ProfilePensionTab.vue') },
      { key: 'health-family', label: '健保眷屬加退保異動', path: 'health-family', icon: 'users', component: () => import('./pages/personal/profile/ProfileHealthFamilyTab.vue') },
      { key: 'tax-dependents', label: '所得稅扶養眷屬異動', path: 'tax-dependents', icon: 'file-check', component: () => import('./pages/personal/profile/ProfileTaxDependentsTab.vue') },
      { key: 'insurance-bracket', label: '勞健保/勞退級距', path: 'insurance-bracket', icon: 'layers', component: () => import('./pages/personal/profile/ProfileInsuranceBracketTab.vue') },
      { key: 'commute', label: '溫室氣體盤查員工通勤調查', path: 'commute', icon: 'leaf', component: () => import('./pages/personal/profile/ProfileCommuteTab.vue') },
    ],
  ),
  page(
    'personal/query',
    {
      title: '自助查詢',
      subtitle: 'Self-help inquiry',
      icon: 'search',
      group: 'personal',
      permission: 'portal.query.read',
      milestone: 'M5',
      description: '出勤年月之刷卡、出勤、加班、請假、班表、補休、特休、勞健保與二代健保明細',
    },
    [
      { key: 'card', label: '刷卡記錄', path: '', icon: 'clock', component: () => import('./pages/personal/query/QueryCardRecordsTab.vue') },
      { key: 'attendance', label: '出勤記錄', path: 'attendance', icon: 'calendar', component: () => import('./pages/personal/query/QueryAttendanceTab.vue') },
      { key: 'overtime', label: '加班紀錄', path: 'overtime', icon: 'zap', component: () => import('./pages/personal/query/QueryOvertimeTab.vue') },
      { key: 'leave', label: '請假紀錄', path: 'leave', icon: 'palm', component: () => import('./pages/personal/query/QueryLeaveTab.vue') },
      { key: 'schedule', label: '班表&訂餐記錄', path: 'schedule', icon: 'grid', component: () => import('./pages/personal/query/QueryScheduleMealTab.vue') },
      { key: 'comp-time', label: '補休/榮譽假', path: 'comp-time', icon: 'check-circle', component: () => import('./pages/personal/query/QueryCompTimeTab.vue') },
      { key: 'annual-leave', label: '特休', path: 'annual-leave', icon: 'sun', component: () => import('./pages/personal/query/QueryAnnualLeaveTab.vue') },
      { key: 'insurance-detail', label: '勞健保明細', path: 'insurance-detail', icon: 'shield', component: () => import('./pages/personal/query/QueryInsuranceDetailTab.vue') },
      { key: 'nhi2', label: '二代健保', path: 'nhi2', icon: 'file-check', component: () => import('./pages/personal/query/QueryNhi2Tab.vue') },
    ],
  ),
  page(
    'personal/salary',
    {
      title: '薪資獎金',
      subtitle: 'Salary & Bonus',
      icon: 'audit',
      group: 'personal',
      permission: 'portal.salary.read',
      milestone: 'M5',
      description: '每月薪資單明細、年終/績效/節日獎金明細與二代健保代扣說明',
    },
    [
      { key: 'slip', label: '薪資明細', path: '', icon: 'audit', component: () => import('./pages/personal/salary/SalarySlipTab.vue') },
      { key: 'bonus', label: '獎金明細', path: 'bonus', icon: 'coin', component: () => import('./pages/personal/salary/BonusDetailTab.vue') },
    ],
  ),
  page(
    'personal/annual-gains',
    {
      title: '年度所得',
      subtitle: 'Annual Salary & Bonus',
      icon: 'layers',
      group: 'personal',
      permission: 'portal.annual-gains.read',
      milestone: 'M5',
      description: '年度薪資彙整總額清冊、所得扣繳憑單與申報證明',
    },
    [
      { key: 'list', label: '年度所得清冊', path: '', icon: 'list', component: () => import('./pages/personal/annualGains/AnnualGainsListTab.vue') },
      { key: 'tax-proof', label: '扣繳憑單 / 申報證明', path: 'tax-proof', icon: 'file-check', component: () => import('./pages/personal/annualGains/AnnualGainsTaxTab.vue') },
    ],
  ),
  page(
    'personal/salary-adjustment',
    {
      title: '薪資異動',
      subtitle: 'Salary Adjustment',
      icon: 'trend-up',
      group: 'personal',
      permission: 'portal.salary-adjust.read',
      milestone: 'M5',
      description: '歷年年度調薪紀錄、升遷職級異動與核定公文清冊',
    },
    [
      { key: 'history', label: '調薪紀錄', path: '', icon: 'trend-up', component: () => import('./pages/personal/salaryAdjustment/SalaryAdjustmentPage.vue') },
    ],
  ),
  page(
    'personal/abnormal-attendance',
    {
      title: '出勤異常',
      subtitle: 'Abnormal Attendance',
      icon: 'alert',
      group: 'personal',
      permission: 'portal.attendance-abnormal.read',
      milestone: 'M5',
      description: '出勤打卡刷卡未刷、遲到、早退、曠職異常統計清單',
    },
    [
      { key: 'list', label: '出勤異常清單', path: '', icon: 'alert', component: () => import('./pages/personal/abnormalAttendance/AbnormalAttendancePage.vue') },
    ],
  ),
  page(
    'personal/abnormal-respond',
    {
      title: '出勤時數異常回報',
      subtitle: 'Abnormal Respond',
      icon: 'alert-circle',
      group: 'personal',
      permission: 'portal.abnormal-respond.read',
      milestone: 'M5',
      description: '異常出勤工時說明、下班滯留原因申報與補登回報',
    },
    [
      { key: 'report', label: '異常回報', path: '', icon: 'alert-circle', component: () => import('./pages/personal/abnormalRespond/AbnormalRespondPage.vue') },
    ],
  ),
  page(
    'personal/ef-info',
    {
      title: 'BPM 簽核資訊',
      subtitle: 'EasyFlow Info.',
      icon: 'workflow',
      group: 'personal',
      permission: 'portal.ef-info.read',
      milestone: 'M5',
      description: 'EasyFlow BPM 流程表單待簽核單據與未結案追蹤清單',
    },
    [
      { key: 'pending', label: '待簽核', path: '', icon: 'inbox', component: () => import('./pages/personal/efInfo/EfPendingTab.vue') },
      { key: 'unclosed', label: '未結案', path: 'unclosed', icon: 'clock', component: () => import('./pages/personal/efInfo/EfUnclosedTab.vue') },
    ],
  ),
  page(
    'personal/release-mail',
    {
      title: '郵件審核資訊',
      subtitle: 'Release Mail Info.',
      icon: 'mail',
      group: 'personal',
      permission: 'portal.release-mail.read',
      milestone: 'M5',
      description: '外寄郵件安全性稽核、機敏外發審批狀態與投遞歷程',
    },
    [
      { key: 'list', label: '郵件審核', path: '', icon: 'mail', component: () => import('./pages/personal/releaseMail/ReleaseMailPage.vue') },
    ],
  ),
  page(
    'personal/property',
    {
      title: '個人資產明細',
      subtitle: 'Personal Property Info.',
      icon: 'boxes',
      group: 'personal',
      permission: 'portal.asset.read',
      milestone: 'M5',
      description: '個人名下保管之固定資產、筆電、周邊設備與移轉歷程',
    },
    [
      { key: 'current', label: '保管資產清冊', path: '', icon: 'boxes', component: () => import('./pages/personal/property/PropertyCurrentTab.vue') },
      { key: 'transfer', label: '資產移轉歷程', path: 'transfer', icon: 'clock', component: () => import('./pages/personal/property/PropertyTransferTab.vue') },
    ],
  ),
  page(
    'personal/cipher-reset',
    {
      title: '薪資金鑰重置',
      subtitle: 'Reset Security Password',
      icon: 'key',
      group: 'personal',
      permission: 'portal.cipher-reset.read',
      milestone: 'M5',
      description: '薪資查詢安全金鑰與二階段查詢密碼線上重置',
    },
    [
      { key: 'reset', label: '金鑰重置', path: '', icon: 'key', component: () => import('./pages/personal/cipherReset/CipherResetPage.vue') },
    ],
  ),
  page(
    'personal/annual-courses',
    {
      title: '年度必上課程',
      subtitle: 'Annual Courses',
      icon: 'spec',
      group: 'personal',
      permission: 'portal.course.read',
      milestone: 'M5',
      description: '職業安全衛生、資安防護、法令遵循等年度必修課程進度',
    },
    [
      { key: 'required', label: '必修課程', path: '', icon: 'spec', component: () => import('./pages/personal/annualCourses/AnnualCoursesPage.vue') },
    ],
  ),
  page(
    'personal/notes',
    {
      title: '個人提醒',
      subtitle: 'Reminder System',
      icon: 'bell',
      group: 'personal',
      permission: 'portal.note.read',
      milestone: 'M5',
      description: '個人日常重要待辦、交辦備忘與行事提醒備忘錄',
    },
    [
      { key: 'list', label: '個人備忘', path: '', icon: 'bell', component: () => import('./pages/personal/notes/NotesPage.vue') },
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
      permission: 'portal.approval.read',
      milestone: 'M5',
      description: 'BPM 流程表單簽核：核准、退回與單據歷程審查',
    },
    [
      { key: 'pending', label: '待簽核', path: '', icon: 'inbox', component: () => import('./pages/approval/ApprovalPendingTab.vue') },
      { key: 'done', label: '已簽核', path: 'done', icon: 'check', component: () => import('./pages/approval/ApprovalDoneTab.vue') },
      { key: 'sent', label: '我送出的', path: 'sent', icon: 'send', component: () => import('./pages/approval/ApprovalSentTab.vue') },
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
      { key: 'list', label: '表單清單', path: '', icon: 'download', component: () => import('./pages/approval/FormsPage.vue') },
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
      permission: 'portal.ga.read',
      milestone: 'M5',
      description: '宿舍、停車證、公務車預約、修繕與文具申領及資產管理',
    },
    [
      { key: 'service', label: '總務服務項目', path: '', icon: 'list', component: () => import('./pages/resources/generalAffairs/GeneralAffairsServiceTab.vue') },
      { key: 'apply', label: '申請專區', path: 'apply', icon: 'edit', component: () => import('./pages/resources/generalAffairs/GeneralAffairsApplyTab.vue') },
      { key: 'property', label: '個人資產明細', path: 'property', icon: 'boxes', component: () => import('./pages/resources/generalAffairs/GeneralAffairsPropertyTab.vue') },
      { key: 'outbound', label: '外送資產明細', path: 'outbound', icon: 'send', component: () => import('./pages/resources/generalAffairs/GeneralAffairsOutboundTab.vue') },
      { key: 'parking', label: '湖口廠停車資訊', path: 'parking', icon: 'compass', component: () => import('./pages/resources/generalAffairs/GeneralAffairsParkingTab.vue') },
    ],
  ),
  page(
    'resources/hr',
    {
      title: '人資專區',
      subtitle: 'Human Resource',
      icon: 'users',
      group: 'resources',
      permission: 'portal.hr.read',
      milestone: 'M5',
      description: '全員團體福利保險、理賠流程與各部門主管職務代理人名冊',
    },
    [
      { key: 'welfare', label: '團體保險', path: '', icon: 'shield', component: () => import('./pages/resources/hr/HrWelfareTab.vue') },
      { key: 'agent', label: '主管職務代理人', path: 'agents', icon: 'users', component: () => import('./pages/resources/hr/HrAgentTab.vue') },
    ],
  ),
  page(
    'resources/job-opening',
    {
      title: '內部職缺',
      subtitle: 'Job Opening',
      icon: 'bell',
      group: 'resources',
      permission: 'portal.job.read',
      milestone: 'M5',
      description: '集團內部轉調機會、開放職缺與應徵管道',
    },
    [
      { key: 'list', label: '內部職缺', path: '', icon: 'bell', component: () => import('./pages/resources/jobOpening/JobOpeningPage.vue') },
    ],
  ),
  page(
    'resources/qa',
    {
      title: '問卷調查',
      subtitle: 'Question Docs',
      icon: 'trello',
      group: 'resources',
      permission: 'portal.survey.read',
      milestone: 'M5',
      description: '企業滿意度、員工健康保護與各項活動意見調查',
    },
    [
      { key: 'list', label: '問卷清單', path: '', icon: 'trello', component: () => import('./pages/resources/qa/QaListPage.vue') },
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
      { key: 'tips', label: '小叮嚀', path: '', icon: 'bell', component: () => import('./pages/resources/onboarding/OnboardingTipsTab.vue') },
      { key: 'quiz', label: '驗收區', path: 'quiz', icon: 'file-check', component: () => import('./pages/resources/onboarding/OnboardingQuizTab.vue') },
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
      { key: 'extension', label: '分機表', path: '', icon: 'phone', component: () => import('./pages/resources/directory/DirectoryExtensionTab.vue') },
      { key: 'contact', label: '聯絡窗口', path: 'contacts', icon: 'users', component: () => import('./pages/resources/directory/DirectoryContactTab.vue') },
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
      { key: 'list', label: '集團統編', path: '', icon: 'hash', component: () => import('./pages/resources/GuiNumberPage.vue') },
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
      { key: 'all', label: '全部', path: '', icon: 'list', component: () => import('./pages/group/news/NewsAllTab.vue') },
      { key: 'unread', label: '未讀', path: 'unread', icon: 'bell', component: () => import('./pages/group/news/NewsUnreadTab.vue') },
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
      { key: 'month', label: '月曆視圖', path: '', icon: 'calendar', component: () => import('./pages/group/calendar/CalendarMonthTab.vue') },
      { key: 'list', label: '年度清單', path: 'list', icon: 'list', component: () => import('./pages/group/calendar/CalendarListTab.vue') },
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
      { key: 'list', label: '系統入口', path: '', icon: 'external', component: () => import('./pages/group/LinksPage.vue') },
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
      { key: 'board', label: '討論看板', path: '', icon: 'message', component: () => import('./pages/group/TalkPage.vue') },
    ],
  ),
  // 主管專區 (Manager Menu)
  page(
    'manager/rights',
    {
      title: '主管權限說明',
      subtitle: 'Manager Rights',
      icon: 'shield',
      group: 'manager',
      permission: 'portal.mgr.rights.read',
      milestone: 'M5',
      description: '課級/理級/處級/總經理室各級別主管職責、核決權限與福利配置說明',
    },
    [
      { key: 'level1', label: '課級主管 (Level 1)', path: '', icon: 'user', component: () => import('./pages/manager/rights/ManagerRightLevel1Tab.vue') },
      { key: 'level2', label: '理級主管 (Level 2)', path: 'level2', icon: 'user-check', component: () => import('./pages/manager/rights/ManagerRightLevel2Tab.vue') },
      { key: 'level3', label: '處級主管 (Level 3)', path: 'level3', icon: 'award', component: () => import('./pages/manager/rights/ManagerRightLevel3Tab.vue') },
      { key: 'level4', label: '副總/總經理室 (Level 4)', path: 'level4', icon: 'shield', component: () => import('./pages/manager/rights/ManagerRightLevel4Tab.vue') },
    ],
  ),
  page(
    'manager/shift',
    {
      title: '部門班表匯入',
      subtitle: 'Shift Schedule',
      icon: 'calendar',
      group: 'manager',
      permission: 'portal.mgr.shift.read',
      milestone: 'M5',
      description: '部門各班別排班 Excel 批次上傳、解析預覽與班別代碼對照',
    },
    [
      { key: 'upload', label: '班表上傳與預覽', path: '', icon: 'upload', component: () => import('./pages/manager/shift/ManagerShiftUploadPage.vue') },
    ],
  ),
  page(
    'manager/boss-trace',
    {
      title: '主管工時追蹤',
      subtitle: 'Senior Manager Trace',
      icon: 'clock',
      group: 'manager',
      permission: 'portal.mgr.boss-trace.read',
      milestone: 'M5',
      description: '理級以上高階主管工時、出差天數與健康工時追蹤',
    },
    [
      { key: 'trace', label: '工時與健康追蹤', path: '', icon: 'clock', component: () => import('./pages/manager/bossTrace/ManagerBossTracePage.vue') },
    ],
  ),
  page(
    'manager/attendance',
    {
      title: '部屬出勤分析',
      subtitle: 'Attendance Analytics',
      icon: 'activity',
      group: 'manager',
      permission: 'portal.mgr.attendance.read',
      milestone: 'M5',
      description: '部門同仁刷卡時間分佈、連續異常缺卡警示與輔導面談紀錄',
    },
    [
      { key: 'punch', label: '部屬刷卡分析', path: '', icon: 'clock', component: () => import('./pages/manager/attendance/ManagerAttendanceTimeTab.vue') },
      { key: 'abnormal', label: '異常出勤追蹤', path: 'abnormal', icon: 'alert-triangle', component: () => import('./pages/manager/attendance/ManagerAttendanceAbnormalTab.vue') },
    ],
  ),
  page(
    'manager/leave-balance',
    {
      title: '休假餘額控管',
      subtitle: 'Leave Balance Control',
      icon: 'palm',
      group: 'manager',
      permission: 'portal.mgr.leave-balance.read',
      milestone: 'M5',
      description: '部屬特休/補休屆期排行榜與一鍵排休提醒',
    },
    [
      { key: 'rank', label: '特補休屆期排行', path: '', icon: 'palm', component: () => import('./pages/manager/leaveBalance/ManagerLeaveBalancePage.vue') },
    ],
  ),
  page(
    'manager/promotion-map',
    {
      title: '職等晉升地圖',
      subtitle: 'Promotion Roadmap',
      icon: 'trend-up',
      group: 'manager',
      permission: 'portal.mgr.promotion.read',
      milestone: 'M5',
      description: '研發/技術/管理各職系職等晉升必備年資、考績與證照條件地圖',
    },
    [
      { key: 'map', label: '晉升條件地圖', path: '', icon: 'trend-up', component: () => import('./pages/manager/promotion/ManagerPromotionMapPage.vue') },
    ],
  ),
  page(
    'manager/training-plan',
    {
      title: '部門訓練計畫',
      subtitle: 'Training Plan',
      icon: 'book-open',
      group: 'manager',
      permission: 'portal.mgr.training.read',
      milestone: 'M5',
      description: '年度部門內部與外訓開課規劃、預算與結訓達成率',
    },
    [
      { key: 'plan', label: '年度訓練開課計畫', path: '', icon: 'book-open', component: () => import('./pages/manager/training/ManagerTrainingPlanPage.vue') },
    ],
  ),
  page(
    'manager/safety-courses',
    {
      title: '工安課程達成率',
      subtitle: 'Safety Courses Status',
      icon: 'award',
      group: 'manager',
      permission: 'portal.mgr.safety-course.read',
      milestone: 'M5',
      description: '部門全員 12 門法規必修工安課程完訓名冊與進度檢驗',
    },
    [
      { key: 'rate', label: '部屬完訓達成名冊', path: '', icon: 'award', component: () => import('./pages/manager/safetyCourses/ManagerSafetyCoursesPage.vue') },
    ],
  ),
  page(
    'manager/property',
    {
      title: '部門財產清冊',
      subtitle: 'Department Property',
      icon: 'box',
      group: 'manager',
      permission: 'portal.mgr.property.read',
      milestone: 'M5',
      description: '部門名下保管之固定資產清冊、保管人及折舊現值',
    },
    [
      { key: 'list', label: '固定資產保管清冊', path: '', icon: 'box', component: () => import('./pages/manager/property/ManagerDeptPropertyPage.vue') },
    ],
  ),
  page(
    'manager/budget',
    {
      title: '部門預算執行',
      subtitle: 'Department Budget',
      icon: 'pie-chart',
      group: 'manager',
      permission: 'portal.mgr.budget.read',
      milestone: 'M5',
      description: '部門各會計科目預算執行率長條圖、動支實績與可用餘額',
    },
    [
      { key: 'exec', label: '預算執行率長條圖', path: '', icon: 'pie-chart', component: () => import('./pages/manager/budget/ManagerDeptBudgetPage.vue') },
    ],
  ),
  page(
    'manager/budget-apply',
    {
      title: '新年度預算編列',
      subtitle: 'Budget Application',
      icon: 'plus-circle',
      group: 'manager',
      permission: 'portal.mgr.budget-apply.read',
      milestone: 'M5',
      description: '新年度資本支出 (CAPEX) 與營業費用 (OPEX) 提案編列與審批',
    },
    [
      { key: 'apply', label: '預算提案與動支申請', path: '', icon: 'plus-circle', component: () => import('./pages/manager/budgetApply/ManagerBudgetApplyPage.vue') },
    ],
  ),
  // ESH 證照管理 (License of ESH)
  page(
    'esh/management',
    {
      title: '證照管理',
      subtitle: 'License Management',
      icon: 'award',
      group: 'esh',
      permission: 'portal.esh.license.read',
      milestone: 'M5',
      description: '全廠勞安、環保與法定機械設備證照持有清冊與 90 天到期預警',
    },
    [
      { key: 'list', label: '全廠持照清冊與預警', path: '', icon: 'award', component: () => import('./pages/esh/management/EhsManagementPage.vue') },
    ],
  ),
  page(
    'esh/items',
    {
      title: '證照項目設定',
      subtitle: 'License Item Setup',
      icon: 'settings',
      group: 'esh',
      permission: 'portal.esh.item.read',
      milestone: 'M5',
      description: '法定機械/安衛/環保證照代碼庫、主管機關與法定回訓週期維護',
    },
    [
      { key: 'list', label: '法定證照代碼維護', path: '', icon: 'settings', component: () => import('./pages/esh/itemEdit/EhsItemEditPage.vue') },
    ],
  ),
  page(
    'esh/needs',
    {
      title: '工作站法定需求',
      subtitle: 'License Requirements',
      icon: 'layers',
      group: 'esh',
      permission: 'portal.esh.need.read',
      milestone: 'M5',
      description: '各廠區高風險工作站點法定應配置證照人數與人力缺口',
    },
    [
      { key: 'list', label: '站點持照配置與缺口', path: '', icon: 'layers', component: () => import('./pages/esh/licenseNeed/EhsLicenseNeedPage.vue') },
    ],
  ),
  page(
    'esh/personal',
    {
      title: '人員證照登記',
      subtitle: 'Personal License Registry',
      icon: 'id-card',
      group: 'esh',
      permission: 'portal.esh.personal.read',
      milestone: 'M5',
      description: '同仁新取得專業證書登錄、審核與電子掃描檔案庫',
    },
    [
      { key: 'list', label: '同仁證照登錄審核', path: '', icon: 'id-card', component: () => import('./pages/esh/personalLicense/EhsPersonalLicensePage.vue') },
    ],
  ),
  page(
    'esh/managers',
    {
      title: '環安窗口設定',
      subtitle: 'EHS Manager Setup',
      icon: 'users',
      group: 'esh',
      permission: 'portal.esh.manager.read',
      milestone: 'M5',
      description: '各廠區各部門法定專責人、緊急應變窗口與公務通報名冊',
    },
    [
      { key: 'list', label: '廠區窗口與擔當名冊', path: '', icon: 'users', component: () => import('./pages/esh/managerSetup/EhsManagerSetupPage.vue') },
    ],
  ),
  page(
    'esh/chemicals',
    {
      title: '危害性化學品資訊',
      subtitle: 'Hazardous Chemicals',
      icon: 'alert-triangle',
      group: 'esh',
      permission: 'portal.esh.chemical.read',
      milestone: 'M5',
      description: '列管與一般化學品清單、CAS No.、SDS 安全資料表下載與防護',
    },
    [
      { key: 'regulated', label: '列管化學品', path: '', icon: 'shield', component: () => import('./pages/esh/chemicals/EhsChemicalRegulatedTab.vue') },
      { key: 'unregulated', label: '一般非列管化學品', path: 'unregulated', icon: 'box', component: () => import('./pages/esh/chemicals/EhsChemicalUnregulatedTab.vue') },
    ],
  ),
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

/** 選單來源:有 group 的功能頁(路徑、名稱、圖示、權限皆取自路由 meta;實際名稱 / 順序 / 大項以 BFF 為準,composables/menu.ts) */
export const MENU_PAGES: MenuPage[] = appPages
  .filter((r) => r.meta?.group)
  .map((r) => ({
    path: `/${r.path}`,
    group: r.meta!.group!,
    title: r.meta!.title!,
    subtitle: r.meta!.subtitle,
    icon: r.meta!.icon,
    permission: r.meta!.permission,
    requires: r.meta!.requires,
  }));

const pageOf = (path: string) => appPages.find((r) => `/${r.path}` === path);

/** 功能頁中第一個有權限的 Tab(Tab 權限 ∩ 該 Tab 需要的讀取權限);沒有 Tab 的頁面回頁面本身,全部沒權限回 null */
function firstTab(page: RouteRecordRaw): string | null {
  const tabs = (page.meta?.tabs as TabItem[] | undefined) ?? [];
  if (!tabs.length) return `/${page.path}`;
  for (const t of tabs) {
    if (t.permission && !can(t.permission)) continue;
    const child = (page.children ?? []).find((c) => `/${page.path}${c.path ? `/${c.path}` : ''}` === t.to);
    if (!child || canAll(child.meta?.requires)) return t.to ?? null;
  }
  return null;
}

/** 側欄只列至少有一個可看 Tab 的功能頁(避免點進去整頁 403) */
export function pageVisible(path: string): boolean {
  const rec = pageOf(path);
  return !rec || firstTab(rec) !== null;
}

/** 側欄兩層選單(依 BFF 的目錄、名稱、排序;可見 = 選單權限 ∩ requires ∩ 至少一個可看的 Tab) */
export const portalMenus = () => buildMenu(MENU_GROUPS, MENU_PAGES, { can, menuOf, hasIcon, pageVisible });

/** 第一個可見的功能頁與 Tab(首頁沒有權限時改到這裡) */
function firstAllowed(): string | null {
  for (const p of MENU_PAGES) {
    if (p.permission && !can(p.permission)) continue;
    if (!canAll(p.requires)) continue;
    const rec = pageOf(p.path);
    const t = rec ? firstTab(rec) : p.path;
    if (t) return t;
  }
  return null;
}

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

  // 頁面守衛:任一層缺少選單 / Tab 權限或需要的 API 讀取權限 → 403,不導回首頁(FR-2.6)
  const denied = to.matched.some((r) => (r.meta.permission && !can(r.meta.permission)) || !canAll(r.meta.requires));
  if (denied) {
    // 有此功能頁、只是目前的 Tab 沒權限:改到同頁第一個有權限的 Tab
    const page = to.matched[1];
    const pageOk = page && (!page.meta.permission || can(page.meta.permission)) && canAll(page.meta.requires);
    if (pageOk) {
      const rec = pageOf(page.path);
      const t = rec ? firstTab(rec) : null;
      if (t && t !== to.path) return t;
    }
    // 首頁沒有權限時改到第一個可見功能
    if (to.path === '/') {
      const first = firstAllowed();
      if (first && first !== '/') return first;
    }
    return '/403';
  }
  return true;
});
