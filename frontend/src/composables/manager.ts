/** 主管專區畫面邏輯(P5;FEATURE-PLAN §7;docs/Gherkin/manager/*.feature) */
import type { AppliedCourse, BudgetApplyRow, BudgetCellInput, CourseInput, MgrDept, PlanCourse, StaffCourses } from '@/api/portal';

/** 部門下拉:依部門樹縮排(上層在前),範圍外的上層不列 */
export function deptOptions(depts: readonly MgrDept[]): { label: string; value: string }[] {
  const codes = new Set(depts.map((d) => d.code));
  const children = new Map<string | null, MgrDept[]>();
  for (const d of depts) {
    const p = d.parent && codes.has(d.parent) ? d.parent : null;
    children.set(p, [...(children.get(p) ?? []), d]);
  }
  const out: { label: string; value: string }[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number) => {
    for (const d of [...(children.get(parent) ?? [])].sort((a, b) => a.code.localeCompare(b.code))) {
      if (seen.has(d.code)) continue;
      seen.add(d.code);
      out.push({ label: `${'　'.repeat(depth)}${d.code} ${d.name ?? ''}`.trimEnd(), value: d.code });
      walk(d.code, depth + 1);
    }
  };
  walk(null, 0);
  // 循環資料的部門(沒有根)也列出
  for (const d of depts) if (!seen.has(d.code)) out.push({ label: `${d.code} ${d.name ?? ''}`.trimEnd(), value: d.code });
  return out;
}

/** 部屬課程統計:適用人次、完成、未完成工安(扣分人數) */
export function courseStats(items: readonly StaffCourses[]) {
  let applicable = 0;
  let done = 0;
  for (const p of items)
    for (const c of p.courses) {
      if (c.status === 'na') continue;
      applicable++;
      if (c.status === 'done') done++;
    }
  return {
    people: items.length,
    applicable,
    done,
    rate: applicable ? Math.round((done / applicable) * 1000) / 10 : 0,
    deducted: items.filter((p) => p.deduction < 0).length,
  };
}

/** 舊資料季別可能以逗號或空白分隔(舊 txtSeason.Replace(' ', ',')) */
export const parseSeasons = (s: string | null | undefined): string[] => (s ?? '').split(/[,\s]+/).filter(Boolean);

export const SEASON_LABEL: Record<string, string> = { '1': '第一季', '2': '第二季', '3': '第三季', '4': '第四季', 不定期: '不定期' };
export const seasonText = (s: string | null | undefined) =>
  parseSeasons(s)
    .map((x) => SEASON_LABEL[x] ?? x)
    .join('、') || '—';

export function emptyCourse(dept: string): CourseInput {
  return {
    dept,
    className: '',
    agenda: '',
    classType: '',
    subType: '',
    classWhere: '',
    onType: '',
    testType: '',
    teacherName: '',
    teacherUnit: '',
    seasons: [],
    hour: 0,
    cost1: 0,
    cost2: 0,
    cost3: 0,
    joinDept: '',
  };
}

/** 編輯 / 從去年計畫帶入:dept 不在可編部門時改用預設部門 */
export function courseFromPlan(c: PlanCourse, editable: readonly string[], fallback: string): CourseInput {
  return {
    dept: editable.includes(c.dept) ? c.dept : fallback,
    className: c.className ?? '',
    agenda: c.agenda ?? '',
    classType: c.classType ?? '',
    subType: c.subType ?? '',
    classWhere: c.classWhere ?? '',
    onType: c.onType ?? '',
    testType: c.testType ?? '',
    teacherName: c.teacherName ?? '',
    teacherUnit: c.teacherUnit ?? '',
    seasons: parseSeasons(c.season),
    hour: c.hour ?? 0,
    cost1: c.cost1 ?? 0,
    cost2: c.cost2 ?? 0,
    cost3: c.cost3 ?? 0,
    joinDept: c.joinDept ?? '',
  };
}

/** 從去年 E-Learning 申請紀錄帶入(舊 GridView1「加至開課」:課名、性質、講師、時數、參加部門) */
export function courseFromApplied(a: AppliedCourse, editable: readonly string[], fallback: string): CourseInput {
  const hour = Number.parseFloat(a.hours ?? '');
  return {
    ...emptyCourse(a.dept && editable.includes(a.dept) ? a.dept : fallback),
    className: a.className ?? '',
    classWhere: a.classWhere,
    teacherName: a.teacherName ?? '',
    hour: Number.isFinite(hour) ? hour : 0,
    joinDept: a.joinDept,
  };
}

/** 每部門在職訓練課程門數(提交需 ≥ 2,同後端 MIN_ON_JOB) */
export const MIN_ON_JOB = 2;
export function onJobCount(courses: readonly PlanCourse[], dept: string): number {
  return courses.filter((c) => c.dept === dept && c.subType === '在職訓練課程').length;
}

// ───── 預算 ─────
export const BUDGET_STATUS: Record<number, string> = { 0: '未提交', 1: '已送出', 2: '待簽核', 3: '退回待重提', 4: '自行退回', 5: '簽核同意' };

export const fmtMoney = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** 編輯中的值(字串,保留使用者輸入) */
export type BudgetEdits = Record<string, { amount: string; mark: string }>;
export const cellKey = (code: string, month: number) => `${code}/${month}`;

export function initialEdits(rows: readonly BudgetApplyRow[]): BudgetEdits {
  const out: BudgetEdits = {};
  for (const r of rows)
    r.months.forEach((m, i) => {
      if (m) out[cellKey(r.code, i + 1)] = { amount: String(m.amount), mark: m.mark ?? '' };
    });
  return out;
}

/** 金額字串:允許千分位逗號,最多 2 位小數 */
export function parseAmount(s: string): number | null {
  const v = s.replace(/,/g, '').trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(v)) return null;
  return Number(v);
}

/** 與載入時不同的格子;invalid 列出無法解析的格子 */
export function budgetChanges(rows: readonly BudgetApplyRow[], edits: BudgetEdits): { cells: BudgetCellInput[]; invalid: string[] } {
  const cells: BudgetCellInput[] = [];
  const invalid: string[] = [];
  for (const r of rows) {
    if (!r.editable) continue;
    r.months.forEach((m, i) => {
      if (!m) return;
      const e = edits[cellKey(r.code, i + 1)];
      if (!e) return;
      const amount = parseAmount(e.amount);
      if (amount === null) {
        invalid.push(`${r.name ?? r.code} ${i + 1} 月`);
        return;
      }
      const markChanged = e.mark.trim() !== (m.mark ?? '').trim();
      if (amount !== m.amount || markChanged) cells.push({ code: r.code, month: i + 1, amount, ...(markChanged ? { mark: e.mark.trim() } : {}) });
    });
  }
  return { cells, invalid };
}

/** 依編輯值計算每列與每月合計 */
export function budgetTotals(rows: readonly BudgetApplyRow[], edits: BudgetEdits) {
  const month = Array.from({ length: 12 }, () => 0);
  const row: Record<string, number> = {};
  for (const r of rows) {
    let sum = 0;
    r.months.forEach((m, i) => {
      if (!m) return;
      const v = r.editable ? (parseAmount(edits[cellKey(r.code, i + 1)]?.amount ?? '') ?? m.amount) : m.amount;
      sum += v;
      month[i]! += v;
    });
    row[r.code] = Math.round(sum * 100) / 100;
  }
  return { row, month: month.map((x) => Math.round(x * 100) / 100) };
}
