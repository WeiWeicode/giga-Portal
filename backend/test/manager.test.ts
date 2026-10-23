/** docs/Gherkin/manager/manager.feature、training.feature、budget.feature(測試名稱 = 場景名稱) */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { loadConfig } from '../src/config.js';
import { Sources } from '../src/db/sources.js';
import { BudgetService, isLocked } from '../src/modules/manager/budget.js';
import type { BudgetCell, BudgetRepo, BudgetSave, BudgetVersion, DeptStatus } from '../src/modules/manager/budget-repo.js';
import { DeptTree, ScopeService, type DeptRow } from '../src/modules/manager/scope.js';
import { ManagerStaffService, type NoteKey, type PropertyNote, type StaffRepo, type StaffRow } from '../src/modules/manager/staff.js';
import { deptsOfObjects, type TrainingRepo, type WriteResult } from '../src/modules/manager/training-repo.js';
import { nextClassId, submitProblems, validateCourse, type CourseInput, type CourseRow, type PlanCourse } from '../src/modules/manager/training-rules.js';
import { TrainingService } from '../src/modules/manager/training.js';
import type { ManagerServices } from '../src/routes/manager.js';
import { DB_ENV, testApp, type TestApp } from './helpers.js';

const DEPTS: DeptRow[] = [
  { code: 'S1300', name: '總經理室', parent: null },
  { code: 'S1800', name: '資訊服務部', parent: 'S1300' },
  { code: 'S1810', name: '網路通訊課', parent: 'S1800' },
  { code: 'S1820 ', name: '資訊應用課', parent: 'S1800' },
  { code: 'S1900', name: '人資部', parent: 'S1300' },
];

class MemoryStaff implements StaffRepo {
  rows: StaffRow[] = [];
  notes: (PropertyNote & { userId: string })[] = [];
  queriedDepts: string[][] = [];
  async courseStaff(depts: string[]) {
    this.queriedDepts.push(depts);
    return this.rows.filter((r) => depts.includes((r.dept ?? '').trim()));
  }
  async memberships() {
    return new Map();
  }
  async completions() {
    return new Map([['S1', [{ courseType: '工安課程(必修)', className: '自衛消防編組訓練', hours: '1' }]]]);
  }
  async propertyNotes(depts: string[]) {
    this.queriedDepts.push(depts);
    return this.notes.filter((n) => depts.includes(n.dept ?? ''));
  }
  async currentDepts(empNo: string) {
    return [...new Set(this.notes.filter((n) => n.empNo === empNo).map((n) => n.dept ?? ''))];
  }
  async updateNote(key: NoteKey, note: string) {
    const hit = this.notes.filter((n) => n.empNo === key.empNo && n.assetNo === key.assetNo && (n.assetSub ?? '') === (key.assetSub ?? ''));
    hit.forEach((n) => (n.note = note));
    return hit.length;
  }
}

const course = (over: Partial<CourseInput> = {}): CourseInput => ({
  dept: 'S1810',
  className: '網路基礎',
  agenda: '1. OSI\r\n2. TCP/IP',
  classType: '專業職能',
  subType: '在職訓練課程',
  classWhere: '內訓',
  onType: '實體',
  testType: '測驗',
  teacherName: '王老師',
  teacherUnit: '資訊服務部',
  seasons: ['3', '1'],
  hour: 1.5,
  cost1: 1000,
  cost2: 0,
  cost3: 200,
  joinDept: 'S1810',
  ...over,
});

