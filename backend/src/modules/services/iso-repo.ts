/**
 * ISO 文件庫資料來源(modules/services/iso.ts):BPM NaNa 唯讀(portal_bpm_ro;測試區 191、正式區 190),查詢同舊 ISOInfo.aspx.cs,改為參數化。
 * 授權:db/dba/06-bpm-readonly-p7.sql(使用者以 sa 執行;**SQL 未在 191 實測**,檢視欄位名稱取自舊程式)。連線延遲到第一次查詢。
 */
import sql from 'mssql';
import type { SqlConfig } from '../../config.js';
import { likeEscape } from '../home/legacy-repo.js';
import type { IsoDocRow, IsoDocVersion, IsoFile, IsoSource } from './iso.js';

type VerRow = {
  docNo: string;
  docName: string | null;
  displayVersion: string | number | null;
  version: string | number | null;
  clauseName: string | null;
  validFrom: string | null;
  validTo: string | null;
  DocLevelID: string | number | null;
};
const str = (v: string | number | null | undefined) => (v === null || v === undefined ? null : String(v).trim() || null);
const toVer = (x: VerRow): IsoDocVersion => ({
  docNo: x.docNo.trim(),
  docName: x.docName?.trim() ?? '',
  displayVersion: str(x.displayVersion),
  version: str(x.version),
  clauseName: x.clauseName?.trim() || null,
  validFrom: x.validFrom,
  validTo: x.validTo,
  levelId: str(x.DocLevelID),
});
/** 不列的條文分類(同舊版清單;資安審查 L1:查詢與清單都在 SQL 端排除) */
const EXCLUDE = `ISNULL(clauseName, N'') NOT LIKE N'合約%' AND ISNULL(clauseName, N'') NOT LIKE N'矽晶材料%'`;
const VER_COLS = `docNo, docName, displayVersion, version, clauseName, CONVERT(char(10), validFrom, 23) AS validFrom, CONVERT(char(10), validTo, 23) AS validTo, DocLevelID`;

