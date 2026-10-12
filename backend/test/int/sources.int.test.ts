/**
 * 整合測試:以 .env 的 portal_app 連 giganexus_gw_test,確認每個舊庫複本都讀得到(skeleton.feature「就緒檢查回報每個來源是否可讀」)。
 * 只讀系統目錄,不寫入任何資料:npm run test:int
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type sql from 'mssql';
import { loadConfig } from '../../src/config.js';
import { openPool, probeSources } from '../../src/db/client.js';

const config = loadConfig({ GW_ENV: 'dev', SERVICE_CODE: 'portal-api', ...process.env });
let pool: sql.ConnectionPool;

before(async () => {
  pool = await openPool(config.sql, { appName: 'giganexus-portal-api-int', poolMax: 2 });
});
after(async () => {
  await pool?.close();
});

describe('舊庫來源(整合)', () => {
  it('每個來源都有可讀的資料表', async () => {
    const failed = (await probeSources(pool, config.sources)).filter(([, err]) => err !== null);
    assert.deepEqual(failed, []);
  });

  it('可讀 PortalSolar 與 LOS 的複本資料表', async () => {
    for (const t of [config.sources.table('PortalSolar', 'NotesPhone'), config.sources.table('LOS', 'EmployeeInfo')]) {
      const r = await pool.request().query(`SELECT TOP 1 1 AS ok FROM ${t}`);
      assert.ok(r.recordset.length <= 1, t);
    }
  });
});