class MemoryTraining implements TrainingRepo {
  year: number | null = 2026;
  plan: { emp: string; code: string }[] = [];
  status: { emp: string; dept: string }[] = [];
  forms: (PlanCourse & { annual: string })[] = [];
  seq = 0;
  async annual() {
    return this.year;
  }
  async planDepts(empNo: string) {
    return this.plan.filter((p) => p.emp === empNo).map((p) => ({ code: p.code, name: null }));
  }
  async submittedBy(empNo: string) {
    return this.status.some((s) => s.emp === empNo);
  }
  async submittedDepts(_y: number, depts: string[]) {
    return [...new Set(this.status.filter((s) => depts.includes(s.dept)).map((s) => s.dept))];
  }
  async courses(year: number, depts: string[]) {
    return this.forms.filter((f) => f.annual === String(year) && depts.includes(f.dept));
  }
  async pastCourses() {
    return [];
  }
  async applied() {
    return [];
  }
  async course(id: string) {
    return this.forms.find((f) => f.classId === id) ?? null;
  }
  private locked(emp: string, depts: string[]) {
    return this.status.some((s) => s.emp === emp || depts.includes(s.dept));
  }
  private toForm(id: string, year: number, row: CourseRow) {
    return { classId: id, annual: String(year), ...row, season: row.season, onType: row.onType };
  }
  async insert(emp: string, year: number, row: CourseRow, now: Date): Promise<WriteResult> {
    if (this.locked(emp, [row.dept])) return { ok: false, reason: 'locked' };
    if (this.forms.some((f) => f.annual === String(year) && f.dept === row.dept && f.className === row.className)) return { ok: false, reason: 'duplicate' };
    const classId = nextClassId(now, this.seq++);
    this.forms.push(this.toForm(classId, year, row));
    return { ok: true, classId };
  }
  async update(emp: string, year: number, id: string, oldDept: string, row: CourseRow): Promise<WriteResult> {
    if (this.locked(emp, [oldDept, row.dept])) return { ok: false, reason: 'locked' };
    const i = this.forms.findIndex((f) => f.classId === id);
    if (i < 0) return { ok: false, reason: 'not-found' };
    this.forms[i] = this.toForm(id, year, row);
    return { ok: true, classId: id };
  }
  async remove(emp: string, _y: number, id: string, dept: string): Promise<WriteResult> {
    if (this.locked(emp, [dept])) return { ok: false, reason: 'locked' };
    const n = this.forms.length;
    this.forms = this.forms.filter((f) => f.classId !== id);
    return n === this.forms.length ? { ok: false, reason: 'not-found' } : { ok: true, classId: id };
  }
  async submit(emp: string, y: number, depts: string[], check: (c: PlanCourse[]) => { message: string }[]) {
    if (this.locked(emp, depts)) return { ok: false as const, reason: 'locked' as const };
    const problems = check(await this.courses(y, depts));
    if (problems.length) return { ok: false as const, reason: 'incomplete' as const, problems };
    this.status = this.status.filter((s) => s.emp !== emp).concat(depts.map((dept) => ({ emp, dept })));
    return { ok: true as const };
  }
}

const V_OPEN: BudgetVersion = { flag: 154, year: 2026, ver: 1, standard: 'H', isFinal: false, companyId: 'GSMC', cid: 15 };
const V_FINAL: BudgetVersion = { ...V_OPEN, flag: 153, isFinal: true };

