/**
 * 年度必上課程(old_PortalSolar PersonalAnnualCurse.aspx + App_Code/GSCLib.cs Learning.Class1–7;PORTAL-API-PLAN D-9 完全照舊規則)。
 * 純函式:輸入員工資料、名單、當年度完訓紀錄,輸出 12 門課的狀態與扣分,方便與舊系統逐項比對。
 *
 *   - 對象:LOS EmployeeInfo 公司別 DS11 / DS15 / DS36,且未離職或離職日 >= 當年 11/30(repo 先過濾)
 *   - 當年 9/30 之後到職(InYear = N):全部不適用、扣分 0
 *   - 工安 5 門(工安課程(必修))適用卻未完成各扣 2 分;其他 7 門只顯示
 *   - 適用對象、時數門檻、免訓名單(SafetyClassExUser 只影響第 1–3 門)同舊程式
 */

export const ELIGIBLE_COMPANIES = ['DS11', 'DS15', 'DS36'] as const;
const SAFETY_COURSE = '工安課程(必修)';

/** 舊 Class2:基層主管 */
const SUPERVISOR_JOBS = ['課長', '代理課長', '副課長', '代理副課長', '領班', '代理領班', '資深領班', '代理資深領班'];
/**
 * 舊 Class6:主管。舊 SQL 寫成 '公關處長''副課長'(少一個逗號),實際比對的是「公關處長'副課長」這一個值,
 * 公關處長與副課長都不會被納入;照舊規則保留此行為(D-9),修正需環安確認。
 */
const MANAGER_JOBS = [
  '代理副課長',
  '代理課長',
  '代理襄理',
  '代理協理',
  '代理副理',
  '代理副處長',
  '代理經理',
  "公關處長'副課長",
  '課長',
  '襄理',
  '副理',
  '經理',
  '副處長',
  '處長',
  '資深處長',
  '副總經理',
  '協理',
  '特助',
  '資深副總',
  '總經理',
  '執行長',
  '董事長',
];

export type Audience = 'all' | 'supervisor' | 'scba' | 'project' | 'manager' | 'wbinv';
export type Membership = 'exempt' | 'scba' | 'project' | 'wbinv';

export interface CourseDef {
  key: string;
  /** 畫面顯示名稱(= 舊程式比對的課名) */
  name: string;
  category: 'safety' | 'general';
  /** 課程類別(TB_COURSE_TYPE.COURSE_NAME);null = 不限 */
  courseType: string | null;
  /** 班名包含任一字串即算(舊 LIKE '%名稱%') */
  match: string[];
  audience: Audience;
  /** 免訓名單是否排除(舊 Class1–3) */
  exemptable: boolean;
  /** 需累積時數(舊 Class4 / Class7:>= 2 小時) */
  minHours?: number;
}

export const COURSES: readonly CourseDef[] = [
  { key: 'fire-team', name: '自衛消防編組訓練', category: 'safety', courseType: SAFETY_COURSE, match: ['自衛消防編組訓練'], audience: 'all', exemptable: true },
  {
    key: 'hazard',
    name: '危害通識與環境教育',
    category: 'safety',
    courseType: SAFETY_COURSE,
    match: ['危害通識與環境教育'],
    audience: 'all',
    exemptable: true,
  },
  {
    key: 'supervisor-safety',
    name: '基層主管工作安全暨緊急應變教育訓練',
    category: 'safety',
    courseType: SAFETY_COURSE,
    match: ['基層主管工作安全暨緊急應變教育訓練'],
    audience: 'supervisor',
    exemptable: true,
  },
  {
    key: 'respirator',
    name: '呼吸防護具教育訓練',
    category: 'safety',
    courseType: SAFETY_COURSE,
    match: ['呼吸防護具教育訓練'],
    audience: 'scba',
    exemptable: true,
  },
  {
    key: 'esh-report',
    name: '環安衛專題報告暨教育訓練',
    category: 'safety',
    courseType: SAFETY_COURSE,
    match: ['環安衛專題報告暨教育訓練'],
    audience: 'project',
    exemptable: false,
    minHours: 2,
  },
  { key: 'infosec', name: '資安宣導 / 資安訓練', category: 'general', courseType: null, match: ['資安宣導', '資安訓練'], audience: 'all', exemptable: false },
  {
    key: 'trade-secret',
    name: '營業秘密及詐欺防治宣導',
    category: 'general',
    courseType: null,
    match: ['營業秘密及詐欺防治宣導'],
    audience: 'all',
    exemptable: false,
  },
  { key: 'harassment', name: '職場性騷擾防治課程', category: 'general', courseType: null, match: ['職場性騷擾防治課程'], audience: 'all', exemptable: false },
  {
    key: 'bullying',
    name: '職場霸凌防治教育訓練(全員)',
    category: 'general',
    courseType: null,
    match: ['職場霸凌防治教育訓練(全員)'],
    audience: 'all',
    exemptable: false,
  },
  {
    key: 'bullying-manager',
    name: '職場霸凌防治教育訓練(主管)',
    category: 'general',
    courseType: null,
    match: ['職場霸凌防治教育訓練(主管)'],
    audience: 'manager',
    exemptable: false,
  },
  {
    key: 'bullying-investigator',
    name: '職場霸凌防治教育訓練(調查小組)',
    category: 'general',
    courseType: null,
    match: ['職場霸凌防治教育訓練(調查小組)'],
    audience: 'wbinv',
    exemptable: false,
    minHours: 2,
  },
  { key: 'hsf', name: 'HSF通識課程', category: 'general', courseType: null, match: ['HSF通識課程'], audience: 'all', exemptable: false },
];

