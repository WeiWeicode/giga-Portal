/** docs/Gherkin/esh/license.feature、notify.feature、chemicals.feature(測試名稱 = 場景名稱) */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { loadConfig } from '../src/config.js';
import {
  buildRecord,
  EshChemicalService,
  parseFieldValues,
  type BpmChemicalForm,
  type ChemicalQuery,
  type ChemicalRecord,
  type ChemicalRepo,
  type ChemicalRow,
  type ChemicalSdsRepo,
  type ChemicalSource,
  type Component,
} from '../src/modules/esh/chemical.js';
import { EshLicenseService } from '../src/modules/esh/license.js';
import {
  DryRunMailer,
  EshNotifyService,
  GatewayNotifyMailer,
  planNotifications,
  weekKey,
  type EshJobRepo,
  type JobName,
  type JobRun,
  type NotifyLogEntry,
} from '../src/modules/esh/notify.js';
import { addMonths, complianceRatio, holderStatus, legacyFileUrl, nextTrainingDate, safeHttpUrl } from '../src/modules/esh/rules.js';
import { dailyAt, EshScheduler, weeklyAt } from '../src/modules/esh/scheduler.js';
import type {
  CreateHolderResult,
  DashboardRow,
  EshFileRepo,
  EshRepo,
  FileRef,
  HolderDoc,
  HolderRow,
  HolderWrite,
  LegacyDoc,
  LicenseItemRow,
  LicenseItemWrite,
  ManagerRow,
  NeedRow,
  Person,
} from '../src/modules/esh/types.js';
import type { EshServices } from '../src/routes/esh.js';
import { DB_ENV, testApp, type TestApp } from './helpers.js';

const TODAY = '2026-10-23';
const UUID = '0bc59e51-9188-4e5d-87eb-6467d178efdd';

class MemoryEsh implements EshRepo {
  mgr: { company: string; empNo: string; sendMail: boolean }[] = [];
  comps = ['國碩', '碩禾', '碩禾新豐廠'];
  itemRows: LicenseItemRow[] = [];
  needRows: { company: string; licenseId: number; required: number; notes: string | null }[] = [];
  holderRows: (Omit<HolderRow, 'licenseName' | 'months' | 'name' | 'dept' | 'bossId' | 'inService'> & {})[] = [];
  people = new Map<string, Person>();
  legacy: LegacyDoc[] = [];
  private seq = 100;

  async managerCompanies(empNo: string) {
    return this.comps.filter((c) => this.mgr.some((m) => m.empNo === empNo && m.company === c));
  }
  async companies() {
    return [...this.comps];
  }
  async items(includeInactive: boolean) {
    return this.itemRows.filter((i) => includeInactive || i.active);
  }
  async item(id: number) {
    return this.itemRows.find((i) => i.id === id) ?? null;
  }
  async itemNameTaken(name: string, exceptId = 0) {
    return this.itemRows.some((i) => i.active && i.name === name && i.id !== exceptId);
  }
  async createItem(i: LicenseItemWrite) {
    const id = ++this.seq;
    this.itemRows.push({ id, name: i.name, months: i.months, script: i.script, logoPath: null, active: true });
    return id;
  }
  async updateItem(id: number, i: LicenseItemWrite) {
    const r = this.itemRows.find((x) => x.id === id && x.active);
    if (!r) return false;
    Object.assign(r, { name: i.name, months: i.months, script: i.script });
    return true;
  }
  async itemUsage(id: number) {
    return { needs: this.needRows.filter((n) => n.licenseId === id).length, holders: this.holderRows.filter((h) => h.licenseId === id && h.active).length };
  }
  async deactivateItem(id: number) {
    const r = this.itemRows.find((x) => x.id === id && x.active);
    if (r) r.active = false;
    return !!r;
  }
  async needs(companies: string[]): Promise<NeedRow[]> {
    return this.needRows
      .filter((n) => companies.includes(n.company))
      .map((n) => ({ ...n, licenseName: this.itemRows.find((i) => i.id === n.licenseId)?.name ?? '' }));
  }
  async createNeed(company: string, licenseId: number, required: number, notes: string | null) {
    if (this.needRows.some((n) => n.company === company && n.licenseId === licenseId)) return false;
    this.needRows.push({ company, licenseId, required, notes });
    return true;
  }
  async updateNeed(company: string, licenseId: number, required: number, notes: string | null) {
    const n = this.needRows.find((x) => x.company === company && x.licenseId === licenseId);
    if (n) Object.assign(n, { required, notes });
    return !!n;
  }
  async deleteNeed(company: string, licenseId: number) {
    const before = this.needRows.length;
    this.needRows = this.needRows.filter((x) => !(x.company === company && x.licenseId === licenseId));
    return before !== this.needRows.length;
  }
  async dashboard(company: string, today: string): Promise<DashboardRow[]> {
    const all = await this.holders([company]);
    return (await this.needs([company])).map((n) => {
      const it = this.itemRows.find((i) => i.id === n.licenseId)!;
      return {
        licenseId: n.licenseId,
        licenseName: n.licenseName,
        script: it.script,
        logoPath: it.logoPath,
        months: it.months,
        required: n.required,
        notes: n.notes,
        valid: all.filter((h) => h.licenseId === n.licenseId && h.active && h.inService && !!h.nextTrainingDate && h.nextTrainingDate >= today).length,
      };
    });
  }
  private full(h: (typeof this.holderRows)[number]): HolderRow {
    const it = this.itemRows.find((i) => i.id === h.licenseId)!;
    const p = this.people.get(h.empNo);
    return {
      ...h,
      licenseName: it.name,
      months: it.months,
      name: p?.name ?? null,
      dept: p?.dept ?? null,
      bossId: p?.bossId ?? null,
      inService: !!p?.inService,
    };
  }
  async holders(companies: string[], licenseId?: number) {
    return this.holderRows
      .filter(
        (h) =>
          companies.includes(h.company) && (licenseId === undefined || h.licenseId === licenseId) && this.itemRows.find((i) => i.id === h.licenseId)?.active,
      )
      .map((h) => this.full(h));
  }
  async holder(id: number) {
    const h = this.holderRows.find((x) => x.id === id);
    return h ? this.full(h) : null;
  }
  async person(empNo: string) {
    return this.people.get(empNo) ?? null;
  }
  async createHolder(empNo: string, licenseId: number, input: HolderWrite): Promise<CreateHolderResult> {
    const same = this.holderRows.filter((h) => h.empNo === empNo && h.licenseId === licenseId && h.company === input.company);
    if (same.some((h) => h.active)) return { ok: false, reason: 'duplicate' };
    if (same[0]) {
      Object.assign(same[0], this.write(input), { active: true });
      return { ok: true, id: same[0].id, reactivated: true };
    }
    const id = ++this.seq;
    this.holderRows.push({ id, licenseId, empNo, active: true, ...this.write(input) });
    return { ok: true, id, reactivated: false };
  }
  private write(i: HolderWrite) {
    return {
      company: i.company,
      trainingDate: i.trainingDate,
      gatDate: i.gatDate,
      retrainDate: i.retrainDate,
      nextTrainingDate: i.nextTrainingDate,
      notifyDays: i.notifyDays,
    };
  }
  async updateHolder(id: number, input: HolderWrite) {
    const h = this.holderRows.find((x) => x.id === id && x.active);
    if (h) Object.assign(h, this.write(input));
    return !!h;
  }
  async deactivateHolder(id: number) {
    const h = this.holderRows.find((x) => x.id === id && x.active);
    if (h) h.active = false;
    return !!h;
  }
  async legacyDocs(ids: number[]) {
    return this.legacy.filter((d) => ids.includes(d.holderId));
  }
  async deleteLegacyDoc(holderId: number, empNo: string, fileName: string) {
    const n = this.legacy.length;
    this.legacy = this.legacy.filter((d) => !(d.holderId === holderId && d.empNo === empNo && d.fileName === fileName));
    return n !== this.legacy.length;
  }
  async managers(companies: string[]): Promise<ManagerRow[]> {
    return this.mgr
      .filter((m) => companies.includes(m.company))
      .map((m) => ({ ...m, name: this.people.get(m.empNo)?.name ?? null, dept: null, inService: !!this.people.get(m.empNo)?.inService }));
  }
  async createManager(company: string, empNo: string, sendMail: boolean) {
    if (this.mgr.some((m) => m.company === company && m.empNo === empNo)) return false;
    this.mgr.push({ company, empNo, sendMail });
    return true;
  }
  async updateManagerSendMail(company: string, empNo: string, sendMail: boolean) {
    const m = this.mgr.find((x) => x.company === company && x.empNo === empNo);
    if (m) m.sendMail = sendMail;
    return !!m;
  }
  async deleteManager(company: string, empNo: string) {
    const list = this.mgr.filter((m) => m.company === company);
    if (!list.some((m) => m.empNo === empNo)) return 'not-found' as const;
    if (list.length === 1) return 'last' as const;
    this.mgr = this.mgr.filter((m) => !(m.company === company && m.empNo === empNo));
    return 'ok' as const;
  }
}