class MemoryBudget implements BudgetRepo {
  comp = ['DS11'];
  manager = false;
  managerDepts = ['S1800'];
  deptStatus: number | null = null;
  cells: BudgetCell[] = [];
  saved: BudgetSave[] = [];
  submitted = 0;
  async compDbs() {
    return this.comp;
  }
  async currentFlag() {
    return { year: 2026, companyName: '碩禾' };
  }
  async versions(_c: string, opts: { openOnly?: boolean }) {
    return opts.openOnly ? [V_OPEN] : [V_OPEN, V_FINAL];
  }
  async version(flag: number) {
    return [V_OPEN, V_FINAL].find((v) => v.flag === flag) ?? null;
  }
  async access() {
    return { manager: this.manager, depts: this.managerDepts };
  }
  async depts() {
    return [
      { id: 'S1800', name: '資訊服務部' },
      { id: 'S1900', name: '人資部' },
    ];
  }
  async viewData() {
    return {
      accounts: [
        { code: '6211', name: '租金', isSum: false },
        { code: '6212', name: '文具', isSum: false },
      ],
      cells: [
        { code: '6211', month: 1, amount: 100, mark: null },
        { code: '6211', month: 2, amount: 50.5, mark: null },
        { code: '6212', month: 1, amount: 10, mark: null },
      ],
    };
  }
  async applyData() {
    return {
      accounts: [
        { code: '6200', name: '管理費用', isSum: true },
        { code: '6211', name: '租金', isSum: false },
        { code: '6219', name: '禁填', isSum: false },
        { code: '6234', name: '例外合計', isSum: true },
      ],
      cells: this.cells,
      remark: '舊備註',
    };
  }
  async status(): Promise<DeptStatus> {
    return { isFinal: false, status: this.deptStatus };
  }
  async save(input: BudgetSave, locked: (s: DeptStatus) => boolean) {
    if (locked({ isFinal: input.version.isFinal, status: this.deptStatus })) return { ok: false as const, reason: 'locked' as const };
    this.saved.push(input);
    for (const c of input.cells) {
      const cell = this.cells.find((x) => x.code === c.code && x.month === c.month)!;
      cell.amount = c.amount;
      if (c.mark !== undefined) cell.mark = c.mark || null;
    }
    return { ok: true as const };
  }
  async submit(_v: BudgetVersion, _d: string, locked: (s: DeptStatus) => boolean) {
    if (locked({ isFinal: false, status: this.deptStatus })) return { ok: false };
    this.submitted++;
    this.deptStatus = 1;
    return { ok: true };
  }
}

const NOW = new Date('2026-10-23T02:00:00Z');
const BUDGET = loadConfig({ GW_ENV: 'dev', SERVICE_CODE: 'portal-api', ...DB_ENV }).budget;

