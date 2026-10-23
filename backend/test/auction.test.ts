/** docs/Gherkin/services/auction.feature(測試名稱 = 場景名稱) */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { AuctionService, buildBidWorkbook, highestOf, type AuctionItemRow, type AuctionRepo, type BidRow } from '../src/modules/services/auction.js';
import { testApp, type TestApp } from './helpers.js';

const NOW = Date.parse('2026-10-23T04:00:00Z');
const A = 'c4811f9a-9adc-4f8d-8bb4-eb06c53a398d';
const B = 'ba76b331-52a4-41d3-9831-154330f139f0';

class MemoryAuction implements AuctionRepo {
  rows: (AuctionItemRow & { down?: boolean })[] = [];
  bidRows: BidRow[] = [];
  private seq = 0;
  private open(guid: string, today: string) {
    const r = this.rows.find((x) => x.guid === guid);
    return !!r && !r.down && (!r.startDate || today >= r.startDate) && (!r.endDate || today <= r.endDate);
  }
  async items(today: string) {
    return this.rows.filter((r) => this.open(r.guid, today));
  }
  async bids(guids: string[]) {
    return this.bidRows.filter((b) => guids.includes(b.guid));
  }
  async placeBid(i: { guid: string; today: string; empNo: string; name: string; amount: number; step: number }) {
    if (!this.open(i.guid, i.today)) return { result: 'ended' as const };
    const highest = highestOf(this.bidRows.filter((b) => b.guid === i.guid));
    if (highest !== null && i.amount < highest + i.step) return { result: 'too-low' as const, highest };
    const s = String(++this.seq).padStart(3, '0');
    this.bidRows.unshift({
      guid: i.guid,
      key: `2026-10-23 12:00:00.${s}|${i.empNo}`,
      empNo: i.empNo,
      name: i.name,
      amount: i.amount,
      message: String(i.amount),
      time: '2026-10-23 12:00',
    });
    return { result: 'ok' as const };
  }
  async deleteBid(guid: string, key: string) {
    const n = this.bidRows.length;
    this.bidRows = this.bidRows.filter((b) => !(b.guid === guid && b.key === key));
    return n !== this.bidRows.length;
  }
}

describe('內部拍賣', () => {
  let t: TestApp;
  const repo = new MemoryAuction();
  const call = async (method: 'GET' | 'POST' | 'DELETE', url: string, payload?: object, emp = 'S112009') =>
    t.app.inject({
      method,
      url,
      ...(payload ? { payload } : {}),
      headers: { 'x-internal-token': await t.token({ sub: '1', emp, name: emp === 'S112009' ? '測試員' : '王小明' }) },
    });

  before(async () => {
    t = await testApp({ services: { auction: new AuctionService(repo), now: () => NOW } });
  });
  after(() => t.close());
  beforeEach(() => {
    repo.rows = [
      { guid: A, title: '公務車拍賣 起標1萬元', body: '<p>NISSAN</p><img src="x" onerror="alert(1)">', startDate: '2026/10/01', endDate: '2026/10/31' },
      { guid: B, title: '過期品', body: null, startDate: '2026/09/01', endDate: '2026/09/30' },
    ];
    repo.bidRows = [
      { guid: A, key: '2026-10-20 09:00:00.000|S100001', empNo: 'S100001', name: '王小明', amount: 10000, message: '10000', time: '2026-10-20 09:00' },
    ];
  });

  it('列出期間內的拍賣品', async () => {
    const j = (await call('GET', '/v1/services/auction')).json();
    assert.equal(j.items.length, 1);
    const it0 = j.items[0];
    assert.equal(it0.highest, 10000);
    assert.equal(it0.minBid, 11000);
    assert.doesNotMatch(it0.html, /onerror/);
    assert.deepEqual(it0.bids[0], { key: null, amount: 10000, time: '2026-10-20 09:00', mine: false, empNo: null, name: null });
  });

  it('出價至少比目前最高價高 1000', async () => {
    const low = await call('POST', `/v1/services/auction/${A}/bids`, { amount: 10500 });
    assert.equal(low.statusCode, 409);
    assert.equal(low.json().code, 'PORTAL_AUCTION_BID_TOO_LOW');
    assert.equal(low.json().details.minBid, 11000);
    assert.equal((await call('POST', `/v1/services/auction/${A}/bids`, { amount: 11000 })).statusCode, 204);
    const mine = (await call('GET', '/v1/services/auction')).json().items[0].bids[0];
    assert.deepEqual([mine.mine, mine.empNo, mine.name, mine.amount], [true, 'S112009', '測試員', 11000]);
    assert.equal((await call('POST', `/v1/services/auction/${A}/bids`, { amount: 1.5 })).statusCode, 400);
  });

  it('同時出價不會低於規則', async () => {
    const [a, b] = await Promise.all([
      call('POST', `/v1/services/auction/${A}/bids`, { amount: 12000 }),
      call('POST', `/v1/services/auction/${A}/bids`, { amount: 12000 }, 'S100002'),
    ]);
    assert.deepEqual([a.statusCode, b.statusCode].sort(), [204, 409]);
  });

  it('過期的拍賣品不能出價', async () => {
    const r = await call('POST', `/v1/services/auction/${B}/bids`, { amount: 100 });
    assert.equal(r.statusCode, 410);
    assert.equal((await call('POST', `/v1/services/auction/not-a-guid/bids`, { amount: 100 })).statusCode, 404);
  });

  it('管理員刪除出價與匯出', async () => {
    const j = (await call('GET', '/v1/services/auction/admin')).json();
    const bid = j.items[0].bids[0];
    assert.deepEqual([bid.empNo, bid.name], ['S100001', '王小明']);
    assert.equal((await call('DELETE', `/v1/services/auction/${A}/bids?key=${encodeURIComponent('bad key')}`)).statusCode, 400);
    assert.equal((await call('DELETE', `/v1/services/auction/${A}/bids?key=${encodeURIComponent(bid.key)}`)).statusCode, 204);
    assert.equal((await call('GET', '/v1/services/auction')).json().items[0].highest, null);
    const x = await call('GET', `/v1/services/auction/${A}/export`);
    assert.equal(x.statusCode, 200);
    assert.match(String(x.headers['content-type']), /spreadsheetml/);
    const buf = await buildBidWorkbook([{ ...repo.rows[0]!, key: 'k', empNo: 'S1', name: 'n', amount: null, message: '=HYPERLINK("x")', time: null, guid: A }]);
    assert.ok(buf.length > 0);
  });
});
