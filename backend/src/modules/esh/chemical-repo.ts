/**
 * 危害性化學品舊表存取(PortalSolar ESHChemicalDataA / B / C,與舊入口網共用,D-7)與 NaNa 唯讀來源(BPM「化學品申報單」)。
 * 一律參數化;日期欄 d_CreateDate_txt 為 yyyy/MM/dd 字串(舊程式寫法),以字串比較區間。
 */
import sql from 'mssql';
import type { SqlConfig } from '../../config.js';
import type { Sources } from '../../db/sources.js';
import { chunks, inList } from '../manager/scope.js';
import {
  A_COLUMN_NAMES,
  A_COLUMNS,
  B_COLUMN_NAMES,
  B_COLUMNS,
  C_LIMITS,
  type BpmChemicalForm,
  type ChemicalQuery,
  type ChemicalRecord,
  type ChemicalRepo,
  type ChemicalRow,
  type ChemicalSource,
  type Component,
} from './chemical.js';

const A_SELECT = A_COLUMN_NAMES.map((c) => `A.[${c}]`).join(', ');
/** 欄位名稱來自固定清單(A_COLUMNS),不接受外部輸入 */
const A_INSERT_COLS = ['EF_ID', ...A_COLUMN_NAMES].map((c) => `[${c}]`).join(', ');
const A_INSERT_VALS = ['@ef', ...A_COLUMN_NAMES.map((_, i) => `@a${i}`)].join(', ');

type RowSql = Record<string, string | null> & { EF_ID: string; AttachmentFile: string | null; logicalName: string | null };

const toRow = (x: RowSql): ChemicalRow => ({
  efId: x.EF_ID.trim(),
  a: Object.fromEntries(A_COLUMN_NAMES.map((c) => [c, x[c] ?? null])),
  attachmentFile: x.AttachmentFile,
  logicalName: x.logicalName,
});

export class MssqlChemicalRepo implements ChemicalRepo {
  constructor(
    private readonly pool: sql.ConnectionPool,
    private readonly src: Sources,
  ) {}

  private t = (name: string) => this.src.table('PortalSolar', name);

  private base(where: string) {
    return `FROM ${this.t('ESHChemicalDataA')} AS A
      OUTER APPLY (SELECT TOP 1 C.AttachmentFile, C.logicalName FROM ${this.t('ESHChemicalDataC')} AS C WHERE C.EF_ID = A.EF_ID) AS C
      WHERE A.EF_ID IS NOT NULL AND ${where}`;
  }

  async list(q: ChemicalQuery): Promise<{ total: number; items: ChemicalRow[] }> {
    const bind = (req: sql.Request) => {
      req.input('restrict', sql.NVarChar(10), q.restrict).input('from', sql.NVarChar(10), q.from).input('to', sql.NVarChar(10), q.to);
      if (q.keyword) req.input('kw', sql.NVarChar(310), `%${q.keyword.replace(/[[%_]/g, (c) => `[${c}]`)}%`);
      return req;
    };
    const kw = q.keyword
      ? `AND (A.s_CH_ChemicalName LIKE @kw OR A.s_EN_ChemicalName LIKE @kw OR A.EF_ID LIKE @kw
           OR EXISTS (SELECT 1 FROM ${this.t('ESHChemicalDataB')} AS B WHERE B.EF_ID = A.EF_ID AND (B.s_Composition_CNS LIKE @kw OR B.s_Composition_CN LIKE @kw OR B.s_Composition_EN LIKE @kw)))`
      : '';
    // 同舊版:填表人空白的列不列出
    const where = `ISNULL(A.s_RequesterID_txt, N'') <> N'' AND A.RB_Restrict = @restrict AND A.d_CreateDate_txt >= @from AND A.d_CreateDate_txt <= @to ${kw}`;
    const total = await bind(this.pool.request()).query<{ n: number }>(`SELECT COUNT(*) AS n ${this.base(where)}`);
    const r = await bind(this.pool.request())
      .input('off', sql.Int, (q.page - 1) * q.pageSize)
      .input('size', sql.Int, q.pageSize)
      .query<RowSql>(
        `SELECT A.EF_ID, ${A_SELECT}, C.AttachmentFile, C.logicalName ${this.base(where)}
         ORDER BY A.d_CreateDate_txt DESC, A.EF_ID DESC OFFSET @off ROWS FETCH NEXT @size ROWS ONLY`,
      );
    return { total: total.recordset[0]!.n, items: r.recordset.map(toRow) };
  }

  async get(efId: string): Promise<ChemicalRow | null> {
    const r = await this.pool
      .request()
      .input('ef', sql.NVarChar(40), efId)
      .query<RowSql>(`SELECT TOP 1 A.EF_ID, ${A_SELECT}, C.AttachmentFile, C.logicalName ${this.base('A.EF_ID = @ef')}`);
    const x = r.recordset[0];
    return x ? toRow(x) : null;
  }

