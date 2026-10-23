/**
 * 同意書資料存取(modules/services/consent.ts):舊表 PortalSolar ConsentX / ConsentXB / ConsentCInfo / ConsentBInfo、LOS EmployeeInfo,
 * 新表 portal.consent_def / consent_sign(同一個 SQL Server 執行個體,簽署與簽名登記在同一交易)。
 * 舊表沒有唯一鍵(測試區複本 ConsentBInfo 有 20 組、ConsentXB 有 2 組重複):寫入前在交易內取得應用鎖(sp_getapplock,鍵 = 同意書 + 工號,
 * 資安審查 M3:避免整表範圍鎖)再檢查本人是否已簽;舊站並行期寫入不經此鎖(CONFIRM-NEEDED P7)。
 * 日期一律在 SQL 轉成 YYYY-MM-DD 字串(避免 mssql useUTC 的時區換算);寫入時間用 GETDATE()(同舊站以伺服器本地時間寫入)。
 */
import sql from 'mssql';
import type { Sources } from '../../db/sources.js';
import type { ConsentDefRow, ConsentEmployee, ConsentRepo, SignResult, XConsentRow } from './consent.js';

const EMP = `UPPER(LTRIM(RTRIM(LgNo))) = @emp`;

export class MssqlConsentRepo implements ConsentRepo {
  constructor(
    private readonly pool: sql.ConnectionPool,
    private readonly src: Sources,
  ) {}

  private t = (name: string) => this.src.table('PortalSolar', name);

  private async inTx<T>(fn: (tx: sql.Transaction) => Promise<T>): Promise<T> {
    const tx = new sql.Transaction(this.pool);
    await tx.begin();
    try {
      const out = await fn(tx);
      await tx.commit();
      return out;
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }

  private static xRow = (r: Record<string, string | null>): XConsentRow => ({
    guid: (r.GUID ?? '').trim().toLowerCase(),
    title: (r.indexConsent ?? '').trim() || '同意書',
    body: r.Consent_main ?? null,
    startDate: r.StartDate ?? null,
    endDate: r.EndDate ?? null,
    kdept: r.Kdept ?? null,
    kpep: r.Kpep ?? null,
  });

  async xConsents(): Promise<XConsentRow[]> {
    const r = await this.pool
      .request()
      .query(
        `SELECT GUID, indexConsent, NULL AS Consent_main, StartDate, EndDate, Kdept, Kpep FROM ${this.t('ConsentX')} WHERE GUID IS NOT NULL AND GUID <> N''`,
      );
    return r.recordset.map(MssqlConsentRepo.xRow);
  }

  async xConsent(guid: string): Promise<XConsentRow | null> {
    const r = await this.pool
      .request()
      .input('g', sql.NVarChar(100), guid)
      .query(`SELECT TOP 1 GUID, indexConsent, Consent_main, StartDate, EndDate, Kdept, Kpep FROM ${this.t('ConsentX')} WHERE LOWER(LTRIM(RTRIM(GUID))) = @g`);
    const row = r.recordset[0];
    return row ? MssqlConsentRepo.xRow(row) : null;
  }

  async xSigned(empNo: string): Promise<Map<string, string>> {
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(20), empNo)
      .query<{ g: string; d: string | null }>(
        `SELECT LOWER(LTRIM(RTRIM(GUID))) AS g, CONVERT(char(10), MIN(ConfirmDate), 23) AS d FROM ${this.t('ConsentXB')} WHERE ${EMP} GROUP BY LOWER(LTRIM(RTRIM(GUID)))`,
      );
    return new Map(r.recordset.map((x) => [x.g, x.d ?? '']));
  }

  async defs(): Promise<ConsentDefRow[]> {
    const r = await this.pool.request().query<{
      consent_id: number;
      kind: string;
      title: string;
      s: string | null;
      e: string | null;
      require_sign: boolean;
      active: boolean;
    }>(`SELECT consent_id, kind, title, CONVERT(char(10), start_date, 23) AS s, CONVERT(char(10), end_date, 23) AS e, require_sign, active FROM [portal].[consent_def]`);
    return r.recordset.map((x) => ({
      consentId: x.consent_id,
      kind: x.kind,
      title: x.title,
      startDate: x.s,
      endDate: x.e,
      requireSign: x.require_sign,
      active: x.active,
    }));
  }