class MemoryPortal implements EshFileRepo, ChemicalSdsRepo, EshJobRepo {
  logo = new Map<number, FileRef>();
  docRows: HolderDoc[] = [];
  sdsRows = new Map<string, FileRef>();
  runs: JobRun[] = [];
  logRows: (NotifyLogEntry & { createdAt: string })[] = [];
  private seq = 0;
  async logos(ids: number[]) {
    return new Map([...this.logo].filter(([k]) => ids.includes(k)));
  }
  async setLogo(id: number, f: FileRef) {
    this.logo.set(id, f);
  }
  async deleteLogo(id: number) {
    return this.logo.delete(id);
  }
  async docs(ids: number[]) {
    return this.docRows.filter((d) => ids.includes(d.holderId));
  }
  async addDoc(holderId: number, _emp: string, f: FileRef) {
    const d = { id: ++this.seq, holderId, ...f, createdAt: 'x' };
    this.docRows.push(d);
    return d;
  }
  async deleteDoc(holderId: number, docId: number) {
    const n = this.docRows.length;
    this.docRows = this.docRows.filter((d) => !(d.id === docId && d.holderId === holderId));
    return n !== this.docRows.length;
  }
  async sds(ids: string[]) {
    return new Map([...this.sdsRows].filter(([k]) => ids.includes(k)));
  }
  async setSds(id: string, f: FileRef) {
    this.sdsRows.set(id, f);
  }
  async deleteSds(id: string) {
    return this.sdsRows.delete(id);
  }
  async start(r: { job: JobName; trigger: JobRun['trigger']; runKey: string; requestedBy: string | null; scope: string }) {
    const old = this.runs.find((x) => x.runKey === r.runKey);
    if (old) {
      if (old.status !== 'failed') return null;
      old.status = 'running';
      return old.id;
    }
    const id = ++this.seq;
    this.runs.unshift({ id, ...r, status: 'running', summary: null, startedAt: new Date().toISOString(), finishedAt: null });
    return id;
  }
  async finish(id: number, status: 'ok' | 'failed', summary: string) {
    Object.assign(
      this.runs.find((r) => r.id === id)!,
      { status, summary, finishedAt: 'x' },
    );
  }
  async addLogs(e: NotifyLogEntry[]) {
    this.logRows.push(...e.map((x) => ({ ...x, createdAt: 'x' })));
  }
  async recentRuns(job: JobName, limit: number) {
    return this.runs.filter((r) => r.job === job).slice(0, limit);
  }
  async manualRunsSince(job: JobName, since: Date) {
    return this.runs.filter((r) => r.job === job && r.trigger === 'manual' && new Date(r.startedAt) >= since);
  }
  async logs(runId: number) {
    return this.logRows.filter((l) => l.runId === runId);
  }
}

const ADMIN = 'S100001';
const person = (empNo: string, over: Partial<Person> = {}): Person => ({
  empNo,
  name: `員工${empNo}`,
  dept: 'S4130',
  bossId: 'S090001',
  inService: true,
  ...over,
});

function seed(repo: MemoryEsh, portal: MemoryPortal) {
  Object.assign(repo, new MemoryEsh());
  Object.assign(portal, new MemoryPortal());
  repo.mgr = [
    { company: '碩禾', empNo: ADMIN, sendMail: true },
    { company: '碩禾', empNo: 'S100002', sendMail: false },
    { company: '國碩', empNo: 'S200001', sendMail: true },
  ];
  repo.itemRows = [
    { id: 7, name: '有機溶劑作業主管', months: 36, script: '<p>依法<script>alert(1)</script></p>', logoPath: '有機溶劑.bmp', active: true },
    { id: 8, name: '急救人員', months: 36, script: null, logoPath: null, active: true },
    { id: 64, name: 'ISO45001 內部稽核人員', months: 9999999, script: null, logoPath: null, active: true },
  ];
  repo.needRows = [
    { company: '碩禾', licenseId: 7, required: 3, notes: null },
    { company: '碩禾', licenseId: 8, required: 1, notes: null },
    { company: '國碩', licenseId: 7, required: 1, notes: null },
  ];
  for (const e of [ADMIN, 'S100002', 'S200001', 'S300001', 'S300002', 'S300003', 'S090001']) repo.people.set(e, person(e));
  repo.people.set('S399999', person('S399999', { inService: false }));
  const h = (id: number, empNo: string, licenseId: number, next: string | null, company = '碩禾', notifyDays: number | null = 90, active = true) =>
    repo.holderRows.push({
      id,
      licenseId,
      empNo,
      company,
      trainingDate: '2023-01-01',
      gatDate: null,
      retrainDate: null,
      nextTrainingDate: next,
      notifyDays,
      active,
    });
  h(1, 'S300001', 7, '2027-12-31'); // 有效
  h(2, 'S300002', 7, '2026-11-30'); // 有效、需通知(38 天)
  h(3, 'S300003', 7, '2026-09-30'); // 已失效
  h(4, 'S399999', 7, '2028-01-01'); // 離職
  h(5, 'S300001', 8, '2026-11-01', '碩禾', 0); // 不追蹤
  h(6, 'S300003', 7, '2026-11-15', '國碩'); // 國碩、需通知
  repo.legacy = [
    { holderId: 1, empNo: 'S300001', fileName: 'S4130-有機溶劑.pdf' },
    { holderId: 1, empNo: 'OTHER', fileName: '別人的.pdf' },
  ];
}

