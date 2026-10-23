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
 *   GOOGLE_MAPS_API_KEY(_FILE)  選用:通勤調查地址轉經緯度(Google Geocoding);未設定時通勤調查不能送出(503)
 *   BPM_DB_HOST / _PORT / _NAME / _USER / _PASSWORD(_FILE)  選用:BPM NaNa 唯讀(portal_bpm_ro;測試區 191、正式區 190);未設定時 /bpm/* 回 503
 *   BPM_COMPANIES     所有 BPM 查詢(首頁筆數、/bpm/*)只對這些公司(Token cos,逗號分隔)查詢(D-29 碩禾系限定);空白則任何人都不查 BPM
 *   BPM_WEB_URL       BPM 網站位址(深連結;與 BPM_DB_HOST 同一台,例 http://10.10.130.191:8080),設定 BPM_DB_HOST 時必填
 *   TALK_AUTHOR_KEY(_FILE)  選用:3691 作者加密金鑰(32 bytes base64,D-23);test / prod 只接受 _FILE。未設定時 3691 可瀏覽,不能發文 / 解碼(503)
 *   TALK_AUTHOR_KEY_ID      金鑰代號(預設 k1;換金鑰時改代號,舊代號的金鑰另設 TALK_AUTHOR_OLD_KEYS_FILE)
 *   TALK_AUTHOR_OLD_KEYS_FILE  選用:換金鑰後的舊金鑰檔,每行「代號:base64」,只用來解碼舊發文
 *   LEGACY_PORTAL_URL 選用:舊入口網網站根網址(例 http://10.10.130.166/PortalSolar),首頁舊公告連結用;未設定則不帶連結(D-21)
 *   BUDGET_COMPANY_MAP        選用:LOS 公司別對應 Budget 公司(預設 DS11=GSMC,DS36=WHOLESUN,DS15=GEE;舊 Budget_DeptData)
 *   BUDGET_LOCKED_CODES       選用:預算編列禁填科目(逗號分隔;預設同舊 Budget_DeptData strDisableAccountingCode)
 *   BUDGET_SUM_EDITABLE_CODES 選用:可填的合計科目例外(預設 6234,6134,6334,5534)
 *   BUDGET_VIEW_EXCLUDED_CODES 選用:部門預算不列的合計科目(預設同舊 Budget_DeptInfoV2)
 *   ESH_NOTIFY_MODE   複訓通知寄送方式:dry-run(預設,只寫寄送紀錄不寄)/ gateway(POST Gateway /api/notify/send,需 GW_BASE_URL 與 API Key 具 notify.message.send)
 *   ESH_SCHEDULE      on / off:程序內排程(複訓通知、化學品同步);預設 off(合併後先驗收,確認 05 腳本與寄信設定後再於 portal.env 設 on)
 *   ESH_NOTIFY_WEEKDAY / ESH_NOTIFY_HOUR  複訓通知排程(台灣時間;預設週一(1)08 點後)
 *   ESH_CHEMICAL_SYNC_HOUR / ESH_CHEMICAL_SYNC_MONTHS  化學品每日同步(預設 02 點後、同步最近 13 個月)
 *   ESH_SDS_BASE_URL  BPM SDS 檔案網址前綴(同舊版 http://<BPM 主機>/SDSFILES);預設由 BPM_DB_HOST 組成,未設定 BPM 時為空
 *   DEV_SKIP_TOKEN    dev 專用:不驗證 X-Internal-Token(本機直連);非 dev 設定即啟動失敗
 */
import { readFileSync } from 'node:fs';
import { isGatewayPort, loadGatewayEnv, loadMonitorEnv, type GatewayEnv, type MonitorEnv } from '@giganexus/backend-sdk';
import { Sources, type SourceMode } from './db/sources.js';
import { AuthorKeyError, parseAuthorKey, type AuthorKey } from './modules/talk/author-cipher.js';

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
  /** null = 未設定,通勤調查不能送出 */
  googleMapsApiKey: string | null;
  /** null = 未設定 BPM 資料來源 */
  bpm: { sql: SqlConfig; webUrl: string } | null;
  /** D-29:可查 BPM 的公司(Token cos;首頁與 /bpm/* 共用) */
  bpmCompanies: string[];
  /** null = 未設定,3691 不能發文 / 解碼 */
  talkKeys: { current: AuthorKey; old: AuthorKey[] } | null;
  /** 舊入口網根網址(不含結尾 /);null = 舊公告不帶連結 */
  legacyPortalUrl: string | null;
  /** 主管專區預算(FEATURE-PLAN §7.2;舊程式寫死的清單改為設定) */
  budget: BudgetSettings;
  esh: EshSettings;
  devSkipToken: boolean;
}

