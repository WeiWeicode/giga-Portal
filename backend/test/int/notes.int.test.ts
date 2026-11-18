/**
 * 整合測試(npm run test:int):SQL Server 2012 的整合測試專用庫(PORTAL_TEST_DB_NAME,例 giganexus_gw_poc_test),schema portal。
 *   - 每次清空 portal 的資料表(含 migration 紀錄)後以 portal_migrate 重新 migrate
 *   - 驗證 DrizzleNoteRepo(OUTPUT 子句、排序、只動本人資料);Drizzle 產生的 SQL 經 2012 語法檢查
 * 不可指向 giganexus_gw_test(開發與測試區共用);不碰 gw.*、file_svc.*、src_*。
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type sql from 'mssql';
import { createDb, openPool } from '../../src/db/client.js';
import { migrateSqlConfig, runMigrations } from '../../src/migrate.js';
import { DrizzleNoteRepo } from '../../src/modules/notes/drizzle-repo.js';

const database = process.env.PORTAL_TEST_DB_NAME?.trim();
const enabled = !!database;
// 白名單:只允許名稱以 _poc_test 結尾的整合測試專用庫(SQL Server 名稱不分大小寫);連線後再以 DB_NAME() 確認一次
if (enabled && !/_poc_test$/i.test(database!)) throw new Error(`PORTAL_TEST_DB_NAME 必須是 *_poc_test 整合測試庫:${database}(會清空 schema portal)`);

describe('個人提醒(SQL Server)', { skip: enabled ? false : 'PORTAL_TEST_DB_NAME 未設定' }, () => {
  let pool: sql.ConnectionPool;
  let repo: DrizzleNoteRepo;

  before(async () => {
    const migrateCfg = migrateSqlConfig(process.env, database);
    const admin = await openPool(migrateCfg, { appName: 'giganexus-portal-int-reset', poolMax: 1 });
    try {
      await admin.request().batch(`
        IF DB_NAME() NOT LIKE N'%[_]poc[_]test' THROW 50001, N'不是整合測試專用庫,未清空', 1;
        DECLARE @stmt NVARCHAR(MAX) = N'';
        SELECT @stmt = @stmt + N'DROP TABLE ' + QUOTENAME(s.name) + N'.' + QUOTENAME(t.name) + N';' + CHAR(10)
        FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id WHERE s.name = N'portal';
        EXEC sp_executesql @stmt;`);
    } finally {
      await admin.close();
    }
    await runMigrations(migrateCfg);
    pool = await openPool(
      { ...migrateCfg, user: process.env.PORTAL_DB_USER!, password: process.env.PORTAL_DB_PASSWORD! },
      { appName: 'giganexus-portal-int', poolMax: 2 },
    );
    repo = new DrizzleNoteRepo(createDb(pool, true));
  });
  after(async () => {
    await pool?.close();
  });

  it('SQL Server 上的新增、排序、修改、刪除', async () => {
    const a = await repo.create('S1', { title: '較晚', category: '個人筆記', priority: 'low', dueDate: '2026-12-01' });
    await repo.create('S1', { title: '無到期日', category: '個人筆記', priority: 'low' });
    const early = await repo.create('S1', { title: '較早', category: '個人筆記', priority: 'high', dueDate: '2026-11-01' });
    const other = await repo.create('S2', { title: '別人', category: '個人筆記', priority: 'low' });
    assert.equal(a.dueDate, '2026-12-01');
    assert.equal(a.done, false);

    const done = await repo.update('S1', early.id, { done: true });
    assert.equal(done?.done, true);
    assert.deepEqual(
      (await repo.list('S1')).map((n) => n.title),
      ['較晚', '無到期日', '較早'],
    );
    assert.equal(await repo.count('S1'), 3);

    assert.equal(await repo.update('S1', other.id, { title: 'x' }), null);
    assert.equal(await repo.remove('S1', other.id), false);
    assert.equal(await repo.remove('S2', other.id), true);
  });
});