describe('ESH 證照規則', () => {
  it('下次複訓日由後端計算', () => {
    assert.equal(nextTrainingDate({ trainingDate: '2026-09-01', gatDate: '2026-10-02', retrainDate: null }, 36), '2029-10-01', '取最晚的日期');
    assert.equal(nextTrainingDate({ trainingDate: '2015-10-19', gatDate: '2015-11-28', retrainDate: '2025-03-20' }, 24), '2027-03-19');
    assert.equal(nextTrainingDate({ trainingDate: '2024-01-31', gatDate: null, retrainDate: null }, 1), '2024-02-28', '月底對齊(同 DATEADD)後減 1 天');
    assert.equal(nextTrainingDate({ trainingDate: '2020-01-01', gatDate: null, retrainDate: null }, 9999999), '2100-01-01', '永久');
    assert.equal(nextTrainingDate({ trainingDate: null, gatDate: null, retrainDate: null }, 36), null, '沒有日期');
    assert.equal(nextTrainingDate({ trainingDate: '2020-01-01', gatDate: null, retrainDate: null }, 0), null, '有效期未設定');
    assert.equal(addMonths('2024-12-15', 2), '2025-02-15');
  });

  it('人員證照狀態', () => {
    const s = (next: string | null, notifyDays = 90, inService = true) => holderStatus({ nextTrainingDate: next, notifyDays, inService }, TODAY);
    assert.equal(s('2027-12-31'), 'ok');
    assert.equal(s('2026-11-30'), 'notify');
    assert.equal(s(TODAY), 'notify', '當天到期仍為需通知(0 ≤ 距離)');
    assert.equal(s('2026-10-22'), 'expired');
    assert.equal(s(null), 'unset');
    assert.equal(s('2027-12-31', 90, false), 'left', '離職優先');
    assert.equal(s('2026-11-30', 0), 'ok', '通知天數 0 不提醒');
  });

  it('符合度與舊站連結', () => {
    assert.equal(complianceRatio(2, 3), 66);
    assert.equal(complianceRatio(2, 0), 200, '應有為 0 時分母用 1');
    assert.equal(legacyFileUrl('http://old/PortalSolar', 'License', '..\\..\\a b.pdf'), 'http://old/PortalSolar/EHS/License/a%20b.pdf', '只取檔名');
    assert.equal(legacyFileUrl(null, 'License', 'a.pdf'), null);
    assert.equal(safeHttpUrl('javascript:alert(1)'), null);
    assert.equal(safeHttpUrl('http://10.10.130.190/SDSFILES/a.pdf'), 'http://10.10.130.190/SDSFILES/a.pdf');
  });
});

