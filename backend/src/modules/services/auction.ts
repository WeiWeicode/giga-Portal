/**
 * 內部拍賣(P7 臨時服務;FEATURE-PLAN §9;docs/Gherkin/services/auction.feature)。
 * 舊程式 GSMC_Auction.aspx(.cs):拍賣品 = PortalSolar ContentX(ContentType = 購物台,唯讀;維護仍在舊站公告編輯),
 * 出價 = ContentXMessage(Message = 金額字串)。
 *   - 期間:未下架(UpDown <> 'Down')且今天在 StartDate ~ EndDate(字串 yyyy/MM/dd,空白不限;同舊版以字串比較)
 *   - 出價 ≥ 該品項有效出價最高金額 + 1,000(舊版拿「全部品項最新一筆」比較);尚無出價時 ≥ 1;交易內鎖定該品項出價再寫入
 *   - 出價人工號 / 姓名只對本人與管理員(portal.api.svc.auction.admin,取代舊版寫死的 3 個工號)顯示
 *   - 刪除出價(IsActive = 0、DeleteDate)與匯出只限管理員(舊版刪除後端不檢查)
 */
import { AppError } from '../../errors.js';
import type { Employee } from '../../identity.js';
import { sanitizeQaHtml } from '../qa/html.js';
import { invalid, legacyDate, serviceEnded } from './common.js';

export const AUCTION_TYPE = '購物台';
export const AUCTION_STEP = 1000;
export const AUCTION_MAX = 100_000_000;

export interface AuctionItemRow {
  guid: string;
  title: string;
  body: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface BidRow {
  guid: string;
  /** CONVERT(varchar(23), UpDateTime, 121) + '|' + LgNo,刪除時用來定位(舊表沒有主鍵) */
  key: string;
  empNo: string;
  name: string | null;
  /** 解析不出數字的舊資料為 null */
  amount: number | null;
  message: string | null;
  time: string | null;
}

export interface AuctionRepo {
  /** 期間內、未下架的拍賣品;today = yyyy/MM/dd */
  items(today: string): Promise<AuctionItemRow[]>;
  /** 有效出價(IsActive = 1),新到舊 */
  bids(guids: string[]): Promise<BidRow[]>;
  /** 交易內:確認品項仍開放、鎖定出價取最高價後寫入 */
  placeBid(input: {
    guid: string;
    today: string;
    empNo: string;
    name: string;
    amount: number;
    step: number;
  }): Promise<{ result: 'ok' | 'ended' } | { result: 'too-low'; highest: number }>;
  deleteBid(guid: string, key: string): Promise<boolean>;
}

export interface BidView {
  key: string | null;
  amount: number | null;
  time: string | null;
  mine: boolean;
  /** 只有本人與管理員看得到 */
  empNo: string | null;
  name: string | null;
}

export interface AuctionItem {
  id: string;
  title: string;
  html: string;
  startDate: string | null;
  endDate: string | null;
  highest: number | null;
  minBid: number;
  bidCount: number;
  bids: BidView[];
}

/** 今天(YYYY-MM-DD)→ 舊表日期字串格式 yyyy/MM/dd */
export const legacyToday = (today: string) => today.replaceAll('-', '/');
const KEY_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\|[A-Za-z0-9]{1,20}$/;
const GUID_RE = /^[0-9a-f-]{36}$/i;

export function highestOf(bids: BidRow[]): number | null {
  const nums = bids.map((b) => b.amount).filter((n): n is number => n !== null);
  return nums.length ? Math.max(...nums) : null;
}

export class AuctionService {
  constructor(private readonly repo: AuctionRepo) {}

  async list(me: Employee, today: string, admin: boolean): Promise<AuctionItem[]> {
    const items = await this.repo.items(legacyToday(today));
    const bids = items.length ? await this.repo.bids(items.map((i) => i.guid)) : [];
    const empNo = me.empNo.toUpperCase();
    return items.map((i) => {
      const own = bids.filter((b) => b.guid === i.guid);
      const highest = highestOf(own);
      return {
        id: i.guid,
        title: i.title,
        html: sanitizeQaHtml(i.body),
        startDate: legacyDate(i.startDate),
        endDate: legacyDate(i.endDate),
        highest,
        minBid: highest === null ? 1 : highest + AUCTION_STEP,
        bidCount: own.length,
        bids: own.map((b) => {
          const mine = b.empNo === empNo;
          const show = mine || admin;
          return { key: admin ? b.key : null, amount: b.amount, time: b.time, mine, empNo: show ? b.empNo : null, name: show ? b.name : null };
        }),
      };
    });
  }

  async bid(me: Employee, guid: string, amount: number, today: string): Promise<void> {
    if (!GUID_RE.test(guid)) throw new AppError(404, 'PORTAL_AUCTION_NOT_FOUND', '找不到此拍賣品');
    if (!Number.isInteger(amount) || amount < 1 || amount > AUCTION_MAX) throw invalid('amount', '出價金額有誤,請填入正整數');
    const r = await this.repo.placeBid({
      guid: guid.toLowerCase(),
      today: legacyToday(today),
      empNo: me.empNo.toUpperCase(),
      name: (me.name ?? me.empNo).slice(0, 20),
      amount,
      step: AUCTION_STEP,
    });
    if (r.result === 'ended') throw serviceEnded('拍賣已結束');
    if (r.result === 'too-low')
      throw new AppError(
        409,
        'PORTAL_AUCTION_BID_TOO_LOW',
        `您的出價比目前最高價 ${r.highest.toLocaleString('en-US')} + ${AUCTION_STEP.toLocaleString('en-US')} 低(競標出價至少 ${AUCTION_STEP} 起跳)`,
        {
          highest: r.highest,
          minBid: r.highest + AUCTION_STEP,
        },
      );
  }

  async deleteBid(guid: string, key: string): Promise<void> {
    if (!GUID_RE.test(guid) || !KEY_RE.test(key)) throw invalid('key', '出價識別碼格式錯誤');
    if (!(await this.repo.deleteBid(guid.toLowerCase(), key))) throw new AppError(404, 'PORTAL_AUCTION_BID_NOT_FOUND', '找不到此出價');
  }

  /** 匯出:該品項全部有效出價(舊到新;上傳日期、工號、姓名、出價) */
  async exportRows(guid: string): Promise<BidRow[]> {
    if (!GUID_RE.test(guid)) throw new AppError(404, 'PORTAL_AUCTION_NOT_FOUND', '找不到此拍賣品');
    return (await this.repo.bids([guid.toLowerCase()])).reverse();
  }
}

/** 匯出 xlsx(同舊版欄位:上傳日期、工號、姓名、留言內容 = 出價);ExcelJS 以字串儲存格寫入,不會被當成公式 */
export async function buildBidWorkbook(rows: readonly BidRow[]): Promise<Buffer> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GigaNexus portal-api';
  const ws = wb.addWorksheet('清單');
  ws.columns = [
    { header: '上傳日期', key: 'time', width: 20 },
    { header: '工號', key: 'empNo', width: 12 },
    { header: '姓名', key: 'name', width: 12 },
    { header: '出價', key: 'message', width: 16 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow({ time: r.time ?? '', empNo: r.empNo, name: r.name ?? '', message: r.message ?? '' });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}
