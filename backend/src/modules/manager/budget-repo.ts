/**
 * 部門預算資料存取(Budget 庫,與舊入口網 / 預算系統共用,D-7;舊程式 Budget_DeptInfoV2、Budget_DeptData)。
 * 欄位型別照舊:DeptBudgetList.Month / Amount 為 varchar、BudgetData.amt 為 money、DeptBudgetMark.Month 為 tinyint、部門備註.Remark 為 varchar(4000)。
 * 寫入只 UPDATE 既有的 DeptBudgetList / BudgetData 列(同舊程式,不新增科目);鎖定檢查與寫入在同一交易(UPDLOCK + HOLDLOCK)。
 */
import sql from 'mssql';
import type { Sources } from '../../db/sources.js';
import { inList } from './scope.js';

export interface BudgetVersion {
  flag: number;
  year: number;
  ver: number;
  standard: string;
  isFinal: boolean;
  companyId: string;
  cid: number | null;
}

export interface BudgetDept {
  id: string;
  name: string | null;
}

export interface BudgetAccount {
  code: string;
  name: string | null;
  isSum: boolean;
}

export interface BudgetCell {
  code: string;
  month: number;
  amount: number;
  mark: string | null;
}

export interface DeptStatus {
  isFinal: boolean;
  /** 部門狀態.Status(部門狀態清單:0 未提交、1 完成、2 待簽核、3 退回待重提、4 自行退回、5 簽核同意);null = 沒有紀錄 */
  status: number | null;
}

export interface CellWrite {
  code: string;
  month: number;
  amount: number;
  /** undefined = 不修改備註 */
  mark?: string;
}

export interface BudgetSave {
  version: BudgetVersion;
  dept: string;
  empNo: string;
  /** undefined = 不修改部門備註 */
  remark?: string;
  cells: CellWrite[];
}

export interface BudgetRepo {
  /** LOS EmployeeInfo 公司別(在職優先) */
  compDbs(empNo: string): Promise<string[]>;
  currentFlag(companyId: string): Promise<{ year: number; companyName: string | null } | null>;
  versions(companyId: string, opts: { year?: number; openOnly?: boolean }): Promise<BudgetVersion[]>;
  version(flag: number): Promise<BudgetVersion | null>;
  /** UserInfo(啟用、公司):是否為管理者、部門主管的部門 */
  access(empNo: string, companyId: string): Promise<{ manager: boolean; depts: string[] }>;
  depts(companyId: string): Promise<BudgetDept[]>;
  /** 部門預算執行:DeptBudgetList 第 1 月有資料的科目(排除清單、0 開頭)× 1~12 月 */
  viewData(
    flag: number,
    dept: string,
    companyId: string,
    excluded: string[],
    includeZeroPrefix: boolean,
  ): Promise<{ accounts: BudgetAccount[]; cells: BudgetCell[] }>;
  /** 預算編列:科目(DeptBudgetList + 產品功能部門展開,舊 LoadAccountingWrite)、金額與備註、部門備註 */
  applyData(version: BudgetVersion, dept: string): Promise<{ accounts: BudgetAccount[]; cells: BudgetCell[]; remark: string | null }>;
  status(version: BudgetVersion, dept: string): Promise<DeptStatus>;
  /** 交易內重新檢查鎖定(isLocked)後寫入;回傳 locked / missing(某格沒有可更新的列) */
  save(
    input: BudgetSave,
    isLocked: (s: DeptStatus) => boolean,
  ): Promise<{ ok: true } | { ok: false; reason: 'locked' } | { ok: false; reason: 'missing'; code: string; month: number }>;
  submit(version: BudgetVersion, dept: string, isLocked: (s: DeptStatus) => boolean): Promise<{ ok: boolean }>;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export class MssqlBudgetRepo implements BudgetRepo {
  constructor(
    private readonly pool: sql.ConnectionPool,
    private readonly src: Sources,
  ) {}

  private t = (name: string) => this.src.table('Budget', name);

  async compDbs(empNo: string): Promise<string[]> {
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(20), empNo)
      .query<{ CompDB: string | null }>(
        `SELECT CompDB FROM ${this.src.table('LOS', 'EmployeeInfo')} WHERE UserID = @emp ORDER BY CASE WHEN LeaveDate IS NULL THEN 0 ELSE 1 END, JobDate DESC`,
      );
    return r.recordset.map((x) => (x.CompDB ?? '').trim().toUpperCase()).filter(Boolean);
  }

  async currentFlag(companyId: string) {
    const r = await this.pool
      .request()
      .input('co', sql.VarChar(50), companyId)
      .query<{ Year: string; CompanyName: string | null }>(`SELECT TOP 1 Year, CompanyName FROM ${this.t('CurrentFlag')} WHERE UPPER(CompanyID) = UPPER(@co)`);
    const x = r.recordset[0];
    const year = Number.parseInt(x?.Year ?? '', 10);
    return x && Number.isInteger(year) ? { year, companyName: x.CompanyName } : null;
  }

