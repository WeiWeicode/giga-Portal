/**
 * 整合測試(npm run test:int):以 SQL Server 2012 驗證 P3 的 SQL —
 *   - Drizzle:首頁輪播、年度行事曆(upsert)、集團系統(含 migration 初始 DES 資料)、個人常用連結(排序 CASE)
 *   - mssql:3691(Talk3691Data OUTPUT、跨舊表 / portal 表的交易、按讚不重複、屏蔽稽核、解碼稽核)、舊公告查詢條件、到職日
 * 在整合測試專用庫(PORTAL_TEST_DB_NAME,*_poc_test)清空 schema portal 後重新 migrate,並在 portal 建立與舊庫同結構的
 * Talk3691Data / Talk3691Like / ContentX / PublicNoticeInfo / EmployeeInfo(來源前綴覆寫為 <庫>.portal);測完刪除舊表複本。
 * 不碰 giganexus_gw_test 與 src_*。
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type sql from 'mssql';
import { createDb, openPool } from '../../src/db/client.js';
import { Sources } from '../../src/db/sources.js';
import { migrateSqlConfig, runMigrations } from '../../src/migrate.js';
import { DrizzleContentRepo } from '../../src/modules/home/drizzle-repo.js';
import { MssqlHomeLegacyRepo } from '../../src/modules/home/legacy-repo.js';
import { DrizzleLinkRepo } from '../../src/modules/links/drizzle-repo.js';
import { AuthorCipher, parseAuthorKey } from '../../src/modules/talk/author-cipher.js';
import { MssqlTalkRepo } from '../../src/modules/talk/repo.js';
import { TalkService } from '../../src/modules/talk/talk.js';

const database = process.env.PORTAL_TEST_DB_NAME?.trim();
const enabled = !!database;
if (enabled && !/_poc_test$/i.test(database!)) throw new Error(`PORTAL_TEST_DB_NAME 必須是 *_poc_test 整合測試庫:${database}(會清空 schema portal)`);

const UUID = '0bc59e51-9188-4e5d-87eb-6467d178efdd';
const LEGACY = ['Talk3691Data', 'Talk3691Like', 'ContentX', 'PublicNoticeInfo', 'EmployeeInfo'];
const DROP_LEGACY = LEGACY.map((t) => `IF OBJECT_ID(N'portal.${t}') IS NOT NULL DROP TABLE portal.${t};`).join('\n');

describe('P3 首頁與集團公告(SQL Server)', { skip: enabled ? false : 'PORTAL_TEST_DB_NAME 未設定' }, () => {
  let admin: sql.ConnectionPool;
  let pool: sql.ConnectionPool;
  let sources: Sources;

  before(async () => {
    const migrateCfg = migrateSqlConfig(process.env, database);
    admin = await openPool(migrateCfg, { appName: 'giganexus-portal-int-p3', poolMax: 2 });
    await admin.request().batch(`
      IF DB_NAME() NOT LIKE N'%[_]poc[_]test' THROW 50001, N'不是整合測試專用庫,未清空', 1;
      IF OBJECT_ID(N'portal.form_doc') IS NOT NULL DROP TABLE portal.form_doc; -- FK 參照 form_category,先刪(P4)
      DECLARE @stmt NVARCHAR(MAX) = N'';
      SELECT @stmt = @stmt + N'DROP TABLE ' + QUOTENAME(s.name) + N'.' + QUOTENAME(t.name) + N';' + CHAR(10)
      FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id WHERE s.name = N'portal';
      EXEC sp_executesql @stmt;`);
    await runMigrations(migrateCfg);
    // 舊表結構同 220(INFORMATION_SCHEMA 實測):Talk3691Data.SN 為識別欄、mark nvarchar(50);日期多為字串
    await admin.request().batch(`
      CREATE TABLE portal.Talk3691Data (SN int IDENTITY(1,1) NOT NULL, ParentSN int NULL, TalkType nvarchar(20) NULL, TextContent nvarchar(max) NULL,
        Title nvarchar(300) NULL, CreateTime datetime NULL, IsBlack bit NULL, mark nvarchar(50) NULL);
      CREATE TABLE portal.Talk3691Like (SN int NULL, UserID nvarchar(10) NULL, CreateDate datetime NULL);
      CREATE TABLE portal.ContentX (LgID nvarchar(50) NULL, LgName nvarchar(50) NULL, ContentType nvarchar(50) NULL, ImgPath nvarchar(150) NULL,
        ContentX nvarchar(max) NULL, StartDate nvarchar(50) NULL, EndDate nvarchar(50) NULL, indexContent nvarchar(100) NULL, Pubtime nvarchar(50) NULL,
        Classtype nvarchar(50) NULL, UpDown nvarchar(50) NULL, GUID nvarchar(50) NULL, Content_main nvarchar(max) NULL);
      CREATE TABLE portal.PublicNoticeInfo (No nvarchar(50) NULL, Title nvarchar(200) NULL, L_Item1 nvarchar(max) NULL);
      CREATE TABLE portal.EmployeeInfo (UserID nvarchar(50) NULL, JobDate date NULL, LeaveDate date NULL);`);
    sources = Sources.fromEnv('copy', database!, {
      PORTAL_SRC_PORTALSOLAR: `${database}.portal`,
      PORTAL_SRC_NOTES: `${database}.portal`,
      PORTAL_SRC_LOS: `${database}.portal`,
    });
    pool = await openPool(
      { ...migrateCfg, user: process.env.PORTAL_DB_USER!, password: process.env.PORTAL_DB_PASSWORD! },
      { appName: 'giganexus-portal-int-p3-app', poolMax: 4 },
    );
  });
  after(async () => {
    await pool?.close();
    await admin?.request().batch(DROP_LEGACY);
    await admin?.close();
  });

  it('首頁輪播與年度行事曆', async () => {
    const repo = new DrizzleContentRepo(createDb(pool, true));
    const s = await repo.createSlide(
      { kind: 'policy', title: '準則', fileId: UUID, linkUrl: null, startDate: '2026-10-01', endDate: null, sort: 10, active: true },
      'S1',
    );
    assert.equal(s.startDate, '2026-10-01');
    await repo.createSlide({ kind: 'gallery', title: '停用', fileId: UUID, linkUrl: '/x', startDate: null, endDate: null, sort: 1, active: false }, 'S1');
    assert.deepEqual(
      (await repo.slides(false)).map((x) => x.title),
      ['準則'],
    );
    assert.equal((await repo.slides(true)).length, 2);
    assert.equal((await repo.updateSlide(s.id, { ...s, title: '準則 v2' }, 'S2'))?.title, '準則 v2');
    assert.equal(await repo.updateSlide(99999, { ...s }, 'S2'), null);
    assert.equal(await repo.deleteSlide(s.id), true);

    await repo.upsertCalendar(2027, UUID, 'a.pdf', 'S1');
    const again = await repo.upsertCalendar(2027, UUID, 'b.pdf', 'S2');
    assert.equal(again.fileName, 'b.pdf');
    await repo.upsertCalendar(2026, UUID, 'c.pdf', 'S1');
    assert.deepEqual(
      (await repo.calendars()).map((c) => [c.year, c.fileName]),
      [
        [2026, 'c.pdf'],
        [2027, 'b.pdf'],
      ],
    );
    assert.equal(await repo.deleteCalendar(2026), true);
    assert.equal(await repo.deleteCalendar(2026), false);
  });

  it('集團系統初始資料與個人常用連結', async () => {
    const repo = new DrizzleLinkRepo(createDb(pool, true));
    const seeded = await repo.systemLinks(false);
    assert.equal(seeded.length, 10, 'migration 建立 10 個 DES 跳轉系統');
    assert.ok(seeded.every((l) => l.legacyDes && l.url === null));
    const bpm = await repo.createSystemLink(
      { name: 'BPM', description: null, category: '行政與流程', url: 'http://bpm.example/', openMode: 'new', legacyDes: false, sort: 1, active: true },
      'S1',
    );
    assert.equal((await repo.systemLinks(false))[0]!.name, 'BPM', '依排序');
    assert.equal((await repo.updateSystemLink(bpm.id, { ...bpm, active: false }, 'S1'))?.active, false);
    assert.equal((await repo.systemLinks(false)).length, 10);
    assert.equal(await repo.deleteSystemLink(bpm.id), true);

    const a = await repo.createPersonalLink('S1', { name: 'A', url: '/a' }, 10);
    const b = await repo.createPersonalLink('S1', { name: 'B', url: '/b' }, 20);
    const o = await repo.createPersonalLink('S2', { name: 'O', url: '/o' }, 10);
    await repo.reorderPersonalLinks('S1', [b.id, a.id]);
    assert.deepEqual(
      (await repo.personalLinks('S1')).map((l) => [l.name, l.sort]),
      [
        ['B', 10],
        ['A', 20],
      ],
    );
    await repo.reorderPersonalLinks('S1', [o.id]);
    assert.equal((await repo.personalLinks('S2'))[0]!.sort, 10, '不動別人的');
    assert.equal(await repo.updatePersonalLink('S1', o.id, { name: 'x', url: '/x' }), null);
    assert.equal(await repo.deletePersonalLink('S1', o.id), false);
    assert.equal((await repo.updatePersonalLink('S1', a.id, { name: 'A2', url: '/a2' }))?.name, 'A2');
  });

  it('3691 發文、按讚、屏蔽與解碼留稽核', async () => {
    const svc = new TalkService(new MssqlTalkRepo(pool, sources), new AuthorCipher(parseAuthorKey('k1', randomBytes(32).toString('base64'))));
    await admin.request().batch(`INSERT INTO portal.Talk3691Data (TalkType, Title, TextContent, CreateTime, IsBlack, mark)
      VALUES (N'', N'舊發文', N'舊內容', '2024-01-02 03:04:05', 0, N'legacyDES==')`);
    const { sn } = await svc.post('S100001', { type: '舉手發問', title: '問題', content: '內容' });
    const { sn: reply } = await svc.post('S100002', { parentSn: sn, content: '回覆' });
    const row = await admin.request().query(`SELECT * FROM portal.Talk3691Data WHERE SN = ${sn}`);
    const r0 = row.recordset[0] as Record<string, unknown>;
    assert.deepEqual([r0.mark, r0.IsBlack, r0.TalkType], [null, false, '舉手發問'], '舊表 mark 留 NULL、IsBlack 0');
    assert.ok(r0.CreateTime instanceof Date);
    const list = await svc.list('S100003', null);
    assert.equal(list.length, 3);
    const legacy = list.find((p) => p.title === '舊發文')!;
    assert.equal(legacy.createdAt, '2024-01-02 03:04:05', '舊表 datetime 原樣以當地時間字串回傳');
    assert.equal(list.find((p) => p.sn === reply)!.type, '舉手發問', '回覆沿用上層分類');

    await svc.like('S100003', sn);
    await svc.like('S100003', sn);
    const liked = (await svc.list('S100003', '舉手發問')).find((p) => p.sn === sn)!;
    assert.deepEqual([liked.likes, liked.likedByMe], [1, true]);

    await svc.setBlocked('S900001', sn, true);
    const masked = await svc.list('S100003', null);
    assert.equal(masked.find((p) => p.sn === sn)!.title, '該發言已屏蔽');
    assert.ok(!masked.some((p) => p.sn === reply), '屏蔽主題的回覆不列出');

    assert.deepEqual(await svc.reveal('S900002', reply, 'HR-1', '調查'), { sn: reply, empNo: 'S100002' });
    await assert.rejects(svc.reveal('S900002', legacy.sn, 'HR-2', null), /舊入口網/);
    const audit = await admin.request().query(`SELECT sn, action, result, emp_no, approval_no FROM portal.talk_audit ORDER BY id`);
    assert.deepEqual(
      audit.recordset.map((a: Record<string, unknown>) => [a.sn, a.action, a.result, a.emp_no, a.approval_no]),
      [
        [sn, 'block', null, 'S900001', null],
        [reply, 'reveal', 'ok', 'S900002', 'HR-1'],
        [legacy.sn, 'reveal', 'legacy', 'S900002', 'HR-2'],
      ],
    );
  });

  it('發文寫入失敗時整筆回復', async () => {
    const svc = new TalkService(new MssqlTalkRepo(pool, sources), new AuthorCipher(parseAuthorKey('kx', randomBytes(32).toString('base64'))));
    const before = await admin.request().query<{ n: number }>(`SELECT COUNT(*) AS n FROM portal.Talk3691Data`);
    // 以 CHECK 讓 portal.talk_author 寫入失敗,確認舊表的 INSERT 一併回復
    await admin.request().batch(`ALTER TABLE portal.talk_author WITH NOCHECK ADD CONSTRAINT ck_it_talk CHECK (key_id <> N'kx')`);
    try {
      await assert.rejects(svc.post('S1', { type: '不吐不快', title: 't', content: 'c' }));
    } finally {
      await admin.request().batch(`ALTER TABLE portal.talk_author DROP CONSTRAINT ck_it_talk`);
    }
    const now = await admin.request().query<{ n: number }>(`SELECT COUNT(*) AS n FROM portal.Talk3691Data`);
    assert.equal(now.recordset[0]!.n, before.recordset[0]!.n);
  });

  it('舊入口網公告條件同舊首頁', async () => {
    await admin.request().batch(`
      INSERT INTO portal.PublicNoticeInfo (No, L_Item1) VALUES (N'N2610001', N'.碩禾全體,.禾迅全體'), (N'N2610002', N'.國碩全體'), (N'N2610003', NULL);
      INSERT INTO portal.ContentX (ContentType, ContentX, StartDate, EndDate, indexContent, Pubtime, UpDown, GUID) VALUES
        (N'集團Notes公告', N'NotesPublic/N2610001.html', N'2026/10/01', N'2026/10/31', N'碩禾全體公告', N'2026/10/01', NULL, N'g1'),
        (N'集團Notes公告', N'NotesPublic/N2610002.html', N'2026/10/02', N'2026/10/31', N'國碩公告(不顯示)', N'2026/10/02', NULL, N'g2'),
        (N'集團Notes公告', N'NotesPublic/N2610003.html', N'2026/10/03', N'', N'對象空白', N'2026/10/03', NULL, N'g3'),
        (N'最新消息', N'PublicContentX.aspx?GUID=g4', N'2026/10/04', N'2026/10/31', N'最新 100%', N'2026/10/4', NULL, N'g4'),
        (N'最新消息', N'PublicContentX.aspx?GUID=g5', N'2026/10/05', N'2026/10/31', N'下架', N'2026/10/5', N'Down', N'g5'),
        (N'福委會公告', N'PublicContentX.aspx?GUID=g6', N'2026/10/06', N'2026/10/31', N'類型不符', N'2026/10/6', NULL, N'g6'),
        (N'最新消息', N'PublicContentX.aspx?GUID=g7', N'2026/10/30', N'2026/10/31', N'未開始', N'2026/10/30', NULL, N'g7'),
        (N'最新消息', N'PublicContentX.aspx?GUID=g8', N'2026/09/01', N'2026/09/30', N'已過期', N'2026/9/1', NULL, N'g8'),
        (N'環安公告', N'PublicContentX.aspx?GUID=g9', N'2026/10/09', NULL, N'EndDate NULL(舊程式不顯示)', N'2026/10/9', NULL, N'g9');`);
    const repo = new MssqlHomeLegacyRepo(pool, sources, 'http://old.example/PortalSolar');
    const r = await repo.list({ today: '2026/10/22', offset: 0, limit: 10 });
    assert.deepEqual(
      r.items.map((x) => x.id),
      ['g4', 'g3', 'g1'],
    );
    assert.equal(r.total, 3);
    assert.equal(r.items[0]!.url, 'http://old.example/PortalSolar/html/PublicContentX.aspx?GUID=g4');
    assert.equal(r.items[0]!.date, '2026-10-04');
    const page2 = await repo.list({ today: '2026/10/22', offset: 2, limit: 2 });
    assert.deepEqual([page2.total, page2.items.map((x) => x.id)], [3, ['g1']]);
    const q = await repo.list({ today: '2026/10/22', q: '100%', offset: 0, limit: 10 });
    assert.deepEqual(
      q.items.map((x) => x.id),
      ['g4'],
      '關鍵字的 % 視為一般字元',
    );
  });

  it('到職日取在職中的最新一筆', async () => {
    await admin.request().batch(`INSERT INTO portal.EmployeeInfo VALUES (N'S1', '2020-01-01', '2021-01-01'), (N'S1', '2026-09-01', NULL), (N'S2', NULL, NULL)`);
    const repo = new MssqlHomeLegacyRepo(pool, sources, null);
    assert.equal(await repo.hireDate('S1'), '2026-09-01');
    assert.equal(await repo.hireDate('S2'), null);
    assert.equal(await repo.hireDate('S9'), null);
  });
});
