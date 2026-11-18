/**
 * 套用 db/migrations(Drizzle migrator;比照 giga-file-service file-api):
 *   - 紀錄表 portal.__portal_migrations(不可用 Gateway 的 drizzle schema,Gateway reset-test-db 會清掉)
 *   - 以 migrate 帳號(PORTAL_MIGRATE_USER / PORTAL_MIGRATE_PASSWORD[_FILE];portal_migrate)執行,只有 schema portal 的權限
 *   開發:於 backend/ 執行 npm run db:migrate(讀 .env,套用到 PORTAL_DB_NAME);整合測試以 database 參數指定 poc_test 庫
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { migrate } from 'drizzle-orm/node-mssql/migrator';
import { required, secret, type SqlConfig } from './config.js';
import { createDb, openPool } from './db/client.js';

export const MIGRATIONS_FOLDER = path.resolve(process.cwd(), 'db/migrations');
export const MIGRATIONS_SCHEMA = 'portal';
export const MIGRATIONS_TABLE = '__portal_migrations';

export function migrateSqlConfig(env: NodeJS.ProcessEnv = process.env, database?: string): SqlConfig {
  return {
    server: required('PORTAL_DB_HOST', env.PORTAL_DB_HOST),
    port: Number(env.PORTAL_DB_PORT ?? 1433),
    database: database ?? required('PORTAL_DB_NAME', env.PORTAL_DB_NAME),
    user: required('PORTAL_MIGRATE_USER', env.PORTAL_MIGRATE_USER),
    password: required('PORTAL_MIGRATE_PASSWORD(或 PORTAL_MIGRATE_PASSWORD_FILE)', secret(env, 'PORTAL_MIGRATE_PASSWORD', false)),
  };
}

export async function runMigrations(cfg: SqlConfig, migrationsFolder = process.env.MIGRATIONS_FOLDER ?? MIGRATIONS_FOLDER): Promise<void> {
  const pool = await openPool(cfg, { appName: 'giganexus-portal-migrate', poolMax: 1, requestTimeoutMs: 300_000 });
  try {
    await migrate(createDb(pool), { migrationsFolder, migrationsSchema: MIGRATIONS_SCHEMA, migrationsTable: MIGRATIONS_TABLE });
  } finally {
    await pool.close();
  }
}

// 以 pathToFileURL 比對:Windows 的 argv[1] 為 D:\...,直接接 file:// 永遠不相等(同 Gateway)
if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  const cfg = migrateSqlConfig();
  runMigrations(cfg)
    .then(() => console.log(`${cfg.database}:migration 完成(schema ${MIGRATIONS_SCHEMA})`))
    .catch((err: unknown) => {
      console.error('migration 失敗', err);
      process.exit(1);
    });
}