export interface EshSettings {
  notifyMode: 'dry-run' | 'gateway';
  schedule: boolean;
  notifyWeekday: number;
  notifyHour: number;
  chemicalSyncHour: number;
  chemicalSyncMonths: number;
  sdsBaseUrl: string | null;
}

function intIn(name: string, raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new ConfigError(`${name} 必須為 ${min}~${max} 的整數:${raw}`);
  return n;
}

function eshSettings(env: NodeJS.ProcessEnv, gateway: GatewayEnv, bpmHost: string | null): EshSettings {
  const mode = env.ESH_NOTIFY_MODE?.trim() || 'dry-run';
  if (mode !== 'dry-run' && mode !== 'gateway') throw new ConfigError(`ESH_NOTIFY_MODE 必須為 dry-run 或 gateway:${mode}`);
  if (mode === 'gateway' && (!gateway.gatewayUrl || !gateway.apiKey)) throw new ConfigError('ESH_NOTIFY_MODE=gateway 需設定 GW_BASE_URL 與 Gateway API Key');
  const sched = env.ESH_SCHEDULE?.trim() || 'off';
  if (sched !== 'on' && sched !== 'off') throw new ConfigError(`ESH_SCHEDULE 必須為 on 或 off:${sched}`);
  let sdsBaseUrl: string | null = null;
  const rawSds = env.ESH_SDS_BASE_URL?.trim() || (bpmHost ? `http://${bpmHost}/SDSFILES` : '');
  if (rawSds) {
    let u: URL;
    try {
      u = new URL(rawSds);
    } catch {
      throw new ConfigError(`ESH_SDS_BASE_URL 格式錯誤:${rawSds}`);
    }
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.search || u.hash)
      throw new ConfigError(`ESH_SDS_BASE_URL 必須為 http(s)://主機[/路徑],不含帳密與查詢字串:${rawSds}`);
    sdsBaseUrl = `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
  }
  return {
    notifyMode: mode,
    schedule: sched === 'on',
    notifyWeekday: intIn('ESH_NOTIFY_WEEKDAY', env.ESH_NOTIFY_WEEKDAY, 1, 0, 6),
    notifyHour: intIn('ESH_NOTIFY_HOUR', env.ESH_NOTIFY_HOUR, 8, 0, 23),
    chemicalSyncHour: intIn('ESH_CHEMICAL_SYNC_HOUR', env.ESH_CHEMICAL_SYNC_HOUR, 2, 0, 23),
    chemicalSyncMonths: intIn('ESH_CHEMICAL_SYNC_MONTHS', env.ESH_CHEMICAL_SYNC_MONTHS, 13, 1, 36),
    sdsBaseUrl,
  };
}

export interface BudgetSettings {
  /** LOS CompDB → Budget CompanyID */
  companyMap: Record<string, string>;
  lockedCodes: string[];
  sumEditableCodes: string[];
  viewExcludedCodes: string[];
}

const DEFAULT_BUDGET = {
  companyMap: 'DS11=GSMC,DS36=WHOLESUN,DS15=GEE',
  lockedCodes:
    '6210A,6210B,6219,6227,6236,6246,6228,6119,6127,6136,6146,6128,6310A,6319,6327,6336,6346,6328,5510A,5510B,5519,5527,5536,5546,5528,5410A,5410B,5420,5430,5440,5450',
  sumEditableCodes: '6234,6134,6334,5534',
  viewExcludedCodes: '5500,5510A,5510B,6100,6110A,6110B,6200,6210,6210A,6210B,6300,6310A,6310B',
};

const CODE = /^[A-Za-z0-9]{1,10}$/;
function codeList(name: string, raw: string | undefined, fallback: string): string[] {
  const list = (raw?.trim() || fallback)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  for (const c of list) if (!CODE.test(c)) throw new ConfigError(`${name} 科目代碼格式錯誤:${c}`);
  return list;
}

function budgetSettings(env: NodeJS.ProcessEnv): BudgetSettings {
  const companyMap: Record<string, string> = {};
  for (const pair of (env.BUDGET_COMPANY_MAP?.trim() || DEFAULT_BUDGET.companyMap)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)) {
    const m = /^([A-Za-z0-9]{1,10})=([A-Za-z0-9_]{1,20})$/.exec(pair);
    if (!m) throw new ConfigError(`BUDGET_COMPANY_MAP 格式錯誤(公司別=Budget 公司):${pair}`);
    companyMap[m[1]!.toUpperCase()] = m[2]!;
  }
  return {
    companyMap,
    lockedCodes: codeList('BUDGET_LOCKED_CODES', env.BUDGET_LOCKED_CODES, DEFAULT_BUDGET.lockedCodes),
    sumEditableCodes: codeList('BUDGET_SUM_EDITABLE_CODES', env.BUDGET_SUM_EDITABLE_CODES, DEFAULT_BUDGET.sumEditableCodes),
    viewExcludedCodes: codeList('BUDGET_VIEW_EXCLUDED_CODES', env.BUDGET_VIEW_EXCLUDED_CODES, DEFAULT_BUDGET.viewExcludedCodes),
  };
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

/** BPM NaNa(選用);BPM_DB_HOST 空白視為未設定 */
function bpmConfig(env: NodeJS.ProcessEnv, strictFile: boolean): Config['bpm'] {
  const host = env.BPM_DB_HOST?.trim();
  if (!host) return null;
  const raw = required('BPM_WEB_URL', env.BPM_WEB_URL?.trim());
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new ConfigError(`BPM_WEB_URL 格式錯誤:${raw}`);
  }
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.pathname !== '/' || u.search || u.hash)
    throw new ConfigError(`BPM_WEB_URL 必須為 http(s)://主機[:port],不含帳密與路徑:${raw}`);
  const webUrl = u.origin;
  const port = Number(env.BPM_DB_PORT ?? 1433);
  if (!Number.isInteger(port) || port <= 0) throw new ConfigError(`BPM_DB_PORT 必須為正整數:${env.BPM_DB_PORT}`);
  return {
    webUrl,
    sql: {
      server: host,
      port,
      database: env.BPM_DB_NAME || 'NaNa',
      user: required('BPM_DB_USER', env.BPM_DB_USER),
      password: required('BPM_DB_PASSWORD(或 BPM_DB_PASSWORD_FILE)', secret(env, 'BPM_DB_PASSWORD', strictFile)),
    },
  };
}