export class NanaIsoSource implements IsoSource {
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
      requestTimeout: 30_000,
      pool: { min: 0, max: 2, idleTimeoutMillis: 30_000 },
      options: { encrypt: false, trustServerCertificate: true, appName: 'giganexus-portal-iso', useUTC: true, enableArithAbort: true },
    });
  }

  private async req(): Promise<sql.Request> {
    if (!this.pool.connected) {
      this.connecting ??= this.pool.connect().finally(() => (this.connecting = null));
      await this.connecting;
    }
    return this.pool.request();
  }

  async close(): Promise<void> {
    await this.pool.close();
  }

  async clauses(): Promise<string[]> {
    const r = await (
      await this.req()
    ).query<{ c: string }>(
      `SELECT DISTINCT LTRIM(RTRIM(clauseName)) AS c FROM dbo.v_ISO_Docs_Clause_Solar
       WHERE clauseName IS NOT NULL AND ${EXCLUDE} ORDER BY c`,
    );
    return r.recordset.map((x) => x.c).filter(Boolean);
  }

  private static docRows(rows: { DocLevelID: string | number | null; docNo: string; docName: string | null }[]): IsoDocRow[] {
    return rows.map((x) => ({ docNo: x.docNo.trim(), docName: x.docName?.trim() ?? '', levelId: str(x.DocLevelID) }));
  }

  async byClause(clause: string): Promise<IsoDocRow[]> {
    const r = await (await this.req()).input('c', sql.NVarChar(200), clause).query<{ DocLevelID: string | null; docNo: string; docName: string | null }>(
      `SELECT DISTINCT DocLevelID, docNo, docName FROM dbo.v_ISO_Docs_Clause_Solar
         WHERE ISNULL(validTo, '2199-12-31') >= GETDATE() AND LTRIM(RTRIM(clauseName)) = @c AND ${EXCLUDE} ORDER BY docNo`,
    );
    return NanaIsoSource.docRows(r.recordset);
  }

  async search(q: string): Promise<IsoDocRow[]> {
    const r = await (
      await this.req()
    )
      .input('q', sql.NVarChar(200), `%${likeEscape(q)}%`)
      .query<{ DocLevelID: string | null; docNo: string; docName: string | null }>(
        `SELECT DISTINCT TOP 200 DocLevelID, docNo, docName FROM dbo.v_ISO_Docs_Clause_Solar
         WHERE ISNULL(validTo, '2199-12-31') >= GETDATE() AND (docName LIKE @q OR clauseName LIKE @q OR docNo LIKE @q) AND ${EXCLUDE} ORDER BY docNo`,
      );
    return NanaIsoSource.docRows(r.recordset);
  }

  async current(docNo: string): Promise<IsoDocVersion | null> {
    const r = await (await this.req()).input('d', sql.NVarChar(100), docNo).query<VerRow>(
      `SELECT TOP 1 ${VER_COLS} FROM dbo.v_ISO_Docs_Clause_Solar
         WHERE docNo = @d AND ${EXCLUDE} AND GETDATE() BETWEEN validFrom AND ISNULL(validTo, CONVERT(date, '2099-01-01')) ORDER BY displayVersion DESC`,
    );
    return r.recordset[0] ? toVer(r.recordset[0]) : null;
  }

  async latestAny(docNo: string): Promise<IsoDocVersion | null> {
    const r = await (
      await this.req()
    )
      .input('d', sql.NVarChar(100), docNo)
      .query<VerRow>(`SELECT TOP 1 ${VER_COLS} FROM dbo.v_ISO_Docs_Clause_ALL WHERE docNo = @d ORDER BY displayVersion DESC`);
    return r.recordset[0] ? toVer(r.recordset[0]) : null;
  }

  async file(docNo: string, version: string): Promise<IsoFile | null> {
    const r = await (
      await this.req()
    )
      .input('d', sql.NVarChar(100), docNo)
      .input('v', sql.NVarChar(50), version)
      .query<{ physicalName: string | null; extensionType: string | null }>(
        `SELECT TOP 1 D.physicalName, D.extensionType FROM dbo.Documents AS Doc INNER JOIN dbo.ISOFile AS D ON Doc.OID = D.documentOID
         INNER JOIN dbo.ISODocCmItem AS DocCm ON Doc.containerOID = DocCm.OID WHERE Doc.docNo = @d AND Doc.version = @v`,
      );
    const x = r.recordset[0];
    return x?.physicalName ? { physicalName: x.physicalName.trim(), extensionType: x.extensionType?.trim() || null } : null;
  }

  private async related(sqlText: string, docNo: string, dv: string): Promise<{ docNo: string; docName: string }[]> {
    const r = await (
      await this.req()
    )
      .input('d', sql.NVarChar(100), docNo)
      .input('dv', sql.NVarChar(50), dv)
      .query<{ docNo: string; docName: string | null }>(sqlText);
    return r.recordset.map((x) => ({ docNo: x.docNo.trim(), docName: x.docName?.trim() ?? '' }));
  }

  references(docNo: string, dv: string) {
    return this.related(
      `SELECT DISTINCT RefDoc.docNo, RefDoc.docName FROM dbo.Documents AS Doc INNER JOIN dbo.DocCmItem_RefDoc AS Ref ON Doc.containerOID = Ref.DocCmItemOID
       INNER JOIN dbo.Documents AS RefDoc ON RefDoc.containerOID = Ref.RefDocOID WHERE Doc.docNo = @d AND Doc.displayVersion = @dv ORDER BY RefDoc.docNo`,
      docNo,
      dv,
    );
  }

  lowers(docNo: string, dv: string) {
    return this.related(
      `SELECT DISTINCT LowDoc.docNo, LowDoc.docName FROM dbo.Documents AS Doc INNER JOIN dbo.Doc_Level AS DocLev ON Doc.OID = DocLev.upperDocOID
       INNER JOIN dbo.Documents AS LowDoc ON DocLev.lowerDocOID = LowDoc.OID WHERE Doc.docNo = @d AND Doc.displayVersion = @dv ORDER BY LowDoc.docNo`,
      docNo,
      dv,
    );
  }

  uppers(docNo: string, dv: string) {
    return this.related(
      `SELECT DISTINCT UpDoc.docNo, UpDoc.docName FROM dbo.Documents AS Doc INNER JOIN dbo.Doc_Level AS DocLev ON Doc.OID = DocLev.lowerDocOID
       INNER JOIN dbo.Documents AS UpDoc ON DocLev.upperDocOID = UpDoc.OID WHERE Doc.docNo = @d AND Doc.displayVersion = @dv ORDER BY UpDoc.docNo`,
      docNo,
      dv,
    );
  }
}
