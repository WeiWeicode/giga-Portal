/**
 * 年度教育訓練計畫的驗證規則(old_PortalSolar ELlessionplan.aspx(.cs);FEATURE-PLAN §7.1;docs/Gherkin/manager/training.feature)。
 * 純函式:新增 / 修改的欄位驗證(舊 Button2_Click)、提交檢查(舊 ConfirmSendBtn_Click)。
 * 選項值與舊頁 RadioButtonList / CheckBoxList 相同,寫入舊表的格式與舊程式一致(並行期舊站讀得到,D-7)。
 */

export const CLASS_TYPES = ['通識', '專業職能'] as const;
/** 類別 → 子類(舊 ClassSub1TypeList / ClassSub2TypeList) */
export const SUB_TYPES: Record<(typeof CLASS_TYPES)[number], readonly string[]> = {
  通識: ['工安課程', '健康宣導', 'ISO訓練課程', '新人訓練課程', '管理課程', '自我啟發', '品質管理課程', '內稽人員複訓'],
  專業職能: ['新人專業職能課程', '在職訓練課程'],
};
export const CLASS_WHERE = ['內訓', '外訓'] as const;
export const CLASS_ON_TYPES = ['線上', '實體'] as const;
/** 評核方式;「其他」時改填自訂文字(舊 txtEditClassTestType) */
export const TEST_TYPES = ['滿意度', '口頭報告', '心得分享', '簡報上傳', '測驗', '證照', '內部轉授'] as const;
export const SEASONS = ['1', '2', '3', '4', '不定期'] as const;
/** 提交時每個部門至少要有的「在職訓練課程」門數 */
export const MIN_ON_JOB = 2;
export const ON_JOB_SUBTYPE = '在職訓練課程';

import { UNSAFE_MESSAGE, unsafeText } from './text.js';

/** 欄位長度上限(字數 = 舊表 nvarchar 長度) */
export const LIMITS = { className: 100, agenda: 200, joinDept: 50, teacherName: 30, teacherUnit: 30, testType: 10 } as const;
const MAX_COST = 100_000_000;

export interface CourseInput {
  dept: string;
  className: string;
  agenda: string;
  classType: string;
  subType: string;
  classWhere: string;
  onType: string;
  testType: string;
  teacherName: string;
  teacherUnit: string;
  seasons: string[];
  hour: number;
  cost1: number;
  cost2: number;
  cost3: number;
  joinDept: string;
}

/** 寫入 ELClassForm 的值 */
export interface CourseRow {
  dept: string;
  className: string;
  agenda: string;
  classType: string;
  subType: string;
  classWhere: string;
  onType: string;
  testType: string;
  teacherName: string;
  teacherUnit: string;
  /** 舊格式:季別以逗號分隔,依選項順序(例 "1,3") */
  season: string;
  /** 舊格式:一位小數 */
  hour: number;
  cost1: number;
  cost2: number;
  cost3: number;
  cost: number;
  joinDept: string;
}

export interface FieldError {
  field: string;
  message: string;
}

/** 新增 / 修改課程(舊 Button2_Click;講師與訓練單位在提交時才必填,同舊版) */
export function validateCourse(input: CourseInput): { row: CourseRow; errors: FieldError[] } {
  const errors: FieldError[] = [];
  const err = (field: string, message: string) => errors.push({ field, message });
  const t = (s: string | undefined) => (s ?? '').trim();
  const text = (field: keyof typeof LIMITS, value: string, label: string, required: boolean) => {
    const v = t(value);
    if (unsafeText(v, field === 'agenda')) err(field, `『${label}』${UNSAFE_MESSAGE}`);
    else if (required && !v) err(field, `未填寫『${label}』`);
    else if (v.length > LIMITS[field]) err(field, `『${label}』最多 ${LIMITS[field]} 字`);
    return v;
  };
  const className = text('className', input.className, '課程名稱', true);
  const agenda = text('agenda', input.agenda, '課程大綱', true);
  const joinDept = text('joinDept', input.joinDept, '參加部門', true);
  const teacherName = text('teacherName', input.teacherName, '講師', false);
  const teacherUnit = text('teacherUnit', input.teacherUnit, '訓練單位', false);
  const classType = t(input.classType);
  const subType = t(input.subType);
  if (!(CLASS_TYPES as readonly string[]).includes(classType)) err('classType', '未選取『課程類別』');
  else if (!SUB_TYPES[classType as (typeof CLASS_TYPES)[number]].includes(subType)) err('subType', '未選取『課程類別-子類』');
  const classWhere = t(input.classWhere);
  if (!(CLASS_WHERE as readonly string[]).includes(classWhere)) err('classWhere', '未選取『課程性質』');
  const onType = t(input.onType);
  if (!(CLASS_ON_TYPES as readonly string[]).includes(onType)) err('onType', '未選取『實施方式』');
  const testType = t(input.testType);
  if (!testType) err('testType', '未選取『評核方式』');
  else if (unsafeText(testType)) err('testType', `『評核方式』${UNSAFE_MESSAGE}`);
  else if (testType.length > LIMITS.testType) err('testType', `『評核方式』最多 ${LIMITS.testType} 字`);
  const picked = new Set((input.seasons ?? []).map((s) => t(s)));
  const seasons = SEASONS.filter((s) => picked.has(s));
  if (!seasons.length || seasons.length !== picked.size) err('seasons', '未選取『實施季別』');
  const hour = Math.round(Number(input.hour) * 10) / 10;
  if (!Number.isFinite(hour) || hour < 0.5) err('hour', '『課程時數』時數至少 0.5H');
  else if (hour > 1000) err('hour', '『課程時數』不可超過 1000');
  const cost = (field: string, v: number, label: string) => {
    if (!Number.isInteger(v) || v < 0 || v > MAX_COST) err(field, `『${label}』請填入 0 以上的整數`);
    return v;
  };
  const cost1 = cost('cost1', input.cost1, '講師費');
  const cost2 = cost('cost2', input.cost2, '報名費');
  const cost3 = cost('cost3', input.cost3, '雜費');
  return {
    errors,
    row: {
      dept: t(input.dept).toUpperCase(),
      className,
      agenda,
      classType,
      subType,
      classWhere,
      onType,
      testType,
      teacherName,
      teacherUnit,
      season: seasons.join(','),
      hour,
      cost1,
      cost2,
      cost3,
      cost: cost1 + cost2 + cost3,
      joinDept,
    },
  };
}