describe('ESH 證照管理 API', () => {
  let t: TestApp;
  const repo = new MemoryEsh();
  const portal = new MemoryPortal();
  const mailer = new DryRunMailer();
  let now = new Date('2026-10-23T02:00:00Z');
  const license = new EshLicenseService(repo, portal, 'http://old/PortalSolar', () => TODAY);
  const notify = new EshNotifyService(repo, portal, mailer, license, () => now);
  const chemRepo = { list: async () => ({ total: 0, items: [] }), get: async () => null, components: async () => new Map(), replace: async () => undefined };
  const chemical = new EshChemicalService(chemRepo, portal, null, portal, { sdsBaseUrl: null, legacyPortalUrl: null, syncMonths: 13 });
  const services: EshServices = { license, notify, chemical };
  const call = async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object, claims: Record<string, unknown> = {}) =>
    t.app.inject({
      method,
      url,
      ...(payload ? { payload } : {}),
      headers: { 'x-internal-token': await t.token({ sub: ADMIN, emp: ADMIN, roles: ['portal-esh-admin'], ...claims }) },
    });
  const q = (s: string) => encodeURIComponent(s);

  before(async () => {
    t = await testApp({ esh: services });
  });
  after(() => t.close());
  beforeEach(() => {
    seed(repo, portal);
    mailer.sent.length = 0;
    now = new Date('2026-10-23T02:00:00Z');
  });

  it('非管理員直接開證照頁', async () => {
    const noRole = await call('GET', '/v1/esh/dashboard', undefined, { roles: [] });
    assert.equal(noRole.statusCode, 403);
    assert.equal(noRole.json().code, 'PORTAL_DATA_ACCESS_DENIED');
    // 有角色但不在 LicenseManagerInfo:清單為空、寫入 403
    const other = { sub: 'S999', emp: 'S999' };
    assert.deepEqual((await call('GET', '/v1/esh/dashboard', undefined, other)).json(), { companies: [], company: null, items: [] });
    assert.equal((await call('GET', '/v1/esh/items', undefined, other)).statusCode, 403, '證照項目也要是某公司的管理員');
    assert.equal((await call('POST', '/v1/esh/items', { name: 'x', months: 12 }, other)).statusCode, 403);
  });

  it('公司證照符合度', async () => {
    const j = (await call('GET', `/v1/esh/dashboard?company=${q('碩禾')}`)).json();
    assert.deepEqual(j.companies, ['碩禾']);
    const it7 = j.items.find((x: { licenseId: number }) => x.licenseId === 7);
    assert.equal(it7.valid, 2, '已失效、離職不算有效');
    assert.equal(it7.required, 3);
    assert.equal(it7.ratio, 66);
    assert.equal(it7.ok, false);
    assert.doesNotMatch(it7.description, /script/, '描述清洗');
    assert.equal(it7.legacyLogoUrl, 'http://old/PortalSolar/EHS/License/%E6%9C%89%E6%A9%9F%E6%BA%B6%E5%8A%91.bmp');
    const r = await call('GET', `/v1/esh/dashboard?company=${q('國碩')}`);
    assert.equal(r.statusCode, 403, '範圍外公司(舊版後端不驗證)');
  });

  it('查看某證照的持證人', async () => {
    const j = (await call('GET', `/v1/esh/dashboard/holders?company=${q('碩禾')}&licenseId=7`)).json();
    assert.deepEqual(
      j.items.map((h: { id: number }) => h.id),
      [1, 2],
    );
    const docs = j.items[0].docs;
    assert.equal(docs.length, 1, '舊站影本以 ID + 工號對應');
    assert.equal(docs[0].kind, 'legacy');
    assert.equal((await call('GET', `/v1/esh/dashboard/holders?company=${q('國碩')}&licenseId=7`)).statusCode, 403);
  });

  it('維護證照項目', async () => {
    const r = await call('POST', '/v1/esh/items', { name: ' 堆高機操作人員 ', months: 36, description: '<p onclick="x()">說明</p><script>x</script>' });
    assert.equal(r.statusCode, 201);
    assert.equal(r.json().name, '堆高機操作人員');
    assert.equal(repo.itemRows.at(-1)!.script, '<p>說明</p>', '寫入前清洗');
    assert.equal((await call('POST', '/v1/esh/items', { name: '堆高機操作人員', months: 12 })).json().code, 'PORTAL_ESH_ITEM_DUPLICATE');
    assert.equal((await call('POST', '/v1/esh/items', { name: '   ', months: 12 })).statusCode, 400, '空白名稱');
    assert.equal((await call('POST', '/v1/esh/items', { name: 'A', months: 0 })).statusCode, 400);
    assert.equal((await call('POST', '/v1/esh/items', { name: '<b>', months: 1 })).statusCode, 400);
    // 舊站 HtmlDecode / 單引號屬性輸出:清洗後仍會還原成標籤或跳出屬性的內容拒收
    for (const d of [
      '&lt;img src=x onerror=alert(1)&gt;',
      "<p>x' onmouseover='alert(1)</p>",
      '<img src="data:image/png;base64,AAAA" alt="&quot; onerror=&quot;x">',
    ])
      assert.equal((await call('POST', '/v1/esh/items', { name: `舊站相容${d.length}`, months: 1, description: d })).statusCode, 400, d);
    const perm = (await call('POST', '/v1/esh/items', { name: '永久證照', permanent: true })).json();
    assert.equal(perm.permanent, true);
    assert.equal(repo.itemRows.at(-1)!.months, 9999999, '永久沿用舊資料值');
  });

  it('編輯時也檢查重名', async () => {
    assert.equal((await call('PUT', '/v1/esh/items/8', { name: '有機溶劑作業主管', months: 36 })).json().code, 'PORTAL_ESH_ITEM_DUPLICATE');
    assert.equal((await call('PUT', '/v1/esh/items/8', { name: '急救人員', months: 24 })).statusCode, 200, '改自己不算重名');
    const used = await call('DELETE', '/v1/esh/items/8');
    assert.equal(used.json().code, 'PORTAL_ESH_ITEM_IN_USE', '仍有需求 / 持證人不能刪(避免其他公司資料消失)');
    repo.needRows = repo.needRows.filter((n) => n.licenseId !== 8);
    repo.holderRows = repo.holderRows.filter((h) => h.licenseId !== 8);
    assert.equal((await call('DELETE', '/v1/esh/items/8')).statusCode, 204);
    assert.equal(repo.itemRows.find((i) => i.id === 8)!.active, false, '軟刪除');
    assert.equal((await call('PUT', '/v1/esh/items/8', { name: '急救人員', months: 24 })).statusCode, 404);
  });

  it('上傳證照 Logo', async () => {
    const r = await call('PUT', '/v1/esh/items/7/logo', { fileId: UUID.toUpperCase(), fileName: 'logo.png' });
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().logo.fileId, UUID);
    assert.equal((await call('PUT', '/v1/esh/items/7/logo', { fileId: UUID, fileName: 'a.exe' })).statusCode, 400);
    assert.equal((await call('PUT', '/v1/esh/items/7/logo', { fileId: 'x', fileName: 'a.png' })).statusCode, 400);
    assert.equal((await call('DELETE', '/v1/esh/items/7/logo')).statusCode, 204);
  });

  it('維護公司證照需求', async () => {
    assert.equal((await call('POST', '/v1/esh/needs', { company: '碩禾', licenseId: 64, required: 2 })).statusCode, 201);
    assert.equal((await call('POST', '/v1/esh/needs', { company: '碩禾', licenseId: 64, required: 2 })).json().code, 'PORTAL_ESH_NEED_DUPLICATE');
    assert.equal((await call('POST', '/v1/esh/needs', { company: '國碩', licenseId: 64, required: 2 })).statusCode, 403, '範圍外公司');
    assert.equal((await call('POST', '/v1/esh/needs', { company: '碩禾', licenseId: 999, required: 2 })).statusCode, 404);
    assert.equal((await call('PUT', '/v1/esh/needs/64', { company: '碩禾', required: -1 })).statusCode, 400);
    assert.equal((await call('PUT', '/v1/esh/needs/64', { company: '碩禾', required: 5, notes: '說明' })).statusCode, 204);
    const list = (await call('GET', '/v1/esh/needs')).json();
    assert.ok(
      list.items.every((n: { company: string }) => n.company === '碩禾'),
      '只列範圍內公司',
    );
  });

  it('刪除需求不影響持證人員', async () => {
    assert.equal((await call('DELETE', `/v1/esh/needs/7?company=${q('碩禾')}`)).statusCode, 204);
    const j = (await call('GET', `/v1/esh/holders?company=${q('碩禾')}&licenseId=7`)).json();
    assert.ok(j.items.length > 0);
  });

  it('人員證照清單', async () => {
    const cur = (await call('GET', '/v1/esh/holders')).json();
    assert.deepEqual(cur.items.map((h: { id: number }) => h.id).sort(), [1, 2, 3], '啟用中、在職、需追蹤;不含其他公司');
    const st = Object.fromEntries(cur.items.map((h: { id: number; status: string }) => [h.id, h.status]));
    assert.deepEqual(st, { 1: 'ok', 2: 'notify', 3: 'expired' });
    assert.equal(cur.items.find((h: { id: number }) => h.id === 2).daysLeft, 38);
    assert.ok(!('bossId' in cur.items[0]), '不回傳主管工號');
    const hist = (await call('GET', '/v1/esh/holders?view=history')).json();
    assert.equal(hist.items.find((h: { id: number }) => h.id === 4).status, 'left');
    const untracked = (await call('GET', '/v1/esh/holders?view=untracked')).json();
    assert.deepEqual(
      untracked.items.map((h: { id: number }) => h.id),
      [5],
    );
    assert.equal((await call('GET', `/v1/esh/holders?company=${q('國碩')}`)).statusCode, 403);
  });

  it('新增人員證照', async () => {
    const body = { empNo: 's300002', licenseId: 8, company: '碩禾', gatDate: '2026-10-02', notifyDays: 90 };
    const r = await call('POST', '/v1/esh/holders', body);
    assert.equal(r.statusCode, 201);
    assert.equal(r.json().empNo, 'S300002', '工號轉大寫');
    assert.equal(r.json().nextTrainingDate, '2029-10-01');
    assert.equal((await call('POST', '/v1/esh/holders', body)).json().code, 'PORTAL_ESH_HOLDER_DUPLICATE');
    assert.equal((await call('POST', '/v1/esh/holders', { ...body, empNo: 'S399999' })).json().code, 'PORTAL_ESH_EMP_NOT_ACTIVE', '離職');
    assert.equal((await call('POST', '/v1/esh/holders', { ...body, empNo: 'NOBODY1' })).json().code, 'PORTAL_ESH_EMP_NOT_ACTIVE');
    assert.equal((await call('POST', '/v1/esh/holders', { ...body, company: '國碩' })).statusCode, 403);
    assert.equal((await call('POST', '/v1/esh/holders', { ...body, gatDate: '2026-02-30' })).statusCode, 400);
    // 已刪除的同證照:復原
    await call('DELETE', `/v1/esh/holders/${r.json().id}`);
    const again = await call('POST', '/v1/esh/holders', { ...body, gatDate: '2026-01-10' });
    assert.equal(again.json().id, r.json().id);
    assert.equal(again.json().active, true);
  });

  it('更新人員證照與下次複訓日', async () => {
    const r = await call('PUT', '/v1/esh/holders/3', { company: '碩禾', trainingDate: '2023-01-01', retrainDate: '2026-10-01', notifyDays: 60 });
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().nextTrainingDate, '2029-09-30');
    assert.equal(r.json().status, 'ok');
    const extra = await call('PUT', '/v1/esh/holders/3', { company: '碩禾', retrainDate: '2026-10-01', notifyDays: 1, nextTrainingDate: '2099-01-01' });
    assert.equal(extra.json().nextTrainingDate, '2029-09-30', '不接受前端送下次複訓日(額外欄位不採用)');
    assert.equal((await call('PUT', '/v1/esh/holders/3', { company: '國碩', notifyDays: 1 })).statusCode, 403, '不可改到範圍外公司');
    assert.equal((await call('PUT', '/v1/esh/holders/6', { company: '碩禾', notifyDays: 1 })).statusCode, 403, '範圍外的紀錄');
    assert.equal((await call('PUT', '/v1/esh/holders/3', { company: '碩禾', notifyDays: -1 })).statusCode, 400);
    await call('DELETE', '/v1/esh/holders/3');
    assert.equal((await call('PUT', '/v1/esh/holders/3', { company: '碩禾', notifyDays: 1 })).statusCode, 404, '已刪除不復活');
  });

  it('證照影本經 file-service', async () => {
    const r = await call('POST', '/v1/esh/holders/1/docs', { fileId: UUID, fileName: '證照.pdf' });
    assert.equal(r.statusCode, 201);
    const docs = r.json().docs;
    assert.equal(docs[0].kind, 'file');
    for (const name of ['a.exe', '../a.pdf', 'a‮fdp.exe'])
      assert.equal((await call('POST', '/v1/esh/holders/1/docs', { fileId: UUID, fileName: name })).statusCode, 400, name);
    assert.equal((await call('POST', '/v1/esh/holders/6/docs', { fileId: UUID, fileName: 'a.pdf' })).statusCode, 403);
    assert.equal((await call('DELETE', `/v1/esh/holders/2/docs/${docs[0].id}`)).statusCode, 404, '影本須屬於該人員');
    assert.equal((await call('DELETE', `/v1/esh/holders/1/docs/${docs[0].id}`)).statusCode, 204);
    assert.equal((await call('DELETE', `/v1/esh/holders/1/legacy-docs?fileName=${q('別人的.pdf')}`)).statusCode, 404, '舊站影本須同工號');
    assert.equal((await call('DELETE', `/v1/esh/holders/1/legacy-docs?fileName=${q('S4130-有機溶劑.pdf')}`)).statusCode, 204);
  });

  it('維護證照管理員', async () => {
    const r = await call('POST', '/v1/esh/managers', { company: '碩禾', empNo: 's300001', sendMail: true });
    assert.equal(r.statusCode, 201);
    assert.equal((await call('POST', '/v1/esh/managers', { company: '碩禾', empNo: 'S300001', sendMail: true })).json().code, 'PORTAL_ESH_MANAGER_DUPLICATE');
    assert.equal((await call('POST', '/v1/esh/managers', { company: '碩禾', empNo: 'S399999', sendMail: true })).json().code, 'PORTAL_ESH_EMP_NOT_ACTIVE');
    assert.equal((await call('POST', '/v1/esh/managers', { company: '國碩', empNo: 'S300001', sendMail: true })).statusCode, 403, '新增到範圍外公司');
    assert.equal((await call('PUT', '/v1/esh/managers', { company: '碩禾', empNo: 'S300001', sendMail: false })).statusCode, 204);
    const list = (await call('GET', '/v1/esh/managers')).json();
    assert.ok(list.items.every((m: { company: string }) => m.company === '碩禾'));
  });

  it('不可刪除最後一位管理員', async () => {
    assert.equal((await call('DELETE', `/v1/esh/managers?company=${q('碩禾')}&empNo=S100002`)).statusCode, 204);
    const last = await call('DELETE', `/v1/esh/managers?company=${q('碩禾')}&empNo=${ADMIN}`);
    assert.equal(last.statusCode, 409);
    assert.equal(last.json().code, 'PORTAL_ESH_MANAGER_LAST');
    assert.equal((await call('DELETE', `/v1/esh/managers?company=${q('國碩')}&empNo=S200001`)).statusCode, 403);
  });

  it('手動立即通知', async () => {
    const r = await call('POST', '/v1/esh/notify');
    assert.equal(r.statusCode, 200);
    const j = r.json();
    assert.equal(j.mode, 'dry-run');
    // 碩禾:S300002 需通知 → 本人 + 主管 S090001;管理員 S100001(SendMail)收彙整;國碩的 S300003 不在範圍
    const sent = mailer.sent.map((m) => `${m.templateCode}:${m.empNo}`).sort();
    assert.deepEqual(sent, ['ESH_LICENSE_ADMIN_DIGEST:S100001', 'ESH_LICENSE_RETRAIN:S300002', 'ESH_LICENSE_RETRAIN_BOSS:S090001']);
    const digest = mailer.sent.find((m) => m.templateCode === 'ESH_LICENSE_ADMIN_DIGEST')!.data;
    assert.equal(digest.expiredCount, 1, '已失效列給管理員');
    assert.equal(digest.shortageCount, 1, '有效 2 < 3(急救人員有效 1 = 應有 1)');
    assert.ok(!mailer.sent.some((m) => m.empNo === 'S300003'), '已失效不寄本人');
    assert.equal(portal.logRows.length, 3, '每封寫紀錄');
    assert.ok(portal.logRows.every((l) => l.status === 'dry-run'));
    const again = await call('POST', '/v1/esh/notify');
    assert.equal(again.json().code, 'PORTAL_ESH_NOTIFY_TOO_SOON');
    // 寄送紀錄只看範圍內
    const runs = (await call('GET', '/v1/esh/notify/runs')).json();
    assert.equal(runs.items.length, 1);
    assert.equal(runs.items[0].requestedBy, ADMIN, '本人發起的才回執行者與彙總');
    assert.equal((await call('GET', `/v1/esh/notify/runs/${runs.items[0].id}`)).json().items.length, 3);
    const other = { sub: 'S200001', emp: 'S200001' };
    assert.equal((await call('GET', `/v1/esh/notify/runs/${runs.items[0].id}`, undefined, other)).statusCode, 404, '其他公司管理員看不到');
    portal.runs[0]!.scope = '碩禾|國碩';
    portal.runs[0]!.requestedBy = 'S100002';
    const masked = (await call('GET', '/v1/esh/notify/runs')).json().items[0];
    assert.deepEqual([masked.scope, masked.requestedBy, masked.summary], ['碩禾', null, null], '不透露其他公司與別人的彙總');
  });

  it('API 權限代碼', async () => {
    const doc = (await t.app.inject({ url: '/openapi.json' })).json();
    const declared = new Set((doc['x-permissions'] as { code: string }[]).map((p) => p.code));
    for (const [p, ops] of Object.entries(doc.paths as Record<string, Record<string, { 'x-permission': string }>>).filter(([p]) => p.startsWith('/v1/esh')))
      for (const [m, op] of Object.entries(ops)) {
        assert.ok(declared.has(op['x-permission']), `${m} ${p}`);
        if (m !== 'get') assert.match(op['x-permission'], /\.(edit|send)$/, `寫入 API 用寫入權限:${m} ${p}`);
      }
    const sys = await t.app.inject({
      url: '/v1/esh/chemicals?restrict=列管'.replace('列管', q('列管')),
      headers: { 'x-internal-token': await t.token({ sub: 'client:x', amr: 'api_key' }) },
    });
    assert.equal(sys.statusCode, 403);
  });
});