  private mapVersion = (x: {
    Flag: number;
    YYYY: number;
    ver: number;
    Standard: string | null;
    IsFinal: boolean | null;
    CompanyID: string;
    CID: number | null;
  }) => ({
    flag: x.Flag,
    year: x.YYYY,
    ver: x.ver,
    standard: (x.Standard ?? '').trim(),
    isFinal: !!x.IsFinal,
    companyId: x.CompanyID,
    cid: x.CID,
  });

  async versions(companyId: string, opts: { year?: number; openOnly?: boolean }): Promise<BudgetVersion[]> {
    const req = this.pool.request().input('co', sql.NVarChar(20), companyId);
    let where = 'UPPER(CompanyID) = UPPER(@co)';
    if (opts.year !== undefined) {
      req.input('y', sql.Int, opts.year);
      where += ' AND YYYY = @y';
    }
    if (opts.openOnly) where += ' AND IsFinal = 0';
    const r = await req.query(
      `SELECT Flag, YYYY, ver, Standard, IsFinal, CompanyID, CID FROM ${this.t('BudgetVersionInfo')} WHERE ${where} ORDER BY Flag DESC`,
    );
    return r.recordset.map(this.mapVersion);
  }

  async version(flag: number): Promise<BudgetVersion | null> {
    const r = await this.pool
      .request()
      .input('f', sql.Int, flag)
      .query(`SELECT Flag, YYYY, ver, Standard, IsFinal, CompanyID, CID FROM ${this.t('BudgetVersionInfo')} WHERE Flag = @f`);
    const x = r.recordset[0];
    return x ? this.mapVersion(x) : null;
  }

  async access(empNo: string, companyId: string) {
    const r = await this.pool
      .request()
      .input('emp', sql.VarChar(50), empNo)
      .input('co', sql.VarChar(50), companyId)
      .query<{ Competence: string | null; DeptID: string | null }>(
        `SELECT Competence, DeptID FROM ${this.t('UserInfo')} WHERE UserID = @emp AND UPPER(CompanyID) = UPPER(@co) AND IsActive = 1
           AND Competence IN ('管理者', '部門主管')`,
      );
    return {
      manager: r.recordset.some((x) => x.Competence === '管理者'),
      depts: r.recordset
        .filter((x) => x.Competence === '部門主管')
        .map((x) => (x.DeptID ?? '').trim().toUpperCase())
        .filter(Boolean),
    };
  }

  async depts(companyId: string): Promise<BudgetDept[]> {
    const r = await this.pool
      .request()
      .input('co', sql.VarChar(10), companyId)
      .query<{ DeptID: string; DeptName: string | null }>(
        `SELECT DeptID, MAX(DeptName) AS DeptName FROM ${this.t('DeptInfo')} WHERE IsActive = 1 AND UPPER(CompanyID) = UPPER(@co) GROUP BY DeptID ORDER BY DeptID`,
      );
    return r.recordset.map((x) => ({ id: x.DeptID.trim().toUpperCase(), name: x.DeptName }));
  }

  private async amounts(flag: number, dept: string): Promise<BudgetCell[]> {
    const r = await this.pool
      .request()
      .input('f', sql.Int, flag)
      .input('d', sql.VarChar(10), dept)
      .query<{ code: string; m: number | null; amount: number | null; mark: string | null }>(
        `SELECT D.AccountingCode AS code, TRY_CONVERT(int, D.Month) AS m, TRY_CONVERT(decimal(18, 2), D.Amount) AS amount, M.mark
         FROM ${this.t('DeptBudgetList')} AS D
         LEFT OUTER JOIN ${this.t('DeptBudgetMark')} AS M ON D.Flag = M.Flag AND D.DeptID = M.DeptID AND D.AccountingCode = M.AccountingCode AND TRY_CONVERT(int, D.Month) = M.Month
         WHERE D.Flag = @f AND D.DeptID = @d AND TRY_CONVERT(int, D.Month) BETWEEN 1 AND 12`,
      );
    return r.recordset.map((x) => ({ code: x.code.trim(), month: x.m!, amount: num(x.amount), mark: x.mark }));
  }