/** ELClassForm 一筆(讀出) */
export interface PlanCourse {
  classId: string;
  dept: string;
  className: string | null;
  agenda: string | null;
  classType: string | null;
  subType: string | null;
  classWhere: string | null;
  onType: string | null;
  testType: string | null;
  teacherName: string | null;
  teacherUnit: string | null;
  season: string | null;
  hour: number | null;
  cost1: number | null;
  cost2: number | null;
  cost3: number | null;
  cost: number | null;
  joinDept: string | null;
}

export interface SubmitProblem {
  dept?: string;
  classId?: string;
  message: string;
}

/** 提交檢查(舊 ConfirmSendBtn_Click):每部門至少 2 門在職訓練課程;每門課必填齊全 */
export function submitProblems(depts: string[], courses: PlanCourse[], annual: number): SubmitProblem[] {
  const out: SubmitProblem[] = [];
  const roc = annual - 1911;
  for (const d of depts) {
    const n = courses.filter((c) => c.dept === d && c.subType === ON_JOB_SUBTYPE).length;
    if (n === 0) out.push({ dept: d, message: `部門『${d}』尚有[在職訓練課程]未建立,未能提交${roc}年度教育計劃` });
    else if (n < MIN_ON_JOB) out.push({ dept: d, message: `部門『${d}』[在職訓練課程] 需開${MIN_ON_JOB}門以上課程,未能提交${roc}年度教育計劃` });
  }
  const blank = (s: string | null) => !s || !s.trim();
  const checks: [keyof PlanCourse, string][] = [
    ['className', '課程名稱未填寫'],
    ['agenda', '大綱未填寫'],
    ['classType', '課程類別未填寫'],
    ['subType', '課程類別-子類未填寫'],
    ['classWhere', '課程性質未填寫'],
    ['onType', '課程實施方式未填寫'],
    ['testType', '課程評核方式未填寫'],
    ['teacherName', '課程講師未填寫'],
    ['teacherUnit', '課程訓練單位未填寫'],
    ['season', '課程實施季別未填寫'],
  ];
  for (const c of courses) {
    const msgs = checks.filter(([k]) => blank(c[k] as string | null)).map(([, m]) => m);
    if (c.hour === null || !(c.hour >= 0.5)) msgs.push('課程時數小於0.5小時');
    for (const [k, m] of [
      ['cost1', '課程講師費錯誤'],
      ['cost2', '課程報名費錯誤'],
      ['cost3', '課程雜費錯誤'],
      ['cost', '課程預算費用錯誤'],
    ] as const)
      if (c[k] === null) msgs.push(m);
    if (msgs.length) out.push({ dept: c.dept, classId: c.classId, message: `『${c.className ?? ''}』-${msgs.join('、')}` });
  }
  return out;
}

/** 新 ClassID:"N" + yyMM(台灣時間)+ 3 碼流水(舊程式取同前綴最大流水 + 1) */
export function nextClassId(now: Date, maxSuffix: number | null): string {
  const tw = new Date(now.getTime() + 8 * 3600_000).toISOString();
  const prefix = `N${tw.slice(2, 4)}${tw.slice(5, 7)}`;
  return `${prefix}${String((maxSuffix ?? 0) + 1).padStart(3, '0')}`;
}

export const classIdPrefix = (now: Date) => nextClassId(now, 0).slice(0, 5);