describe('ESH 複訓通知規則', () => {
  const repo = new MemoryEsh();
  const portal = new MemoryPortal();

  it('排程每週一執行一次', async () => {
    seed(repo, portal);
    const mailer = new DryRunMailer();
    let now = new Date('2026-10-26T01:00:00Z'); // 週一 09:00(台灣)
    const license = new EshLicenseService(repo, portal, null, () => '2026-10-26');
    const svc = new EshNotifyService(repo, portal, mailer, license, () => now);
    const r = await svc.runScheduled();
    assert.ok(r);
    assert.equal(portal.runs[0]!.runKey, 'notify-weekly-2026-10-26');
    assert.ok(
      mailer.sent.some((m) => m.empNo === 'S200001'),
      '排程含全部公司(國碩管理員)',
    );
    now = new Date('2026-10-26T05:00:00Z');
    assert.equal(await svc.runScheduled(), null, '同一週不重複');
    assert.equal(weekKey(new Date('2026-11-01T15:30:00Z')), '2026-10-26', '台灣週日 23:30 仍屬上週');
  });

  it('需求為 0 或未設定的證照不通知', () => {
    seed(repo, portal);
    const h: HolderRow = {
      id: 1,
      licenseId: 64,
      licenseName: 'x',
      months: 36,
      company: '碩禾',
      empNo: 'S1',
      name: null,
      dept: null,
      bossId: 'S1',
      trainingDate: null,
      gatDate: null,
      retrainDate: null,
      nextTrainingDate: '2026-11-01',
      notifyDays: 90,
      active: true,
      inService: true,
    };
    const base = { dashboards: new Map(), admins: [], companies: ['碩禾'], today: TODAY };
    assert.equal(planNotifications({ ...base, holders: [h], needs: [] }).length, 0);
    const msgs = planNotifications({ ...base, holders: [h], needs: [{ company: '碩禾', licenseId: 64, licenseName: 'x', required: 1, notes: null }] });
    assert.deepEqual(
      msgs.map((m) => m.kind),
      ['holder'],
      '主管 = 本人時不重複寄',
    );
  });

  it('Gateway 通知中心介面', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (status: number, body: object) =>
      (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response(JSON.stringify(body), { status });
      }) as unknown as typeof fetch;
    const m = new GatewayNotifyMailer('https://gw.example/', 'key-1', fake(202, { queued: 1, skipped: 0 }));
    assert.equal(await m.send({ templateCode: 'T', empNo: 'S1', data: { a: 1 }, idempotencyKey: 'k' }), 'queued');
    assert.equal(calls[0]!.url, 'https://gw.example/api/notify/send');
    const h = calls[0]!.init.headers as Record<string, string>;
    assert.equal(h['x-api-key'], 'key-1');
    assert.deepEqual(JSON.parse(String(calls[0]!.init.body)).to, { users: ['S1'] }, '以工號逐人寄,不寫死信箱');
    assert.equal(
      await new GatewayNotifyMailer('https://gw', 'k', fake(202, { queued: 0, skipped: 1 })).send({
        templateCode: 'T',
        empNo: 'S1',
        data: {},
        idempotencyKey: 'k',
      }),
      'skipped',
    );
    assert.equal(
      await new GatewayNotifyMailer('https://gw', 'k', fake(200, { code: 'DUPLICATE_REQUEST' })).send({
        templateCode: 'T',
        empNo: 'S1',
        data: {},
        idempotencyKey: 'k',
      }),
      'duplicate',
    );
    await assert.rejects(
      new GatewayNotifyMailer('https://gw', 'k', fake(400, { code: 'VALIDATION_FAILED' })).send({
        templateCode: 'T',
        empNo: 'S1',
        data: {},
        idempotencyKey: 'k',
      }),
    );
  });

  it('單封失敗不中斷其他收件人', async () => {
    seed(repo, portal);
    const mailer = {
      mode: 'gateway' as const,
      n: 0,
      async send() {
        if (this.n++ === 0) throw new Error('SMTP down');
        return 'queued' as const;
      },
    };
    const license = new EshLicenseService(repo, portal, null, () => TODAY);
    const svc = new EshNotifyService(repo, portal, mailer, license, () => new Date('2026-10-23T02:00:00Z'));
    const r = await svc.runManual({ empNo: ADMIN, name: null, dept: null, companies: [], roles: ['portal-esh-admin'] });
    assert.equal(r.counts.failed, 1);
    assert.equal(r.counts.queued, 2);
    assert.equal(portal.logRows.find((l) => l.status === 'failed')!.message, 'SMTP down');
  });

  it('排程器', async () => {
    let now = new Date('2026-10-25T23:00:00Z'); // 台灣週一 07:00
    let n = 0;
    const log = { info: () => undefined, error: () => undefined };
    const s = new EshScheduler([{ name: 'n', due: weeklyAt(1, 8), run: async () => n++ }], log, 1000, () => now);
    assert.deepEqual(await s.tick(), [], '未到 8 點');
    now = new Date('2026-10-26T00:30:00Z');
    assert.deepEqual(await s.tick(), ['n']);
    assert.deepEqual(await s.tick(), [], '同一期不重複');
    assert.equal(n, 1);
    assert.equal(dailyAt(2)(new Date('2026-10-25T18:30:00Z')), '2026-10-26');
    assert.equal(dailyAt(2)(new Date('2026-10-25T17:30:00Z')), null);
  });
});

