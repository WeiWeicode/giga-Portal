/** 主管專區畫面邏輯(docs/Gherkin/manager/*.feature) */
import { describe, expect, it } from 'vitest';
import type { BudgetApplyRow, PlanCourse, StaffCourses } from '../src/api/portal';
import {
  budgetChanges,
  budgetTotals,
  cellKey,
  courseFromApplied,
  courseFromPlan,
  courseStats,
  deptOptions,
  initialEdits,
  onJobCount,
  parseAmount,
  parseSeasons,
  seasonText,
} from '../src/composables/manager';
import { itemNo, MANAGER_RIGHTS } from '../src/pages/manager/rights/rightsContent';

describe('主管專區', () => {
  it('部門下拉依部門樹縮排、範圍外上層不列', () => {
    const o = deptOptions([
      { code: 'S1810', name: '網路課', parent: 'S1800' },
      { code: 'S1800', name: '資訊部', parent: 'S1300' },
      { code: 'S1820', name: null, parent: 'S1800' },
    ]);
    expect(o.map((x) => x.value)).toEqual(['S1800', 'S1810', 'S1820']);
    expect(o[1]!.label).toBe('　S1810 網路課');
    expect(o[2]!.label).toBe('　S1820');
  });

  it('部屬年度必上課程統計', () => {
    const p = (deduction: number, statuses: ('done' | 'missing' | 'na')[]): StaffCourses => ({
      empNo: 'S',
      name: null,
      dept: null,
      deptName: null,
      inYear: true,
      deduction,
      courses: statuses.map((status, i) => ({ key: `k${i}`, status })),
    });
    expect(courseStats([p(0, ['done', 'na']), p(-2, ['missing', 'done'])])).toEqual({ people: 2, applicable: 3, done: 2, rate: 66.7, deducted: 1 });
    expect(courseStats([]).rate).toBe(0);
  });

  it('主管權益照搬舊頁', () => {
    expect(Object.keys(MANAGER_RIGHTS)).toEqual(['1', '2', '3', '4']);
    expect(MANAGER_RIGHTS['1'].items[2]).toContain('1,500(含)以下');
    expect(MANAGER_RIGHTS['4'].items[2]).toContain('100,000(含)以下');
    expect(MANAGER_RIGHTS['4'].items.some((t) => t.includes('接班人'))).toBe(false);
    expect(itemNo(7)).toBe('八、');
  });
});

describe('年度教育訓練計畫', () => {
  const c: PlanCourse = {
    classId: 'N2610001',
    dept: 'S1900',
    className: '舊課',
    agenda: null,
    classType: '通識',
    subType: '工安課程',
    classWhere: '內訓',
    onType: '實體',
    testType: '實作',
    teacherName: null,
    teacherUnit: null,
    season: '1 3',
    hour: 2,
    cost1: 100,
    cost2: null,
    cost3: 0,
    cost: 100,
    joinDept: '全員',
  };

  it('從去年 / 申請紀錄帶入', () => {
    const f = courseFromPlan(c, ['S1800'], 'S1800');
    expect(f.dept).toBe('S1800');
    expect(f.seasons).toEqual(['1', '3']);
    expect(f.cost2).toBe(0);
    const a = courseFromApplied(
      { applyDate: null, dept: 'S1800', deptName: null, className: '申請課', classWhere: '外訓', teacherName: '王', hours: '1.5', joinDept: 'S1800' },
      ['S1800'],
      'S1810',
    );
    expect([a.dept, a.className, a.classWhere, a.hour, a.teacherName]).toEqual(['S1800', '申請課', '外訓', 1.5, '王']);
  });

  it('季別與在職訓練門數', () => {
    expect(parseSeasons('1,2, 不定期')).toEqual(['1', '2', '不定期']);
    expect(seasonText('1,4')).toBe('第一季、第四季');
    expect(seasonText('')).toBe('—');
    expect(onJobCount([{ ...c, dept: 'S1800', subType: '在職訓練課程' }, c], 'S1800')).toBe(1);
  });
});

describe('部門預算編列', () => {
  const rows: BudgetApplyRow[] = [
    { code: '6200', name: '合計', isSum: true, editable: false, months: [{ amount: 9, mark: null }, ...Array(11).fill(null)], total: 9 },
    {
      code: '6211',
      name: '租金',
      isSum: false,
      editable: true,
      months: [{ amount: 100, mark: null }, null, { amount: 0, mark: '舊' }, ...Array(9).fill(null)],
      total: 100,
    },
  ];

  it('只送出有變動的格子', () => {
    const e = initialEdits(rows);
    expect(e[cellKey('6211', 1)]).toEqual({ amount: '100', mark: '' });
    expect(budgetChanges(rows, e)).toEqual({ cells: [], invalid: [] });
    e[cellKey('6211', 1)]!.amount = '1,500.5';
    e[cellKey('6211', 3)]!.mark = '新備註';
    e[cellKey('6200', 1)]!.amount = '999';
    expect(budgetChanges(rows, e).cells).toEqual([
      { code: '6211', month: 1, amount: 1500.5 },
      { code: '6211', month: 3, amount: 0, mark: '新備註' },
    ]);
    e[cellKey('6211', 1)]!.amount = 'abc';
    expect(budgetChanges(rows, e).invalid).toEqual(['租金 1 月']);
  });

  it('金額格式與合計', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('1.234')).toBeNull();
    expect(parseAmount('')).toBeNull();
    const e = initialEdits(rows);
    e[cellKey('6211', 3)]!.amount = '50';
    const t = budgetTotals(rows, e);
    expect(t.row['6211']).toBe(150);
    expect(t.month.slice(0, 3)).toEqual([109, 0, 50]);
  });
});
