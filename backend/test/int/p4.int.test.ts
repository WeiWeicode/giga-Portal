/**
 * 整合測試(npm run test:int):P4 待我簽核與表單下載的 SQL —
 *   - Drizzle:表單分類 / 表單(migration 20261022224624_p4_forms、唯一名稱、FK、停用、分類使用中不能刪)
 *     在整合測試專用庫(PORTAL_TEST_DB_NAME,*_poc_test)清空 schema portal 後重新 migrate;不碰 giganexus_gw_test 與 src_*
 *   - NaNa(BPM 191,唯讀帳號 portal_bpm_ro):待簽核 / 我送出的 / 已簽核的 SQL 在實際資料庫可執行、欄位授權足夠(只 SELECT)
 *     工號以 BPM_INT_EMP 指定(預設 S090005,6_todo_viewer 實測帳號);未設定 BPM_DB_HOST 時略過
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type sql from 'mssql';
import { createDb, openPool } from '../../src/db/client.js';
import { migrateSqlConfig, runMigrations } from '../../src/migrate.js';
import { NanaBpmRepo } from '../../src/modules/bpm/nana-repo.js';
import { DrizzleFormRepo } from '../../src/modules/forms/drizzle-repo.js';
import { FormService } from '../../src/modules/forms/forms.js';

const database = process.env.PORTAL_TEST_DB_NAME?.trim();
const enabled = !!database;
if (enabled && !/_poc_test$/i.test(database!)) throw new Error(`PORTAL_TEST_DB_NAME 必須是 *_poc_test 整合測試庫:${database}(會清空 schema portal)`);
const UUID = '0bc59e51-9188-4e5d-87eb-6467d178efdd';

describe('P4 表單下載(SQL Server)', { skip: enabled ? false : 'PORTAL_TEST_DB_NAME 未設定' }, () => {
  let pool: sql.ConnectionPool;

  before(async () => {
    const migrateCfg = migrateSqlConfig(process.env, database);
    const admin = await openPool(migrateCfg, { appName: 'giganexus-portal-int-p4', poolMax: 1 });
    try {
      // FK:先刪 form_doc 再刪其他表
      await admin.request().batch(`
        IF DB_NAME() NOT LIKE N'%[_]poc[_]test' THROW 50001, N'不是整合測試專用庫,未清空', 1;
        IF OBJECT_ID(N'portal.form_doc') IS NOT NULL DROP TABLE portal.form_doc;
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
      { appName: 'giganexus-portal-int-p4-app', poolMax: 4 },
    );
  });
  after(async () => {
    await pool?.close();
  });

  it('表單分類與表單', async () => {
    const repo = new DrizzleFormRepo(createDb(pool, true));
    const svc = new FormService(repo);
    const hr = await svc.createCategory({ name: '人事', sort: 10 }, 'S1');
    const ga = await svc.createCategory({ name: '總務', sort: 5 }, 'S1');
    await assert.rejects(svc.createCategory({ name: '人事', sort: 1 }, 'S1'), /同名/);
    assert.deepEqual(
      (await repo.categories()).map((c) => c.name),
      ['總務', '人事'],
      '依 sort',
    );
    const f1 = await svc.createForm(
      { categoryId: hr.id, name: '請假單', description: '紙本備用', fileId: UUID, fileName: '請假單.docx', sort: 2, active: true },
      'S1',
    );
    assert.equal(f1.description, '紙本備用');
    assert.ok(!Number.isNaN(Date.parse(f1.updatedAt)));
    const f2 = await svc.createForm({ categoryId: hr.id, name: '舊表', description: null, fileId: UUID, fileName: 'old.pdf', sort: 1, active: false }, 'S1');
    assert.deepEqual(
      (await svc.catalog()).items.map((f) => f.id),
      [f1.id],
      '員工只看啟用中',
    );
    assert.deepEqual(
      (await svc.adminCatalog()).items.map((f) => f.id),
      [f2.id, f1.id],
    );
    const moved = await svc.updateForm(f2.id, { ...f2, categoryId: ga.id, active: true }, 'S2');
    assert.equal(moved.categoryId, ga.id);
    await assert.rejects(svc.updateForm(f2.id, { ...f2, categoryId: 99999 }, 'S2'), /分類/);
    await assert.rejects(svc.deleteCategory(ga.id), /還有表單/);
    await svc.deleteForm(f2.id);
    await svc.deleteCategory(ga.id);
    assert.equal(await repo.categoryExists(ga.id), false);
    assert.equal(await repo.categoryNameTaken('人事', hr.id), false);
    assert.equal((await repo.updateCategory(hr.id, { name: '人資', sort: 1 }, 'S2'))?.name, '人資');
  });
});

describe('P4 待我簽核(BPM NaNa 唯讀)', { skip: process.env.BPM_DB_HOST?.trim() ? false : 'BPM_DB_HOST 未設定' }, () => {
  let repo: NanaBpmRepo;
  const emp = process.env.BPM_INT_EMP?.trim() || 'S090005';

  before(() => {
    repo = new NanaBpmRepo({
      server: process.env.BPM_DB_HOST!.trim(),
      port: Number(process.env.BPM_DB_PORT ?? 1433),
      database: process.env.BPM_DB_NAME || 'NaNa',
      user: process.env.BPM_DB_USER!,
      password: process.env.BPM_DB_PASSWORD!,
    });
  });
  after(async () => {
    await repo?.close();
  });

  it('待簽核、我送出的、已簽核的查詢可執行', async () => {
    const user = await repo.user(emp);
    assert.ok(user, `BPM 找不到 ${emp}(以 BPM_INT_EMP 指定其他工號)`);
    const todos = await repo.todos(user.oid);
    for (const r of todos) assert.ok([0, 1, 97].includes(r.workItemState));
    const open = await repo.requested(user.oid, 'open', 0, 5);
    const all = await repo.requested(user.oid, 'all', 0, 5);
    assert.ok(all.total >= open.total, '全部 ≥ 未結案');
    for (const r of open.rows) assert.equal(r.processState, 1);
    const handled = await repo.handled(user.oid, 0, 5);
    assert.ok(handled.rows.length <= 5 && handled.total >= handled.rows.length);
    for (const r of handled.rows) {
      assert.ok(r.completedAt === null || !Number.isNaN(Date.parse(r.completedAt)));
      assert.ok(r.requesterId === null || r.requesterId === r.requesterId.trim(), '申請人工號已去空白');
    }
    const acts = await repo.openActivities(open.rows.map((r) => r.contextOid));
    assert.ok(acts instanceof Map);
  });
});
