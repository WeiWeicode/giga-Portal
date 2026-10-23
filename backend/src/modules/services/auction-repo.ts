/**
 * 內部拍賣資料存取(modules/services/auction.ts):PortalSolar ContentX(唯讀)、ContentXMessage(寫入)。
 * ContentXMessage 沒有主鍵:出價以「UpDateTime(毫秒)| LgNo」定位,刪除只動一筆(TOP 1);出價寫入在交易內取得應用鎖(鍵 = 品項)後取最高價。
 * ContentXMessage 也存公告留言:讀取 / 刪除一律限定 ContentType = 購物台,且品項須為拍賣品(資安審查 M2)。
 */
import sql from 'mssql';
import type { Sources } from '../../db/sources.js';
import { AUCTION_TYPE, type AuctionItemRow, type AuctionRepo, type BidRow } from './auction.js';

/** 期間條件(同舊程式:未下架、今天在起訖日字串之間,空白不限) */
const OPEN = `ISNULL(X.UpDown, N'') <> N'Down' AND @today BETWEEN ISNULL(NULLIF(X.StartDate, N''), N'1900/01/01') AND ISNULL(NULLIF(X.EndDate, N''), N'2200/12/31')`;
const AMOUNT = `TRY_CONVERT(bigint, REPLACE(LTRIM(RTRIM(M.Message)), N',', N''))`;
const KEY = `CONVERT(varchar(23), M.UpDateTime, 121) + '|' + UPPER(LTRIM(RTRIM(M.LgNo)))`;

export class MssqlAuctionRepo implements AuctionRepo {
  constructor(
    private readonly pool: sql.ConnectionPool,
    private readonly src: Sources,
  ) {}

  private t = (name: string) => this.src.table('PortalSolar', name);
  /** 出價屬於拍賣品(留言表也存公告留言;需 @type 參數) */
  private get isAuction() {
    return `M.ContentType = @type AND EXISTS (SELECT 1 FROM ${this.t('ContentX')} AS X2 WHERE LOWER(LTRIM(RTRIM(X2.GUID))) = LOWER(LTRIM(RTRIM(M.GUID))) AND X2.ContentType = @type)`;
  }

  async items(today: string): Promise<AuctionItemRow[]> {
    const r = await this.pool
      .request()
      .input('today', sql.NVarChar(20), today)
      .input('type', sql.NVarChar(100), AUCTION_TYPE)
      .query<{ GUID: string; indexContent: string | null; Content_main: string | null; StartDate: string | null; EndDate: string | null }>(
        `SELECT X.GUID, X.indexContent, X.Content_main, X.StartDate, X.EndDate FROM ${this.t('ContentX')} AS X
         WHERE X.ContentType = @type AND X.GUID IS NOT NULL AND ${OPEN} ORDER BY X.StartDate DESC, X.indexContent`,
      );
    return r.recordset.map((x) => ({
      guid: x.GUID.trim().toLowerCase(),
      title: x.indexContent?.trim() || '拍賣品',
      body: x.Content_main,
      startDate: x.StartDate,
      endDate: x.EndDate,
    }));
  }

  async bids(guids: string[]): Promise<BidRow[]> {
    if (!guids.length) return [];
    const req = this.pool.request().input('type', sql.NVarChar(100), AUCTION_TYPE);
    const names = guids.slice(0, 200).map((g, i) => {
      req.input(`g${i}`, sql.NVarChar(100), g);
      return `@g${i}`;
    });
    const r = await req.query<{
      g: string;
      k: string;
      LgNo: string | null;
      LgName: string | null;
      amount: number | string | null;
      Message: string | null;
      tm: string | null;
    }>(
      `SELECT LOWER(LTRIM(RTRIM(M.GUID))) AS g, ${KEY} AS k, M.LgNo, M.LgName, ${AMOUNT} AS amount, M.Message, CONVERT(varchar(16), M.UpDateTime, 120) AS tm
       FROM ${this.t('ContentXMessage')} AS M WHERE LOWER(LTRIM(RTRIM(M.GUID))) IN (${names.join(', ')}) AND M.IsActive = 1 AND ${this.isAuction} ORDER BY M.UpDateTime DESC`,
    );
    return r.recordset.map((x) => ({
      guid: x.g,
      key: x.k,
      empNo: (x.LgNo ?? '').trim().toUpperCase(),
      name: x.LgName?.trim() || null,
      amount: x.amount === null ? null : Number(x.amount),
      message: x.Message,
      time: x.tm,
    }));
  }

  async placeBid(i: { guid: string; today: string; empNo: string; name: string; amount: number; step: number }) {
    const tx = new sql.Transaction(this.pool);
    await tx.begin();
    try {
      const open = await new sql.Request(tx)
        .input('g', sql.NVarChar(100), i.guid)
        .input('today', sql.NVarChar(20), i.today)
        .input('type', sql.NVarChar(100), AUCTION_TYPE)
        .query<{ n: number }>(
          `SELECT COUNT(*) AS n FROM ${this.t('ContentX')} AS X WHERE LOWER(LTRIM(RTRIM(X.GUID))) = @g AND X.ContentType = @type AND ${OPEN}`,
        );
      if (open.recordset[0]!.n === 0) {
        await tx.rollback();
        return { result: 'ended' as const };
      }
      await new sql.Request(tx)
        .input('lk', sql.NVarChar(255), `portal:auction:${i.guid}`)
        .query(
          `DECLARE @r int; EXEC @r = sp_getapplock @Resource = @lk, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000; IF @r < 0 THROW 50010, N'portal-api 應用鎖逾時', 1;`,
        );
      const max = await new sql.Request(tx)
        .input('g', sql.NVarChar(100), i.guid)
        .query<{ m: number | string | null }>(
          `SELECT MAX(${AMOUNT}) AS m FROM ${this.t('ContentXMessage')} AS M WHERE LOWER(LTRIM(RTRIM(M.GUID))) = @g AND M.IsActive = 1`,
        );
      const highest = max.recordset[0]!.m === null ? null : Number(max.recordset[0]!.m);
      if (highest !== null && i.amount < highest + i.step) {
        await tx.rollback();
        return { result: 'too-low' as const, highest };
      }
      await new sql.Request(tx)
        .input('g', sql.NVarChar(100), i.guid)
        .input('type', sql.NVarChar(20), AUCTION_TYPE)
        .input('emp', sql.NVarChar(20), i.empNo)
        .input('name', sql.NVarChar(20), i.name)
        .input('msg', sql.NVarChar(400), String(i.amount))
        .query(
          `INSERT INTO ${this.t('ContentXMessage')} (GUID, ContentType, LgNo, LgName, Message, UpDateTime, IsActive) VALUES (@g, @type, @emp, @name, @msg, GETDATE(), 1)`,
        );
      await tx.commit();
      return { result: 'ok' as const };
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }

  async deleteBid(guid: string, key: string): Promise<boolean> {
    const r = await this.pool
      .request()
      .input('g', sql.NVarChar(100), guid)
      .input('k', sql.VarChar(50), key)
      .input('type', sql.NVarChar(100), AUCTION_TYPE)
      .query(
        `UPDATE TOP (1) M SET IsActive = 0, DeleteDate = GETDATE() FROM ${this.t('ContentXMessage')} AS M
         WHERE LOWER(LTRIM(RTRIM(M.GUID))) = @g AND M.IsActive = 1 AND ${KEY} = @k AND ${this.isAuction}`,
      );
    return (r.rowsAffected[0] ?? 0) > 0;
  }
}
