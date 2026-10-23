/**
 * 舊庫來源前綴(PORTAL-API-PLAN §3.1、D-2、D-7):測試 / 正式同一份程式。
 *   copy   測試區:讀寫連線庫(giganexus_gw_test)裡的複本 schema src_<庫名>[_<schema>](backend/db/dba/02-refresh-test-data.sql)
 *   legacy 正式區:直接讀寫 220 原庫(與舊系統並行,不改舊表結構)
 * 個別來源可用 PORTAL_SRC_<KEY>=<庫>.<schema> 覆寫(KEY = 來源代碼大寫、「.」換成「_」,例 PORTAL_SRC_LEARNDB_LEARN)。
 * 名稱一律以白名單格式檢查後加中括號,值另以參數傳入;不接受請求參數組名稱。
 */

/** 來源代碼 = 原庫名稱[.schema](schema 省略為 dbo) */
export const SOURCE_KEYS = [
  'PortalSolar',
  'LOS',
  'Budget',
  'LearnDB',
  'LearnDB.learn',
  'Safety',
  'welfare_s',
  'MisDb',
  'Notes',
  'GscSystem',
  'NotesAppDb',
] as const;
export type SourceKey = (typeof SOURCE_KEYS)[number];

export type SourceMode = 'copy' | 'legacy';

export interface SourcePrefix {
  db: string;
  schema: string;
}

const IDENT = /^[A-Za-z0-9_]+$/;

export class SourceConfigError extends Error {
  override name = 'SourceConfigError';
}

/** 表名:字母(含中文)、數字、底線;Budget 庫有「部門狀態」「部門備註」等中文表名。不允許中括號、引號、空白、點 */
const TABLE = /^[\p{L}\p{N}_]+$/u;
function tableIdent(value: string): string {
  if (!TABLE.test(value)) throw new SourceConfigError(`資料表名稱格式不合法:${value}`);
  return value;
}

function ident(value: string, what: string): string {
  if (!IDENT.test(value)) throw new SourceConfigError(`${what} 格式不合法(只允許英數字與底線):${value}`);
  return value;
}

/** PORTAL_SRC_<KEY> 的設定名稱 */
export const envName = (key: SourceKey) => `PORTAL_SRC_${key.toUpperCase().replace('.', '_')}`;

function parse(key: SourceKey): SourcePrefix {
  const [db, schema = 'dbo'] = key.split('.') as [string, string?];
  return { db, schema };
}

export class Sources {
  constructor(readonly prefixes: Readonly<Record<SourceKey, SourcePrefix>>) {}

  /** 依模式與覆寫設定建立;connectionDb = 連線庫(copy 模式的複本所在) */
  static fromEnv(mode: SourceMode, connectionDb: string, env: NodeJS.ProcessEnv = process.env): Sources {
    ident(connectionDb, '連線資料庫名稱');
    const prefixes = {} as Record<SourceKey, SourcePrefix>;
    for (const key of SOURCE_KEYS) {
      const name = envName(key);
      const override = env[name];
      if (override) {
        const parts = override.split('.');
        if (parts.length !== 2) throw new SourceConfigError(`${name} 必須為「資料庫.schema」:${override}`);
        prefixes[key] = { db: ident(parts[0]!, name), schema: ident(parts[1]!, name) };
        continue;
      }
      const { db, schema } = parse(key);
      prefixes[key] =
        mode === 'legacy' ? { db, schema } : { db: connectionDb, schema: `src_${db.toLowerCase()}${schema === 'dbo' ? '' : `_${schema.toLowerCase()}`}` };
    }
    return new Sources(prefixes);
  }

  /** 三段式名稱,例 [giganexus_gw_test].[src_portalsolar].[CpfExInfo];表名只允許英數字與底線(含其他字元的舊表要用時再放寬白名單) */
  table(key: SourceKey, table: string): string {
    const p = this.prefixes[key];
    return `[${p.db}].[${p.schema}].[${tableIdent(table)}]`;
  }
}
