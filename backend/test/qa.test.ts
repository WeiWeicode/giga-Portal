/** docs/Gherkin/resources/qa.feature(測試名稱 = 場景名稱);資料以記憶體模擬舊表 QAAnnual / B / C / D */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { sanitizeQaHtml } from '../src/modules/qa/html.js';
import { QaService, type Dept, type ExportRow, type ListFilter, type QaRepo, type Survey, type SurveyWrite, type UpdateMode } from '../src/modules/qa/qa.js';
import {
  buildAnswerRows,
  buildQuestions,
  imageKey,
  inPeriod,
  isTarget,
  LEGACY_TYPE,
  newQaNo,
  parseTargets,
  serializeOptions,
  serializeTargets,
  type AnswerRow,
  type ImageRow,
  type QuestionRow,
} from '../src/modules/qa/rules.js';
import { testApp, type TestApp } from './helpers.js';

/** 2026-10-22 10:00:00(台灣時間) */
const NOW = Date.parse('2026-10-22T02:00:00Z');

interface ARow {
  QANo: string;
  QAName: string;
  QADept: string;
  QAFcontent: string;
  QAEcontent: string;
  start: string | null;
  end: string | null;
  Kdept: string;
  Kpep: string;
  CLgNo: string;
  IsActive: boolean;
}
type BRow = QuestionRow & { QANo: string };
type CRow = { QANo: string; LgNo: string; No: number; Answer: string; QATimes: string };
type DRow = ImageRow & { QANo: string };

class MemoryQa implements QaRepo {
  a: ARow[] = [];
  b: BRow[] = [];
  c: CRow[] = [];
  d: DRow[] = [];
  /** 模擬交易:寫入前失敗時不留下任何資料 */
  failInsert = false;

  private survey(qaNo: string): Survey | null {
    const h = this.a.find((x) => x.QANo === qaNo);
    if (!h) return null;
    return {
      qaNo: h.QANo,
      title: h.QAName,
      dept: h.QADept || null,
      intro: h.QAFcontent,
      outro: h.QAEcontent,
      startDate: h.start,
      endDate: h.end,
      kdept: h.Kdept,
      kpep: h.Kpep,
      creator: h.CLgNo,
      active: h.IsActive,
      questions: buildQuestions(
        this.b.filter((x) => x.QANo === qaNo),
        this.d.filter((x) => x.QANo === qaNo),
      ),
    };
  }
  private respondentsOf = (qaNo: string) => new Set(this.c.filter((x) => x.QANo === qaNo).map((x) => x.LgNo)).size;

