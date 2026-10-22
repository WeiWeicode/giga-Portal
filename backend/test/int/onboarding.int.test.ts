/**
 * 整合測試(npm run test:int):以 SQL Server 2012 驗證 MssqlOnboardingRepo 的 SQL(日期字串轉換、同日不重複、先刪後寫的交易)。
 * 在整合測試專用庫(PORTAL_TEST_DB_NAME,*_poc_test)的 schema portal 建立與 PortalSolar 同結構的 NewPepR / HRNewPtest,
 * 來源前綴覆寫為 <庫>.portal;測完刪除。不碰 giganexus_gw_test 與 src_*。
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type sql from 'mssql';
import { openPool } from '../../src/db/client.js';
import { Sources } from '../../src/db/sources.js';
import { migrateSqlConfig } from '../../src/migrate.js';
import { MssqlOnboardingRepo } from '../../src/routes/onboarding.js';

const database = process.env.PORTAL_TEST_DB_NAME?.trim();
const enabled = !!database;
if (enabled && !/_poc_test$/i.test(database!)) throw new Error(`PORTAL_TEST_DB_NAME 必須是 *_poc_test 整合測試庫:${database}`);

const tCols = Array.from({ length: 31 }, (_, i) => `t${i + 1} nvarchar(${i === 13 ? 50 : 5}) NULL`).join(', ');
const DROP = `IF OBJECT_ID(N'portal.NewPepR') IS NOT NULL DROP TABLE portal.NewPepR;
              IF OBJECT_ID(N'portal.HRNewPtest') IS NOT NULL DROP TABLE portal.HRNewPtest;`;

describe('新人導覽(SQL Server)', { skip: enabled ? false : 'PORTAL_TEST_DB_NAME 未設定' }, () => {
  let admin: sql.ConnectionPool;
  let repo: MssqlOnboardingRepo;

  before(async () => {
    admin = await openPool(migrateSqlConfig(process.env, database), { appName: 'giganexus-portal-int-onboarding', poolMax: 2 });
    await admin.request().batch(`
      IF DB_NAME() NOT LIKE N'%[_]poc[_]test' THROW 50001, N'不是整合測試專用庫', 1;
      ${DROP}
      CREATE TABLE portal.NewPepR (LgNo nvarchar(50) NULL, LgTime nvarchar(50) NULL);
      CREATE TABLE portal.HRNewPtest (LgNo nvarchar(50) NULL, ${tCols}, a01 nvarchar(max) NULL, MakeTime nvarchar(50) NULL, PGrade nvarchar(50) NULL);`);
    const sources = Sources.fromEnv('copy', database!, { PORTAL_SRC_PORTALSOLAR: `${database}.portal` });
    repo = new MssqlOnboardingRepo(admin, sources);
  });
  after(async () => {
    await admin?.request().batch(DROP);
    await admin?.close();
  });

  it('閱讀紀錄同一天不重複、狀態取最近日期', async () => {
    await admin.request().batch(`INSERT INTO portal.NewPepR VALUES (N'S1', N'2026/09/09'), (N'S1', N'壞資料'), (N'S2', N'2026/12/31')`);
    await repo.markRead('S1', '2026/10/05');
    await repo.markRead('S1', '2026/10/05');
    const n = await admin.request().query<{ n: number }>(`SELECT COUNT(*) AS n FROM portal.NewPepR WHERE LgNo = N'S1' AND LgTime = N'2026/10/05'`);
    assert.equal(n.recordset[0]!.n, 1);
    assert.deepEqual(await repo.status('S1'), { readAt: '2026-10-05', passedAt: null });
    assert.deepEqual(await repo.status('S9'), { readAt: null, passedAt: null });
  });

  it('通過時先刪本人舊紀錄再寫入,只認 PGrade 100', async () => {
    await admin.request().batch(`INSERT INTO portal.HRNewPtest (LgNo, t1, MakeTime, PGrade) VALUES
      (N'S1', N'是', N'2020/1/2', N'155'), (N'S1', N'否', N'2025/3/4', N'100'), (N'S2', N'是', N'2025/3/4', N'100')`);
    assert.equal((await repo.status('S1')).passedAt, '2025-03-04');
    const answers = Array.from({ length: 20 }, (_, i) => (i % 3 ? '是' : '否'));
    await repo.savePass('S1', { answers, comment: '意見'.repeat(100), makeTime: '2026/9/9' });
    const r = await admin.request().query(`SELECT * FROM portal.HRNewPtest WHERE LgNo = N'S1'`);
    assert.equal(r.recordset.length, 1);
    const row = r.recordset[0] as Record<string, string | null>;
    assert.deepEqual(
      Array.from({ length: 20 }, (_, i) => row[`t${i + 1}`]),
      answers,
    );
    assert.equal(row.t21, null);
    assert.equal(row.a01, '意見'.repeat(100), 'a01 不截斷');
    assert.deepEqual([row.MakeTime, row.PGrade], ['2026/9/9', '100']);
    assert.equal((await repo.status('S1')).passedAt, '2026-09-09');
    const other = await admin.request().query<{ n: number }>(`SELECT COUNT(*) AS n FROM portal.HRNewPtest WHERE LgNo = N'S2'`);
    assert.equal(other.recordset[0]!.n, 1, '不動別人的紀錄');
  });

  it('寫入失敗時整筆回復', async () => {
    // 以 CHECK 讓 INSERT 失敗(DELETE 已執行),確認交易回復
    await admin.request().batch(`ALTER TABLE portal.HRNewPtest ADD CONSTRAINT ck_it_onboarding CHECK (a01 <> N'boom')`);
    await assert.rejects(repo.savePass('S2', { answers: Array(20).fill('是'), comment: 'boom', makeTime: '2026/9/9' }));
    const r = await admin.request().query<{ n: number }>(`SELECT COUNT(*) AS n FROM portal.HRNewPtest WHERE LgNo = N'S2'`);
    assert.equal(r.recordset[0]!.n, 1, '舊紀錄仍在(DELETE 已回復)');
  });
});