/** 3691 作者金鑰(D-23):金鑰只從 secret / 環境變數讀,不寫死;格式錯誤啟動失敗 */
function talkKeys(env: NodeJS.ProcessEnv, strictFile: boolean): Config['talkKeys'] {
  const raw = secret(env, 'TALK_AUTHOR_KEY', strictFile);
  if (!raw) return null;
  try {
    const current = parseAuthorKey(env.TALK_AUTHOR_KEY_ID?.trim() || 'k1', raw);
    const old: AuthorKey[] = [];
    const file = env.TALK_AUTHOR_OLD_KEYS_FILE;
    if (file) {
      let text: string;
      try {
        text = readFileSync(file, 'utf8');
      } catch (err) {
        throw new ConfigError(`無法讀取 TALK_AUTHOR_OLD_KEYS_FILE:${(err as Error).message}`);
      }
      for (const [n, line] of text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .entries()) {
        // 錯誤訊息只寫行號,不回顯內容(避免金鑰寫反時印進啟動日誌)
        const i = line.indexOf(':');
        try {
          if (i <= 0) throw new AuthorKeyError('format');
          old.push(parseAuthorKey(line.slice(0, i), line.slice(i + 1)));
        } catch {
          throw new ConfigError(`TALK_AUTHOR_OLD_KEYS_FILE 第 ${n + 1} 個金鑰格式錯誤(每行「代號:base64」,代號英數字 - _、金鑰 32 bytes)`);
        }
      }
    }
    if (old.some((k) => k.id === current.id)) throw new ConfigError('TALK_AUTHOR_OLD_KEYS_FILE 的代號不可與 TALK_AUTHOR_KEY_ID 相同');
    return { current, old };
  } catch (err) {
    if (err instanceof AuthorKeyError) throw new ConfigError(err.message);
    throw err;
  }
}

/** 舊入口網根網址:只接受 http(s)、不含帳密、查詢字串 */
function legacyPortalUrl(raw: string | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    throw new ConfigError(`LEGACY_PORTAL_URL 格式錯誤:${v}`);
  }
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.search || u.hash)
    throw new ConfigError(`LEGACY_PORTAL_URL 必須為 http(s)://主機[/路徑],不含帳密與查詢字串:${v}`);
  return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
}

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

  const bpm = bpmConfig(env, !isDev);
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
    googleMapsApiKey: secret(env, 'GOOGLE_MAPS_API_KEY', !isDev) ?? null,
    bpm,
    bpmCompanies: (env.BPM_COMPANIES ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    talkKeys: talkKeys(env, !isDev),
    legacyPortalUrl: legacyPortalUrl(env.LEGACY_PORTAL_URL),
    budget: budgetSettings(env),
    esh: eshSettings(env, gateway, bpm?.sql.server ?? null),
    devSkipToken,
  };
}