// ───── 危害性化學品 ─────
const XML = `
<Chemicals_Application_Solar>
<s_RequesterID_txt id="s_RequesterID_txt" dataType="java.lang.String" perDataProId="">S093012</s_RequesterID_txt>
<s_Requester_txt id="s_Requester_txt" dataType="java.lang.String">許淑華</s_Requester_txt>
<s_DeptName_txt id="s_DeptName_txt" dataType="java.lang.String">玻璃材料開發專案</s_DeptName_txt>
<d_CreateDate_txt id="d_CreateDate_txt" dataType="java.lang.String">2023/01/10</d_CreateDate_txt>
<s_UseApplyUserID_txt id="s_UseApplyUserID_txt" dataType="java.lang.String">S100012</s_UseApplyUserID_txt>
<s_CH_ChemicalName id="s_CH_ChemicalName" dataType="java.lang.String">過錳酸鉀 &amp; 其他</s_CH_ChemicalName>
<Input_StorageDept id="Input_StorageDept" list_hidden="" hidden="ab84">S4130_玻璃材料開發專案</Input_StorageDept>
<RB_For id="RB_For" dataType="java.lang.String">2</RB_For>
<s_Reason id="s_Reason" dataType="java.lang.String">研發</s_Reason>
<RB_Attachment id="RB_Attachment" dataType="java.lang.String">0</RB_Attachment>
<description></description>
<user OID="9a53" restriction="1"/>
<RB_Restrict id="RB_Restrict" dataType="java.lang.String">1</RB_Restrict>
<RB_Path id="RB_Path" dataType="java.lang.String">1</RB_Path>
<RB_Type id="RB_Type" dataType="java.lang.String">0</RB_Type>
<RBstate id="RBstate" dataType="java.lang.String">2</RBstate>
<s_Composition_CN1 id="s_Composition_CN1" dataType="java.lang.String">過錳酸鉀</s_Composition_CN1>
<s_Composition_CODE1 id="s_Composition_CODE1" dataType="java.lang.String">-</s_Composition_CODE1>
<s_Composition_CNS1 id="s_Composition_CNS1" dataType="java.lang.String">7722-64-7</s_Composition_CNS1>
<s_Composition_Rate1 id="s_Composition_Rate1" dataType="java.lang.String">&gt;95%</s_Composition_Rate1>
<s_Composition_CN2 id="s_Composition_CN2" dataType="java.lang.String"></s_Composition_CN2>
<Attachment id="Attachment"><attachments><attachment OID="8d" id="x.pdf" name="x.pdf"><permission></permission></attachment></attachments></Attachment>
</Chemicals_Application_Solar>`;

