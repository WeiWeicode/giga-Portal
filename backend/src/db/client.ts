/**
 * 連線池(PORTAL-API-PLAN §3.4):連 giganexus_gw[_test](帳號 portal_app),舊庫一律以 db/sources.ts 的三段式名稱存取;
 * schema portal 的新表用 Drizzle(createDb)。
 * tedious 參數比照 Gateway 與 file-api(內網 SQL Server 2012 不加密,已有決議)。
 */
import sql from 'mssql';
import { drizzle, type NodeMsSqlDatabase } from 'drizzle-orm/node-mssql';
import type { Logger as DrizzleLogger } from 'drizzle-orm/logger';
import type { SqlConfig } from '../config.js';
import * as schema from './schema.js';
import { findSql2012Violations, Sql2012CompatError } from './sql2012-guard.js';
import { SOURCE_KEYS, type Sources } from './sources.js';

export async function openPool(cfg: SqlConfig, opts: { appName: string; poolMax?: number; requestTimeoutMs?: number }): Promise<sql.ConnectionPool> {
  const pool = new sql.ConnectionPool({
    server: cfg.server,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    connectionTimeout: 15_000,
    requestTimeout: opts.requestTimeoutMs ?? 30_000,
    pool: { min: 0, max: opts.poolMax ?? 10, idleTimeoutMillis: 30_000 },
    options: { encrypt: false, trustServerCertificate: true, appName: opts.appName, useUTC: true, enableArithAbort: true },
  });
  await pool.connect();
  return pool;
}

/**
 * 每個來源是否可讀:該 schema 內有本帳號看得到的資料表(沒有權限時 sys.tables 看不到,視為不可用)。
 * 回傳 [來源代碼, 錯誤訊息 | null]
 */
export async function probeSources(pool: sql.ConnectionPool, sources: Sources): Promise<[string, string | null][]> {
  return Promise.all(
    SOURCE_KEYS.map(async (key): Promise<[string, string | null]> => {
      const { db, schema } = sources.prefixes[key];
      try {
        const r = await pool
          .request()
          .input('schema', sql.NVarChar(128), schema)
          .query<{ n: number }>(
            `SELECT COUNT(*) AS n FROM [${db}].sys.tables t JOIN [${db}].sys.schemas s ON s.schema_id = t.schema_id WHERE s.name = @schema`,
          );
        return [key, r.recordset[0]!.n > 0 ? null : `${db}.${schema} 沒有可讀的資料表`];
      } catch (err) {
        return [key, (err as Error).message];
      }
    }),
  );
}

export type PortalDatabase = NodeMsSqlDatabase<typeof schema>;

/** 開發 / 測試:檢查 Drizzle 產生的每一句 SQL 是否含 2012 不支援的語法(比照 Gateway、file-api) */
class Sql2012GuardLogger implements DrizzleLogger {
  logQuery(query: string): void {
    const violations = findSql2012Violations(query);
    if (violations.length) throw new Sql2012CompatError(violations, query);
  }
}

export function createDb(pool: sql.ConnectionPool, guard = false): PortalDatabase {
  return drizzle({ client: pool, schema, ...(guard ? { logger: new Sql2012GuardLogger() } : {}) });
}
