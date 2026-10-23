/**
 * 整合測試(npm run test:int):P7 臨時服務的 SQL —
 *   - 舊表(PortalSolar Consent* / EmployeeStock* / ContentX* / TV*、MisDb SendMailLog、LOS EmployeeInfo):在整合測試專用庫
 *     (PORTAL_TEST_DB_NAME,*_poc_test)的 schema portal 建立同結構的表(欄位型別同測試區複本,2026-10-23 查 sys.columns),
 *     來源前綴覆寫為 <庫>.portal;測完刪除
 *   - 新表(migration 20261023082527_p7_services):consent_def(含種子 20260814)、consent_sign 唯一鍵、tv_image
 *   - ISO 文件庫(NaNa)未納入:需 06-bpm-readonly-p7.sql 授權後另行驗證
 * 不碰 giganexus_gw_test 與 src_*。
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type sql from 'mssql';
import { openPool } from '../../src/db/client.js';
import { Sources } from '../../src/db/sources.js';
import { migrateSqlConfig, runMigrations } from '../../src/migrate.js';
import { MssqlAuctionRepo } from '../../src/modules/services/auction-repo.js';
import { MssqlConsentRepo } from '../../src/modules/services/consent-repo.js';
import { MssqlPostRepo } from '../../src/modules/services/post-repo.js';
import { MssqlStockRepo } from '../../src/modules/services/stock-repo.js';
import { MssqlTvRepo } from '../../src/modules/services/tv-repo.js';

const database = process.env.PORTAL_TEST_DB_NAME?.trim();
const enabled = !!database;
if (enabled && !/_poc_test$/i.test(database!)) throw new Error(`PORTAL_TEST_DB_NAME 必須是 *_poc_test 整合測試庫:${database}`);
const GUID = '953c6656-e759-46ef-9c3f-bedbb04b21a0';
const ITEM = 'c4811f9a-9adc-4f8d-8bb4-eb06c53a398d';
const SIGN = '0bc59e51-9188-4e5d-87eb-6467d178efdd';

const TABLES = [
  'ConsentX',
  'ConsentXB',
  'ConsentCInfo',
  'ConsentBInfo',
  'EmployeeInfo',
  'EmployeeStockInfo',
  'EmployeeStockLog',
  'SendMailLog',
  'ContentX',
  'ContentXMessage',
  'TVShowInfo',
  'TVImgInfo',
];
const DROP = TABLES.map((t) => `IF OBJECT_ID(N'portal.${t}') IS NOT NULL DROP TABLE portal.[${t}];`).join('\n');
const CREATE = `
  CREATE TABLE portal.ConsentX (LgID nvarchar(100) NULL, LgName nvarchar(100) NULL, Kdept nvarchar(4000) NULL, Kpep nvarchar(4000) NULL, ImgPath nvarchar(300) NULL,
    ConsentX nvarchar(max) NULL, StartDate nvarchar(100) NULL, EndDate nvarchar(100) NULL, indexConsent nvarchar(200) NULL, Pubtime nvarchar(100) NULL,
    Classtype nvarchar(100) NULL, UpDown nvarchar(100) NULL, GUID nvarchar(100) NULL, Consent_main nvarchar(max) NULL);
  CREATE TABLE portal.ConsentXB (GUID nvarchar(100) NULL, LgNo nvarchar(20) NULL, ConfirmDate date NULL);
  CREATE TABLE portal.ConsentCInfo (ConsentID int NULL, LgNo nvarchar(20) NULL, Item1 nvarchar(1200) NULL);
  CREATE TABLE portal.ConsentBInfo (ConsentID int NULL, LgNo nvarchar(20) NULL, ConfirmDate datetime NULL, ContentX nvarchar(500) NULL, Pass bit NULL,
    SignFile nvarchar(100) NULL, ItemData nvarchar(1200) NULL);
  CREATE TABLE portal.EmployeeInfo (CompName nvarchar(20) NULL, CompFullName nvarchar(40) NULL, EFDept nvarchar(20) NULL, ID nvarchar(40) NULL,
    UserID nvarchar(20) NULL, UserName nvarchar(100) NULL, BirthDate date NULL, LeaveDate date NULL);
  CREATE TABLE portal.EmployeeStockInfo (Annual int NULL, UserID nvarchar(20) NULL, UserName nvarchar(20) NULL, InsiteUser nvarchar(4) NULL, BackStockNo int NULL,
    TotalStockNo int NULL, StockTypeName nvarchar(20) NULL, JoinDate nvarchar(20) NULL, BackDate nvarchar(20) NULL, CompBackDate nvarchar(20) NULL,
    CanBack nvarchar(4) NULL, ConfirmTime datetime NULL, DoBack nvarchar(4) NULL);
  CREATE TABLE portal.EmployeeStockLog (Annual int NULL, UserID nvarchar(20) NULL, UserName nvarchar(20) NULL, ConfirmTime datetime NULL, BackStockNo int NULL,
    BankAccount nvarchar(40) NULL, DoBack nvarchar(4) NULL);
  CREATE TABLE portal.SendMailLog (SN int IDENTITY(1,1) NOT NULL, SenderName nvarchar(40) NULL, SenderID nvarchar(40) NULL, Dept nvarchar(20) NULL,
    Receiver nvarchar(100) NULL, MailMoney nvarchar(40) NULL, MailReturnMoney nvarchar(40) NULL, MailMoneySplit nvarchar(60) NULL,
    MailReturnMoneySplit nvarchar(60) NULL, MailAreaNo nvarchar(20) NULL, SendDate date NULL, CallMailNo nvarchar(40) NULL, MailType nvarchar(10) NULL,
    IsActive bit NULL CONSTRAINT DF_p7_SendMailLog_IsActive DEFAULT (1));
  CREATE TABLE portal.ContentX (LgID nvarchar(100) NULL, LgName nvarchar(100) NULL, ContentType nvarchar(100) NULL, ImgPath nvarchar(300) NULL,
    ContentX nvarchar(max) NULL, StartDate nvarchar(100) NULL, EndDate nvarchar(100) NULL, indexContent nvarchar(200) NULL, Pubtime nvarchar(100) NULL,
    Classtype nvarchar(100) NULL, UpDown nvarchar(100) NULL, GUID nvarchar(100) NULL, Content_main nvarchar(max) NULL);
  CREATE TABLE portal.ContentXMessage (GUID nvarchar(100) NULL, ContentType nvarchar(20) NULL, LgNo nvarchar(20) NULL, LgName nvarchar(20) NULL,
    Message nvarchar(400) NULL, UpDateTime datetime NULL, DeleteDate datetime NULL, IsActive bit NULL);
  CREATE TABLE portal.TVShowInfo (_Index tinyint NULL, Fontsize int NULL, Message nvarchar(500) NULL, IsActive bit NULL);
  CREATE TABLE portal.TVImgInfo (_Index tinyint NULL, ImgPath nvarchar(1000) NULL, Message nvarchar(1000) NULL, IsActive bit NULL);`;

describe('P7 臨時服務(SQL Server)', { skip: enabled ? false : 'PORTAL_TEST_DB_NAME 未設定' }, () => {
  let admin: sql.ConnectionPool;
  let sources: Sources;

  before(async () => {
    const cfg = migrateSqlConfig(process.env, database);
    await runMigrations(cfg);
    admin = await openPool(cfg, { appName: 'giganexus-portal-int-p7', poolMax: 4 });
    await admin.request().batch(`IF DB_NAME() NOT LIKE N'%[_]poc[_]test' THROW 50001, N'不是整合測試專用庫', 1;\n${DROP}\n${CREATE}`);
    const p = `${database}.portal`;
    sources = Sources.fromEnv('copy', database!, { PORTAL_SRC_PORTALSOLAR: p, PORTAL_SRC_LOS: p, PORTAL_SRC_MISDB: p });
  });
  after(async () => {
    await admin?.request().batch(`${DROP}\nDELETE FROM portal.consent_sign; DELETE FROM portal.tv_image;`);
    await admin?.close();
  });
  beforeEach(async () => {
    await admin.request().batch(`${TABLES.map((t) => `DELETE FROM portal.[${t}];`).join(' ')} DELETE FROM portal.consent_sign; DELETE FROM portal.tv_image;`);
    await admin.request().batch(`
      INSERT INTO portal.EmployeeInfo (CompName, CompFullName, EFDept, ID, UserID, UserName, BirthDate, LeaveDate) VALUES
        (N'禾迅', N'禾迅科技股份有限公司', N'S1800', N'A123456789', N'S112009', N'測試員', '1990-01-02', NULL),
        (N'禾迅', N'禾迅科技股份有限公司', N'S1800', NULL, N'S100001', N'王小明', NULL, '2025-01-01');`);
  });

  it('同意書:GUID 版與編號版的讀寫、擋重簽', async () => {
    const repo = new MssqlConsentRepo(admin, sources);
    await admin.request()
      .batch(`INSERT INTO portal.ConsentX (GUID, indexConsent, Consent_main, StartDate, EndDate, Kdept, Kpep) VALUES (N'${GUID.toUpperCase()}', N'福委會同意書', N'<p>UserName</p>', N'2026/10/01', NULL, N'all', NULL);
        INSERT INTO portal.ConsentCInfo VALUES (20260814, N's112009 ', NULL);`);
    assert.equal((await repo.xConsents())[0]!.guid, GUID);
    assert.equal((await repo.xConsent(GUID))!.body, '<p>UserName</p>');
    assert.deepEqual(
      (await repo.defs()).find((d) => d.consentId === 20260814),
      {
        consentId: 20260814,
        kind: 'account-survey',
        title: '2026年禾迅現金增資集保帳號調查',
        startDate: '2026-08-14',
        endDate: null,
        requireSign: false,
        active: true,
      },
      'migration 種子',
    );
    assert.deepEqual(await repo.assigned('S112009'), [20260814]);
    assert.equal((await repo.employee('S112009'))!.nationalId, 'A123456789');
    const [a, b] = await Promise.all([repo.signX(GUID, 'S112009', SIGN), repo.signX(GUID, 'S112009', SIGN)]);
    assert.deepEqual([a.ok, b.ok].sort(), [false, true], '同時送出只寫一筆');
    const xb = await admin.request().query<{ n: number }>(`SELECT COUNT(*) AS n FROM portal.ConsentXB WHERE ConfirmDate IS NOT NULL`);
    assert.equal(xb.recordset[0]!.n, 1);
    assert.ok((await repo.xSigned('S112009')).has(GUID));
    const s = await repo.signB(20260814, 'S112009', '03;戶籍;通訊;12345678901', null);
    assert.ok(s.ok);
    assert.equal((await repo.signB(20260814, 'S112009', null, null)).ok, false);
    const bi = await admin.request().query<{ ItemData: string; SignFile: string | null }>(`SELECT ItemData, SignFile FROM portal.ConsentBInfo`);
    assert.deepEqual(bi.recordset, [{ ItemData: '03;戶籍;通訊;12345678901', SignFile: null }]);
    const sg = await admin.request().query<{ n: number }>(`SELECT COUNT(*) AS n FROM portal.consent_sign WHERE file_id = '${SIGN}'`);
    assert.equal(sg.recordset[0]!.n, 1);
  });

  it('員工持股:本人資料與每年度一筆', async () => {
    const repo = new MssqlStockRepo(admin, sources);
    await admin.request()
      .batch(`INSERT INTO portal.EmployeeStockInfo (Annual, UserID, UserName, BackStockNo, TotalStockNo, StockTypeName, JoinDate, BackDate, CanBack) VALUES
      (2026, N'S112009', N'測試員', 120, 600, N'自提', N'2021年9月', N'2024年11月', N'Y'), (2026, N'S112009', N'測試員', NULL, 600, N'公提', N'2021年9月', NULL, N'N'),
      (2026, N'S100001', N'王小明', 10, 50, N'自提', NULL, NULL, N'Y');`);
    const rows = await repo.rows('S112009');
    assert.equal(rows.length, 2);
    assert.equal(rows.find((r) => r.stockType === '自提')!.canBack, true);
    const d = { annual: 2026, empNo: 'S112009', userName: 'S112009', backStockNo: 120, doBack: 'Y' as const, bankAccount: '12345678901' };
    const [a, b] = await Promise.all([repo.decide(d), repo.decide(d)]);
    assert.deepEqual([a, b].sort(), [false, true]);
    const logs = await repo.logs('S112009');
    assert.deepEqual([logs.length, logs[0]!.doBack, logs[0]!.backStockNo, logs[0]!.bankAccount], [1, 'Y', 120, '12345678901']);
    assert.match(logs[0]!.confirmTime!, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('中華郵政:在職寄件人、本人清單、郵資鎖定', async () => {
    const repo = new MssqlPostRepo(admin, sources);
    assert.equal(await repo.activeEmployee('S100001'), null, '離職');
    assert.deepEqual(await repo.activeEmployee('S112009'), { empNo: 'S112009', name: '測試員', dept: 'S1800' });
    assert.deepEqual(
      (await repo.searchEmployees('測試', 20)).map((x) => x.empNo),
      ['S112009'],
    );
    assert.deepEqual(await repo.searchEmployees('%', 20), [], 'LIKE 萬用字元跳脫');
    const input = { senderId: 'S112009', senderName: '測試員', dept: 'S1800', receiver: '新竹縣政府', zip: '302', sendDate: '2026-10-23', mailType: '掛號' };
    const sn = await repo.create(input);
    const list = await repo.list('S112009', '2026-10-01', '2026-10-31');
    assert.deepEqual([list.length, list[0]!.sn, list[0]!.locked, list[0]!.sendDate], [1, sn, false, '2026-10-23']);
    assert.equal(await repo.update(sn, 'S100001', input), 'forbidden');
    await admin.request().query(`UPDATE portal.SendMailLog SET MailMoney = N'35' WHERE SN = ${sn}`);
    assert.equal(await repo.void(sn, 'S112009'), 'locked');
    await admin.request().query(`UPDATE portal.SendMailLog SET MailMoney = NULL WHERE SN = ${sn}`);
    assert.equal(await repo.update(sn, 'S112009', { ...input, receiver: '改' }), 'ok');
    assert.equal(await repo.void(sn, 'S112009'), 'ok');
    assert.equal(await repo.void(sn, 'S112009'), 'not-found');
    assert.equal((await repo.list('S112009', '2026-10-01', '2026-10-31')).length, 0);
  });

  it('內部拍賣:期間、最高價與併發出價、刪除', async () => {
    const repo = new MssqlAuctionRepo(admin, sources);
    await admin.request().batch(`INSERT INTO portal.ContentX (ContentType, GUID, indexContent, Content_main, StartDate, EndDate, UpDown) VALUES
      (N'購物台', N'${ITEM}', N'公務車', N'<p>x</p>', N'2026/10/01', N'2026/10/31', NULL),
      (N'購物台', N'ba76b331-52a4-41d3-9831-154330f139f0', N'下架品', NULL, NULL, NULL, N'Down'),
      (N'最新消息', N'698652e1-f316-41de-95d3-ab7e487178a1', N'公告', NULL, NULL, NULL, NULL);
      INSERT INTO portal.ContentXMessage (GUID, ContentType, LgNo, LgName, Message, UpDateTime, IsActive) VALUES
      (N'${ITEM}', N'購物台', N'S100001', N'王小明', N'10,000', '2026-10-20 09:00:00', 1), (N'${ITEM}', N'購物台', N'S100002', N'甲', N'99999', '2026-10-20 10:00:00', 0),
      (N'${ITEM}', N'購物台', N'S100003', N'乙', N'看起來不錯', '2026-10-20 11:00:00', 1);`);
    assert.deepEqual(
      (await repo.items('2026/10/23')).map((i) => i.guid),
      [ITEM],
    );
    assert.equal((await repo.items('2026/11/01')).length, 0);
    const bids = await repo.bids([ITEM]);
    assert.deepEqual(
      bids.map((b) => b.amount),
      [null, 10000],
      '已刪除不列、非數字為 null、千分位可解析',
    );
    // 公告留言(ContentType 不是購物台)不列、不能刪(資安審查 M2)
    await admin
      .request()
      .query(
        `INSERT INTO portal.ContentXMessage (GUID, ContentType, LgNo, LgName, Message, UpDateTime, IsActive) VALUES (N'698652e1-f316-41de-95d3-ab7e487178a1', N'最新消息', N'S100005', N'丁', N'留言', '2026-10-20 12:00:00', 1)`,
      );
    assert.deepEqual(await repo.bids(['698652e1-f316-41de-95d3-ab7e487178a1']), []);
    assert.equal(await repo.deleteBid('698652e1-f316-41de-95d3-ab7e487178a1', '2026-10-20 12:00:00.000|S100005'), false);
    assert.deepEqual(await repo.placeBid({ guid: ITEM, today: '2026/10/23', empNo: 'S112009', name: '測試員', amount: 10500, step: 1000 }), {
      result: 'too-low',
      highest: 10000,
    });
    assert.deepEqual(await repo.placeBid({ guid: ITEM, today: '2026/11/01', empNo: 'S112009', name: '測試員', amount: 20000, step: 1000 }), {
      result: 'ended',
    });
    const [a, b] = await Promise.all([
      repo.placeBid({ guid: ITEM, today: '2026/10/23', empNo: 'S112009', name: '測試員', amount: 11000, step: 1000 }),
      repo.placeBid({ guid: ITEM, today: '2026/10/23', empNo: 'S100004', name: '丙', amount: 11000, step: 1000 }),
    ]);
    assert.deepEqual([a.result, b.result].sort(), ['ok', 'too-low'], '同時同價只成功一筆');
    const after1 = await repo.bids([ITEM]);
    const top = after1.find((x) => x.amount === 11000)!;
    assert.match(top.key, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\|S1/);
    assert.equal(await repo.deleteBid(ITEM, top.key), true);
    assert.equal(await repo.deleteBid(ITEM, top.key), false);
    const del = await admin.request().query<{ n: number }>(`SELECT COUNT(*) AS n FROM portal.ContentXMessage WHERE IsActive = 0 AND DeleteDate IS NOT NULL`);
    assert.equal(del.recordset[0]!.n, 1);
  });

  it('電視看板:跑馬燈、舊圖與新圖', async () => {
    const repo = new MssqlTvRepo(admin, sources);
    assert.equal(await repo.message(), null);
    await repo.setMessage({ message: '第一次', fontSize: 20 });
    await repo.setMessage({ message: '歡迎', fontSize: 30 });
    assert.deepEqual(await repo.message(), { message: '歡迎', fontSize: 30 });
    const n = await admin.request().query<{ n: number }>(`SELECT COUNT(*) AS n FROM portal.TVShowInfo`);
    assert.equal(n.recordset[0]!.n, 1, '沒有資料時新增一列,之後只更新');
    await admin.request().batch(`INSERT INTO portal.TVImgInfo (_Index, ImgPath, IsActive) VALUES (1, N'a.jpg', 1), (2, N'b.jpg', 0);`);
    assert.equal(await repo.updateLegacy('b.jpg', 0, true), 1);
    assert.deepEqual(
      (await repo.legacyImages()).map((x) => [x.path, x.index, x.active]),
      [
        ['b.jpg', 0, true],
        ['a.jpg', 1, true],
      ],
    );
    const img = await repo.addImage(SIGN, 'new.png', 3, 'S112009');
    assert.equal(await repo.updateNew(img.id, 5, false, 'S112009'), true);
    assert.deepEqual(
      (await repo.newImages()).map((x) => [x.fileName, x.sort, x.active]),
      [['new.png', 5, false]],
    );
    assert.equal(await repo.deleteNew(img.id), true);
  });
});
