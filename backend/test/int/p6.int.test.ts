/**
 * 整合測試(npm run test:int):P6 ESH 證照管理與危害性化學品的 SQL —
 *   - 舊表(PortalSolar License* / ESHChemicalData*、LOS RankInfo):在整合測試專用庫(PORTAL_TEST_DB_NAME,*_poc_test)的 schema portal
 *     建立同結構的表(欄位型別同測試區複本,2026-10-23 查 sys.columns),來源前綴覆寫為 <庫>.portal;測完刪除
 *   - 新表(migration 20261023034541_p6_esh):Logo / 影本 / SDS 登記、工作紀錄 run_key 唯一、寄送紀錄
 *   - NaNa 化學品申報單(191 唯讀):需 05-bpm-readonly-p6.sql 授權後才可執行,設定 BPM_INT_P6=1 才測
 * 不碰 giganexus_gw_test 與 src_*。
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type sql from 'mssql';
import { createDb, openPool } from '../../src/db/client.js';
import { Sources } from '../../src/db/sources.js';
import { migrateSqlConfig, runMigrations } from '../../src/migrate.js';
import { buildRecord } from '../../src/modules/esh/chemical.js';
import { MssqlChemicalRepo, NanaChemicalSource } from '../../src/modules/esh/chemical-repo.js';
import { DrizzleEshRepo } from '../../src/modules/esh/drizzle-repo.js';
import { MssqlEshRepo } from '../../src/modules/esh/repo.js';

const database = process.env.PORTAL_TEST_DB_NAME?.trim();
const enabled = !!database;
if (enabled && !/_poc_test$/i.test(database!)) throw new Error(`PORTAL_TEST_DB_NAME 必須是 *_poc_test 整合測試庫:${database}`);
const UUID = '0bc59e51-9188-4e5d-87eb-6467d178efdd';

const TABLES = [
  'LicenseInfo',
  'LicenseBInfo',
  'LicenseFileA',
  'LicenseFileC',
  'LicenseManagerInfo',
  'LicenseCompanyInfo',
  'RankInfo',
  'ESHChemicalDataA',
  'ESHChemicalDataB',
  'ESHChemicalDataC',
];
const DROP = TABLES.map((t) => `IF OBJECT_ID(N'portal.${t}') IS NOT NULL DROP TABLE portal.[${t}];`).join('\n');
const A_COLS = `EF_ID nvarchar(40) NULL, s_RequesterID_txt nvarchar(10) NULL, s_Requester_txt nvarchar(10) NULL, s_ApplyUserName_txt nvarchar(10) NULL,
  s_DeptID_txt nvarchar(10) NULL, s_DeptName_txt nvarchar(20) NULL, d_CreateDate_txt nvarchar(10) NULL, s_ApplyUserID_txt nvarchar(10) NULL,
  s_UseApplyUserName_txt nvarchar(10) NULL, s_UseDeptID_txt nvarchar(10) NULL, s_UseDeptName_txt nvarchar(40) NULL, s_UseApplyUserID_txt nvarchar(10) NULL,
  i_Amount_txt nvarchar(40) NULL, s_FactoryName nvarchar(40) NULL, s_ProductNumber nvarchar(40) NULL, s_CH_ChemicalName nvarchar(200) NULL,
  s_EN_ChemicalName nvarchar(200) NULL, Input_StorageDept nvarchar(40) NULL, s_StorageNumber nvarchar(40) NULL, s_KeepUserName_txt nvarchar(10) NULL,
  s_KeepDeptID_txt nvarchar(10) NULL, s_KeepDeptName_txt nvarchar(40) NULL, s_KeepUserID_txt nvarchar(10) NULL, RB_For nvarchar(200) NULL,
  s_Reason nvarchar(200) NULL, RB_Attachment nvarchar(200) NULL, Attachment nvarchar(200) NULL, RB_Restrict nvarchar(10) NULL, RB_Path nvarchar(10) NULL,
  RB_Type nvarchar(10) NULL, ddl_InputUnit nvarchar(10) NULL, RBstate nvarchar(10) NULL, s_NoAttachmentPS nvarchar(100) NULL, ddl_FactoryArea nvarchar(40) NULL`;
const CREATE = `
  CREATE TABLE portal.LicenseInfo (LicenseID int IDENTITY(1,1) NOT NULL, LicenseName nvarchar(50) NULL, Script nvarchar(4000) NULL, LogoPath nvarchar(100) NULL,
    ActiveYear float NULL, IsActive bit NULL);
  CREATE TABLE portal.LicenseBInfo (LicenseID int NULL, Company nvarchar(10) NULL, LicenseCount int NULL, Notes nvarchar(350) NULL);
  CREATE TABLE portal.LicenseFileA (ID int IDENTITY(1,1) NOT NULL, LicenseID int NULL, LgNo nvarchar(10) NULL, TrainingDate date NULL, GatDate date NULL,
    Training2Date date NULL, NextTrainingDate date NULL, SendMailDay int NULL, Company nvarchar(10) NULL, IsActive bit NULL);
  CREATE TABLE portal.LicenseFileC (ID int NULL, LgNo nvarchar(10) NULL, FileName nvarchar(100) NULL);
  CREATE TABLE portal.LicenseManagerInfo (Company nvarchar(10) NULL, LgNo nvarchar(10) NULL, SendMail bit NULL);
  CREATE TABLE portal.LicenseCompanyInfo (Company nvarchar(10) NULL, ItemIndex int NULL);
  CREATE TABLE portal.RankInfo (UserID nvarchar(20) NULL, UserName nvarchar(50) NULL, VirtualUserID nvarchar(20) NULL, Dept nvarchar(50) NULL,
    BossID nvarchar(20) NULL, IsMaster bit NULL, LeaveDate date NULL);
  CREATE TABLE portal.ESHChemicalDataA (${A_COLS});
  CREATE TABLE portal.ESHChemicalDataB (EF_ID nvarchar(40) NULL, Item tinyint NULL, s_Composition_CN nvarchar(150) NULL, s_Composition_EN nvarchar(150) NULL,
    s_Composition_CODE nvarchar(40) NULL, s_Composition_CNS nvarchar(100) NULL, s_Composition_Formula nvarchar(100) NULL, s_Composition_Rate nvarchar(100) NULL);
  CREATE TABLE portal.ESHChemicalDataC (EF_ID nvarchar(40) NULL, AttachmentFile nvarchar(200) NULL, logicalName nvarchar(100) NULL);`;

describe('P6 ESH(SQL Server)', { skip: enabled ? false : 'PORTAL_TEST_DB_NAME 未設定' }, () => {
  let admin: sql.ConnectionPool;
  let app: sql.ConnectionPool;
  let repo: MssqlEshRepo;
  let chem: MssqlChemicalRepo;
  let portalRepo: DrizzleEshRepo;

  before(async () => {
    const cfg = migrateSqlConfig(process.env, database);
    await runMigrations(cfg);
    admin = await openPool(cfg, { appName: 'giganexus-portal-int-p6', poolMax: 2 });
    await admin.request().batch(`IF DB_NAME() NOT LIKE N'%[_]poc[_]test' THROW 50001, N'不是整合測試專用庫', 1;\n${DROP}\n${CREATE}`);
    const p = `${database}.portal`;
    const sources = Sources.fromEnv('copy', database!, { PORTAL_SRC_PORTALSOLAR: p, PORTAL_SRC_LOS: p });
    repo = new MssqlEshRepo(admin, sources);
    chem = new MssqlChemicalRepo(admin, sources);
    app = await openPool(
      { ...cfg, user: process.env.PORTAL_DB_USER!, password: process.env.PORTAL_DB_PASSWORD! },
      { appName: 'giganexus-portal-int-p6-app', poolMax: 2 },
    );
    portalRepo = new DrizzleEshRepo(createDb(app, true));
  });
  after(async () => {
    await admin?.request().batch(DROP);
    await admin?.close();
    await app?.close();
  });
  beforeEach(async () => {
    await admin.request().batch(TABLES.map((t) => `DELETE FROM portal.[${t}];`).join(' '));
    await admin.request().batch(`
      INSERT INTO portal.LicenseCompanyInfo VALUES (N'國碩', 1), (N'碩禾', 2);
      INSERT INTO portal.LicenseManagerInfo VALUES (N'碩禾', N'S100001', 1), (N'國碩', N's100001 ', 0), (N'碩禾', N'S100002', 0);
      INSERT INTO portal.RankInfo VALUES (N'S100001', N'管理員', N'S100001', N'S4130', N'S090001', 1, NULL),
        (N'S300001', N'甲', N'S300001', N'S4130', N'S090001', 1, NULL), (N'S300001', N'甲兼', N'V300001', N'S9999', NULL, 0, NULL),
        (N'S399999', N'離職', N'S399999', N'S4130', NULL, 1, '2026-01-01');`);
  });

  it('管理範圍、證照項目與需求', async () => {
    assert.deepEqual(await repo.managerCompanies('S100001'), ['國碩', '碩禾'], '依 ItemIndex、工號不分大小寫與空白');
    assert.deepEqual(await repo.companies(), ['國碩', '碩禾']);
    const id = await repo.createItem({ name: "含單引號 ' 證照", months: 36, script: '<p>說明</p>' });
    assert.equal(await repo.itemNameTaken("含單引號 ' 證照"), true);
    assert.equal(await repo.itemNameTaken("含單引號 ' 證照", id), false);
    assert.equal(await repo.updateItem(id, { name: '證照A', months: 9999999, script: '' }), true);
    assert.equal((await repo.item(id))!.months, 9999999);
    assert.equal(await repo.createNeed('碩禾', id, 2, null), true);
    assert.equal(await repo.createNeed('碩禾', id, 3, null), false, '重複');
    assert.equal(await repo.updateNeed('碩禾', id, 5, '備註'), true);
    assert.deepEqual(
      (await repo.needs(['碩禾'])).map((n) => [n.licenseName, n.required, n.notes]),
      [['證照A', 5, '備註']],
    );
    assert.equal(await repo.deactivateItem(id), true);
    assert.equal((await repo.needs(['碩禾'])).length, 0, '已刪除證照不列');
    assert.equal(await repo.deleteNeed('碩禾', id), true);
  });

  it('持證人員、在職判斷、儀表板與舊站影本', async () => {
    const id = await repo.createItem({ name: '急救人員', months: 36, script: '' });
    await repo.createNeed('碩禾', id, 2, null);
    const w = { company: '碩禾', trainingDate: '2026-01-01', gatDate: null, retrainDate: null, nextTrainingDate: '2028-12-31', notifyDays: 90 };
    const a = await repo.createHolder('S300001', id, w);
    assert.ok(a.ok && !a.reactivated);
    assert.deepEqual(await repo.createHolder('S300001', id, w), { ok: false, reason: 'duplicate' });
    const left = await repo.createHolder('S399999', id, w);
    assert.ok(left.ok);
    const rows = await repo.holders(['碩禾']);
    const s1 = rows.find((r) => r.empNo === 'S300001')!;
    assert.deepEqual(
      [s1.name, s1.dept, s1.bossId, s1.inService, s1.nextTrainingDate, s1.active],
      ['甲', 'S4130', 'S090001', true, '2028-12-31', true],
      '只取主要身分列',
    );
    assert.equal(rows.find((r) => r.empNo === 'S399999')!.inService, false);
    assert.equal((await repo.dashboard('碩禾', '2026-10-23'))[0]!.valid, 1, '離職不算有效');
    assert.equal((await repo.dashboard('碩禾', '2029-01-01'))[0]!.valid, 0, '過期不算有效');
    assert.deepEqual(await repo.person('s300001'), { empNo: 'S300001', name: '甲', dept: 'S4130', bossId: 'S090001', inService: true });
    assert.equal((await repo.person('S399999'))!.inService, false);
    if (!a.ok) return;
    assert.equal(await repo.updateHolder(a.id, { ...w, retrainDate: '2026-10-01', nextTrainingDate: '2029-09-30' }), true);
    assert.equal((await repo.holder(a.id))!.retrainDate, '2026-10-01');
    assert.equal(await repo.deactivateHolder(a.id), true);
    assert.equal(await repo.updateHolder(a.id, w), false, '已刪除不更新');
    const back = await repo.createHolder('S300001', id, w);
    assert.deepEqual(back, { ok: true, id: a.id, reactivated: true }, '復原已刪除的紀錄');
    await admin
      .request()
      .batch(`INSERT INTO portal.LicenseFileC VALUES (${a.id}, N'S300001', N'a.pdf'), (${a.id}, N'S300001', N' '), (${a.id}, N'S300001', NULL)`);
    assert.deepEqual(await repo.legacyDocs([a.id]), [{ holderId: a.id, empNo: 'S300001', fileName: 'a.pdf' }]);
    assert.equal(await repo.deleteLegacyDoc(a.id, 'S300001', 'a.pdf'), true);
  });

  it('證照管理員:重複、通知開關、最後一位', async () => {
    assert.equal(await repo.createManager('碩禾', 'S300001', true), true);
    assert.equal(await repo.createManager('碩禾', 'S300001', true), false);
    assert.equal(await repo.updateManagerSendMail('碩禾', 'S300001', false), true);
    const m = await repo.managers(['碩禾']);
    assert.deepEqual(
      m.map((x) => [x.empNo, x.sendMail, x.inService]),
      [
        ['S100001', true, true],
        ['S100002', false, false],
        ['S300001', false, true],
      ],
    );
    assert.equal(await repo.deleteManager('國碩', 'S100001'), 'last');
    assert.equal(await repo.deleteManager('碩禾', 'S999'), 'not-found');
    assert.equal(await repo.deleteManager('碩禾', 'S300001'), 'ok');
  });

  it('新表:檔案登記、工作紀錄、寄送紀錄', async () => {
    await portalRepo.setLogo(7, { fileId: UUID, fileName: 'a.png' }, 'S1');
    await portalRepo.setLogo(7, { fileId: UUID, fileName: 'b.png' }, 'S1');
    assert.equal((await portalRepo.logos([7, 8])).get(7)!.fileName, 'b.png', '同一證照取代');
    assert.equal(await portalRepo.deleteLogo(7), true);
    const d = await portalRepo.addDoc(5, 'S300001', { fileId: UUID, fileName: '證照.pdf' }, 'S1');
    assert.equal((await portalRepo.docs([5])).length, 1);
    assert.equal(await portalRepo.deleteDoc(6, d.id), false);
    assert.equal(await portalRepo.deleteDoc(5, d.id), true);
    await portalRepo.setSds('SHR008_1', { fileId: UUID, fileName: 'sds.pdf' }, 'S1');
    assert.equal((await portalRepo.sds(['SHR008_1'])).size, 1);
    const key = `int-${Date.now()}`;
    const run = await portalRepo.start({ job: 'notify', trigger: 'manual', runKey: key, requestedBy: 'S1', scope: '碩禾|國碩' });
    assert.ok(run);
    assert.equal(await portalRepo.start({ job: 'notify', trigger: 'schedule', runKey: key, requestedBy: null, scope: '' }), null, 'run_key 唯一');
    await portalRepo.addLogs([{ runId: run!, kind: 'holder', empNo: 'S300001', company: '碩禾', itemCount: 2, status: 'dry-run', message: null }]);
    await portalRepo.finish(run!, 'ok', 'dry-run;queued=0');
    const recent = await portalRepo.recentRuns('notify', 5);
    assert.equal(recent[0]!.status, 'ok');
    assert.ok((await portalRepo.manualRunsSince('notify', new Date(Date.now() - 60_000))).some((r) => r.id === run));
    assert.equal((await portalRepo.logs(run!))[0]!.itemCount, 2);
  });

  it('化學品:整批交易寫入、查詢、成份以 ID 對應', async () => {
    const xml = (name: string, restrict: string, cas: string) =>
      `<r><s_RequesterID_txt id="s_RequesterID_txt">S1</s_RequesterID_txt><d_CreateDate_txt id="d_CreateDate_txt">2026/09/10</d_CreateDate_txt>
       <s_CH_ChemicalName id="s_CH_ChemicalName">${name}</s_CH_ChemicalName><RB_Restrict id="RB_Restrict">${restrict}</RB_Restrict>
       <s_Composition_CN1 id="s_Composition_CN1">${name}成份</s_Composition_CN1><s_Composition_CNS1 id="s_Composition_CNS1">${cas}</s_Composition_CNS1></r>`;
    const rec = (sn: string, name: string, restrict: string, cas: string) => {
      const r = buildRecord(
        { serialNumber: sn, fieldValues: xml(name, restrict, cas), doc: { logicalName: 'S.pdf', physicalName: 'p1', extension: 'pdf' } },
        'http://bpm/SDSFILES',
      );
      assert.ok(r.ok);
      return r.record;
    };
    await admin.request()
      .batch(`INSERT INTO portal.ESHChemicalDataA (EF_ID, s_RequesterID_txt, d_CreateDate_txt, RB_Restrict) VALUES (N'SHR008_1', N'X', N'2020/01/01', N'不列管');
      INSERT INTO portal.ESHChemicalDataB (EF_ID, Item, s_Composition_CN) VALUES (N'SHR008_1', 1, N'舊成份'), (N'SHR008_1', 2, N'舊成份2');`);
    await chem.replace([rec('SHR008_1', '甲', '0', '1-1-1'), rec('SHR008_2', '乙', '1', '2-2-2')]);
    const un = await chem.list({ restrict: '不列管', from: '2026/01/01', to: '2026/12/31', keyword: null, page: 1, pageSize: 10 });
    assert.equal(un.total, 1);
    assert.equal(un.items[0]!.a.s_CH_ChemicalName, '甲', '先刪後寫');
    assert.equal(un.items[0]!.attachmentFile, 'http://bpm/SDSFILES/p1.pdf');
    const comps = await chem.components(['SHR008_1', 'SHR008_2']);
    assert.deepEqual(
      comps.get('SHR008_1')!.map((c) => c.cn),
      ['甲成份'],
      '舊成份刪除',
    );
    assert.equal(comps.get('SHR008_2')![0]!.cas, '2-2-2');
    assert.equal(
      (await chem.list({ restrict: '列管', from: '2026/01/01', to: '2026/12/31', keyword: '2-2-2', page: 1, pageSize: 10 })).total,
      1,
      '關鍵字查 CAS',
    );
    assert.equal((await chem.list({ restrict: '列管', from: '2026/01/01', to: '2026/12/31', keyword: "%' OR 1=1 --", page: 1, pageSize: 10 })).total, 0);
    // 交易:第二筆寫入失敗(超長)時第一筆也回復
    const bad = rec('SHR008_3', '丙', '0', '3');
    bad.a.s_CH_ChemicalName = 'x'.repeat(300);
    await assert.rejects(chem.replace([rec('SHR008_1', '丁', '0', '4'), bad]));
    assert.equal((await chem.get('SHR008_1'))!.a.s_CH_ChemicalName, '甲', '整批回復');
    assert.equal(await chem.get('SHR008_3'), null);
  });
});

describe(
  'P6 化學品申報單(BPM NaNa 唯讀)',
  { skip: process.env.BPM_DB_HOST?.trim() && process.env.BPM_INT_P6 === '1' ? false : 'BPM_INT_P6 未設定(需先執行 05-bpm-readonly-p6.sql)' },
  () => {
    it('化學品申報單查詢可執行', async () => {
      const src = new NanaChemicalSource({
        server: process.env.BPM_DB_HOST!.trim(),
        port: Number(process.env.BPM_DB_PORT ?? 1433),
        database: process.env.BPM_DB_NAME || 'NaNa',
        user: process.env.BPM_DB_USER!,
        password: process.env.BPM_DB_PASSWORD!,
      });
      try {
        const forms = await src.forms('2026-01-01', '2026-10-23');
        for (const f of forms.slice(0, 20)) assert.ok(buildRecord(f, 'http://bpm/SDSFILES'));
      } finally {
        await src.close();
      }
    });
  },
);