class MemoryChem implements ChemicalRepo {
  rows: ChemicalRow[] = [];
  comps = new Map<string, Component[]>();
  written: ChemicalRecord[][] = [];
  lastQuery: ChemicalQuery | null = null;
  async list(q: ChemicalQuery) {
    this.lastQuery = q;
    const items = this.rows.filter((r) => r.a.RB_Restrict === q.restrict);
    return { total: items.length, items };
  }
  async get(efId: string) {
    return this.rows.find((r) => r.efId === efId) ?? null;
  }
  async components(ids: string[]) {
    return new Map([...this.comps].filter(([k]) => ids.includes(k)));
  }
  async replace(records: ChemicalRecord[]) {
    this.written.push(records);
  }
}

describe('危害性化學品', () => {
  it('解析 BPM 表單欄位', () => {
    const f = parseFieldValues(XML);
    assert.equal(f.s_CH_ChemicalName, '過錳酸鉀 & 其他', '解碼實體');
    assert.equal(f.s_Composition_Rate1, '>95%', '解析保留原值');
    assert.equal(f.Input_StorageDept, 'S4130_玻璃材料開發專案', '有其他屬性的節點');
    assert.ok(!('Attachment' in f) || f.Attachment === '', '巢狀附件節點不取內容');
    const r = buildRecord(
      { serialNumber: 'SHR008_00001609 ', fieldValues: XML, doc: { logicalName: 'SDS.pdf', physicalName: '3344d4', extension: 'pdf' } },
      'http://bpm/SDSFILES',
    );
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.record.efId, 'SHR008_00001609');
    assert.equal(r.record.a.RB_Restrict, '列管');
    assert.equal(r.record.a.RB_For, '其他研發');
    assert.equal(r.record.a.RB_Path, '小量自行採購');
    assert.equal(r.record.a.RBstate, '氣體');
    assert.equal(r.record.a.s_DeptName_txt, '玻璃材料開發專案', '舊版漏寫的欄位');
    assert.equal(r.record.a.s_UseApplyUserID_txt, 'S100012');
    assert.equal(r.record.components.length, 1, '空白成份不寫');
    assert.equal(r.record.components[0]!.s_Composition_Rate, '＞95%', '寫入舊表前 < > 改全形(舊站原樣輸出)');
    assert.equal(r.record.components[0]!.s_Composition_CODE, '-', '登錄碼(舊版漏寫)');
    assert.deepEqual(r.record.sds, { url: 'http://bpm/SDSFILES/3344d4.pdf', logicalName: 'SDS.pdf' });
  });

  it('欄位超長或沒有填表人的表單略過', () => {
    const long = XML.replace('許淑華', '一二三四五六七八九十十一');
    const r = buildRecord({ serialNumber: 'SHR008_1', fieldValues: long, doc: null }, null);
    assert.equal(r.ok, false);
    assert.equal(buildRecord({ serialNumber: 'SHR008_2', fieldValues: '<x/>', doc: null }, null).ok, false);
    assert.equal(buildRecord({ serialNumber: "x';--", fieldValues: XML, doc: null }, null).ok, false);
    const xss = XML.replace('過錳酸鉀 &amp; 其他', '&lt;img src=x onerror=alert(1)&gt;');
    const x = buildRecord({ serialNumber: 'SHR008_3', fieldValues: xss, doc: null }, null);
    assert.ok(x.ok && !/[<>]/.test(x.record.a.s_CH_ChemicalName), '舊站 Label 原樣輸出,< > 不寫入');
    assert.equal(buildRecord({ serialNumber: 'SHR008_4', fieldValues: XML.replace('許淑華', '許\u0007'), doc: null }, null).ok, false, '控制字元略過');
  });

  it('由 BPM 同步', async () => {
    const repo = new MemoryChem();
    const portal = new MemoryPortal();
    const forms: BpmChemicalForm[] = [
      { serialNumber: 'SHR008_1', fieldValues: XML, doc: null },
      { serialNumber: 'SHR008_1', fieldValues: XML, doc: null },
      { serialNumber: 'SHR008_2', fieldValues: '<bad', doc: null },
    ];
    const ranges: string[][] = [];
    const source: ChemicalSource = {
      forms: async (from, to) => {
        ranges.push([from, to]);
        return forms;
      },
    };
    const svc = new EshChemicalService(
      repo,
      portal,
      source,
      portal,
      { sdsBaseUrl: null, legacyPortalUrl: null, syncMonths: 13 },
      () => new Date('2026-10-23T02:00:00Z'),
    );
    const admin = { empNo: 'S1', name: null, dept: null, companies: [], roles: ['portal-esh-admin'] };
    await assert.rejects(svc.syncManual({ ...admin, roles: [] }, {}), /portal-esh-admin/);
    const r = await svc.syncManual(admin, {});
    assert.equal(r.forms, 3);
    assert.equal(r.written, 1, '同一流程序號只寫一次');
    assert.equal(r.skipped.length, 1);
    assert.deepEqual(ranges[0], ['2025-10-01', '2026-10-23'], '預設區間:去年本月 1 日 ~ 今天');
    assert.equal(repo.written.length, 1, '整批一次交易');
    await assert.rejects(svc.syncManual(admin, { from: '2020-01-01', to: '2026-10-23' }), /36/);
    const s = await svc.syncScheduled();
    assert.ok(s);
    assert.equal(s!.from, '2025-09-23', '排程同步最近 13 個月');
    assert.equal(await svc.syncScheduled(), null, '同一天只同步一次');
    portal.runs[0]!.status = 'failed';
    assert.ok(await svc.syncScheduled(), '上次失敗可重跑');
  });

  it('查詢化學品', async () => {
    const repo = new MemoryChem();
    const portal = new MemoryPortal();
    repo.rows = [
      {
        efId: 'A1',
        a: { RB_Restrict: '不列管', s_CH_ChemicalName: '甲', s_UseApplyUserID_txt: 'S1', s_UseDeptID_txt: 'S4130' },
        attachmentFile: 'http://bpm/SDSFILES/a.pdf',
        logicalName: 'a.pdf',
      },
      { efId: 'A2', a: { RB_Restrict: '不列管', s_CH_ChemicalName: '乙' }, attachmentFile: 'javascript:alert(1)', logicalName: 'x' },
      { efId: 'A3', a: { RB_Restrict: '不列管' }, attachmentFile: 'old.pdf', logicalName: null },
    ];
    repo.comps.set('A1', [{ item: 1, cn: '甲成份', en: null, code: null, cas: '1-1-1', formula: null, rate: null }]);
    repo.comps.set('A2', [{ item: 1, cn: '乙成份', en: null, code: null, cas: '2-2-2', formula: null, rate: null }]);
    portal.sdsRows.set('A3', { fileId: UUID, fileName: 'new.pdf' });
    const svc = new EshChemicalService(
      repo,
      portal,
      null,
      portal,
      { sdsBaseUrl: null, legacyPortalUrl: 'http://old/PortalSolar', syncMonths: 13 },
      () => new Date('2026-10-23T02:00:00Z'),
    );
    const r = await svc.list({ restrict: '不列管' });
    assert.equal(repo.lastQuery!.from, '2025/10/01', '日期轉為舊表格式');
    assert.deepEqual(
      r.items[0]!.components.map((c) => c.cn),
      ['甲成份'],
      '成份以化學品 ID 對應',
    );
    assert.deepEqual(
      r.items[1]!.components.map((c) => c.cn),
      ['乙成份'],
    );
    assert.deepEqual(r.items[0]!.sds, { kind: 'url', url: 'http://bpm/SDSFILES/a.pdf', name: 'a.pdf' });
    assert.equal(r.items[1]!.sds, null, '不安全的網址不輸出');
    assert.equal(r.items[2]!.sds!.kind, 'file', '新站上傳的 SDS 優先');
    assert.deepEqual(r.items[0]!.user, { id: 'S1', name: null, dept: 'S4130', deptName: null }, '使用人欄位不錯置');
    await assert.rejects(svc.list({ restrict: '不列管', from: '2026-10-23', to: '2026-01-01' }));
    await assert.rejects(
      svc.setSds({ empNo: 'S1', name: null, dept: null, companies: [], roles: [] }, 'A1', { fileId: UUID, fileName: 'a.pdf' }),
      /portal-esh-admin/,
    );
  });
});