  async openSurveys(today: string) {
    return this.a
      .filter((x) => x.IsActive && inPeriod(x.start, x.end, today))
      .map((x) => ({ ...this.survey(x.QANo)!, questionCount: this.b.filter((y) => y.QANo === x.QANo).length }));
  }
  async answered(empNo: string, qaNos: readonly string[]) {
    return new Set(this.c.filter((x) => x.LgNo === empNo && qaNos.includes(x.QANo)).map((x) => x.QANo));
  }
  async get(qaNo: string) {
    return this.survey(qaNo);
  }
  async submit(qaNo: string, empNo: string, answeredAt: string, build: (s: Survey | null, already: boolean) => AnswerRow[]) {
    const rows = build(
      this.survey(qaNo),
      this.c.some((x) => x.QANo === qaNo && x.LgNo === empNo),
    );
    if (this.failInsert) throw new Error('boom');
    this.c.push(...rows.map((r) => ({ QANo: qaNo, LgNo: empNo, No: r.no, Answer: r.answer, QATimes: answeredAt })));
  }
  async list(f: ListFilter, page: number, pageSize: number) {
    const all = this.a
      .filter(
        (x) =>
          x.IsActive && (f.creator === null || x.CLgNo === f.creator) && (!f.q || x.QAName.includes(f.q)) && (!f.today || inPeriod(x.start, x.end, f.today)),
      )
      .map((x) => ({
        qaNo: x.QANo,
        title: x.QAName,
        dept: x.QADept,
        startDate: x.start,
        endDate: x.end,
        creator: x.CLgNo,
        active: x.IsActive,
        questionCount: this.b.filter((y) => y.QANo === x.QANo).length,
        respondents: this.respondentsOf(x.QANo),
      }));
    return { items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length };
  }
  private writeQuestions(qaNo: string, w: SurveyWrite) {
    this.b = this.b.filter((x) => x.QANo !== qaNo);
    for (const q of w.questions)
      this.b.push({
        QANo: qaNo,
        No: q.no,
        Type: LEGACY_TYPE[q.type],
        LimNo: q.limit ?? -1,
        Item: q.text,
        SubItem: serializeOptions(q.options),
        IsWrite: q.required ? 'Y' : 'N',
      });
  }
  private writeImages(qaNo: string, w: SurveyWrite) {
    this.d = this.d.filter((x) => !(x.QANo === qaNo && (x.Item ?? '').startsWith('#')));
    for (const q of w.questions)
      if (q.image)
        this.d.push({
          QANo: qaNo,
          Item: imageKey(q.no),
          FileName: q.image.fileId,
          Position: q.image.position === 'before' ? 0 : 1,
          Width: q.image.width,
          Height: q.image.height,
        });
  }
  async create(qaNo: string, creator: string, w: SurveyWrite) {
    if (this.a.some((x) => x.QANo === qaNo)) return false;
    this.a.push({
      QANo: qaNo,
      QAName: w.title,
      QADept: w.dept,
      QAFcontent: w.intro,
      QAEcontent: w.outro,
      start: w.startDate,
      end: w.endDate,
      Kdept: w.kdept,
      Kpep: w.kpep,
      CLgNo: creator,
      IsActive: true,
    });
    this.writeQuestions(qaNo, w);
    this.writeImages(qaNo, w);
    return true;
  }
  async update(qaNo: string, w: SurveyWrite, guard: (s: Survey | null, n: number) => UpdateMode) {
    const mode = guard(this.survey(qaNo), this.respondentsOf(qaNo));
    const h = this.a.find((x) => x.QANo === qaNo)!;
    Object.assign(h, {
      QAName: w.title,
      QADept: w.dept,
      QAFcontent: w.intro,
      QAEcontent: w.outro,
      start: w.startDate,
      end: w.endDate,
      Kdept: w.kdept,
      Kpep: w.kpep,
    });
    if (mode === 'full') this.writeQuestions(qaNo, w);
    else for (const q of w.questions) this.b.find((x) => x.QANo === qaNo && x.No === q.no)!.Item = q.text;
    this.writeImages(qaNo, w);
  }
  async softDelete(qaNo: string) {
    const h = this.a.find((x) => x.QANo === qaNo && x.IsActive);
    if (h) h.IsActive = false;
    return !!h;
  }
  async copy(from: string, to: string, creator: string, title: string) {
    const h = this.a.find((x) => x.QANo === from)!;
    this.a.push({ ...h, QANo: to, QAName: title, CLgNo: creator, IsActive: true });
    this.b.push(...this.b.filter((x) => x.QANo === from).map((x) => ({ ...x, QANo: to })));
    this.d.push(...this.d.filter((x) => x.QANo === from).map((x) => ({ ...x, QANo: to })));
    return true;
  }
  async respondents(qaNo: string) {
    return this.respondentsOf(qaNo);
  }
  async answerCounts(qaNo: string) {
    const rows = this.c.filter((x) => x.QANo === qaNo);
    const counts = new Map<string, { no: number; answer: string; count: number }>();
    for (const r of rows) {
      const k = `${r.No}\u0000${r.Answer}`;
      counts.set(k, { no: r.No, answer: r.Answer, count: (counts.get(k)?.count ?? 0) + 1 });
    }
    const answeredBy = new Map<number, number>();
    for (const no of new Set(rows.map((r) => r.No))) answeredBy.set(no, new Set(rows.filter((r) => r.No === no && r.Answer.trim()).map((r) => r.LgNo)).size);
    return { respondents: this.respondentsOf(qaNo), counts: [...counts.values()], answeredBy };
  }
  async exportRows(qaNo: string): Promise<ExportRow[]> {
    return this.c
      .filter((x) => x.QANo === qaNo)
      .map((x) => ({
        dept: '資訊部',
        empNo: x.LgNo,
        name: '測試',
        no: x.No,
        question: this.b.find((y) => y.QANo === qaNo && y.No === x.No)?.Item ?? null,
        answer: x.Answer,
        answeredAt: x.QATimes,
      }));
  }
  async departments(): Promise<Dept[]> {
    return [
      { code: 'S1400', name: '製造處', parent: 'GSMC' },
      { code: 'S1420', name: '製造一課', parent: 'S1400' },
    ];
  }
}