describe('主管專區', () => {
  let t: TestApp;
  const staff = new MemoryStaff();
  const training = new MemoryTraining();
  const budget = new MemoryBudget();
  const scopes = new ScopeService({ departments: async () => DEPTS });
  const svc: ManagerServices = {
    scopes,
    staff: new ManagerStaffService(staff, scopes),
    training: new TrainingService(training, scopes, () => NOW),
    budget: new BudgetService(budget, BUDGET),
  };
  const call = async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object, claims: Record<string, unknown> = {}) =>
    t.app.inject({
      method,
      url,
      ...(payload ? { payload } : {}),
      headers: { 'x-internal-token': await t.token({ sub: '1', emp: 'S112009', dept: 'S1800', roles: ['employee', 'portal-manager'], ...claims }) },
    });

  before(async () => {
    t = await testApp({ manager: svc });
  });
  after(() => t.close());
  beforeEach(() => {
    staff.queriedDepts = [];
    training.plan = [
      { emp: 'S112009', code: 'S1800' },
      { emp: 'S112009', code: 'S1810' },
      { emp: 'S112009', code: 'S1900' },
    ];
    training.status = [];
    training.forms = [];
    training.year = 2026;
    budget.manager = false;
    budget.managerDepts = ['S1800'];
    budget.deptStatus = null;
    budget.saved = [];
    budget.cells = [
      { code: '6211', month: 1, amount: 100, mark: null },
      { code: '6211', month: 3, amount: 0, mark: null },
      { code: '6219', month: 3, amount: 0, mark: null },
      { code: '6200', month: 3, amount: 0, mark: null },
      { code: '6234', month: 3, amount: 0, mark: null },
    ];
  });

  // ───── 共通 ─────
  it('主管可選的部門', async () => {
    const j = (await call('GET', '/v1/manager/depts')).json();
    assert.equal(j.all, false);
    assert.deepEqual(j.items.map((d: DeptRow) => d.code).sort(), ['S1800', 'S1810', 'S1820'], '含下層、代碼去空白,不含上層');
  });

  it('全公司角色', async () => {
    const j = (await call('GET', '/v1/manager/depts', undefined, { roles: ['portal-manager-all'] })).json();
    assert.equal(j.all, true);
    assert.equal(j.items.length, 5);
    const r = await call('GET', '/v1/manager/courses', undefined, { roles: ['portal-manager-all'] });
    assert.equal(r.json().code, 'PORTAL_MGR_DEPT_REQUIRED');
    assert.equal((await call('GET', '/v1/manager/courses?dept=S1900', undefined, { roles: ['portal-manager-all'] })).statusCode, 200);
  });

  it('指定範圍外的部門', async () => {
    for (const url of ['/v1/manager/courses?dept=S1300', '/v1/manager/property?dept=S1900']) {
      const r = await call('GET', url);
      assert.equal(r.statusCode, 403, url);
      assert.equal(r.json().code, 'PORTAL_DATA_ACCESS_DENIED');
    }
    assert.deepEqual(staff.queriedDepts, [], '範圍外不查資料庫');
  });

  it('Token 沒有部門', async () => {
    assert.deepEqual((await call('GET', '/v1/manager/depts', undefined, { dept: undefined })).json().items, []);
    assert.equal((await call('GET', '/v1/manager/courses?dept=S1800', undefined, { dept: undefined })).statusCode, 403);
  });

  it('不具主管角色不給部門資料(資安審查 M-1)', async () => {
    for (const url of ['/v1/manager/depts', '/v1/manager/courses?dept=S1800', '/v1/manager/property?dept=S1800', '/v1/manager/training'])
      assert.equal((await call('GET', url, undefined, { roles: ['employee'] })).json().code, 'PORTAL_DATA_ACCESS_DENIED', url);
  });

  it('部門樹防循環', () => {
    const tree = new DeptTree([
      { code: 'A', name: null, parent: 'B' },
      { code: 'B', name: null, parent: 'A' },
    ]);
    assert.deepEqual(tree.subtree('a').sort(), ['A', 'B']);
  });

  // ───── 部門必上課程 ─────
  it('部屬年度必上課程', async () => {
    const row = (empNo: string, dept: string): StaffRow => ({
      empNo,
      name: empNo,
      deptName: null,
      compDb: 'DS11',
      dept,
      jobName: '工程師',
      jobDate: '2020-01-01',
    });
    staff.rows = [row('S1', 'S1810'), row('S2', 'S1810'), row('S3', 'S1800')];
    const j = (await call('GET', '/v1/manager/courses?dept=S1800&year=2026')).json();
    assert.deepEqual(staff.queriedDepts[0]!.sort(), ['S1800', 'S1810', 'S1820']);
    assert.equal(j.items.length, 3);
    const s1 = j.items.find((x: { empNo: string }) => x.empNo === 'S1');
    const s2 = j.items.find((x: { empNo: string }) => x.empNo === 'S2');
    assert.equal(s1.courses.find((c: { key: string }) => c.key === 'fire-team').status, 'done');
    assert.equal(s2.courses.find((c: { key: string }) => c.key === 'fire-team').status, 'missing');
    assert.equal(s2.deduction, -4, '自衛消防、危害通識未完成各扣 2 分(D-9;舊主管版固定 0.0 不沿用)');
    await call('GET', '/v1/manager/courses?dept=S1800&includeSub=false');
    assert.deepEqual(staff.queriedDepts[1], ['S1800']);
    await call('GET', '/v1/manager/courses');
    assert.equal(staff.queriedDepts[2]!.length, 3, '未指定部門 = 整個範圍');
  });

  // ───── 部門資產 ─────
  it('部門資產備註', async () => {
    staff.notes = [
      { userId: 'S2', empNo: 'S2', name: 'B', dept: 'S1810', deptName: null, compDb: 'DS11', assetNo: 'A001', assetSub: '', note: '舊', hasPhoto: true },
    ];
    const j = (await call('GET', '/v1/manager/property?dept=S1800')).json();
    assert.equal(j.items.length, 1);
    assert.equal(j.items[0].hasPhoto, true);
  });

  it('主管修改部屬資產備註(備註歸屬保管人)', async () => {
    staff.notes = [
      { userId: 'S2', empNo: 'S2', name: 'B', dept: 'S1810', deptName: null, compDb: 'DS11', assetNo: 'A001', assetSub: '', note: '舊', hasPhoto: true },
      { userId: 'S9', empNo: 'S9', name: 'C', dept: 'S1900', deptName: null, compDb: 'DS11', assetNo: 'B001', assetSub: '', note: '舊', hasPhoto: false },
    ];
    const body = { empNo: 'S2', compDb: 'DS11', assetNo: 'A001', assetSub: '', note: '  放置於 B 棟 3 樓 ' };
    assert.equal((await call('PUT', '/v1/manager/property/note', body)).statusCode, 204);
    assert.equal(staff.notes[0]!.note, '放置於 B 棟 3 樓', '寫到保管人 S2,去頭尾空白');
    assert.equal((await call('PUT', '/v1/manager/property/note', { ...body, empNo: 'S9', assetNo: 'B001' })).statusCode, 403, '保管人不在範圍');
    assert.equal((await call('PUT', '/v1/manager/property/note', { ...body, assetNo: 'X999' })).json().code, 'PORTAL_MGR_PROPERTY_NOT_FOUND');
    assert.equal((await call('PUT', '/v1/manager/property/note', { ...body, note: 'x'.repeat(151) })).statusCode, 400);
    assert.equal((await call('PUT', '/v1/manager/property/note', { ...body, note: '<script>' })).statusCode, 400);
  });

  // ───── 訓練計畫 ─────
  it('開啟訓練計畫', async () => {
    const j = (await call('GET', '/v1/manager/training')).json();
    assert.equal(j.year, 2026);
    assert.deepEqual(
      j.depts.map((d: { code: string }) => d.code),
      ['S1800', 'S1810'],
    );
    assert.deepEqual(
      j.outOfScope.map((d: { code: string }) => d.code),
      ['S1900'],
      'ELPlanDept 有但不在 Token 範圍',
    );
    assert.equal(j.canEdit, true);
    assert.ok(j.options.subTypes['專業職能'].includes('在職訓練課程'));
  });

  it('不是年度負責主管', async () => {
    training.plan = [];
    const j = (await call('GET', '/v1/manager/training')).json();
    assert.deepEqual(j.depts, []);
    assert.equal(j.canEdit, false);
    assert.equal((await call('POST', '/v1/manager/training/courses', course())).statusCode, 403);
  });

  it('新增課程與驗證', async () => {
    const r = await call('POST', '/v1/manager/training/courses', course());
    assert.equal(r.statusCode, 201);
    const c = r.json();
    assert.match(c.classId, /^N2610\d{3}$/);
    assert.equal(c.season, '1,3', '季別依選項順序、逗號分隔');
    assert.equal(c.cost, 1200);
    assert.equal(c.hour, 1.5);
    assert.equal((await call('POST', '/v1/manager/training/courses', course())).json().code, 'PORTAL_MGR_TRAINING_DUPLICATE');
    for (const [bad, field] of [
      [{ className: ' ' }, 'className'],
      [{ hour: 0.4 }, 'hour'],
      [{ cost1: -1 }, 'cost1'],
      [{ subType: '工安課程' }, 'subType'],
      [{ seasons: [] }, 'seasons'],
      [{ seasons: ['5'] }, 'seasons'],
      [{ classWhere: '其他' }, 'classWhere'],
      [{ className: '<b>x</b>' }, 'className'],
      [{ agenda: 'a‮b' }, 'agenda'],
    ] as const) {
      const e = await call(
        'POST',
        '/v1/manager/training/courses',
        course({ ...(bad as Partial<CourseInput>), className: 'className' in bad ? bad.className : `課${field}` }),
      );
      assert.equal(e.statusCode, 400, field);
      assert.ok(
        e.json().details.some((d: { field: string }) => d.field === field),
        field,
      );
    }
    assert.equal((await call('POST', '/v1/manager/training/courses', course({ dept: 'S1900', className: '人資課' }))).statusCode, 403, '範圍外的負責部門');
    assert.equal((await call('POST', '/v1/manager/training/courses', course({ dept: 'S1820', className: '非負責' }))).statusCode, 403, '範圍內但非負責部門');
  });

  it('修改與刪除課程', async () => {
    const id = (await call('POST', '/v1/manager/training/courses', course())).json().classId;
    const u = await call('PUT', `/v1/manager/training/courses/${id}`, course({ className: '網路進階', dept: 'S1800' }));
    assert.equal(u.statusCode, 200);
    assert.equal(u.json().dept, 'S1800');
    training.forms.push({ ...training.forms[0]!, classId: 'N2610999', dept: 'S1820' });
    assert.equal((await call('PUT', '/v1/manager/training/courses/N2610999', course())).json().code, 'PORTAL_MGR_TRAINING_NOT_FOUND', '非負責部門的課程');
    training.forms.push({ ...training.forms[0]!, classId: 'N2510001', annual: '2025' });
    assert.equal((await call('DELETE', '/v1/manager/training/courses/N2510001')).statusCode, 404, '非本年度');
    assert.equal((await call('DELETE', `/v1/manager/training/courses/${id}`)).statusCode, 204);
  });

  it('提交訓練計畫', async () => {
    await call('POST', '/v1/manager/training/courses', course({ dept: 'S1800', className: 'A' }));
    await call('POST', '/v1/manager/training/courses', course({ dept: 'S1800', className: 'B' }));
    await call('POST', '/v1/manager/training/courses', course({ dept: 'S1810', className: 'C', teacherName: '' }));
    const r = await call('POST', '/v1/manager/training/submit');
    assert.equal(r.statusCode, 422);
    assert.equal(r.json().code, 'PORTAL_MGR_TRAINING_INCOMPLETE');
    assert.ok(r.json().details.some((d: { dept?: string; message: string }) => d.dept === 'S1810' && d.message.includes('2門以上')));
    assert.ok(r.json().details.some((d: { message: string }) => d.message.includes('講師未填寫')));
    const c = training.forms.find((f) => f.className === 'C')!;
    await call('PUT', `/v1/manager/training/courses/${c.classId}`, course({ dept: 'S1810', className: 'C' }));
    await call('POST', '/v1/manager/training/courses', course({ dept: 'S1810', className: 'D' }));
    const ok = await call('POST', '/v1/manager/training/submit');
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.json().submitted, true);
    assert.deepEqual(training.status.map((s) => s.dept).sort(), ['S1800', 'S1810'], '只提交範圍內的負責部門');
  });

  it('提交後鎖定(後端檢查)', async () => {
    const id = (await call('POST', '/v1/manager/training/courses', course())).json().classId;
    training.status = [{ emp: 'OTHER', dept: 'S1810' }];
    for (const r of [
      await call('POST', '/v1/manager/training/courses', course({ className: '新' })),
      await call('PUT', `/v1/manager/training/courses/${id}`, course()),
      await call('DELETE', `/v1/manager/training/courses/${id}`),
    ])
      assert.equal(r.json().code, 'PORTAL_MGR_TRAINING_LOCKED');
    assert.equal((await call('POST', '/v1/manager/training/courses', course({ dept: 'S1800', className: '未鎖部門' }))).statusCode, 201);
  });

  it('匯出訓練計畫', async () => {
    await call('POST', '/v1/manager/training/courses', course());
    const r = await call('GET', '/v1/manager/training/export?dept=S1810');
    assert.equal(r.statusCode, 200);
    assert.match(String(r.headers['content-disposition']), /filename\*=UTF-8''S1810_115/);
    assert.equal(r.rawPayload.subarray(0, 2).toString(), 'PK');
    assert.equal((await call('GET', '/v1/manager/training/export?dept=S1900')).statusCode, 403);
  });

  it('尚未設定編列年度', async () => {
    training.year = null;
    assert.equal((await call('GET', '/v1/manager/training')).json().code, 'PORTAL_MGR_TRAINING_YEAR_UNSET');
  });

  // ───── 預算 ─────
  it('可看部門(D-26)', async () => {
    const j = (await call('GET', '/v1/manager/budget/options')).json();
    assert.equal(j.company.id, 'GSMC');
    assert.deepEqual(
      j.depts.map((d: { id: string }) => d.id),
      ['S1800'],
    );
    assert.equal(j.versions.length, 2);
    budget.manager = true;
    assert.equal((await call('GET', '/v1/manager/budget/options')).json().depts.length, 2, '管理者看全部啟用部門');
    const r = await call('GET', '/v1/manager/budget/options', undefined, { roles: ['employee'] });
    assert.equal(r.statusCode, 403, '須具 portal-manager');
    budget.comp = ['DS99'];
    assert.equal((await call('GET', '/v1/manager/budget/options')).statusCode, 403, '公司別沒有對應');
    budget.comp = ['DS11'];
  });

  it('預算執行(只顯示預算)', async () => {
    const j = (await call('GET', '/v1/manager/budget?flag=153&dept=S1800')).json();
    assert.equal(j.rows[0].total, 150.5);
    assert.deepEqual(j.monthTotals.slice(0, 2), [110, 50.5]);
    assert.equal(j.actual, null);
    assert.deepEqual(j.unavailable, ['actual']);
    assert.equal((await call('GET', '/v1/manager/budget?flag=153&dept=S1900')).statusCode, 403);
    assert.equal((await call('GET', '/v1/manager/budget?flag=999&dept=S1800')).json().code, 'PORTAL_MGR_BUDGET_VERSION_NOT_FOUND');
  });

  it('預算編列清單', async () => {
    assert.deepEqual(
      (await call('GET', '/v1/manager/budget-apply/options')).json().versions.map((v: { flag: number }) => v.flag),
      [154],
    );
    assert.equal((await call('GET', '/v1/manager/budget-apply?flag=153&dept=S1800')).statusCode, 404, '已結案版本不能編列');
    const j = (await call('GET', '/v1/manager/budget-apply?flag=154&dept=S1800')).json();
    const by = Object.fromEntries(j.rows.map((r: { code: string; editable: boolean }) => [r.code, r.editable]));
    assert.deepEqual(by, { '6200': false, '6211': true, '6219': false, '6234': true }, '合計科目不可填、6234 例外可填、禁填清單不可填');
    assert.equal(j.rows[1].months[1], null, '沒有資料列的月份');
    assert.equal(j.locked, false);
    assert.equal(j.lastYearActual, null);
  });

  it('更新預算(後端鎖定檢查、交易)', async () => {
    const body = { flag: 154, dept: 'S1800', remark: '說明', cells: [{ code: '6211', month: 3, amount: 1500.25, mark: '教育訓練' }] };
    const r = await call('PUT', '/v1/manager/budget-apply', body);
    assert.equal(r.statusCode, 200);
    assert.equal(budget.saved[0]!.empNo, 'S112009');
    assert.equal(r.json().rows[1].months[2].amount, 1500.25);
    for (const cells of [
      [{ code: '6200', month: 3, amount: 1 }],
      [{ code: '6219', month: 3, amount: 1 }],
      [{ code: '6211', month: 2, amount: 1 }],
      [{ code: '9999', month: 3, amount: 1 }],
      [{ code: '6211', month: 3, amount: 1.234 }],
      [
        { code: '6211', month: 3, amount: 1 },
        { code: '6211', month: 3, amount: 2 },
      ],
      [{ code: '6211', month: 3, amount: 1, mark: '<b>' }],
    ]) {
      const e = await call('PUT', '/v1/manager/budget-apply', { ...body, cells });
      assert.equal(e.statusCode, 400, JSON.stringify(cells));
    }
    assert.equal(
      (await call('PUT', '/v1/manager/budget-apply', { ...body, cells: [{ code: '6234', month: 3, amount: 0.29 }] })).statusCode,
      200,
      '例外合計科目',
    );
    assert.equal((await call('PUT', '/v1/manager/budget-apply', { ...body, cells: [{ code: '6211', month: 13, amount: 1 }] })).statusCode, 400);
    assert.equal((await call('PUT', '/v1/manager/budget-apply', { ...body, dept: 'S1900' })).statusCode, 403);
    for (const s of [1, 2, 5]) {
      budget.deptStatus = s;
      assert.equal((await call('PUT', '/v1/manager/budget-apply', body)).json().code, 'PORTAL_MGR_BUDGET_LOCKED', `狀態 ${s}`);
    }
    budget.deptStatus = 3;
    assert.equal((await call('PUT', '/v1/manager/budget-apply', body)).statusCode, 200, '退回待重提可再編');
  });

  it('送出部門預算', async () => {
    const r = await call('POST', '/v1/manager/budget-apply/submit', { flag: 154, dept: 'S1800' });
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().locked, true);
    assert.equal((await call('POST', '/v1/manager/budget-apply/submit', { flag: 154, dept: 'S1800' })).json().code, 'PORTAL_MGR_BUDGET_LOCKED');
  });
});