  async assigned(empNo: string): Promise<number[]> {
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(20), empNo)
      .query<{ ConsentID: number }>(`SELECT DISTINCT ConsentID FROM ${this.t('ConsentCInfo')} WHERE ${EMP} AND ConsentID IS NOT NULL`);
    return r.recordset.map((x) => x.ConsentID);
  }

  async bSigned(empNo: string): Promise<Map<number, string>> {
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(20), empNo)
      .query<{ id: number; d: string | null }>(
        `SELECT ConsentID AS id, CONVERT(char(10), MIN(ConfirmDate), 23) AS d FROM ${this.t('ConsentBInfo')} WHERE ${EMP} AND ConsentID IS NOT NULL GROUP BY ConsentID`,
      );
    return new Map(r.recordset.map((x) => [x.id, x.d ?? '']));
  }

  async employee(empNo: string): Promise<ConsentEmployee | null> {
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(20), empNo)
      .query<{ UserID: string; UserName: string | null; CompFullName: string | null; ID: string | null; b: string | null }>(
        `SELECT TOP 1 UserID, UserName, CompFullName, ID, CONVERT(char(10), BirthDate, 23) AS b FROM ${this.src.table('LOS', 'EmployeeInfo')}
         WHERE UPPER(LTRIM(RTRIM(UserID))) = @emp ORDER BY CASE WHEN LeaveDate IS NULL THEN 0 ELSE 1 END`,
      );
    const x = r.recordset[0];
    if (!x) return null;
    return {
      empNo: x.UserID.trim().toUpperCase(),
      name: x.UserName?.trim() || null,
      compFullName: x.CompFullName?.trim() || null,
      nationalId: x.ID?.trim() || null,
      birthDate: x.b,
    };
  }

  private static async sign(tx: sql.Transaction, source: 'x' | 'b', ref: string, empNo: string, fileId: string | null): Promise<void> {
    if (!fileId) return;
    await new sql.Request(tx)
      .input('s', sql.VarChar(1), source)
      .input('r', sql.VarChar(50), ref)
      .input('emp', sql.NVarChar(20), empNo)
      .input('f', sql.VarChar(36), fileId)
      .query(`INSERT INTO [portal].[consent_sign] (source, ref, emp_no, file_id) VALUES (@s, @r, @emp, @f)`);
  }

  async signX(guid: string, empNo: string, signFileId: string | null): Promise<SignResult> {
    return this.inTx(async (tx) => {
      const XB = this.t('ConsentXB');
      const req = () => new sql.Request(tx).input('g', sql.NVarChar(100), guid).input('emp', sql.NVarChar(20), empNo);
      await new sql.Request(tx)
        .input('lk', sql.NVarChar(255), `portal:consent:x:${guid}:${empNo}`)
        .query(
          `DECLARE @r int; EXEC @r = sp_getapplock @Resource = @lk, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000; IF @r < 0 THROW 50010, N'portal-api 應用鎖逾時', 1;`,
        );
      const dup = await req().query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${XB} WHERE LOWER(LTRIM(RTRIM(GUID))) = @g AND ${EMP}`);
      if (dup.recordset[0]!.n > 0) return { ok: false } as const;
      // ConfirmDate 為 date;舊程式不寫(預設值),新站明確寫今天
      await req().query(`INSERT INTO ${XB} (GUID, LgNo, ConfirmDate) VALUES (@g, @emp, CAST(GETDATE() AS date))`);
      await MssqlConsentRepo.sign(tx, 'x', guid, empNo, signFileId);
      const d = await new sql.Request(tx).query<{ d: string }>(`SELECT CONVERT(char(10), GETDATE(), 23) AS d`);
      return { ok: true, signedAt: d.recordset[0]!.d } as const;
    });
  }

  async signB(consentId: number, empNo: string, itemData: string | null, signFileId: string | null): Promise<SignResult> {
    return this.inTx(async (tx) => {
      const B = this.t('ConsentBInfo');
      const req = () => new sql.Request(tx).input('id', sql.Int, consentId).input('emp', sql.NVarChar(20), empNo);
      await new sql.Request(tx)
        .input('lk', sql.NVarChar(255), `portal:consent:b:${consentId}:${empNo}`)
        .query(
          `DECLARE @r int; EXEC @r = sp_getapplock @Resource = @lk, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000; IF @r < 0 THROW 50010, N'portal-api 應用鎖逾時', 1;`,
        );
      const dup = await req().query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${B} WHERE ConsentID = @id AND ${EMP}`);
      if (dup.recordset[0]!.n > 0) return { ok: false } as const;
      // 同舊程式欄位:ConsentID、LgNo、ConfirmDate(伺服器時間)、ItemData;SignFile 不寫(簽名在 portal.consent_sign,舊站讀不到,CONFIRM-NEEDED P7)
      await req()
        .input('data', sql.NVarChar(1200), itemData)
        .query(`INSERT INTO ${B} (ConsentID, LgNo, ConfirmDate, ItemData) VALUES (@id, @emp, GETDATE(), @data)`);
      await MssqlConsentRepo.sign(tx, 'b', String(consentId), empNo, signFileId);
      const d = await new sql.Request(tx).query<{ d: string }>(`SELECT CONVERT(char(10), GETDATE(), 23) AS d`);
      return { ok: true, signedAt: d.recordset[0]!.d } as const;
    });
  }
}
