/**
 * docs/Gherkin/home/home.feature、group/news.feature、group/calendar.feature、group/links.feature(測試名稱 = 場景名稱)。
 * 資料存取以記憶體假物件取代。
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { BpmService, type BpmRepo } from '../src/modules/bpm/bpm.js';
import { ContentService, type CalendarPdf, type ContentRepo, type Slide, type SlideInput } from '../src/modules/home/content.js';
import { DashboardService, daysBetween } from '../src/modules/home/dashboard.js';
import { legacyNewsUrl, likeEscape, type HireDateRepo, type LegacyNews, type LegacyNewsRepo } from '../src/modules/home/legacy-repo.js';
import {
  isSafeUrl,
  LinkService,
  type LinkRepo,
  type PersonalLink,
  type PersonalLinkInput,
  type SystemLink,
  type SystemLinkInput,
} from '../src/modules/links/links.js';
import { NoteService, type Note, type NoteRepo } from '../src/modules/notes/notes.js';
import { twParts } from '../src/modules/qa/rules.js';
import { testApp, type TestApp } from './helpers.js';

const UUID = '0bc59e51-9188-4e5d-87eb-6467d178efdd';
const TODAY = twParts().date;
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

class MemoryContent implements ContentRepo {
  slideRows: Slide[] = [];
  cal: CalendarPdf[] = [];
  seq = 0;
  async slides(all: boolean) {
    return this.slideRows.filter((s) => all || s.active);
  }
  async createSlide(input: SlideInput) {
    const s = { id: ++this.seq, ...input };
    this.slideRows.push(s);
    return s;
  }
  async updateSlide(id: number, input: SlideInput) {
    const i = this.slideRows.findIndex((s) => s.id === id);
    if (i < 0) return null;
    this.slideRows[i] = { id, ...input };
    return this.slideRows[i]!;
  }
  async deleteSlide(id: number) {
    const n = this.slideRows.length;
    this.slideRows = this.slideRows.filter((s) => s.id !== id);
    return this.slideRows.length < n;
  }
  async calendars() {
    return [...this.cal].sort((a, b) => a.year - b.year);
  }
  async upsertCalendar(year: number, fileId: string, fileName: string) {
    this.cal = this.cal.filter((c) => c.year !== year);
    const c = { year, fileId, fileName, updatedAt: new Date().toISOString() };
    this.cal.push(c);
    return c;
  }
  async deleteCalendar(year: number) {
    const n = this.cal.length;
    this.cal = this.cal.filter((c) => c.year !== year);
    return this.cal.length < n;
  }
}

class MemoryLinks implements LinkRepo {
  sys: SystemLink[] = [];
  mine: (PersonalLink & { emp: string })[] = [];
  seq = 0;
  async systemLinks(all: boolean) {
    return this.sys.filter((s) => all || s.active).sort((a, b) => a.sort - b.sort || a.id - b.id);
  }
  async createSystemLink(input: SystemLinkInput) {
    const s = { id: ++this.seq, ...input };
    this.sys.push(s);
    return s;
  }
  async updateSystemLink(id: number, input: SystemLinkInput) {
    const i = this.sys.findIndex((s) => s.id === id);
    if (i < 0) return null;
    this.sys[i] = { id, ...input };
    return this.sys[i]!;
  }
  async deleteSystemLink(id: number) {
    const n = this.sys.length;
    this.sys = this.sys.filter((s) => s.id !== id);
    return this.sys.length < n;
  }
  async personalLinks(emp: string) {
    return this.mine
      .filter((l) => l.emp === emp)
      .sort((a, b) => a.sort - b.sort || a.id - b.id)
      .map(({ emp: _e, ...l }) => l);
  }
  async createPersonalLink(emp: string, input: PersonalLinkInput, sort: number) {
    const l = { id: ++this.seq, emp, sort, ...input };
    this.mine.push(l);
    return { id: l.id, name: l.name, url: l.url, sort };
  }
  async updatePersonalLink(emp: string, id: number, input: PersonalLinkInput) {
    const l = this.mine.find((x) => x.id === id && x.emp === emp);
    if (!l) return null;
    Object.assign(l, input);
    return { id, name: l.name, url: l.url, sort: l.sort };
  }
  async deletePersonalLink(emp: string, id: number) {
    const n = this.mine.length;
    this.mine = this.mine.filter((x) => !(x.id === id && x.emp === emp));
    return this.mine.length < n;
  }
  async reorderPersonalLinks(emp: string, ids: readonly number[]) {
    ids.forEach((id, i) => {
      const l = this.mine.find((x) => x.id === id && x.emp === emp);
      if (l) l.sort = (i + 1) * 10;
    });
  }
}

class MemoryNews implements LegacyNewsRepo, HireDateRepo {
  items: LegacyNews[] = [{ id: 'g1', title: '舊公告', type: '最新消息', date: '2026-10-01', url: null }];
  calls: { today: string; q?: string; offset: number; limit: number }[] = [];
  hire: Record<string, string> = {};
  fail = false;
  async list(opts: { today: string; q?: string; offset: number; limit: number }) {
    this.calls.push(opts);
    if (this.fail) throw new Error('db down');
    return { total: this.items.length, items: this.items.slice(opts.offset, opts.offset + opts.limit) };
  }
  async hireDate(emp: string) {
    return this.hire[emp] ?? null;
  }
}

class MemoryNotes implements NoteRepo {
  rows: Note[] = [];
  async list() {
    return this.rows;
  }
  async count() {
    return this.rows.length;
  }
  async create(): Promise<Note> {
    throw new Error('not used');
  }
  async update() {
    return null;
  }
  async remove() {
    return false;
  }
}

const bpmRepo = (pending: number, unclosed: number, fail = false): BpmRepo =>
  ({
    user: async () => {
      if (fail) throw new Error('nana down');
      return { oid: 'u1', id: 'S112009', name: 'x' } as never;
    },
    todos: async () => Array.from({ length: pending }, (_, i) => ({ workItemState: 1, workItemOid: `w${i}`, processOid: `p${i}` }) as never),
    requested: async () => ({ total: unclosed, rows: [] }),
    openActivities: async () => new Map(),
    close: async () => undefined,
  }) as unknown as BpmRepo;

const note = (over: Partial<Note>): Note => ({
  id: 1,
  title: '繳交報告',
  content: null,
  category: '個人筆記',
  priority: 'high',
  dueDate: TODAY,
  done: false,
  createdAt: '',
  updatedAt: '',
  ...over,
});

const slideIn = (over: Partial<SlideInput> = {}): SlideInput => ({
  kind: 'policy',
  title: '員工行為準則',
  fileId: UUID,
  linkUrl: null,
  startDate: null,
  endDate: null,
  sort: 10,
  active: true,
  ...over,
});

describe('首頁聚合', () => {
  let t: TestApp;
  const content = new MemoryContent();
  const links = new MemoryLinks();
  const news = new MemoryNews();
  const notes = new MemoryNotes();
  const onboard = { status: async () => ({ readAt: null as string | null, passedAt: null as string | null }) };
  let bpm = new BpmService(bpmRepo(2, 1), 'http://bpm.example:8080', ['碩禾']);
  const call = async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object, emp = 'S112009', cos = ['碩禾']) =>
    t.app.inject({ method, url, ...(payload ? { payload } : {}), headers: { 'x-internal-token': await t.token({ sub: emp, emp, dept: 'S1800', cos }) } });
  const dashboard = () =>
    new DashboardService({
      bpm,
      qa: { pending: async () => [{ qaNo: 'Q1', title: '滿意度調查', dept: null, startDate: '2026-10-01', endDate: '2026-10-31', questionCount: 3 }] } as never,
      onboarding: onboard,
      hireDates: news,
      notes: new NoteService(notes),
      links: new LinkService(links),
      news,
      content: new ContentService(content),
    });

  before(async () => {
    t = await testApp({
      content: new ContentService(content),
      links: new LinkService(links),
      legacyNews: news,
      // 每次請求重新組(測試中會切換 BPM 假物件)
      dashboard: { build: (me: never, log: never) => dashboard().build(me, log) } as never,
    });
  });
  after(() => t.close());
  beforeEach(() => {
    content.slideRows = [];
    content.cal = [];
    links.sys = [];
    links.mine = [];
    news.fail = false;
    news.calls = [];
    news.hire = {};
    notes.rows = [];
    onboard.status = async () => ({ readAt: null, passedAt: null });
    bpm = new BpmService(bpmRepo(2, 1), 'http://bpm.example:8080', ['碩禾']);
  });

  it('首屏聚合回應各區塊', async () => {
    news.hire.S112009 = addDays(TODAY, -30);
    notes.rows = [note({ id: 1 }), note({ id: 2, done: true }), note({ id: 3, dueDate: addDays(TODAY, 1) })];
    links.mine = [{ id: 9, emp: 'S112009', name: '報修', url: 'https://it.example/', sort: 10 }];
    content.slideRows = [
      { id: 1, ...slideIn() },
      { id: 2, ...slideIn({ kind: 'gallery', title: '竣工' }) },
      { id: 3, ...slideIn({ title: '過期', endDate: addDays(TODAY, -1) }) },
      { id: 4, ...slideIn({ title: '未開始', startDate: addDays(TODAY, 1) }) },
      { id: 5, ...slideIn({ title: '停用', active: false }) },
    ];
    const r = await call('GET', '/v1/dashboard');
    assert.equal(r.statusCode, 200);
    const j = r.json();
    assert.deepEqual(
      j.todos.items.map((x: { kind: string; title: string }) => [x.kind, x.title]),
      [
        ['bpm-pending', 'BPM 待簽核 2 筆'],
        ['bpm-unclosed', 'BPM 未結案 1 筆'],
        ['qa', '問卷:滿意度調查'],
        ['onboarding-read', '新人導覽:請閱讀小叮嚀'],
        ['onboarding-quiz', '新人導覽:請完成驗收測驗'],
        ['note', '提醒:繳交報告'],
      ],
    );
    assert.equal(j.todos.items[0].href, 'http://bpm.example:8080/NaNaWeb/', '前往簽核以深連結到 BPM(D-24)');
    assert.deepEqual(j.secretary.bpm, { pending: 2, abnormal: 0, unclosed: 1, hasAccount: true, homeUrl: 'http://bpm.example:8080/NaNaWeb/' });
    assert.deepEqual(
      j.secretary.links.map((l: PersonalLink) => l.name),
      ['報修'],
    );
    assert.equal(j.news.items[0].title, '舊公告');
    assert.equal(news.calls[0]!.today, TODAY.replaceAll('-', '/'), '舊表日期為 yyyy/MM/dd 字串');
    assert.deepEqual(
      j.slides.policy.map((s: Slide) => s.title),
      ['員工行為準則'],
      '只顯示期間內、啟用中',
    );
    assert.equal(j.slides.gallery.length, 1);
    assert.deepEqual(j._meta, { errors: [], unavailable: ['todos.consent'] });
  });

  it('新人導覽提醒只對到職 90 天內且未完成者', async () => {
    const kinds = async () => (await call('GET', '/v1/dashboard')).json().todos.items.map((x: { kind: string }) => x.kind);
    assert.ok(!(await kinds()).includes('onboarding-read'), '查無到職日不提醒');
    news.hire.S112009 = addDays(TODAY, -91);
    assert.ok(!(await kinds()).includes('onboarding-read'), '超過 90 天');
    news.hire.S112009 = addDays(TODAY, -90);
    onboard.status = async () => ({ readAt: '2026-10-01', passedAt: null });
    assert.deepEqual(
      (await kinds()).filter((k: string) => k.startsWith('onboarding')),
      ['onboarding-quiz'],
    );
    onboard.status = async () => ({ readAt: '2026-10-01', passedAt: '2026-10-02' });
    assert.ok(!(await kinds()).some((k: string) => k.startsWith('onboarding')), '已完成不提醒');
    assert.equal(daysBetween('2026-01-01', '2026-03-01'), 59);
  });

  it('部分區塊失敗不影響其他區塊', async () => {
    bpm = new BpmService(bpmRepo(0, 0, true), 'http://bpm.example:8080', ['碩禾']);
    news.fail = true;
    const r = await call('GET', '/v1/dashboard');
    assert.equal(r.statusCode, 200);
    const j = r.json();
    assert.deepEqual(j._meta.errors.map((e: { section: string }) => e.section).sort(), ['bpm', 'news']);
    assert.ok(!JSON.stringify(j._meta.errors).includes('down'), '不回傳內部錯誤細節');
    assert.equal(j.secretary.bpm, null);
    assert.equal(j.news, null);
    assert.equal(j.todos.items[0].kind, 'qa', '其他待辦照常');
    assert.ok(Array.isArray(j.slides.policy));
  });

  it('BPM 只對碩禾系公司查詢', async () => {
    const r = (await call('GET', '/v1/dashboard', undefined, 'S112009', ['禾迅'])).json();
    assert.equal(r.secretary.bpm, null);
    assert.ok(r._meta.unavailable.includes('bpm'), '其他公司本機帳號不查 BPM(D-29)');
    assert.ok(!r.todos.items.some((x: { kind: string }) => x.kind.startsWith('bpm')));
    const svc = new DashboardService({ bpm: new BpmService(bpmRepo(2, 1), 'http://bpm.example:8080', []) });
    const d = await svc.build({ empNo: 'S1', name: null, dept: null, companies: ['碩禾'] }, { error: () => undefined });
    assert.ok(d._meta.unavailable.includes('bpm'), '未設定公司清單時不查');
  });

  it('沒有任何待辦', async () => {
    bpm = new BpmService(bpmRepo(0, 0), 'http://bpm.example:8080', ['碩禾']);
    const svc = new DashboardService({ bpm });
    const d = await svc.build({ empNo: 'S1', name: null, dept: null, companies: ['碩禾'] }, { error: () => undefined });
    assert.deepEqual(d.todos.items, []);
    assert.deepEqual(d._meta.unavailable, ['todos.qa', 'todos.onboarding', 'todos.consent', 'todos.notes', 'secretary.links', 'news', 'slides']);
  });

  it('舊入口網公告唯讀併入', async () => {
    news.items = Array.from({ length: 25 }, (_, i) => ({ id: `g${i}`, title: `公告${i}`, type: '最新消息', date: null, url: null }));
    const r = await call('GET', '/v1/news/legacy?page=2&pageSize=10&q=%25');
    assert.equal(r.statusCode, 200);
    const j = r.json();
    assert.deepEqual([j.total, j.page, j.pageSize, j.items[0].id], [25, 2, 10, 'g10']);
    assert.equal(news.calls.at(-1)!.q, '%');
    assert.equal((await call('GET', '/v1/news/legacy?pageSize=101')).statusCode, 400);
    assert.equal(likeEscape('100%_[a]'), '100[%][_][[]a]');
    assert.equal(legacyNewsUrl('http://old.example/PortalSolar', 'NotesPublic/N2610005.html'), 'http://old.example/PortalSolar/html/NotesPublic/N2610005.html');
    assert.equal(
      legacyNewsUrl('http://old.example/PortalSolar', `PublicContentX.aspx?GUID=${UUID}`),
      `http://old.example/PortalSolar/html/PublicContentX.aspx?GUID=${UUID}`,
    );
    assert.equal(legacyNewsUrl('http://old.example', 'javascript:alert(1)'), null, '路徑不合格不組網址');
    assert.equal(legacyNewsUrl('http://old.example', 'NotesPublic/../web.config'), null, '不可往上層');
    assert.equal(legacyNewsUrl(null, 'NotesPublic/N1.html'), null, '未設定舊站網址不帶連結');
  });

  it('維護首頁輪播', async () => {
    const c = await call('POST', '/v1/home/slides', { ...slideIn({ fileId: UUID.toUpperCase() }), linkUrl: '/news' });
    assert.equal(c.statusCode, 201);
    assert.equal(c.json().fileId, UUID, 'UUID 轉小寫');
    const id = c.json().id;
    assert.equal((await call('PUT', `/v1/home/slides/${id}`, slideIn({ active: false }))).json().active, false);
    assert.equal((await call('GET', '/v1/home/slides')).json().items.length, 1, '維護清單含停用');
    assert.equal((await call('PUT', '/v1/home/slides/999', slideIn())).statusCode, 404);
    for (const bad of [
      slideIn({ fileId: 'not-uuid' }),
      slideIn({ linkUrl: 'javascript:alert(1)' }),
      slideIn({ startDate: '2026-10-10', endDate: '2026-10-01' }),
      { ...slideIn(), kind: 'other' },
      { ...slideIn(), title: '  ' },
    ]) {
      assert.equal((await call('POST', '/v1/home/slides', bad)).statusCode, 400, JSON.stringify(bad));
    }
    assert.equal((await call('DELETE', `/v1/home/slides/${id}`)).statusCode, 204);
    assert.equal((await call('DELETE', `/v1/home/slides/${id}`)).statusCode, 404);
  });

  it('依年度切換行事曆', async () => {
    assert.equal((await call('PUT', '/v1/calendar/2027', { fileId: UUID, fileName: '2027 行事曆.pdf' })).statusCode, 200);
    await call('PUT', '/v1/calendar/2026', { fileId: UUID, fileName: '2026.PDF' });
    await call('PUT', '/v1/calendar/2027', { fileId: UUID, fileName: '2027 修正版.pdf' });
    const items = (await call('GET', '/v1/calendar')).json().items;
    assert.deepEqual(
      items.map((c: CalendarPdf) => [c.year, c.fileName]),
      [
        [2026, '2026.PDF'],
        [2027, '2027 修正版.pdf'],
      ],
      '同年度重新上傳即取代',
    );
    assert.equal((await call('PUT', '/v1/calendar/2027', { fileId: UUID, fileName: 'x.xlsx' })).statusCode, 400, '只接受 PDF');
    assert.equal((await call('PUT', '/v1/calendar/1999', { fileId: UUID, fileName: 'x.pdf' })).statusCode, 400);
    assert.equal((await call('PUT', '/v1/calendar/2027', { fileId: 'x', fileName: 'x.pdf' })).statusCode, 400);
    assert.equal((await call('DELETE', '/v1/calendar/2026')).statusCode, 204);
    assert.equal((await call('DELETE', '/v1/calendar/2026')).statusCode, 404);
  });

  it('DES 跳轉系統只顯示標示', async () => {
    const des = await call('POST', '/v1/links', {
      name: '訂便當',
      category: '行政與流程',
      url: 'http://10.10.130.166/LOS/Main.aspx',
      openMode: 'new',
      legacyDes: true,
      sort: 1,
      active: true,
    });
    assert.equal(des.statusCode, 201);
    assert.equal(des.json().url, null, 'DES 跳轉系統不存網址');
    await call('POST', '/v1/links', {
      name: 'BPM',
      category: '行政與流程',
      url: 'http://bpm.example/NaNaWeb/',
      openMode: 'new',
      legacyDes: false,
      sort: 2,
      active: true,
    });
    await call('POST', '/v1/links', { name: '停用', category: 'x', url: '/x', openMode: 'same', legacyDes: false, sort: 3, active: false });
    const list = (await call('GET', '/v1/links')).json().items as SystemLink[];
    assert.deepEqual(
      list.map((l) => [l.name, l.url, l.legacyDes]),
      [
        ['訂便當', null, true],
        ['BPM', 'http://bpm.example/NaNaWeb/', false],
      ],
    );
    assert.equal((await call('GET', '/v1/links/admin')).json().items.length, 3);
  });

  it('拒絕不安全的網址', async () => {
    for (const url of ['javascript:alert(1)', '//evil.example', 'http://u:p@x.example', 'ftp://x', 'data:text/html,x', '']) {
      const r = await call('POST', '/v1/links', { name: 'x', category: 'x', url, openMode: 'new', legacyDes: false, sort: 0, active: true });
      assert.equal(r.statusCode, 400, url);
    }
    assert.ok(isSafeUrl('https://a.example/b?c=1') && isSafeUrl('/legacy-docs/a.pdf'));
    assert.ok(!isSafeUrl('/\\evil.example') && !isSafeUrl('https://a.example/<script>'));
    assert.equal(
      (await call('PUT', '/v1/links/999', { name: 'x', category: 'x', url: '/x', openMode: 'new', legacyDes: false, sort: 0, active: true })).statusCode,
      404,
    );
  });

  it('個人常用連結只看得到、改得到自己的', async () => {
    const a = (await call('POST', '/v1/personal-links', { name: ' 報修 ', url: 'https://it.example/' })).json();
    const b = (await call('POST', '/v1/personal-links', { name: '請假', url: '/personal/query' })).json();
    const other = (await call('POST', '/v1/personal-links', { name: '別人', url: '/x' }, 'S000002')).json();
    assert.deepEqual([a.name, a.sort, b.sort], ['報修', 10, 20]);
    assert.deepEqual(
      (await call('GET', '/v1/personal-links')).json().items.map((l: PersonalLink) => l.name),
      ['報修', '請假'],
    );
    assert.equal((await call('PUT', `/v1/personal-links/${other.id}`, { name: 'x', url: '/x' })).statusCode, 404);
    assert.equal((await call('DELETE', `/v1/personal-links/${other.id}`)).statusCode, 404);
    assert.equal((await call('POST', '/v1/personal-links', { name: 'x', url: 'javascript:alert(1)' })).statusCode, 400);
    const order = await call('PUT', '/v1/personal-links/order', { ids: [b.id, a.id] });
    assert.deepEqual(
      order.json().items.map((l: PersonalLink) => l.name),
      ['請假', '報修'],
    );
    assert.equal((await call('PUT', '/v1/personal-links/order', { ids: [b.id] })).statusCode, 400, '必須包含全部');
    assert.equal((await call('PUT', '/v1/personal-links/order', { ids: [b.id, other.id] })).statusCode, 400, '不能排別人的');
    assert.equal((await call('PUT', `/v1/personal-links/${a.id}`, { name: '報修單', url: 'https://it.example/new' })).json().name, '報修單');
    assert.equal((await call('DELETE', `/v1/personal-links/${a.id}`)).statusCode, 204);
  });

  it('個人常用連結上限', async () => {
    for (let i = 0; i < 20; i++) await call('POST', '/v1/personal-links', { name: `L${i}`, url: '/x' });
    const r = await call('POST', '/v1/personal-links', { name: 'L21', url: '/x' });
    assert.equal(r.statusCode, 409);
    assert.equal(r.json().code, 'PORTAL_LINK_LIMIT');
  });
});
