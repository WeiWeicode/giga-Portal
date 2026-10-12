/**
 * 設定(PORTAL-API-PLAN §3):Gateway 相關(GW_ENV、SERVICE_CODE=portal-api、GW_BASE_URL、API Key…)由 SDK loadGatewayEnv 讀取,
 * 本檔補上服務自己的設定。缺少必要設定時啟動失敗,不加預設值繞過檢查。
 *
 *   PORT              portal-api(51271,BACKEND-GUIDE §3.3)
 *   HOST              dev 預設 127.0.0.1(DEV_SKIP_TOKEN 開著時不可讓同網段的電腦連入),test / prod 預設 0.0.0.0(容器)
 *   PORTAL_DB_*       SQL Server 連線庫(giganexus_gw[_test];帳號 portal_app,backend/db/dba/01-create-schema.sql);
 *                     密碼 test / prod 只接受 PORTAL_DB_PASSWORD_FILE
 *   PORTAL_SRC_MODE   copy(複本 src_*)/ legacy(220 原庫);預設 dev / test 為 copy、prod 為 legacy,prod 不可設 copy
 *   PORTAL_SRC_<KEY>  個別來源覆寫「資料庫.schema」(db/sources.ts)
 *   DEV_SKIP_TOKEN    dev 專用:不驗證 X-Internal-Token(本機直連);非 dev 設定即啟動失敗
 */
import { readFileSync } from 'node:fs';
import { isGatewayPort, loadGatewayEnv, loadMonitorEnv, type GatewayEnv, type MonitorEnv } from '@giganexus/backend-sdk';
import { Sources, type SourceMode } from './db/sources.js';

export interface SqlConfig {
  server: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface Config {
  gateway: GatewayEnv;
  monitor: MonitorEnv;
  host: string;
  port: number;
  logLevel: string;
  sql: SqlConfig;
  sourceMode: SourceMode;
  sources: Sources;
  devSkipToken: boolean;
}

export class ConfigError extends Error {
  override name = 'ConfigError';
}

/** 讀 NAME 或 NAME_FILE(Docker secret);strictFile:test / prod 只接受 _FILE */
export function secret(env: NodeJS.ProcessEnv, name: string, strictFile: boolean): string | undefined {
  const file = env[`${name}_FILE`];
  if (file) {
    try {
      return readFileSync(file, 'utf8').trim();
    } catch (err) {
      throw new ConfigError(`無法讀取 ${name}_FILE:${(err as Error).message}`);
    }
  }
  if (env[name] && strictFile) throw new ConfigError(`${name} 在 test / prod 只接受 ${name}_FILE(Docker secret)`);
  return env[name] || undefined;
}

export function required<T>(name: string, v: T | undefined | null | ''): T {
  if (v === undefined || v === null || v === '') throw new ConfigError(`${name} 未設定`);
  return v;
}

const flag = (v: string | undefined) => v === '1' || v === 'true';

export function loadConfig(env: NodeJS.ProcessEnv = process.env, cwd?: string): Config {
  const gateway = loadGatewayEnv(env, cwd);
  const isDev = gateway.gwEnv === 'dev';
  if (!isDev && env.DEV_SKIP_TOKEN !== undefined) throw new ConfigError(`DEV_SKIP_TOKEN 只能在 GW_ENV=dev 使用,${gateway.gwEnv} 不可設定`);

  const port = Number(env.PORT ?? 51271);
  if (!isGatewayPort(port)) throw new ConfigError(`PORT 必須在 51200–51300(BACKEND-GUIDE.md §3):${env.PORT}`);

  const mode = env.PORTAL_SRC_MODE || (gateway.gwEnv === 'prod' ? 'legacy' : 'copy');
  if (mode !== 'copy' && mode !== 'legacy') throw new ConfigError(`PORTAL_SRC_MODE 必須為 copy 或 legacy:${mode}`);
  if (gateway.gwEnv === 'prod' && mode === 'copy') throw new ConfigError('正式區不可使用 PORTAL_SRC_MODE=copy(複本只在 giganexus_gw_test)');

  const dbPort = Number(env.PORTAL_DB_PORT ?? 1433);
  if (!Number.isInteger(dbPort) || dbPort <= 0) throw new ConfigError(`PORTAL_DB_PORT 必須為正整數:${env.PORTAL_DB_PORT}`);
  const database = required('PORTAL_DB_NAME', env.PORTAL_DB_NAME);
  let sources: Sources;
  try {
    sources = Sources.fromEnv(mode, database, env);
  } catch (err) {
    throw new ConfigError((err as Error).message);
  }

  const host = env.HOST ?? (isDev ? '127.0.0.1' : '0.0.0.0');
  const devSkipToken = isDev && flag(env.DEV_SKIP_TOKEN);
  if (devSkipToken && !['127.0.0.1', '::1', 'localhost'].includes(host))
    throw new ConfigError(`DEV_SKIP_TOKEN 開啟時只能監聽本機(HOST=127.0.0.1),目前為 ${host}`);

  return {
    gateway,
    monitor: loadMonitorEnv(gateway.gwEnv, env),
    host,
    port,
    logLevel: env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
    sql: {
      server: required('PORTAL_DB_HOST', env.PORTAL_DB_HOST),
      port: dbPort,
      database,
      user: required('PORTAL_DB_USER', env.PORTAL_DB_USER),
      password: required('PORTAL_DB_PASSWORD(或 PORTAL_DB_PASSWORD_FILE)', secret(env, 'PORTAL_DB_PASSWORD', !isDev)),
    },
    sourceMode: mode,
    sources,
    devSkipToken,
  };
}
