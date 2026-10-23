/**
 * ESH 證照舊表存取(PortalSolar LicenseInfo / LicenseBInfo / LicenseFileA / LicenseFileC / LicenseManagerInfo / LicenseCompanyInfo;
 * LOS RankInfo 判斷在職與主管,同舊 EHLicense「UserID = VirtualUserID AND IsMaster = 1 AND LeaveDate IS NULL」)。
 * 一律參數化;舊表沒有唯一鍵,「檢查重複再寫入」包交易並以 UPDLOCK + HOLDLOCK 鎖住檢查範圍。
 * 跨庫比對工號加 COLLATE(正式區 PortalSolar 與 LOS 為不同庫)。日期欄為 date,以 YYYY-MM-DD 字串進出。
 */
import sql from 'mssql';
import type { Sources } from '../../db/sources.js';
import { chunks, inList } from '../manager/scope.js';
import type {
  CreateHolderResult,
  DashboardRow,
  EshRepo,
  HolderRow,
  HolderWrite,
  LegacyDoc,
  LicenseItemRow,
  LicenseItemWrite,
  ManagerRow,
  NeedRow,
  Person,
} from './types.js';

const CI = 'COLLATE Chinese_Taiwan_Stroke_CI_AS';
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const trimOrNull = (s: string | null) => (s === null ? null : s.trim() || null);

/** 主要身分列(同舊程式),在職者優先 */
const rankApply = (rank: string, emp: string) =>
  `OUTER APPLY (SELECT TOP 1 R.UserID, R.UserName, R.Dept, R.BossID, R.LeaveDate FROM ${rank} AS R
     WHERE R.UserID ${CI} = ${emp} ${CI} AND R.UserID = R.VirtualUserID AND R.IsMaster = 1
     ORDER BY CASE WHEN R.LeaveDate IS NULL THEN 0 ELSE 1 END) AS R`;

interface HolderSql {
  ID: number;
  LicenseID: number;
  LicenseName: string | null;
  ActiveYear: number | null;
  Company: string | null;
  LgNo: string | null;
  UserID: string | null;
  UserName: string | null;
  Dept: string | null;
  BossID: string | null;
  LeaveDate: Date | null;
  TrainingDate: Date | null;
  GatDate: Date | null;
  Training2Date: Date | null;
  NextTrainingDate: Date | null;
  SendMailDay: number | null;
  IsActive: boolean | null;
}

const toHolder = (x: HolderSql): HolderRow => ({
  id: x.ID,
  licenseId: x.LicenseID,
  licenseName: x.LicenseName ?? '',
  months: x.ActiveYear,
  company: (x.Company ?? '').trim(),
  empNo: (x.LgNo ?? '').trim().toUpperCase(),
  name: trimOrNull(x.UserName),
  dept: trimOrNull(x.Dept),
  bossId: x.BossID?.trim().toUpperCase() || null,
  trainingDate: iso(x.TrainingDate),
  gatDate: iso(x.GatDate),
  retrainDate: iso(x.Training2Date),
  nextTrainingDate: iso(x.NextTrainingDate),
  notifyDays: x.SendMailDay,
  active: x.IsActive === true,
  inService: !!x.UserID && x.LeaveDate === null,
});

export class MssqlEshRepo implements EshRepo {
  constructor(
    private readonly pool: sql.ConnectionPool,
    private readonly src: Sources,
  ) {}

  private t = (name: string) => this.src.table('PortalSolar', name);
  private get rank() {
    return this.src.table('LOS', 'RankInfo');
  }

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