  async viewData(flag: number, dept: string, companyId: string, excluded: string[], includeZeroPrefix: boolean) {
    const req = this.pool.request().input('f', sql.Int, flag).input('d', sql.VarChar(10), dept).input('co', sql.NVarChar(40), companyId);
    const ex = inList(req, 'x', excluded, () => sql.VarChar(10));
    const r = await req.query<{ code: string; name: string | null }>(
      `SELECT D.AccountingCode AS code, MAX(A.AccountingName) AS name
       FROM ${this.t('DeptBudgetList')} AS D
       INNER JOIN ${this.t('AccountingCourses')} AS A ON A.AccountingCode = D.AccountingCode AND UPPER(A.CompanyID) = UPPER(@co)
       WHERE D.Flag = @f AND D.DeptID = @d AND TRY_CONVERT(int, D.Month) = 1 AND D.AccountingCode NOT IN (${ex})
         ${includeZeroPrefix ? '' : `AND LEFT(D.AccountingCode, 1) <> '0'`}
       GROUP BY D.AccountingCode ORDER BY D.AccountingCode`,
    );
    const accounts = r.recordset.map((x) => ({ code: x.code.trim(), name: x.name, isSum: false }));
    const codes = new Set(accounts.map((a) => a.code));
    // 舊程式另外排除 6210 的金額
    const cells = (await this.amounts(flag, dept)).filter((c) => codes.has(c.code) && c.code !== '6210');
    return { accounts, cells };
  }

  async applyData(version: BudgetVersion, dept: string) {
    const r = await this.pool
      .request()
      .input('f', sql.Int, version.flag)
      .input('cid', sql.Int, version.cid)
      .input('d', sql.NVarChar(10), dept)
      .input('co', sql.NVarChar(40), version.companyId)
      .query<{ code: string; name: string | null; isSum: number }>(
        `SELECT A.AccountingCode AS code, AC.AccountingName AS name, CASE WHEN AC.IsSum = 1 THEN 1 ELSE 0 END AS isSum
         FROM ${this.t('DeptBudgetList')} AS A INNER JOIN ${this.t('AccountingCourses')} AS AC ON AC.AccountingCode = A.AccountingCode AND AC.CompanyID = @co
         WHERE A.Flag = @f AND A.DeptID = @d AND TRY_CONVERT(int, A.Month) = 1 AND LEFT(A.AccountingCode, 1) <> '0'
         UNION
         SELECT F.AcctHead + '00', AF.HeadName, 1 FROM ${this.t('AcctProductFuncDept')} AS F
           LEFT OUTER JOIN ${this.t('AcctFunc')} AS AF ON F.AcctHead = AF.AcctHead AND F.CID = AF.CID
           LEFT OUTER JOIN ${this.t('AcctProductItem')} AS P ON P.AcctProduct = F.AcctProduct AND P.ProductItem = F.ProductItem AND P.CID = F.CID
           WHERE F.DeptID = @d AND P.CID = @cid
         UNION
         SELECT F.AcctHead + P.AcctProduct, AP.ProductName, 1 FROM ${this.t('AcctProductFuncDept')} AS F
           LEFT OUTER JOIN ${this.t('AcctProductItem')} AS P ON P.AcctProduct = F.AcctProduct AND P.ProductItem = F.ProductItem AND P.CID = F.CID
           LEFT OUTER JOIN ${this.t('AcctProduct')} AS AP ON P.AcctProduct = AP.AcctProduct AND P.CID = AP.CID
           WHERE F.DeptID = @d AND P.CID = @cid
         UNION
         SELECT F.AcctHead + P.AcctProduct + P.ProductItem, AP.ProductName + '-' + P.ItemName, 0 FROM ${this.t('AcctProductFuncDept')} AS F
           LEFT OUTER JOIN ${this.t('AcctProductItem')} AS P ON P.AcctProduct = F.AcctProduct AND P.ProductItem = F.ProductItem AND P.CID = F.CID
           LEFT OUTER JOIN ${this.t('AcctProduct')} AS AP ON P.AcctProduct = AP.AcctProduct AND P.CID = AP.CID
           WHERE F.DeptID = @d AND P.CID = @cid
         ORDER BY code`,
      );
    const seen = new Set<string>();
    const accounts: BudgetAccount[] = [];
    for (const x of r.recordset) {
      const code = (x.code ?? '').trim();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      accounts.push({ code, name: x.name, isSum: x.isSum === 1 });
    }
    const rem = await this.pool
      .request()
      .input('d', sql.VarChar(50), dept)
      .input('y', sql.Char(4), String(version.year))
      .input('co', sql.VarChar(50), version.companyId)
      .input('v', sql.Int, version.ver)
      .input('s', sql.VarChar(10), version.standard)
      .query<{ Remark: string | null }>(
        `SELECT TOP 1 Remark FROM ${this.t('部門備註')} WHERE DeptID = @d AND Year = @y AND CompanyID = @co AND Version = @v AND Standard = @s ORDER BY UpdateTime DESC`,
      );
    return { accounts, cells: await this.amounts(version.flag, dept), remark: rem.recordset[0]?.Remark ?? null };
  }

