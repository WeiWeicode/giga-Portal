/**
 * 整合測試(npm run test:int):以 SQL Server 2012 驗證 MssqlQaRepo 的 SQL(日期、分頁、交易與鎖定、批次寫入、複製、統計、匯出)。
 * 在整合測試專用庫(PORTAL_TEST_DB_NAME,*_poc_test)的 schema portal 建立與 PortalSolar / LOS 同結構的表
 * (QAAnnual / B / C / D、DeptInfo、EmployeeInfo 精簡欄位),來源前綴覆寫為 <庫>.portal;測完刪除。不碰 giganexus_gw_test 與 src_*。
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type sql from 'mssql';
import { openPool } from '../../src/db/client.js';
import { Sources } from '../../src/db/sources.js';
import { migrateSqlConfig } from '../../src/migrate.js';
import { AppError } from '../../src/errors.js';
import { QaService, type SurveyWrite } from '../../src/modules/qa/qa.js';
import { MssqlQaRepo } from '../../src/modules/qa/repo.js';

const database = process.env.PORTAL_TEST_DB_NAME?.trim();
const enabled = !!database;
if (enabled && !/_poc_test$/i.test(database!)) throw new Error(`PORTAL_TEST_DB_NAME 必須是 *_poc_test 整合測試庫:${database}`);

const TABLES = ['QAAnnual', 'QAAnnualB', 'QAAnnualC', 'QAAnnualD', 'DeptInfo', 'EmployeeInfo'];
const DROP = TABLES.map((t) => `IF OBJECT_ID(N'portal.${t}') IS NOT NULL DROP TABLE portal.${t};`).join('\n');
/** 欄位型別與測試區複本 src_portalsolar 相同(2026-10-22 查詢 sys.columns) */
const CREATE = `
  CREATE TABLE portal.QAAnnual (QANo nvarchar(50) NULL, QAName nvarchar(400) NULL, QADept nvarchar(20) NULL, QAFcontent nvarchar(max) NULL,
    QAEcontent nvarchar(max) NULL, QAStartDate datetime NULL, QAEndDate datetime NULL, Kdept nvarchar(3000) NULL, Kpep nvarchar(3000) NULL,
    CLgNo nvarchar(10) NULL, IsActive bit NULL);
  CREATE TABLE portal.QAAnnualB (QANo nvarchar(50) NULL, Type nvarchar(20) NULL, No int NULL, LimNo int NULL, Item nvarchar(200) NULL,
    SubItem nvarchar(3000) NULL, IsWrite nvarchar(2) NULL);
  CREATE TABLE portal.QAAnnualC (QANo nvarchar(50) NULL, LgNo nvarchar(20) NULL, No int NULL, Answer nvarchar(300) NULL,
    CPF03 nvarchar(50) NULL, CPF04 nvarchar(50) NULL, CPF19 nvarchar(50) NULL, CPF24 nvarchar(50) NULL, CPF70 nvarchar(50) NULL,
    CPF14 nvarchar(50) NULL, CPF31 nvarchar(50) NULL, CPF29 nvarchar(50) NULL, CPF34 nvarchar(50) NULL, CPK02 nvarchar(10) NULL, QATimes datetime NULL);
  CREATE TABLE portal.QAAnnualD (QANo nvarchar(50) NULL, Item nvarchar(200) NULL, FileName nvarchar(100) NULL, Position tinyint NULL, Width int NULL, Height int NULL);
  CREATE TABLE portal.DeptInfo (Dept nvarchar(20) NULL, DeptName nvarchar(50) NULL, ParentDept nvarchar(10) NULL);
  CREATE TABLE portal.EmployeeInfo (UserID nvarchar(10) NULL, UserName nvarchar(50) NULL, EFDeptName nvarchar(30) NULL);`;

/** 2026-10-22 10:00:00(台灣時間) */
const NOW = Date.parse('2026-10-22T02:00:00Z');

const write = (over: Partial<SurveyWrite> = {}): SurveyWrite => ({
  title: '整合測試問卷',
  dept: '人力資源部',
  intro: '<p>前言</p>',
  outro: '',
  startDate: '2026-10-20',
  endDate: '2026-10-22',
  kdept: 'S1420,',
  kpep: '',
  questions: [
    { no: 1, type: 'single', text: '滿意度', options: ['滿意', '不滿意'], limit: null, required: true, image: null },
    {
      no: 2,
      type: 'multi',
      text: '課程',
      options: ['A', 'B', 'C'],
      limit: 2,
      required: false,
      image: { fileId: '0f8fad5b-d9cb-469f-a165-70867728950e', position: 'after', width: 200, height: 0 },
    },
    { no: 3, type: 'text', text: "含單引號 ' 的題目", options: [], limit: null, required: false, image: null },
  ],
  ...over,
});

