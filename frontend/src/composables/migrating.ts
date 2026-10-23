/**
 * 人事系統轉移中(PORTAL-API-PLAN D-1、§3.2;docs/Gherkin/ui/migrating.feature):
 * 資料全部來自舊人事系統(鼎新 TIPTOP:人事、出勤、薪資)的功能頁,整頁顯示「系統轉移中」、不載入 Tab 內容、不呼叫 API;
 * 選單與 Tab 仍依權限顯示。只有部分欄位來自 TIPTOP 的頁面不列在這裡,由 API 的 unavailable 標示該欄位。
 */
export const MIGRATING_PAGES: readonly string[] = [
  'portal.query.read', // 自助查詢
  'portal.salary.read', // 薪資獎金
  'portal.annual-gains.read', // 年度所得
  'portal.salary-adjust.read', // 薪資異動
  'portal.attendance-abnormal.read', // 出勤異常
  'portal.abnormal-respond.read', // 出勤時數異常回報
  'portal.cipher-reset.read', // 薪資金鑰重置
  // 主管專區(P5;FEATURE-PLAN §7):TIPTOP 班表 / 出勤 / 假勤 / 人事(晉升地圖另需 WPORTALZ,Q-D10)
  'portal.mgr.shift.read', // 部門班表匯入
  'portal.mgr.boss-trace.read', // 主管工時追蹤(理級以上出勤)
  'portal.mgr.attendance.read', // 部屬出勤分析(員工出勤狀況)
  'portal.mgr.leave-balance.read', // 休假餘額控管(特補休剩餘)
  'portal.mgr.promotion.read', // 職等晉升地圖
];

export const isMigrating = (menuPermission: string) => MIGRATING_PAGES.includes(menuPermission);

/**
 * 只有部分 Tab 來自 TIPTOP 的頁面:這些 Tab 顯示「系統轉移中」,同頁其他 Tab 照常(PORTAL-API-PLAN D-10)。
 * 代碼 = Tab 權限代碼(router.ts tabCode)。
 */
export const MIGRATING_TABS: readonly string[] = [
  'portal.profile.basic', // 基本資料
  'portal.profile.pension', // 勞退新制資料
  'portal.profile.health-family', // 健保眷屬加退保異動
  'portal.profile.tax-dependents', // 所得稅扶養眷屬異動
  'portal.profile.insurance-bracket', // 勞健保/勞退級距
  'portal.asset.transfer', // 資產移轉歷程(D-12)
  'portal.ga.outbound', // 總務專區 外送資產明細(TIPTOP)
];

export const MIGRATING_TEXT = '系統轉移中';

export const MigratingPage = () => import('../pages/MigratingPage.vue');

/** 功能頁各 Tab 的內容元件:轉移中的頁面或 Tab 一律換成 MigratingPage(不載入原 Tab、不呼叫 API) */
export const tabComponent = <T>(menuPermission: string, tabPermission: string, component: T): T | typeof MigratingPage =>
  isMigrating(menuPermission) || MIGRATING_TABS.includes(tabPermission) ? MigratingPage : component;