describe('主管專區規則', () => {
  it('ClassID 與舊程式同格式(台灣時間 yyMM + 3 碼)', () => {
    assert.equal(nextClassId(new Date('2026-10-31T17:00:00Z'), 12), 'N2611013');
    assert.equal(nextClassId(new Date('2026-10-01T00:00:00Z'), null), 'N2610001');
  });

  it('評核方式「其他」可自訂文字', () => {
    assert.equal(validateCourse(course({ testType: '實作' })).errors.length, 0);
  });

  it('提交檢查需開 2 門在職訓練課程', () => {
    const p = submitProblems(['S1800'], [], 2026);
    assert.match(p[0]!.message, /尚有\[在職訓練課程\]未建立,未能提交115年度/);
  });

  it('CLASS_OBJECTS 只取部門代碼', () => {
    assert.equal(deptsOfObjects('S4120_特用膠材開發專案;\nCS091002_黃文瑞;s1810_網路課;_全體;'), 'S4120,S1810');
  });

  it('鎖定狀態', () => {
    assert.equal(isLocked({ isFinal: true, status: null }), true);
    assert.equal(isLocked({ isFinal: false, status: 0 }), false);
    assert.equal(isLocked({ isFinal: false, status: 4 }), false);
  });

  it('Budget 中文表名可用', () => {
    assert.equal(Sources.fromEnv('copy', 'giganexus_gw_test', {}).table('Budget', '部門狀態'), '[giganexus_gw_test].[src_budget].[部門狀態]');
    assert.throws(() => Sources.fromEnv('copy', 'giganexus_gw_test', {}).table('Budget', '部門 狀態'), /資料表名稱/);
  });

  it('預算設定可覆寫且檢查格式', () => {
    const c = loadConfig({ GW_ENV: 'dev', SERVICE_CODE: 'portal-api', ...DB_ENV, BUDGET_COMPANY_MAP: 'ds11=GSMC', BUDGET_LOCKED_CODES: '6219' });
    assert.deepEqual(c.budget.companyMap, { DS11: 'GSMC' });
    assert.deepEqual(c.budget.lockedCodes, ['6219']);
    assert.throws(() => loadConfig({ GW_ENV: 'dev', SERVICE_CODE: 'portal-api', ...DB_ENV, BUDGET_LOCKED_CODES: "62'19" }), /BUDGET_LOCKED_CODES/);
    assert.throws(() => loadConfig({ GW_ENV: 'dev', SERVICE_CODE: 'portal-api', ...DB_ENV, BUDGET_COMPANY_MAP: 'DS11' }), /BUDGET_COMPANY_MAP/);
  });
});
