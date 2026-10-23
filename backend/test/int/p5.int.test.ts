/**
 * 整合測試(npm run test:int):P5 主管專區寫入舊表的 SQL(交易、鎖定、重複、流水號、中文表名、varchar / money 欄位)。
 * 在整合測試專用庫(PORTAL_TEST_DB_NAME,*_poc_test)的 schema portal 建立與 PortalSolar / LOS / Budget 同結構的表
 * (欄位型別同測試區複本,2026-10-23 查 sys.columns),來源前綴覆寫為 <庫>.portal;測完刪除。不碰 giganexus_gw_test 與 src_*。
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type sql from 'mssql';
import { openPool } from '../../src/db/client.js';
import { Sources } from '../../src/db/sources.js';
import { migrateSqlConfig } from '../../src/migrate.js';
import { isLocked } from '../../src/modules/manager/budget.js';
import { MssqlBudgetRepo, type BudgetVersion } from '../../src/modules/manager/budget-repo.js';
import { MssqlStaffRepo } from '../../src/modules/manager/staff.js';
import { MssqlTrainingRepo } from '../../src/modules/manager/training-repo.js';
import { validateCourse } from '../../src/modules/manager/training-rules.js';

const database = process.env.PORTAL_TEST_DB_NAME?.trim();
const enabled = !!database;
if (enabled && !/_poc_test$/i.test(database!)) throw new Error(`PORTAL_TEST_DB_NAME 必須是 *_poc_test 整合測試庫:${database}`);

const TABLES = [
  'ELClassAnnual',
  'ELPlanDept',
  'ELClassForm',
  'ELClassStatus',
  'PersonalPropertyInfo',
  'DeptInfo',
  'EmployeeInfo',
  'BudgetVersionInfo',
  'DeptBudgetList',
  'BudgetData',
  'DeptBudgetMark',
  '部門狀態',
  '部門備註',
  'AccountingCourses',
  'AcctProductFuncDept',
  'AcctFunc',
  'AcctProductItem',
  'AcctProduct',
];
const DROP = TABLES.map((t) => `IF OBJECT_ID(N'portal.${t}') IS NOT NULL DROP TABLE portal.[${t}];`).join('\n');
const CREATE = `
  CREATE TABLE portal.ELClassAnnual (Annual nvarchar(10) NULL);
  CREATE TABLE portal.ELPlanDept (Annual int NULL, XDept nvarchar(50) NULL, XLgNo nvarchar(50) NULL, XName nvarchar(50) NULL);
  CREATE TABLE portal.ELClassForm (ClassID nvarchar(20) NULL, Annual nvarchar(4) NULL, Dept nvarchar(10) NULL, ClassName nvarchar(100) NULL,
    ClassAgenda nvarchar(200) NULL, ClassType nvarchar(10) NULL, ClassSubType nvarchar(10) NULL, ClassWhere nvarchar(10) NULL, ClassOnType nvarchar(5) NULL,
    ClassTestType nvarchar(10) NULL, TeacherID nvarchar(10) NULL, TeacherName nvarchar(30) NULL, TeacherUnit nvarchar(30) NULL, Season nvarchar(20) NULL,
    Hour float NULL, Cost1 int NULL, Cost2 int NULL, Cost3 int NULL, Cost int NULL, JoinDept nvarchar(50) NULL, JoinPersons float NULL, Note nvarchar(150) NULL,
    IsOK bit NULL, IsCancel bit NULL);
  CREATE TABLE portal.ELClassStatus (Annual nvarchar(4) NULL, Dept nvarchar(10) NULL, BossID nvarchar(10) NULL, Status nvarchar(10) NULL);
  CREATE TABLE portal.PersonalPropertyInfo (CompDB nvarchar(10) NULL, FAJ02 nvarchar(40) NULL, FAJ022 nvarchar(40) NULL, UserID nvarchar(10) NULL,
    Note nvarchar(150) NULL, PicFile nvarchar(100) NULL);
  CREATE TABLE portal.DeptInfo (Dept nvarchar(20) NULL, DeptName nvarchar(50) NULL, ParentDept nvarchar(10) NULL);
  CREATE TABLE portal.EmployeeInfo (UserID nvarchar(10) NULL, UserName nvarchar(50) NULL, CompDB nvarchar(5) NULL, EFDept nvarchar(10) NULL,
    EFDeptName nvarchar(30) NULL, JobDate date NULL, LeaveDate date NULL);
  CREATE TABLE portal.BudgetVersionInfo (Flag int NOT NULL, IsFinal bit NULL, CID int NULL, YYYY int NULL, ver int NULL, Standard nvarchar(10) NULL,
    CompanyID nvarchar(10) NULL);
  CREATE TABLE portal.DeptBudgetList (Flag int NULL, DeptID varchar(10) NULL, AccountingCode varchar(10) NULL, Month varchar(2) NULL, Amount varchar(20) NULL);
  CREATE TABLE portal.BudgetData (Flag int NULL, DeptID varchar(10) NULL, AccountingCode varchar(10) NULL, Month int NULL, amt money NULL, PS nvarchar(50) NULL);
  CREATE TABLE portal.DeptBudgetMark (Flag int NULL, DeptID varchar(50) NULL, AccountingCode varchar(10) NULL, Month tinyint NULL, mark nvarchar(300) NULL);
  CREATE TABLE portal.[部門狀態] (Flag int NULL, DeptID varchar(10) NULL, IsFinish bit NULL, CompanyID varchar(10) NULL, Status int NULL);
  CREATE TABLE portal.[部門備註] (Year char(4) NULL, Version int NULL, Standard varchar(10) NULL, Remark varchar(4000) NULL, CompanyID varchar(50) NULL,
    CompanyName varchar(50) NULL, UpdateID varchar(50) NULL, UpdateTime datetime NULL, DeptID varchar(50) NULL);
  CREATE TABLE portal.AccountingCourses (AccountingCode nvarchar(20) NULL, AccountingName nvarchar(128) NULL, CompanyID nvarchar(40) NULL, IsSum bit NULL);
  CREATE TABLE portal.AcctProductFuncDept (CID int NULL, DeptID nvarchar(10) NULL, AcctHead nvarchar(10) NULL, AcctProduct nvarchar(10) NULL, ProductItem nvarchar(10) NULL);
  CREATE TABLE portal.AcctFunc (CID int NULL, AcctHead nvarchar(10) NULL, HeadName nvarchar(50) NULL);
  CREATE TABLE portal.AcctProductItem (CID int NULL, AcctProduct nvarchar(10) NULL, ProductItem nvarchar(10) NULL, ItemName nvarchar(50) NULL);
  CREATE TABLE portal.AcctProduct (CID int NULL, AcctProduct nvarchar(10) NULL, ProductName nvarchar(50) NULL);`;

const NOW = new Date('2026-10-23T02:00:00Z');
const row = (over: Record<string, unknown> = {}) =>
  validateCourse({
    dept: 'S1810',
    className: "含單引號 ' 的課",
    agenda: '大綱',
    classType: '專業職能',
    subType: '在職訓練課程',
    classWhere: '內訓',
    onType: '實體',
    testType: '測驗',
    teacherName: '王',
    teacherUnit: '資訊',
    seasons: ['1', '3'],
    hour: 1.5,
    cost1: 100,
    cost2: 0,
    cost3: 20,
    joinDept: 'S1810',
    ...over,
  }).row;

describe('主管專區(SQL Server)', { skip: enabled ? false : 'PORTAL_TEST_DB_NAME 未設定' }, () => {
  let admin: sql.ConnectionPool;
  let training: MssqlTrainingRepo;
  let staff: MssqlStaffRepo;
  let budget: MssqlBudgetRepo;
  const V: BudgetVersion = { flag: 154, year: 2026, ver: 1, standard: 'H', isFinal: false, companyId: 'GSMC', cid: 15 };

  before(async () => {
    admin = await openPool(migrateSqlConfig(process.env, database), { appName: 'giganexus-portal-int-p5', poolMax: 4 });
    await admin.request().batch(`IF DB_NAME() NOT LIKE N'%[_]poc[_]test' THROW 50001, N'不是整合測試專用庫', 1;\n${DROP}\n${CREATE}`);
    const p = `${database}.portal`;
    const sources = Sources.fromEnv('copy', database!, { PORTAL_SRC_PORTALSOLAR: p, PORTAL_SRC_LOS: p, PORTAL_SRC_BUDGET: p });
    training = new MssqlTrainingRepo(admin, sources);
    staff = new MssqlStaffRepo(admin, sources);
    budget = new MssqlBudgetRepo(admin, sources);
  });
  after(async () => {
    await admin?.request().batch(DROP);
    await admin?.close();
  });
  beforeEach(async () => {
    await admin.request().batch(TABLES.map((t) => `DELETE FROM portal.[${t}];`).join(' '));
  });

  it('訓練計畫:年度、負責部門、新增流水號、重複、修改、刪除', async () => {
    await admin.request().batch(`
      INSERT INTO portal.ELClassAnnual VALUES (N'2026');
      INSERT INTO portal.ELPlanDept VALUES (2026, N'S1810 ', N'S112009', N'測試'), (2025, N'S1900', N'S112009', N'測試');
      INSERT INTO portal.DeptInfo VALUES (N'S1810', N'網路通訊課', N'S1800');
      INSERT INTO portal.ELClassForm (ClassID, Annual, Dept, ClassName) VALUES (N'N2610007', N'2025', N'S1900', N'舊');`);
    assert.equal(await training.annual(), 2026);
    assert.deepEqual(await training.planDepts('S112009', 2026), [{ code: 'S1810', name: '網路通訊課' }]);
    const a = await training.insert('S112009', 2026, row(), NOW);
    assert.deepEqual(a, { ok: true, classId: 'N2610008' }, '同前綴最大流水 + 1');
    assert.deepEqual(await training.insert('S112009', 2026, row(), NOW), { ok: false, reason: 'duplicate' });
    const c = (await training.course('N2610008'))!;
    assert.deepEqual([c.annual, c.dept, c.season, c.hour, c.cost, c.className], ['2026', 'S1810', '1,3', 1.5, 120, "含單引號 ' 的課"]);
    assert.equal((await training.courses(2026, ['S1810'])).length, 1);
    assert.deepEqual(await training.update('S112009', 2026, 'N2610008', 'S1810', row({ className: '改名' })), { ok: true, classId: 'N2610008' });
    assert.deepEqual(await training.update('S112009', 2026, 'N2610007', 'S1810', row({ className: 'x' })), { ok: false, reason: 'not-found' }, '別年度');
    assert.deepEqual(await training.remove('S112009', 2026, 'N2610008', 'S1810'), { ok: true, classId: 'N2610008' });
    assert.equal((await training.courses(2026, ['S1810'])).length, 0);
  });

  it('訓練計畫:提交一個交易、提交後鎖定(本人或部門)', async () => {
    await training.insert('S112009', 2026, row(), NOW);
    await admin.request().batch(`INSERT INTO portal.ELClassStatus VALUES (N'2026', N'S1800', N'S112009', N'提交');`);
    assert.deepEqual(await training.submit('S112009', 2026, ['S1810'], () => []), { ok: false, reason: 'locked' }, '本人已提交');
    await admin.request().batch(`DELETE FROM portal.ELClassStatus;`);
    const seen: string[] = [];
    const inc = await training.submit('S112009', 2026, ['S1810', 'S1820'], (c) => (seen.push(...c.map((x) => x.dept)), [{ message: '不足' }]));
    assert.deepEqual(inc, { ok: false, reason: 'incomplete', problems: [{ message: '不足' }] });
    assert.deepEqual(seen, ['S1810'], '交易內重讀課程');
    assert.equal(await training.submittedBy('S112009', 2026), false, '未通過不寫狀態');
    assert.deepEqual(await training.submit('S112009', 2026, ['S1810', 'S1820'], () => []), { ok: true });
    assert.equal(await training.submittedBy('S112009', 2026), true);
    assert.deepEqual((await training.submittedDepts(2026, ['S1810', 'S1999'])).sort(), ['S1810']);
    assert.deepEqual(await training.insert('S999', 2026, row({ className: '他人' }), NOW), { ok: false, reason: 'locked' }, '部門已被提交');
    assert.deepEqual(await training.insert('S999', 2026, row({ className: '他部門', dept: 'S1830' }), NOW), { ok: true, classId: 'N2610002' });
  });

  it('資產備註:只更新保管人那一筆,照片不變', async () => {
    await admin.request().batch(`
      INSERT INTO portal.EmployeeInfo VALUES (N'S2', N'B', N'DS11', N'S1810', N'網路通訊課', '2020-01-01', NULL), (N'S3', N'C', N'DS11', N'S1810', NULL, '2020-01-01', '2025-01-01');
      INSERT INTO portal.PersonalPropertyInfo VALUES (N'DS11', N'A001', N'', N'S2', N'舊', N'a.jpg'), (N'DS11', N'A001', N'', N'S100', N'主管寫的', NULL),
        (N'DS11', N'A009', NULL, N'S3', N'離職', NULL);`);
    const list = await staff.propertyNotes(['S1810']);
    assert.deepEqual(
      list.map((x) => [x.empNo, x.assetNo, x.hasPhoto]),
      [['S2', 'A001', true]],
      '離職者不列',
    );
    assert.deepEqual(await staff.currentDepts('S2'), ['S1810']);
    assert.equal(await staff.updateNote({ empNo: 'S2', compDb: 'DS11', assetNo: 'A001', assetSub: null }, '新備註'), 1);
    const r = await admin.request().query(`SELECT UserID, Note, PicFile FROM portal.PersonalPropertyInfo WHERE FAJ02 = N'A001' ORDER BY UserID`);
    assert.deepEqual(
      r.recordset.map((x) => [x.UserID, x.Note, x.PicFile]),
      [
        ['S100', '主管寫的', null],
        ['S2', '新備註', 'a.jpg'],
      ],
    );
  });

  it('預算:科目展開、更新金額 / 備註一個交易、鎖定、送出', async () => {
    await admin.request().batch(`
      INSERT INTO portal.BudgetVersionInfo VALUES (154, 0, 15, 2026, 1, N'H', N'GSMC');
      INSERT INTO portal.AccountingCourses VALUES (N'6200', N'管理費用', N'GSMC', 1), (N'6211', N'租金', N'GSMC', 0), (N'0101', N'零', N'GSMC', 0);
      INSERT INTO portal.DeptBudgetList VALUES (154, 'S1800', '6211', '1', '100'), (154, 'S1800', '6211', '3', '0.00'), (154, 'S1800', '0101', '1', '5');
      INSERT INTO portal.BudgetData VALUES (154, 'S1800', '6211', 3, 0, NULL);
      INSERT INTO portal.AcctProductFuncDept VALUES (15, N'S1800', N'64', N'1', N'01');
      INSERT INTO portal.AcctFunc VALUES (15, N'64', N'研發費用');
      INSERT INTO portal.AcctProductItem VALUES (15, N'1', N'01', N'材料');
      INSERT INTO portal.AcctProduct VALUES (15, N'1', N'產品A');`);
    const d = await budget.applyData(V, 'S1800');
    assert.deepEqual(
      d.accounts.map((a) => [a.code, a.isSum]),
      [
        ['6400', true],
        ['641', true],
        ['64101', false],
        ['6211', false],
      ].sort((x, y) => String(x[0]).localeCompare(String(y[0]))),
      '0 開頭不列;產品功能部門展開合計 / 明細',
    );
    assert.equal(d.cells.find((c) => c.code === '6211' && c.month === 1)!.amount, 100);
    const ok = await budget.save(
      { version: V, dept: 'S1800', empNo: 'S112009', remark: '部門說明', cells: [{ code: '6211', month: 3, amount: 1500.5, mark: '教育訓練' }] },
      isLocked,
    );
    assert.deepEqual(ok, { ok: true });
    const after = await admin.request().query(`
      SELECT (SELECT Amount FROM portal.DeptBudgetList WHERE AccountingCode = '6211' AND Month = '3') AS a,
             (SELECT amt FROM portal.BudgetData WHERE AccountingCode = '6211' AND Month = 3) AS b,
             (SELECT mark FROM portal.DeptBudgetMark WHERE AccountingCode = '6211' AND Month = 3) AS m,
             (SELECT Remark FROM portal.[部門備註] WHERE DeptID = 'S1800' AND Year = '2026') AS r,
             (SELECT UpdateID FROM portal.[部門備註] WHERE DeptID = 'S1800') AS u`);
    assert.deepEqual(after.recordset[0], { a: '1500.5', b: 1500.5, m: '教育訓練', r: '部門說明', u: 'S112009' });
    const miss = await budget.save(
      { version: V, dept: 'S1800', empNo: 'S112009', remark: '不該寫入', cells: [{ code: '6211', month: 4, amount: 1 }] },
      isLocked,
    );
    assert.deepEqual(miss, { ok: false, reason: 'missing', code: '6211', month: 4 });
    assert.equal((await admin.request().query(`SELECT Remark FROM portal.[部門備註]`)).recordset[0].Remark, '部門說明', '失敗時整筆回復');
    assert.deepEqual(await budget.submit(V, 'S1800', isLocked), { ok: true });
    assert.deepEqual(await budget.status(V, 'S1800'), { isFinal: false, status: 1 });
    assert.deepEqual(await budget.save({ version: V, dept: 'S1800', empNo: 'S1', cells: [{ code: '6211', month: 3, amount: 9 }] }, isLocked), {
      ok: false,
      reason: 'locked',
    });
    assert.deepEqual(await budget.submit(V, 'S1800', isLocked), { ok: false });
    const view = await budget.viewData(154, 'S1800', 'GSMC', ['6200'], false);
    assert.deepEqual(
      view.accounts.map((a) => a.code),
      ['6211'],
    );
  });
});