/** 舊資料:一份啟用中的問卷(單選、複選上限 2、問答必填、題型空白的舊題) */
function seed(repo: MemoryQa, over: Partial<ARow> = {}) {
  const qa = over.QANo ?? 'Q20261001080000S100001';
  repo.a.push({
    QANo: qa,
    QAName: '滿意度調查',
    QADept: '人力資源部',
    QAFcontent: '<p onclick="x()">說明</p><script>alert(1)</script>',
    QAEcontent: '',
    start: '2026-10-01',
    end: '2026-10-31',
    Kdept: 'S1420,S1430,',
    Kpep: 's112009,',
    CLgNo: 'S100001',
    IsActive: true,
    ...over,
  });
  repo.b.push(
    { QANo: qa, No: 1, Type: '單選題', LimNo: -1, Item: '整體滿意度', SubItem: '滿意●普通●不滿意●', IsWrite: 'Y' },
    { QANo: qa, No: 2, Type: '複選題', LimNo: 2, Item: '想要的課程', SubItem: 'A●B●C●', IsWrite: 'N' },
    { QANo: qa, No: 3, Type: '問答題', LimNo: -1, Item: '建議', SubItem: '', IsWrite: 'Y' },
    { QANo: qa, No: 4, Type: '', LimNo: -1, Item: '舊資料說明', SubItem: '', IsWrite: 'Y' },
  );
  return qa;
}

const input = (over: Record<string, unknown> = {}) => ({
  title: '新問卷',
  dept: '人力資源部',
  intro: '<p>前言</p><img src="https://evil.example/x.png"><a href="javascript:alert(1)">x</a>',
  outro: '',
  startDate: '2026-10-20',
  endDate: '2026-10-31',
  targets: { all: false, depts: ['S1420'], emps: [] },
  questions: [
    { type: 'single', text: 'Q1', options: ['是', '否'], required: true },
    { type: 'multi', text: 'Q2', options: ['A', 'B', 'C'], limit: 2, required: false },
  ],
  ...over,
});

describe('問卷規則', () => {
  it('對象比對:部門完整比對、工號不分大小寫', () => {
    const t = parseTargets('S1420,S1430,      ', 's112009,');
    assert.deepEqual(t, { all: false, depts: ['S1420', 'S1430'], emps: ['s112009'] });
    assert.ok(isTarget(t, 'X', 'S1420'));
    assert.ok(!isTarget(t, 'X', 'S14'), '不做部分比對');
    assert.ok(!isTarget(parseTargets('S14,', ''), 'X', 'S1420'), '舊版 LIKE 會比到 S1420,新版不會');
    assert.ok(isTarget(t, 'S112009', null));
    assert.ok(isTarget(parseTargets('ALL', ''), 'X', null));
    assert.deepEqual(serializeTargets({ all: false, depts: [], emps: ['S1'] }), { kdept: '', kpep: 'S1,' }, '單一工號也加結尾逗號(舊首頁比對得到)');
  });

  it('起訖日含兩端,未設定日期不開放', () => {
    assert.ok(inPeriod('2026-10-22', '2026-10-22', '2026-10-22'));
    assert.ok(!inPeriod(null, '2026-10-30', '2026-10-22'));
    assert.ok(!inPeriod('2026-10-23', '2026-10-30', '2026-10-22'));
  });

  it('新問卷編號 = Q + 台灣時間 + 工號', () => {
    assert.equal(newQaNo('S112009', NOW), 'Q20261022100000S112009');
  });

  it('白名單過濾 HTML', () => {
    const out = sanitizeQaHtml(
      '<p style="color:red;position:fixed" onclick="x()">a</p><script>alert(1)</script><img src="x" onerror="y"><img src="data:image/png;base64,AAAA"><a href="//evil">b</a><iframe src="https://x"></iframe>',
    );
    assert.equal(out, '<p style="color:red">a</p><img src="data:image/png;base64,AAAA" /><a target="_blank" rel="noopener noreferrer">b</a>');
  });
});