  async managerCompanies(empNo: string): Promise<string[]> {
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(20), empNo)
      .query<{ Company: string }>(
        `SELECT DISTINCT LTRIM(RTRIM(A.Company)) AS Company, ISNULL(B.ItemIndex, 9999) AS ord FROM ${this.t('LicenseManagerInfo')} AS A
         LEFT JOIN ${this.t('LicenseCompanyInfo')} AS B ON B.Company = A.Company
         WHERE UPPER(LTRIM(RTRIM(A.LgNo))) = @emp AND A.Company IS NOT NULL AND LTRIM(RTRIM(A.Company)) <> N'' ORDER BY ord, Company`,
      );
    return r.recordset.map((x) => x.Company);
  }

  async companies(): Promise<string[]> {
    const r = await this.pool
      .request()
      .query<{ Company: string }>(
        `SELECT LTRIM(RTRIM(Company)) AS Company FROM ${this.t('LicenseCompanyInfo')} WHERE Company IS NOT NULL ORDER BY ItemIndex, Company`,
      );
    return r.recordset.map((x) => x.Company);
  }

  // ───── 證照項目 ─────
  async items(includeInactive: boolean): Promise<LicenseItemRow[]> {
    const r = await this.pool.request().query<{
      LicenseID: number;
      LicenseName: string | null;
      ActiveYear: number | null;
      Script: string | null;
      LogoPath: string | null;
      IsActive: boolean | null;
    }>(
      `SELECT LicenseID, LicenseName, ActiveYear, Script, LogoPath, IsActive FROM ${this.t('LicenseInfo')}
       ${includeInactive ? '' : 'WHERE IsActive = 1'} ORDER BY LicenseName, LicenseID`,
    );
    return r.recordset.map((x) => ({
      id: x.LicenseID,
      name: (x.LicenseName ?? '').trim(),
      months: x.ActiveYear,
      script: x.Script,
      logoPath: trimOrNull(x.LogoPath),
      active: x.IsActive === true,
    }));
  }

  async item(id: number): Promise<LicenseItemRow | null> {
    return (await this.items(true)).find((x) => x.id === id) ?? null;
  }

  async itemNameTaken(name: string, exceptId = 0): Promise<boolean> {
    const r = await this.pool
      .request()
      .input('name', sql.NVarChar(50), name)
      .input('id', sql.Int, exceptId)
      .query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${this.t('LicenseInfo')} WHERE IsActive = 1 AND LTRIM(RTRIM(LicenseName)) = @name AND LicenseID <> @id`);
    return r.recordset[0]!.n > 0;
  }

  private bindItem(req: sql.Request, input: LicenseItemWrite) {
    return req.input('name', sql.NVarChar(50), input.name).input('months', sql.Float, input.months).input('script', sql.NVarChar(4000), input.script);
  }

  async createItem(input: LicenseItemWrite): Promise<number> {
    const r = await this.bindItem(this.pool.request(), input).query<{ id: number }>(
      `INSERT INTO ${this.t('LicenseInfo')} (LicenseName, Script, ActiveYear, IsActive) OUTPUT INSERTED.LicenseID AS id VALUES (@name, @script, @months, 1)`,
    );
    return r.recordset[0]!.id;
  }

  async updateItem(id: number, input: LicenseItemWrite): Promise<boolean> {
    const r = await this.bindItem(this.pool.request(), input)
      .input('id', sql.Int, id)
      .query(`UPDATE ${this.t('LicenseInfo')} SET LicenseName = @name, Script = @script, ActiveYear = @months WHERE LicenseID = @id AND IsActive = 1`);
    return r.rowsAffected[0]! > 0;
  }

  async itemUsage(id: number): Promise<{ needs: number; holders: number }> {
    const r = await this.pool
      .request()
      .input('id', sql.Int, id)
      .query<{ needs: number; holders: number }>(
        `SELECT (SELECT COUNT(*) FROM ${this.t('LicenseBInfo')} WHERE LicenseID = @id) AS needs,
                (SELECT COUNT(*) FROM ${this.t('LicenseFileA')} WHERE LicenseID = @id AND IsActive = 1) AS holders`,
      );
    return r.recordset[0]!;
  }

  async deactivateItem(id: number): Promise<boolean> {
    const r = await this.pool
      .request()
      .input('id', sql.Int, id)
      .query(`UPDATE ${this.t('LicenseInfo')} SET IsActive = 0 WHERE LicenseID = @id AND IsActive = 1`);
    return r.rowsAffected[0]! > 0;
  }

  // ───── 證照需求 ─────
  async needs(companies: string[]): Promise<NeedRow[]> {
    if (!companies.length) return [];
    const req = this.pool.request();
    const c = inList(req, 'c', companies, () => sql.NVarChar(20));
    const r = await req.query<{ LicenseID: number; Company: string; LicenseName: string | null; LicenseCount: number | null; Notes: string | null }>(
      `SELECT B.LicenseID, LTRIM(RTRIM(B.Company)) AS Company, L.LicenseName, B.LicenseCount, B.Notes FROM ${this.t('LicenseBInfo')} AS B
       JOIN ${this.t('LicenseInfo')} AS L ON L.LicenseID = B.LicenseID AND L.IsActive = 1
       WHERE LTRIM(RTRIM(B.Company)) IN (${c}) ORDER BY B.Company, L.LicenseName`,
    );
    return r.recordset.map((x) => ({
      licenseId: x.LicenseID,
      company: x.Company,
      licenseName: x.LicenseName ?? '',
      required: x.LicenseCount ?? 0,
      notes: x.Notes,
    }));
  }

  private needReq(req: sql.Request, company: string, licenseId: number) {
    return req.input('company', sql.NVarChar(20), company).input('lid', sql.Int, licenseId);
  }

  createNeed(company: string, licenseId: number, required: number, notes: string | null): Promise<boolean> {
    return this.inTx(async (tx) => {
      const dup = await this.needReq(new sql.Request(tx), company, licenseId).query<{ n: number }>(
        `SELECT COUNT(*) AS n FROM ${this.t('LicenseBInfo')} WITH (UPDLOCK, HOLDLOCK) WHERE LicenseID = @lid AND LTRIM(RTRIM(Company)) = @company`,
      );
      if (dup.recordset[0]!.n > 0) return false;
      await this.needReq(new sql.Request(tx), company, licenseId)
        .input('count', sql.Int, required)
        .input('notes', sql.NVarChar(350), notes)
        .query(`INSERT INTO ${this.t('LicenseBInfo')} (LicenseID, Company, LicenseCount, Notes) VALUES (@lid, @company, @count, @notes)`);
      return true;
    });
  }

  async updateNeed(company: string, licenseId: number, required: number, notes: string | null): Promise<boolean> {
    const r = await this.needReq(this.pool.request(), company, licenseId)
      .input('count', sql.Int, required)
      .input('notes', sql.NVarChar(350), notes)
      .query(`UPDATE ${this.t('LicenseBInfo')} SET LicenseCount = @count, Notes = @notes WHERE LicenseID = @lid AND LTRIM(RTRIM(Company)) = @company`);
    return r.rowsAffected[0]! > 0;
  }

  async deleteNeed(company: string, licenseId: number): Promise<boolean> {
    const r = await this.needReq(this.pool.request(), company, licenseId).query(
      `DELETE FROM ${this.t('LicenseBInfo')} WHERE LicenseID = @lid AND LTRIM(RTRIM(Company)) = @company`,
    );
    return r.rowsAffected[0]! > 0;
  }

  // ───── 儀表板 ─────
  async dashboard(company: string, today: string): Promise<DashboardRow[]> {
    const r = await this.pool
      .request()
      .input('company', sql.NVarChar(20), company)
      .input('today', sql.Date, today)
      .query<{
        LicenseID: number;
        LicenseName: string | null;
        Script: string | null;
        LogoPath: string | null;
        ActiveYear: number | null;
        LicenseCount: number | null;
        Notes: string | null;
        Valid: number;
      }>(
        `SELECT B.LicenseID, L.LicenseName, L.Script, L.LogoPath, L.ActiveYear, B.LicenseCount, B.Notes,
           (SELECT COUNT(*) FROM ${this.t('LicenseFileA')} AS A
            WHERE A.LicenseID = B.LicenseID AND LTRIM(RTRIM(A.Company)) = @company AND A.IsActive = 1 AND A.NextTrainingDate >= @today
              AND EXISTS (SELECT 1 FROM ${this.rank} AS R WHERE R.UserID ${CI} = A.LgNo ${CI} AND R.UserID = R.VirtualUserID AND R.IsMaster = 1 AND R.LeaveDate IS NULL)) AS Valid
         FROM ${this.t('LicenseBInfo')} AS B JOIN ${this.t('LicenseInfo')} AS L ON L.LicenseID = B.LicenseID AND L.IsActive = 1
         WHERE LTRIM(RTRIM(B.Company)) = @company ORDER BY L.LicenseName DESC`,
      );
    return r.recordset.map((x) => ({
      licenseId: x.LicenseID,
      licenseName: x.LicenseName ?? '',
      script: x.Script,
      logoPath: trimOrNull(x.LogoPath),
      months: x.ActiveYear,
      required: x.LicenseCount ?? 0,
      notes: x.Notes,
      valid: x.Valid,
    }));
  }

  // ───── 持證人員 ─────
  private holderSelect(where: string) {
    return `SELECT A.ID, A.LicenseID, L.LicenseName, L.ActiveYear, A.Company, A.LgNo, R.UserID, R.UserName, R.Dept, R.BossID, R.LeaveDate,
              A.TrainingDate, A.GatDate, A.Training2Date, A.NextTrainingDate, A.SendMailDay, A.IsActive
            FROM ${this.t('LicenseFileA')} AS A JOIN ${this.t('LicenseInfo')} AS L ON L.LicenseID = A.LicenseID AND L.IsActive = 1
            ${rankApply(this.rank, 'A.LgNo')}
            WHERE ${where}`;
  }

  async holders(companies: string[], licenseId?: number): Promise<HolderRow[]> {
    if (!companies.length) return [];
    const req = this.pool.request();
    const c = inList(req, 'c', companies, () => sql.NVarChar(20));
    if (licenseId !== undefined) req.input('lid', sql.Int, licenseId);
    const r = await req.query<HolderSql>(
      `${this.holderSelect(`LTRIM(RTRIM(A.Company)) IN (${c})${licenseId !== undefined ? ' AND A.LicenseID = @lid' : ''}`)} ORDER BY L.LicenseName DESC, A.LgNo`,
    );
    return r.recordset.map(toHolder);
  }

  async holder(id: number): Promise<HolderRow | null> {
    const r = await this.pool.request().input('id', sql.Int, id).query<HolderSql>(this.holderSelect('A.ID = @id'));
    const x = r.recordset[0];
    return x ? toHolder(x) : null;
  }

  async person(empNo: string): Promise<Person | null> {
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(20), empNo)
      .query<{ UserID: string; UserName: string | null; Dept: string | null; BossID: string | null; LeaveDate: Date | null }>(
        `SELECT TOP 1 UserID, UserName, Dept, BossID, LeaveDate FROM ${this.rank}
         WHERE UPPER(LTRIM(RTRIM(UserID))) = @emp AND UserID = VirtualUserID AND IsMaster = 1 ORDER BY CASE WHEN LeaveDate IS NULL THEN 0 ELSE 1 END`,
      );
    const x = r.recordset[0];
    return x
      ? {
          empNo: x.UserID.trim().toUpperCase(),
          name: trimOrNull(x.UserName),
          dept: trimOrNull(x.Dept),
          bossId: x.BossID?.trim().toUpperCase() || null,
          inService: x.LeaveDate === null,
        }
      : null;
  }

  private bindHolder(req: sql.Request, input: HolderWrite) {
    return req
      .input('company', sql.NVarChar(20), input.company)
      .input('t1', sql.Date, input.trainingDate)
      .input('gat', sql.Date, input.gatDate)
      .input('t2', sql.Date, input.retrainDate)
      .input('next', sql.Date, input.nextTrainingDate)
      .input('days', sql.Int, input.notifyDays);
  }

  createHolder(empNo: string, licenseId: number, input: HolderWrite): Promise<CreateHolderResult> {
    return this.inTx(async (tx) => {
      const existing = await new sql.Request(tx)
        .input('emp', sql.NVarChar(20), empNo)
        .input('lid', sql.Int, licenseId)
        .input('company', sql.NVarChar(20), input.company)
        .query<{ ID: number; IsActive: boolean | null }>(
          `SELECT ID, IsActive FROM ${this.t('LicenseFileA')} WITH (UPDLOCK, HOLDLOCK)
           WHERE UPPER(LTRIM(RTRIM(LgNo))) = @emp AND LicenseID = @lid AND LTRIM(RTRIM(Company)) = @company ORDER BY ID DESC`,
        );
      if (existing.recordset.some((x) => x.IsActive === true)) return { ok: false, reason: 'duplicate' };
      const old = existing.recordset[0];
      if (old) {
        await this.bindHolder(new sql.Request(tx), input)
          .input('id', sql.Int, old.ID)
          .query(
            `UPDATE ${this.t('LicenseFileA')} SET TrainingDate = @t1, GatDate = @gat, Training2Date = @t2, NextTrainingDate = @next, SendMailDay = @days, IsActive = 1 WHERE ID = @id`,
          );
        return { ok: true, id: old.ID, reactivated: true };
      }
      const r = await this.bindHolder(new sql.Request(tx), input)
        .input('emp', sql.NVarChar(20), empNo)
        .input('lid', sql.Int, licenseId)
        .query<{ id: number }>(
          `INSERT INTO ${this.t('LicenseFileA')} (LicenseID, LgNo, TrainingDate, GatDate, Training2Date, NextTrainingDate, SendMailDay, Company, IsActive)
           OUTPUT INSERTED.ID AS id VALUES (@lid, @emp, @t1, @gat, @t2, @next, @days, @company, 1)`,
        );
      return { ok: true, id: r.recordset[0]!.id, reactivated: false };
    });
  }

  async updateHolder(id: number, input: HolderWrite): Promise<boolean> {
    const r = await this.bindHolder(this.pool.request(), input)
      .input('id', sql.Int, id)
      .query(
        `UPDATE ${this.t('LicenseFileA')} SET Company = @company, TrainingDate = @t1, GatDate = @gat, Training2Date = @t2, NextTrainingDate = @next, SendMailDay = @days
         WHERE ID = @id AND IsActive = 1`,
      );
    return r.rowsAffected[0]! > 0;
  }

  async deactivateHolder(id: number): Promise<boolean> {
    const r = await this.pool
      .request()
      .input('id', sql.Int, id)
      .query(`UPDATE ${this.t('LicenseFileA')} SET IsActive = 0 WHERE ID = @id AND IsActive = 1`);
    return r.rowsAffected[0]! > 0;
  }

  async legacyDocs(holderIds: number[]): Promise<LegacyDoc[]> {
    const out: LegacyDoc[] = [];
    for (const part of chunks(holderIds)) {
      const req = this.pool.request();
      part.forEach((v, i) => req.input(`i${i}`, sql.Int, v));
      const ids = part.map((_, i) => `@i${i}`).join(', ');
      const r = await req.query<{ ID: number; LgNo: string | null; FileName: string | null }>(
        `SELECT ID, LgNo, FileName FROM ${this.t('LicenseFileC')} WHERE ID IN (${ids}) AND FileName IS NOT NULL AND LTRIM(RTRIM(FileName)) <> N'' ORDER BY ID, FileName`,
      );
      for (const x of r.recordset) out.push({ holderId: x.ID, empNo: (x.LgNo ?? '').trim().toUpperCase(), fileName: x.FileName!.trim() });
    }
    return out;
  }

  async deleteLegacyDoc(holderId: number, empNo: string, fileName: string): Promise<boolean> {
    const r = await this.pool
      .request()
      .input('id', sql.Int, holderId)
      .input('emp', sql.NVarChar(20), empNo)
      .input('name', sql.NVarChar(100), fileName)
      .query(`DELETE FROM ${this.t('LicenseFileC')} WHERE ID = @id AND UPPER(LTRIM(RTRIM(LgNo))) = @emp AND LTRIM(RTRIM(FileName)) = @name`);
    return r.rowsAffected[0]! > 0;
  }

  // ───── 證照管理員 ─────
  async managers(companies: string[]): Promise<ManagerRow[]> {
    if (!companies.length) return [];
    const req = this.pool.request();
    const c = inList(req, 'c', companies, () => sql.NVarChar(20));
    const r = await req.query<{
      Company: string;
      LgNo: string;
      SendMail: boolean | null;
      UserID: string | null;
      UserName: string | null;
      Dept: string | null;
      LeaveDate: Date | null;
    }>(
      `SELECT LTRIM(RTRIM(M.Company)) AS Company, LTRIM(RTRIM(M.LgNo)) AS LgNo, M.SendMail, R.UserID, R.UserName, R.Dept, R.LeaveDate
       FROM ${this.t('LicenseManagerInfo')} AS M ${rankApply(this.rank, 'M.LgNo')}
       WHERE LTRIM(RTRIM(M.Company)) IN (${c}) AND M.LgNo IS NOT NULL ORDER BY M.Company, M.LgNo`,
    );
    return r.recordset.map((x) => ({
      company: x.Company,
      empNo: x.LgNo.toUpperCase(),
      name: trimOrNull(x.UserName),
      dept: trimOrNull(x.Dept),
      sendMail: x.SendMail === true,
      inService: !!x.UserID && x.LeaveDate === null,
    }));
  }

  private mgrReq(req: sql.Request, company: string, empNo: string) {
    return req.input('company', sql.NVarChar(20), company).input('emp', sql.NVarChar(20), empNo);
  }
  private static MGR_WHERE = 'LTRIM(RTRIM(Company)) = @company AND UPPER(LTRIM(RTRIM(LgNo))) = @emp';

  createManager(company: string, empNo: string, sendMail: boolean): Promise<boolean> {
    return this.inTx(async (tx) => {
      const dup = await this.mgrReq(new sql.Request(tx), company, empNo).query<{ n: number }>(
        `SELECT COUNT(*) AS n FROM ${this.t('LicenseManagerInfo')} WITH (UPDLOCK, HOLDLOCK) WHERE ${MssqlEshRepo.MGR_WHERE}`,
      );
      if (dup.recordset[0]!.n > 0) return false;
      await this.mgrReq(new sql.Request(tx), company, empNo)
        .input('send', sql.Bit, sendMail)
        .query(`INSERT INTO ${this.t('LicenseManagerInfo')} (Company, LgNo, SendMail) VALUES (@company, @emp, @send)`);
      return true;
    });
  }

  async updateManagerSendMail(company: string, empNo: string, sendMail: boolean): Promise<boolean> {
    const r = await this.mgrReq(this.pool.request(), company, empNo)
      .input('send', sql.Bit, sendMail)
      .query(`UPDATE ${this.t('LicenseManagerInfo')} SET SendMail = @send WHERE ${MssqlEshRepo.MGR_WHERE}`);
    return r.rowsAffected[0]! > 0;
  }

  deleteManager(company: string, empNo: string): Promise<'ok' | 'not-found' | 'last'> {
    return this.inTx(async (tx) => {
      const r = await this.mgrReq(new sql.Request(tx), company, empNo).query<{ total: number; mine: number }>(
        `SELECT COUNT(*) AS total, SUM(CASE WHEN UPPER(LTRIM(RTRIM(LgNo))) = @emp THEN 1 ELSE 0 END) AS mine
         FROM ${this.t('LicenseManagerInfo')} WITH (UPDLOCK, HOLDLOCK) WHERE LTRIM(RTRIM(Company)) = @company`,
      );
      const { total, mine } = r.recordset[0]!;
      if (!mine) return 'not-found';
      if (total - mine < 1) return 'last';
      await this.mgrReq(new sql.Request(tx), company, empNo).query(`DELETE FROM ${this.t('LicenseManagerInfo')} WHERE ${MssqlEshRepo.MGR_WHERE}`);
      return 'ok';
    });
  }
}