  async components(efIds: string[]): Promise<Map<string, Component[]>> {
    const map = new Map<string, Component[]>();
    for (const part of chunks(efIds)) {
      const req = this.pool.request();
      const ids = inList(req, 'e', part, () => sql.NVarChar(40));
      const r = await req.query<{
        EF_ID: string;
        Item: number | null;
        s_Composition_CN: string | null;
        s_Composition_EN: string | null;
        s_Composition_CODE: string | null;
        s_Composition_CNS: string | null;
        s_Composition_Formula: string | null;
        s_Composition_Rate: string | null;
      }>(`SELECT EF_ID, Item, ${B_COLUMN_NAMES.join(', ')} FROM ${this.t('ESHChemicalDataB')} WHERE EF_ID IN (${ids}) ORDER BY EF_ID, Item`);
      for (const x of r.recordset) {
        const k = x.EF_ID.trim();
        map.set(k, [
          ...(map.get(k) ?? []),
          {
            item: x.Item ?? 0,
            cn: x.s_Composition_CN,
            en: x.s_Composition_EN,
            code: x.s_Composition_CODE,
            cas: x.s_Composition_CNS,
            formula: x.s_Composition_Formula,
            rate: x.s_Composition_Rate,
          },
        ]);
      }
    }
    return map;
  }

  async replace(records: ChemicalRecord[]): Promise<void> {
    if (!records.length) return;
    const tx = new sql.Transaction(this.pool);
    await tx.begin();
    try {
      for (const rec of records) {
        const del = new sql.Request(tx).input('ef', sql.NVarChar(40), rec.efId);
        await del.query(
          `DELETE FROM ${this.t('ESHChemicalDataB')} WHERE EF_ID = @ef; DELETE FROM ${this.t('ESHChemicalDataC')} WHERE EF_ID = @ef; DELETE FROM ${this.t('ESHChemicalDataA')} WHERE EF_ID = @ef;`,
        );
        const ins = new sql.Request(tx).input('ef', sql.NVarChar(40), rec.efId);
        A_COLUMN_NAMES.forEach((c, i) => ins.input(`a${i}`, sql.NVarChar(A_COLUMNS[c]), rec.a[c]));
        await ins.query(`INSERT INTO ${this.t('ESHChemicalDataA')} (${A_INSERT_COLS}) VALUES (${A_INSERT_VALS})`);
        for (const c of rec.components) {
          const b = new sql.Request(tx).input('ef', sql.NVarChar(40), rec.efId).input('item', sql.TinyInt, c.item);
          B_COLUMN_NAMES.forEach((col, i) => b.input(`b${i}`, sql.NVarChar(B_COLUMNS[col]), c[col]));
          await b.query(
            `INSERT INTO ${this.t('ESHChemicalDataB')} (EF_ID, Item, ${B_COLUMN_NAMES.join(', ')}) VALUES (@ef, @item, ${B_COLUMN_NAMES.map((_, i) => `@b${i}`).join(', ')})`,
          );
        }
        if (rec.sds)
          await new sql.Request(tx)
            .input('ef', sql.NVarChar(40), rec.efId)
            .input('file', sql.NVarChar(C_LIMITS.AttachmentFile), rec.sds.url)
            .input('name', sql.NVarChar(C_LIMITS.logicalName), rec.sds.logicalName)
            .query(`INSERT INTO ${this.t('ESHChemicalDataC')} (EF_ID, AttachmentFile, logicalName) VALUES (@ef, @file, @name)`);
      }
      await tx.commit();
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }
}

/**
 * NaNa 唯讀來源(portal_bpm_ro):只查 db/dba/05-bpm-readonly-p6.sql 建立的檢視 dbo.portal_esh_chemical_forms
 * (SHR008_ 化學品申報單、已結案;資安審查 M2:不直接授權 FormInstance / NoCmDocument,避免讀到其他流程的表單內容)。
 * 連線延遲到第一次查詢(同 NanaBpmRepo);datetime 為台灣時間,區間以日期字串比較。
 */
export const CHEMICAL_VIEW = 'portal_esh_chemical_forms';

export class NanaChemicalSource implements ChemicalSource {
  private readonly pool: sql.ConnectionPool;
  private connecting: Promise<sql.ConnectionPool> | null = null;

  constructor(cfg: SqlConfig) {
    this.pool = new sql.ConnectionPool({
      server: cfg.server,
      port: cfg.port,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      connectionTimeout: 10_000,
      requestTimeout: 120_000,
      pool: { min: 0, max: 1, idleTimeoutMillis: 30_000 },
      options: { encrypt: false, trustServerCertificate: true, appName: 'giganexus-portal-esh-chemical', useUTC: true, enableArithAbort: true },
    });
  }

  private async ready(): Promise<sql.ConnectionPool> {
    if (this.pool.connected) return this.pool;
    this.connecting ??= this.pool.connect().finally(() => (this.connecting = null));
    return this.connecting;
  }

  async forms(from: string, to: string): Promise<BpmChemicalForm[]> {
    const pool = await this.ready();
    const r = await pool
      .request()
      .input('from', sql.VarChar(10), from)
      .input('to', sql.VarChar(10), to)
      .query<{ sn: string; fv: string | null; logicalName: string | null; physicalName: string | null; ext: string | null }>(
        `SELECT sn, fv, logicalName, physicalName, ext FROM dbo.${CHEMICAL_VIEW}
         WHERE CONVERT(varchar(10), createdTime, 120) BETWEEN @from AND @to ORDER BY createdTime DESC`,
      );
    return r.recordset.map((x) => ({
      serialNumber: x.sn,
      fieldValues: x.fv ?? '',
      doc: x.physicalName ? { logicalName: x.logicalName, physicalName: x.physicalName, extension: x.ext } : null,
    }));
  }

  close(): Promise<void> {
    return this.pool.close();
  }
}