describe('問卷調查', () => {
  let t: TestApp;
  const repo = new MemoryQa();
  const call = async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object, emp = 'S112009', dept = 'S1420') =>
    t.app.inject({ method, url, ...(payload ? { payload } : {}), headers: { 'x-internal-token': await t.token({ sub: emp, emp, dept }) } });

  before(async () => {
    t = await testApp({ qa: new QaService(repo, null, () => NOW) });
  });
  after(() => t.close());
  beforeEach(() => {
    repo.a = [];
    repo.b = [];
    repo.c = [];
    repo.d = [];
    repo.failInsert = false;
  });

  it('只列待填問卷', async () => {
    const qa = seed(repo);
    seed(repo, { QANo: 'QB', Kdept: 'S14,', Kpep: '' });
    seed(repo, { QANo: 'QC', Kdept: 'all' });
    seed(repo, { QANo: 'QD', Kdept: 'all', IsActive: false });
    seed(repo, { QANo: 'QE', Kdept: 'all', end: '2026-10-21' });
    repo.c.push({ QANo: 'QC', LgNo: 'S112009', No: 1, Answer: '滿意', QATimes: '' });
    const r = await call('GET', '/v1/qa/pending');
    assert.equal(r.statusCode, 200);
    assert.deepEqual(
      r.json().items.map((x: { qaNo: string }) => x.qaNo),
      [qa],
    );
    assert.equal(r.json().items[0].questionCount, 4);
  });

  it('非對象不可開啟', async () => {
    const qa = seed(repo, { Kdept: 'S9999,', Kpep: '' });
    const r = await call('GET', `/v1/qa/pending/${qa}`);
    assert.equal(r.statusCode, 404);
    assert.equal(r.json().code, 'PORTAL_QA_NOT_FOUND');
    assert.equal((await call('POST', `/v1/qa/pending/${qa}/answers`, { answers: [] })).statusCode, 404, '送出時後端也再檢查');
  });

  it('填答畫面的題目與清洗後的前言', async () => {
    const qa = seed(repo);
    const r = (await call('GET', `/v1/qa/pending/${qa}`)).json();
    assert.equal(r.intro, '<p>說明</p>');
    assert.deepEqual(
      r.questions.map((q: { type: string | null; options: string[]; limit: number | null; required: boolean }) => [q.type, q.options, q.limit, q.required]),
      [
        ['single', ['滿意', '普通', '不滿意'], null, true],
        ['multi', ['A', 'B', 'C'], 2, false],
        ['text', [], null, true],
        [null, [], null, true],
      ],
    );
  });

  it('送出作答:複選題全部勾選項都寫入、人事屬性留空', async () => {
    const qa = seed(repo);
    const r = await call('POST', `/v1/qa/pending/${qa}/answers`, {
      answers: [
        { no: 1, choices: ['普通'] },
        { no: 2, choices: ['C', 'A'] },
        { no: 3, text: ' <b>很好</b> ' },
      ],
    });
    assert.equal(r.statusCode, 201);
    assert.equal(r.json().answeredAt, '2026-10-22 10:00:00');
    assert.deepEqual(
      repo.c.map((x) => [x.No, x.Answer]),
      [
        [1, '普通'],
        [2, 'A'],
        [2, 'C'],
        [3, '＜b＞很好＜/b＞'],
      ],
      '依選項順序寫入;題型空白的舊題不寫;問答題 < > 轉全形',
    );
    assert.ok(repo.c.every((x) => x.LgNo === 'S112009'));
  });

  it('未作答的非必填單選 / 問答寫空字串,複選不寫', () => {
    const qs = buildQuestions(
      [
        { No: 1, Type: '單選題', LimNo: -1, Item: 'a', SubItem: 'x●', IsWrite: 'N' },
        { No: 2, Type: '問答題', LimNo: -1, Item: 'b', SubItem: '', IsWrite: 'N' },
        { No: 3, Type: '複選題', LimNo: -1, Item: 'c', SubItem: 'x●', IsWrite: 'N' },
      ],
      [],
    );
    assert.deepEqual(buildAnswerRows(qs, []), [
      { no: 1, answer: '' },
      { no: 2, answer: '' },
    ]);
  });

  it('送出前檢查', async () => {
    const qa = seed(repo);
    const cases: [object[], string][] = [
      [[{ no: 3, text: 'x' }], '題1 單選題為必填,請確認選項!'],
      [[{ no: 1, choices: ['滿意'] }], '題3 問答題為必填,請確認填寫內容!'],
      [
        [
          { no: 1, choices: ['滿意'] },
          { no: 2, choices: ['A', 'B', 'C'] },
          { no: 3, text: 'x' },
        ],
        '題2 複選題選項超過2項,請確認選項!',
      ],
      [
        [
          { no: 1, choices: ['不存在'] },
          { no: 3, text: 'x' },
        ],
        '題 1 選項不存在',
      ],
      [
        [
          { no: 1, choices: ['滿意', '普通'] },
          { no: 3, text: 'x' },
        ],
        '題 1 單選題只能選一項',
      ],
      [
        [
          { no: 1, choices: ['滿意'] },
          { no: 3, text: 'x'.repeat(301) },
        ],
        '題 3 回答超過 300 字',
      ],
      [
        [
          { no: 1, choices: ['滿意'] },
          { no: 3, text: 'x' },
          { no: 9, text: 'x' },
        ],
        '題 9 不存在',
      ],
    ];
    for (const [answers, msg] of cases) {
      const r = await call('POST', `/v1/qa/pending/${qa}/answers`, { answers });
      assert.equal(r.statusCode, 400, msg);
      assert.equal(r.json().code, 'PORTAL_QA_INVALID');
      assert.ok(
        r.json().details.some((d: { message: string }) => d.message === msg),
        `${msg}:${JSON.stringify(r.json().details)}`,
      );
    }
    assert.equal(repo.c.length, 0, '不寫入任何作答');
  });

  it('已填過', async () => {
    const qa = seed(repo);
    const body = {
      answers: [
        { no: 1, choices: ['滿意'] },
        { no: 3, text: 'x' },
      ],
    };
    assert.equal((await call('POST', `/v1/qa/pending/${qa}/answers`, body)).statusCode, 201);
    const again = await call('POST', `/v1/qa/pending/${qa}/answers`, body);
    assert.equal(again.statusCode, 409);
    assert.equal(again.json().code, 'PORTAL_QA_ANSWERED');
    assert.equal((await call('GET', `/v1/qa/pending/${qa}`)).statusCode, 409);
    assert.equal(repo.c.length, 2);
  });

  it('寫入失敗時整份不寫', async () => {
    const qa = seed(repo);
    repo.failInsert = true;
    const r = await call('POST', `/v1/qa/pending/${qa}/answers`, {
      answers: [
        { no: 1, choices: ['滿意'] },
        { no: 3, text: 'x' },
      ],
    });
    assert.equal(r.statusCode, 500);
    assert.equal(repo.c.length, 0);
  });

  it('新增問卷', async () => {
    const r = await call('POST', '/v1/qa/surveys', input(), 'S100001');
    assert.equal(r.statusCode, 201);
    assert.equal(r.json().qaNo, 'Q20261022100000S100001');
    const a = repo.a[0]!;
    assert.deepEqual([a.CLgNo, a.IsActive, a.Kdept, a.Kpep], ['S100001', true, 'S1420,', '']);
    assert.equal(a.QAFcontent, '<p>前言</p><a target="_blank" rel="noopener noreferrer">x</a>', '前言白名單過濾(外部圖片、javascript 連結移除)');
    assert.deepEqual(
      repo.b.map((x) => [x.No, x.Type, x.LimNo, x.SubItem, x.IsWrite]),
      [
        [1, '單選題', -1, '是●否●', 'Y'],
        [2, '複選題', 2, 'A●B●C●', 'N'],
      ],
    );
    const again = await call('POST', '/v1/qa/surveys', input(), 'S100001');
    assert.equal(again.json().qaNo, 'Q20261022100001S100001', '同一秒重複時順延');
  });

  it('新增問卷的輸入檢查', async () => {
    const bad = [
      input({ title: '<b>x</b>' }),
      input({ endDate: '2026-10-01' }),
      input({ targets: { all: false, depts: [], emps: [] } }),
      input({ targets: { all: false, depts: ['S1;DROP'], emps: [] } }),
      input({ questions: [{ type: 'single', text: 'Q', options: [], required: false }] }),
      input({ questions: [{ type: 'single', text: 'Q', options: ['a●b'], required: false }] }),
      input({ questions: [{ type: 'multi', text: 'Q', options: ['a', 'b'], limit: 3, required: false }] }),
      input({ questions: [{ type: 'text', text: '  ', required: false }] }),
    ];
    for (const b of bad) {
      const r = await call('POST', '/v1/qa/surveys', b, 'S100001');
      assert.equal(r.statusCode, 400, JSON.stringify(b));
    }
    assert.equal(repo.a.length, 0);
  });

  it('只列自己建立的問卷', async () => {
    seed(repo, { QANo: 'Q1', CLgNo: 'S100001' });
    seed(repo, { QANo: 'Q2', CLgNo: 'S100002' });
    const r = (await call('GET', '/v1/qa/surveys', undefined, 'S100001')).json();
    assert.deepEqual(
      r.items.map((x: { qaNo: string }) => x.qaNo),
      ['Q1'],
    );
    assert.equal(r.total, 1);
    const other = await call('GET', '/v1/qa/surveys/Q2', undefined, 'S100001');
    assert.equal(other.statusCode, 403);
    assert.equal(other.json().code, 'PORTAL_DATA_ACCESS_DENIED');
    for (const [m, u] of [
      ['PUT', '/v1/qa/surveys/Q2'],
      ['DELETE', '/v1/qa/surveys/Q2'],
      ['POST', '/v1/qa/surveys/Q2/copy'],
      ['GET', '/v1/qa/surveys/Q2/stats'],
      ['GET', '/v1/qa/surveys/Q2/export'],
    ] as const)
      assert.equal((await call(m, u, m === 'PUT' ? input() : undefined, 'S100001')).statusCode, 403, `${m} ${u}`);
  });

  it('代管查看全部問卷', async () => {
    seed(repo, { QANo: 'Q1', CLgNo: 'S100001' });
    seed(repo, { QANo: 'Q2', CLgNo: 'S100002' });
    const all = (await call('GET', '/v1/qa/admin/surveys', undefined, 'S094009')).json();
    assert.equal(all.total, 2);
    const one = (await call('GET', '/v1/qa/admin/surveys?creator=S100002', undefined, 'S094009')).json();
    assert.deepEqual(
      one.items.map((x: { qaNo: string }) => x.qaNo),
      ['Q2'],
    );
    assert.equal((await call('GET', '/v1/qa/admin/surveys/Q2', undefined, 'S094009')).statusCode, 200);
  });

  it('編輯不改建立者;未作答時可重建題目與圖片', async () => {
    seed(repo, { QANo: 'Q1', CLgNo: 'S100001' });
    const fileId = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const body = input({ questions: [{ type: 'text', text: '只剩一題', required: false, image: { fileId, position: 'before', width: 300 } }] });
    const r = await call('PUT', '/v1/qa/admin/surveys/Q1', body, 'S094009');
    assert.equal(r.statusCode, 204);
    assert.equal(repo.a[0]!.CLgNo, 'S100001');
    assert.deepEqual(
      repo.b.map((x) => [x.No, x.Item]),
      [[1, '只剩一題']],
    );
    assert.deepEqual(repo.d, [{ QANo: 'Q1', Item: '#1', FileName: fileId, Position: 0, Width: 300, Height: 0 }], '圖片以題號綁定');
    const q = (await call('GET', '/v1/qa/surveys/Q1', undefined, 'S100001')).json().questions[0];
    assert.deepEqual(q.image, { fileId, position: 'before', width: 300, height: 0 });
  });

  it('已有作答後不可改題目結構', async () => {
    const qa = seed(repo, { CLgNo: 'S100001' });
    repo.c.push({ QANo: qa, LgNo: 'S1', No: 1, Answer: '滿意', QATimes: '' });
    const detail = (await call('GET', `/v1/qa/surveys/${qa}`, undefined, 'S100001')).json();
    assert.equal(detail.locked, true);
    assert.equal(detail.respondents, 1);
    const qs = detail.questions.map((q: { type: string | null; text: string; options: string[]; limit: number | null; required: boolean }) => ({
      type: q.type ?? 'text',
      text: q.text,
      options: q.options,
      limit: q.limit,
      required: q.required,
    }));
    const removed = await call('PUT', `/v1/qa/surveys/${qa}`, input({ questions: qs.slice(1) }), 'S100001');
    assert.equal(removed.statusCode, 409);
    assert.equal(removed.json().code, 'PORTAL_QA_LOCKED');
    const changed = structuredClone(qs);
    changed[0].options = ['滿意', '不滿意'];
    assert.equal((await call('PUT', `/v1/qa/surveys/${qa}`, input({ questions: changed }), 'S100001')).statusCode, 409);
    assert.equal(repo.b.length, 4, '資料不變');

    const textOnly = structuredClone(qs);
    textOnly[0].text = '整體滿意度(修正)';
    const ok = await call('PUT', `/v1/qa/surveys/${qa}`, input({ questions: textOnly, endDate: '2026-11-30' }), 'S100001');
    assert.equal(ok.statusCode, 204);
    assert.equal(repo.a[0]!.end, '2026-11-30');
    assert.equal(repo.b.find((x) => x.No === 1)!.Item, '整體滿意度(修正)');
    assert.equal(repo.b.find((x) => x.No === 4)!.Type, '', '鎖定時不重建題目(舊題型保留)');
  });

  it('刪除問卷', async () => {
    const qa = seed(repo, { CLgNo: 'S100001' });
    repo.c.push({ QANo: qa, LgNo: 'S1', No: 1, Answer: '滿意', QATimes: '' });
    assert.equal((await call('DELETE', `/v1/qa/surveys/${qa}`, undefined, 'S100001')).statusCode, 204);
    assert.equal(repo.a[0]!.IsActive, false);
    assert.equal(repo.c.length, 1, '作答保留');
    assert.equal((await call('GET', `/v1/qa/surveys/${qa}`, undefined, 'S100001')).statusCode, 404);
  });

  it('複製問卷', async () => {
    const qa = seed(repo, { CLgNo: 'S100001' });
    repo.d.push({ QANo: qa, Item: '#1', FileName: '0f8fad5b-d9cb-469f-a165-70867728950e', Position: 1, Width: 0, Height: 0 });
    repo.c.push({ QANo: qa, LgNo: 'S1', No: 1, Answer: '滿意', QATimes: '' });
    const r = await call('POST', `/v1/qa/admin/surveys/${qa}/copy`, undefined, 'S094009');
    assert.equal(r.statusCode, 201);
    const to = r.json().qaNo;
    assert.equal(to, 'Q20261022100000S094009');
    const copied = repo.a.find((x) => x.QANo === to)!;
    assert.deepEqual([copied.QAName, copied.CLgNo], ['滿意度調查Copy', 'S094009']);
    assert.equal(repo.b.filter((x) => x.QANo === to).length, 4);
    assert.equal(repo.d.filter((x) => x.QANo === to).length, 1);
    assert.equal(repo.c.filter((x) => x.QANo === to).length, 0, '不複製作答');
  });

  it('單題統計', async () => {
    const qa = seed(repo, { CLgNo: 'S100001' });
    repo.c.push(
      { QANo: qa, LgNo: 'S1', No: 1, Answer: '滿意', QATimes: '' },
      { QANo: qa, LgNo: 'S1', No: 2, Answer: 'A', QATimes: '' },
      { QANo: qa, LgNo: 'S1', No: 2, Answer: 'B', QATimes: '' },
      { QANo: qa, LgNo: 'S1', No: 3, Answer: '好', QATimes: '' },
      { QANo: qa, LgNo: 'S2', No: 1, Answer: '舊選項', QATimes: '' },
      { QANo: qa, LgNo: 'S2', No: 2, Answer: 'A', QATimes: '' },
      { QANo: qa, LgNo: 'S2', No: 3, Answer: '', QATimes: '' },
    );
    const r = (await call('GET', `/v1/qa/surveys/${qa}/stats`, undefined, 'S100001')).json();
    assert.equal(r.respondents, 2);
    assert.deepEqual(r.unavailable, ['hr']);
    assert.deepEqual(r.questions[0].items, [
      { answer: '滿意', count: 1, percent: 50 },
      { answer: '普通', count: 0, percent: 0 },
      { answer: '不滿意', count: 0, percent: 0 },
      { answer: '舊選項', count: 1, percent: 50 },
    ]);
    assert.deepEqual(
      r.questions[1].items.map((x: { percent: number }) => x.percent),
      [100, 50, 0],
      '分母 = 作答人數',
    );
    assert.equal(r.questions[2].answered, 1);
    assert.deepEqual(r.questions[2].items, [{ answer: '好', count: 1, percent: 50 }], '空白答案不列');
  });

  it('匯出作答明細', async () => {
    const qa = seed(repo, { CLgNo: 'S100001', QAName: '滿意度/調查' });
    repo.c.push({ QANo: qa, LgNo: 'S1', No: 3, Answer: '=1+1', QATimes: '2026-10-22 10:00:00' });
    const r = await call('GET', `/v1/qa/surveys/${qa}/export`, undefined, 'S100001');
    assert.equal(r.statusCode, 200);
    assert.match(r.headers['content-type'] as string, /spreadsheetml/);
    assert.match(r.headers['content-disposition'] as string, /filename\*=UTF-8''%E6%BB%BF%E6%84%8F%E5%BA%A6_%E8%AA%BF%E6%9F%A5\.xlsx/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(r.rawPayload as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('作答明細')!;
    assert.deepEqual((ws.getRow(1).values as unknown[]).slice(1), ['部門', '工號', '姓名', '題號', '題目', '答案', '填答時間']);
    assert.deepEqual((ws.getRow(2).values as unknown[]).slice(1), ['資訊部', 'S1', '測試', 3, '建議', '=1+1', '2026-10-22 10:00:00']);
    assert.equal(ws.getRow(2).getCell(6).type, ExcelJS.ValueType.String, '不當成公式');
  });

  it('取得部門樹 / 職級資料未提供', async () => {
    assert.equal((await call('GET', '/v1/qa/org/departments')).json().items.length, 2);
    const r = await call('GET', '/v1/qa/org/job-tier?tier=manager');
    assert.equal(r.statusCode, 503);
    assert.equal(r.json().code, 'PORTAL_JOB_TIER_UNAVAILABLE');
  });
});
