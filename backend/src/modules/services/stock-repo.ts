/** 員工持股資料存取(modules/services/stock.ts):PortalSolar EmployeeStockInfo(唯讀)、EmployeeStockLog(寫入,舊表無唯一鍵 → 交易內以應用鎖(年度 + 工號)鎖定後檢查,資安審查 M3) */
import sql from 'mssql';
import type { Sources } from '../../db/sources.js';
import type { StockLog, StockRepo, StockRow } from './stock.js';

export class MssqlStockRepo implements StockRepo {
  constructor(
    private readonly pool: sql.ConnectionPool,
    private readonly src: Sources,
  ) {}

  private t = (name: string) => this.src.table('PortalSolar', name);

  async rows(empNo: string): Promise<StockRow[]> {
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(20), empNo)
      .query<{
        Annual: number;
        UserID: string;
        UserName: string | null;
        StockTypeName: string | null;
        BackStockNo: number | null;
        TotalStockNo: number | null;
        JoinDate: string | null;
        BackDate: string | null;
        CanBack: string | null;
      }>(
        `SELECT Annual, UserID, UserName, StockTypeName, BackStockNo, TotalStockNo, JoinDate, BackDate, CanBack FROM ${this.t('EmployeeStockInfo')}
         WHERE UPPER(LTRIM(RTRIM(UserID))) = @emp AND Annual IS NOT NULL ORDER BY Annual DESC, StockTypeName`,
      );
    return r.recordset.map((x) => ({
      annual: x.Annual,
      userId: x.UserID.trim().toUpperCase(),
      userName: x.UserName?.trim() || null,
      stockType: x.StockTypeName?.trim() || null,
      backStockNo: x.BackStockNo,
      totalStockNo: x.TotalStockNo,
      joinDate: x.JoinDate?.trim() || null,
      backDate: x.BackDate?.trim() || null,
      canBack: (x.CanBack ?? '').trim().toUpperCase() === 'Y',
    }));
  }

  async logs(empNo: string): Promise<StockLog[]> {
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(20), empNo)
      .query<{ Annual: number; DoBack: string | null; BackStockNo: number | null; t: string | null; BankAccount: string | null }>(
        `SELECT Annual, DoBack, BackStockNo, CONVERT(varchar(19), ConfirmTime, 120) AS t, BankAccount FROM ${this.t('EmployeeStockLog')}
         WHERE UPPER(LTRIM(RTRIM(UserID))) = @emp ORDER BY Annual DESC, ConfirmTime`,
      );
    // 同一年度若有多筆(舊資料無唯一鍵),以第一筆為準(舊程式 DT.Rows[0])
    const seen = new Set<number>();
    return r.recordset
      .filter((x) => !seen.has(x.Annual) && seen.add(x.Annual))
      .map((x) => ({
        annual: x.Annual,
        doBack: (x.DoBack ?? '').trim(),
        backStockNo: x.BackStockNo,
        confirmTime: x.t,
        bankAccount: x.BankAccount?.trim() || null,
      }));
  }

  async decide(i: { annual: number; empNo: string; userName: string; backStockNo: number; doBack: 'Y' | 'N'; bankAccount: string | null }): Promise<boolean> {
    const tx = new sql.Transaction(this.pool);
    await tx.begin();
    try {
      const L = this.t('EmployeeStockLog');
      await new sql.Request(tx)
        .input('lk', sql.NVarChar(255), `portal:stock:${i.annual}:${i.empNo}`)
        .query(
          `DECLARE @r int; EXEC @r = sp_getapplock @Resource = @lk, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000; IF @r < 0 THROW 50010, N'portal-api 應用鎖逾時', 1;`,
        );
      const dup = await new sql.Request(tx)
        .input('y', sql.Int, i.annual)
        .input('emp', sql.NVarChar(20), i.empNo)
        .query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${L} WHERE Annual = @y AND UPPER(LTRIM(RTRIM(UserID))) = @emp`);
      if (dup.recordset[0]!.n > 0) {
        await tx.rollback();
        return false;
      }
      await new sql.Request(tx)
        .input('y', sql.Int, i.annual)
        .input('emp', sql.NVarChar(20), i.empNo)
        .input('name', sql.NVarChar(20), i.userName.slice(0, 20))
        .input('n', sql.Int, i.backStockNo)
        .input('d', sql.NVarChar(4), i.doBack)
        .input('acc', sql.NVarChar(40), i.bankAccount)
        .query(`INSERT INTO ${L} (Annual, UserID, UserName, ConfirmTime, BackStockNo, DoBack, BankAccount) VALUES (@y, @emp, @name, GETDATE(), @n, @d, @acc)`);
      await tx.commit();
      return true;
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }
}