/** LOS EmployeeInfo 一筆(已依公司別與離職日過濾) */
export interface EmployeeRow {
  compDb: string;
  dept: string | null;
  jobName: string | null;
  /** 到職日 YYYY-MM-DD */
  jobDate: string | null;
}

/** 當年度完訓紀錄(LearnDB:E-Learning 通過 / 講師 / 線上測驗通過;已依舊 UNION 欄位去重) */
export interface CompletionRecord {
  courseType: string | null;
  className: string | null;
  hours: string | null;
}

export type CourseStatus = 'done' | 'missing' | 'na';

export interface CourseResult {
  key: string;
  name: string;
  category: 'safety' | 'general';
  status: CourseStatus;
  /** 需累積時數的課程:目前時數與門檻 */
  hours?: number;
  minHours?: number;
}

export interface RequiredCourses {
  year: number;
  /** 是否在舊規則的對象內(公司別、離職日) */
  eligible: boolean;
  /** 9/30 前到職 */
  inYear: boolean;
  /** 工安課程未完成扣分(0 或負數) */
  deduction: number;
  courses: CourseResult[];
}

/** 舊 Class4 / 6 / 7 的部門條件:有到職日、部門非 NULL(空字串仍算)、部門不以 S0 或 Y 開頭(舊 NOT LIKE 在 CI 定序不分大小寫) */
const deptRule = (e: EmployeeRow) => {
  if (!e.jobDate || e.dept === null) return false;
  const d = e.dept.toUpperCase();
  return !d.startsWith('S0') && !d.startsWith('Y');
};

function applies(def: CourseDef, rows: EmployeeRow[], members: ReadonlySet<Membership>): boolean {
  if (def.exemptable && members.has('exempt')) return false;
  const any = (pred: (e: EmployeeRow) => boolean) => rows.some(pred);
  switch (def.audience) {
    case 'all':
      return rows.length > 0;
    case 'supervisor':
      return any((e) => SUPERVISOR_JOBS.includes(e.jobName ?? ''));
    case 'scba':
      return members.has('scba') && rows.length > 0;
    case 'project':
      return members.has('project') && any((e) => (e.compDb === 'DS11' || e.compDb === 'DS36') && deptRule(e));
    case 'manager':
      return any((e) => MANAGER_JOBS.includes(e.jobName ?? '') && deptRule(e));
    case 'wbinv':
      return members.has('wbinv') && any((e) => (e.compDb === 'DS11' || e.compDb === 'DS36') && deptRule(e));
  }
}

const matches = (def: CourseDef, r: CompletionRecord) =>
  (def.courseType === null || r.courseType === def.courseType) && def.match.some((m) => (r.className ?? '').includes(m));

/** 舊 Convert(float, CLASS_HOURS);無法轉換的視為 0 */
const hoursOf = (r: CompletionRecord) => {
  const n = Number.parseFloat(r.hours ?? '');
  return Number.isFinite(n) ? n : 0;
};

export function evaluate(year: number, rows: EmployeeRow[], members: ReadonlySet<Membership>, records: CompletionRecord[]): RequiredCourses {
  const eligible = rows.length > 0;
  const cutoff = `${year}-09-30`;
  const inYear = eligible && !!rows[0]!.jobDate && rows[0]!.jobDate <= cutoff;
  let deduction = 0;
  const courses = COURSES.map((def): CourseResult => {
    const base = { key: def.key, name: def.name, category: def.category };
    if (!inYear || !applies(def, rows, members)) return { ...base, status: 'na' };
    const done = records.filter((r) => matches(def, r));
    if (def.minHours !== undefined) {
      const hours = done.reduce((s, r) => s + hoursOf(r), 0);
      const status: CourseStatus = hours >= def.minHours ? 'done' : 'missing';
      if (status === 'missing' && def.category === 'safety') deduction -= 2;
      return { ...base, status, hours, minHours: def.minHours };
    }
    const status: CourseStatus = done.length > 0 ? 'done' : 'missing';
    if (status === 'missing' && def.category === 'safety') deduction -= 2;
    return { ...base, status };
  });
  return { year, eligible, inYear, deduction, courses };
}