describe('問卷調查(SQL Server)', { skip: enabled ? false : 'PORTAL_TEST_DB_NAME 未設定' }, () => {
  let admin: sql.ConnectionPool;
  let repo: MssqlQaRepo;
  let service: QaService;
  const me = { empNo: 'S112009', name: null, dept: 'S1420', companies: [] };

  before(async () => {
    admin = await openPool(migrateSqlConfig(process.env, database), { appName: 'giganexus-portal-int-qa', poolMax: 4 });
    await admin.request().batch(`IF DB_NAME() NOT LIKE N'%[_]poc[_]test' THROW 50001, N'不是整合測試專用庫', 1;\n${DROP}\n${CREATE}`);
    const sources = Sources.fromEnv('copy', database!, { PORTAL_SRC_PORTALSOLAR: `${database}.portal`, PORTAL_SRC_LOS: `${database}.portal` });
    repo = new MssqlQaRepo(admin, sources);
    service = new QaService(repo, null, () => NOW);
  });
  after(async () => {
    await admin?.request().batch(DROP);
    await admin?.close();
  });
  beforeEach(async () => {
    await admin.request().batch(TABLES.map((t) => `DELETE FROM portal.${t};`).join(' '));
  });

  it('新增、讀取、開放中清單與分頁', async () => {
    assert.equal(await repo.create('Q1', 'S100001', write()), true);
    assert.equal(await repo.create('Q1', 'S100001', write()), false, '同編號不重複建立');
    await repo.create('Q2', 'S100002', write({ title: '別人的 [100%]_問卷', startDate: '2026-10-23', endDate: '2026-10-30' }));
    const s = (await repo.get('Q1'))!;
    assert.deepEqual([s.title, s.startDate, s.endDate, s.creator, s.active, s.kdept], ['整合測試問卷', '2026-10-20', '2026-10-22', 'S100001', true, 'S1420,']);
    assert.deepEqual(
      s.questions.map((q) => [q.no, q.type, q.options, q.limit, q.required, q.image?.fileId ?? null]),
      [
        [1, 'single', ['滿意', '不滿意'], null, true, null],
        [2, 'multi', ['A', 'B', 'C'], 2, false, '0f8fad5b-d9cb-469f-a165-70867728950e'],
        [3, 'text', [], null, false, null],
      ],
    );
    assert.equal(s.questions[2]!.text, "含單引號 ' 的題目");
    const open = await repo.openSurveys('2026-10-22');
    assert.deepEqual(
      open.map((x) => [x.qaNo, x.questionCount]),
      [['Q1', 3]],
      '結束日當天仍開放,未開始的不列',
    );
    assert.equal((await repo.openSurveys('2026-10-23')).length, 1);
    const mine = await repo.list({ creator: 'S100001' }, 1, 10);
    assert.deepEqual([mine.total, mine.items[0]!.qaNo, mine.items[0]!.questionCount, mine.items[0]!.respondents], [1, 'Q1', 3, 0]);
    const all = await repo.list({ creator: null, q: '[100%]_' }, 1, 10);
    assert.deepEqual(
      all.items.map((x) => x.qaNo),
      ['Q2'],
      'LIKE 特殊字元跳脫',
    );
    assert.equal((await repo.list({ creator: null, today: '2026-10-22' }, 1, 10)).total, 1);
    assert.equal((await repo.list({ creator: null }, 2, 1)).items[0]!.qaNo, 'Q1', 'OFFSET 分頁(開始日新到舊)');
  });

  it('送出作答:整份一個交易,已填過不重複寫', async () => {
    await repo.create('Q1', 'S100001', write());
    const answers = [
      { no: 1, choices: ['滿意'] },
      { no: 2, choices: ['A', 'C'] },
      { no: 3, text: '好' },
    ];
    await service.submit(me, 'Q1', answers);
    const rows = await admin
      .request()
      .query(
        `SELECT No, Answer, CONVERT(varchar(19), QATimes, 120) AS t, CPF03, CPK02 FROM portal.QAAnnualC WHERE QANo = N'Q1' AND LgNo = N'S112009' ORDER BY No, Answer`,
      );
    assert.deepEqual(
      rows.recordset.map((r) => [r.No, r.Answer]),
      [
        [1, '滿意'],
        [2, 'A'],
        [2, 'C'],
        [3, '好'],
      ],
    );
    assert.ok(rows.recordset.every((r) => r.t === '2026-10-22 10:00:00' && r.CPF03 === null && r.CPK02 === null));
    await assert.rejects(service.submit(me, 'Q1', answers), (e: AppError) => e.code === 'PORTAL_QA_ANSWERED');
    // 兩個請求同時送出:只有一份寫入
    const other = { ...me, empNo: 'S112010' };
    const results = await Promise.allSettled([service.submit(other, 'Q1', answers), service.submit(other, 'Q1', answers)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const n = await admin.request().query<{ n: number }>(`SELECT COUNT(*) AS n FROM portal.QAAnnualC WHERE LgNo = N'S112010'`);
    assert.equal(n.recordset[0]!.n, 4);
    assert.deepEqual([...(await repo.answered('S112009', ['Q1', 'Q9']))], ['Q1']);
  });

  it('寫入失敗時整份回復', async () => {
    await repo.create('Q1', 'S100001', write());
    await admin.request().batch(`ALTER TABLE portal.QAAnnualC ADD CONSTRAINT ck_it_qa CHECK (Answer <> N'boom')`);
    try {
      await assert.rejects(
        service.submit(me, 'Q1', [
          { no: 1, choices: ['滿意'] },
          { no: 3, text: 'boom' },
        ]),
      );
      const n = await admin.request().query<{ n: number }>(`SELECT COUNT(*) AS n FROM portal.QAAnnualC`);
      assert.equal(n.recordset[0]!.n, 0);
    } finally {
      await admin.request().batch(`ALTER TABLE portal.QAAnnualC DROP CONSTRAINT ck_it_qa`);
    }
  });

  it('編輯:未作答重建題目;已作答只改文字;舊站圖片保留', async () => {
    await repo.create('Q1', 'S100001', write());
    await admin
      .request()
      .batch(`INSERT INTO portal.QAAnnualD (QANo, Item, FileName, Position, Width, Height) VALUES (N'Q1', N'滿意度', N'07-27-03-24_舊圖.png', 1, 0, 0)`);
    await repo.update('Q1', write({ questions: write().questions.slice(0, 1), endDate: '2026-11-30' }), () => 'full');
    let s = (await repo.get('Q1'))!;
    assert.equal(s.questions.length, 1);
    assert.equal(s.endDate, '2026-11-30');
    assert.equal(s.creator, 'S100001', '不改 CLgNo');
    assert.equal(s.questions[0]!.legacyImage, true);
    const d = await admin.request().query(`SELECT Item FROM portal.QAAnnualD WHERE QANo = N'Q1' ORDER BY Item`);
    assert.deepEqual(
      d.recordset.map((r) => r.Item),
      ['滿意度'],
      '新站圖片(#2)隨題目移除,舊站圖片不動',
    );

    const q = write().questions[0]!;
    await repo.update('Q1', write({ questions: [{ ...q, text: '滿意度(修正)' }] }), () => 'text');
    s = (await repo.get('Q1'))!;
    assert.equal(s.questions[0]!.text, '滿意度(修正)');
  });

  it('編輯:guard 拒絕時不寫入', async () => {
    await repo.create('Q1', 'S100001', write());
    await assert.rejects(
      repo.update('Q1', write({ title: '不該寫入' }), () => {
        throw new Error('locked');
      }),
    );
    assert.equal((await repo.get('Q1'))!.title, '整合測試問卷');
  });

  it('軟刪、複製、統計、匯出、部門樹', async () => {
    await repo.create('Q1', 'S100001', write());
    await service.submit(me, 'Q1', [
      { no: 1, choices: ['滿意'] },
      { no: 2, choices: ['B'] },
      { no: 3, text: '' },
    ]);
    assert.equal(await repo.copy('Q1', 'Q1C', 'S094009', '整合測試問卷Copy'), true);
    const c = (await repo.get('Q1C'))!;
    assert.deepEqual([c.title, c.creator, c.active, c.questions.length, c.questions[1]!.image?.width], ['整合測試問卷Copy', 'S094009', true, 3, 200]);
    assert.equal(await repo.respondents('Q1C'), 0, '不複製作答');

    const st = await repo.answerCounts('Q1');
    assert.equal(st.respondents, 1);
    assert.equal(st.answeredBy.get(3), undefined, '空白答案不算有作答');
    assert.ok(st.counts.some((x) => x.no === 2 && x.answer === 'B' && x.count === 1));

    await admin.request().batch(`INSERT INTO portal.EmployeeInfo VALUES (N'S112009', N'測試員', N'資訊部'), (N'S112009', N'重複', N'重複')`);
    const rows = await repo.exportRows('Q1');
    assert.equal(rows.length, 3, 'EmployeeInfo 重複列不放大筆數');
    assert.deepEqual(
      [rows[0]!.dept, rows[0]!.empNo, rows[0]!.name, rows[0]!.no, rows[0]!.question, rows[0]!.answer],
      ['資訊部', 'S112009', '測試員', 1, '滿意度', '滿意'],
    );
    assert.equal(rows[0]!.answeredAt, '2026/10/22 10:00:00');

    assert.equal(await repo.softDelete('Q1'), true);
    assert.equal(await repo.softDelete('Q1'), false);
    assert.equal((await repo.get('Q1'))!.active, false);
    assert.equal(
      (await repo.openSurveys('2026-10-22')).some((x) => x.qaNo === 'Q1'),
      false,
    );

    await admin.request().batch(`INSERT INTO portal.DeptInfo VALUES (N'GSMC', N'碩禾', N''), (N'S1400 ', N'製造處', N'GSMC'), (N'', N'空', NULL)`);
    assert.deepEqual(await repo.departments(), [
      { code: 'GSMC', name: '碩禾', parent: null },
      { code: 'S1400', name: '製造處', parent: 'GSMC' },
    ]);
  });
});