describe('ESH 設定', () => {
  it('寄送方式與排程設定', () => {
    const base = { GW_ENV: 'dev', SERVICE_CODE: 'portal-api', ...DB_ENV };
    const c = loadConfig(base);
    assert.equal(c.esh.notifyMode, 'dry-run', '預設不寄信');
    assert.equal(c.esh.schedule, false, 'dev 預設不排程');
    assert.equal(c.esh.sdsBaseUrl, null);
    assert.equal(
      loadConfig({ ...base, BPM_DB_HOST: '10.10.130.191', BPM_WEB_URL: 'http://10.10.130.191:8080', BPM_DB_USER: 'u', BPM_DB_PASSWORD: 'p' }).esh.sdsBaseUrl,
      'http://10.10.130.191/SDSFILES',
    );
    assert.throws(() => loadConfig({ ...base, ESH_NOTIFY_MODE: 'smtp' }), /ESH_NOTIFY_MODE/);
    assert.throws(() => loadConfig({ ...base, ESH_NOTIFY_MODE: 'gateway' }), /API Key/, 'gateway 模式需要 API Key');
    assert.throws(() => loadConfig({ ...base, ESH_NOTIFY_WEEKDAY: '7' }), /ESH_NOTIFY_WEEKDAY/);
    assert.throws(() => loadConfig({ ...base, ESH_SDS_BASE_URL: 'javascript:x' }), /ESH_SDS_BASE_URL/);
  });
});