  private async statusIn(req: sql.Request, version: BudgetVersion, dept: string, lock: boolean): Promise<DeptStatus> {
    const hint = lock ? 'WITH (UPDLOCK, HOLDLOCK)' : '';
    const r = await req
      .input('f', sql.Int, version.flag)
      .input('d', sql.VarChar(10), dept)
      .input('co', sql.VarChar(10), version.companyId)
      .query<{ IsFinal: boolean | null; Status: number | null }>(
        `SELECT B.IsFinal, (SELECT TOP 1 D.Status FROM ${this.t('部門狀態')} AS D ${hint} WHERE D.Flag = B.Flag AND D.DeptID = @d AND D.CompanyID = @co ORDER BY D.Status DESC) AS Status
         FROM ${this.t('BudgetVersionInfo')} AS B ${hint} WHERE B.Flag = @f`,
      );
    const x = r.recordset[0];
    return { isFinal: x ? !!x.IsFinal : true, status: x?.Status ?? null };
  }

  status(version: BudgetVersion, dept: string) {
    return this.statusIn(this.pool.request(), version, dept, false);
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

  async save(input: BudgetSave, isLocked: (s: DeptStatus) => boolean) {
    const { version: v, dept } = input;
    type R = { ok: true } | { ok: false; reason: 'locked' } | { ok: false; reason: 'missing'; code: string; month: number };
    const missing = new Error('missing');
    let miss: { code: string; month: number } | null = null;
    try {
      return await this.inTx<R>(async (tx) => {
        if (isLocked(await this.statusIn(new sql.Request(tx), v, dept, true))) return { ok: false, reason: 'locked' };
        if (input.remark !== undefined)
          await new sql.Request(tx)
            .input('d', sql.VarChar(50), dept)
            .input('y', sql.Char(4), String(v.year))
            .input('co', sql.VarChar(50), v.companyId)
            .input('v', sql.Int, v.ver)
            .input('s', sql.VarChar(10), v.standard)
            .input('r', sql.NVarChar(4000), input.remark)
            .input('emp', sql.VarChar(50), input.empNo)
            .query(
              `DELETE FROM ${this.t('部門備註')} WHERE DeptID = @d AND Year = @y AND CompanyID = @co AND Version = @v AND Standard = @s;
               INSERT INTO ${this.t('部門備註')} (Year, Version, Standard, Remark, CompanyID, DeptID, UpdateID, UpdateTime) VALUES (@y, @v, @s, @r, @co, @d, @emp, GETDATE());`,
            );
        for (const c of input.cells) {
          const base = () =>
            new sql.Request(tx)
              .input('f', sql.Int, v.flag)
              .input('d', sql.VarChar(10), dept)
              .input('code', sql.VarChar(10), c.code)
              .input('m', sql.Int, c.month);
          const r = await base()
            .input('a', sql.VarChar(20), String(c.amount))
            .input('amt', sql.Money, c.amount)
            .query(
              `UPDATE ${this.t('DeptBudgetList')} SET Amount = @a WHERE Flag = @f AND DeptID = @d AND AccountingCode = @code AND TRY_CONVERT(int, Month) = @m;
               UPDATE ${this.t('BudgetData')} SET amt = @amt WHERE Flag = @f AND DeptID = @d AND AccountingCode = @code AND Month = @m;`,
            );
          if ((r.rowsAffected[0] ?? 0) === 0) {
            miss = { code: c.code, month: c.month };
            throw missing;
          }
          if (c.mark !== undefined)
            await base()
              .input('mark', sql.NVarChar(300), c.mark)
              .query(
                `DELETE FROM ${this.t('DeptBudgetMark')} WHERE Flag = @f AND DeptID = @d AND AccountingCode = @code AND Month = @m;
                 ${c.mark ? `INSERT INTO ${this.t('DeptBudgetMark')} (Flag, DeptID, AccountingCode, Month, mark) VALUES (@f, @d, @code, @m, @mark);` : ''}`,
              );
        }
        return { ok: true };
      });
    } catch (err) {
      if (err === missing && miss) return { ok: false as const, reason: 'missing' as const, ...(miss as { code: string; month: number }) };
      throw err;
    }
  }

  submit(version: BudgetVersion, dept: string, isLocked: (s: DeptStatus) => boolean) {
    return this.inTx(async (tx) => {
      if (isLocked(await this.statusIn(new sql.Request(tx), version, dept, true))) return { ok: false };
      await new sql.Request(tx)
        .input('f', sql.Int, version.flag)
        .input('d', sql.VarChar(10), dept)
        .input('co', sql.VarChar(10), version.companyId)
        .query(
          `DELETE FROM ${this.t('部門狀態')} WHERE Flag = @f AND DeptID = @d AND CompanyID = @co;
           INSERT INTO ${this.t('部門狀態')} (Flag, DeptID, CompanyID, IsFinish, Status) VALUES (@f, @d, @co, 0, 1);`,
        );
      return { ok: true };
    });
  }
}
