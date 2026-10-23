/** docs/Gherkin/services/stock.feature(測試名稱 = 場景名稱) */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { StockService, type StockLog, type StockRepo, type StockRow } from '../src/modules/services/stock.js';
import { testApp, type TestApp } from './helpers.js';

const NOW = Date.parse('2026-10-23T04:00:00Z');

class MemoryStock implements StockRepo {
  rowsData: StockRow[] = [];
  logData: (StockLog & { emp: string; userName: string })[] = [];
  async rows(e: string) {
    return this.rowsData.filter((r) => r.userId === e);
  }
  async logs(e: string) {
    return this.logData.filter((l) => l.emp === e);
  }
  async decide(i: { annual: number; empNo: string; userName: string; backStockNo: number; doBack: 'Y' | 'N'; bankAccount: string | null }) {
    if (this.logData.some((l) => l.emp === i.empNo && l.annual === i.annual)) return false;
    this.logData.push({
      emp: i.empNo,
      userName: i.userName,
      annual: i.annual,
      doBack: i.doBack,
      backStockNo: i.backStockNo,
      confirmTime: '2026-10-23 12:00:00',
      bankAccount: i.bankAccount,
    });
    return true;
  }
}

const row = (over: Partial<StockRow> = {}): StockRow => ({
  annual: 2026,
  userId: 'S112009',
  userName: '測試員',
  stockType: '自提',
  backStockNo: 120,
  totalStockNo: 600,
  joinDate: '2021年9月',
  backDate: '2024年11月',
  canBack: true,
  ...over,
});

describe('員工持股領回', () => {
  let t: TestApp;
  const repo = new MemoryStock();
  const call = async (method: 'GET' | 'POST', url: string, payload?: object, emp = 'S112009') =>
    t.app.inject({ method, url, ...(payload ? { payload } : {}), headers: { 'x-internal-token': await t.token({ sub: '1', emp, name: '測試員' }) } });

  before(async () => {
    t = await testApp({ services: { stock: new StockService(repo), now: () => NOW } });
  });
  after(() => t.close());
  beforeEach(() => {
    repo.rowsData = [row(), row({ stockType: '公提', canBack: false, backStockNo: null }), row({ annual: 2025 }), row({ userId: 'S100001' })];
    repo.logData = [
      { emp: 'S112009', userName: 'S112009', annual: 2025, doBack: 'Y', backStockNo: 100, confirmTime: '2025-11-01 10:00:00', bankAccount: '98765432109' },
    ];
  });

  it('只列本人資料', async () => {
    const j = (await call('GET', '/v1/services/stock')).json();
    assert.equal(j.year, 2026);
    assert.equal(j.open, true);
    assert.equal(j.current.length, 2);
    assert.equal(j.canDecide, true);
    assert.equal(j.history.length, 3);
    assert.equal(j.history.find((h: { annual: number }) => h.annual === 2025).decision.accountLast4, '2109');
    assert.doesNotMatch(JSON.stringify(j), /98765432109|S100001/);
  });

  it('可領回才可送出', async () => {
    repo.rowsData = [row({ canBack: false })];
    const r = await call('POST', '/v1/services/stock/decision', { doBack: false });
    assert.equal(r.statusCode, 409);
    assert.equal(r.json().code, 'PORTAL_STOCK_NOT_ELIGIBLE');
  });

  it('領回需 11 碼集保帳號', async () => {
    assert.equal((await call('POST', '/v1/services/stock/decision', { doBack: true, account: '123' })).statusCode, 400);
    assert.equal((await call('POST', '/v1/services/stock/decision', { doBack: true })).statusCode, 400);
    const r = await call('POST', '/v1/services/stock/decision', { doBack: true, account: '1234-5678-901' });
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().decision.accountLast4, '8901');
    const log = repo.logData.find((l) => l.annual === 2026)!;
    assert.deepEqual([log.userName, log.doBack, log.backStockNo, log.bankAccount], ['S112009', 'Y', 120, '12345678901']);
  });

  it('每年度一筆', async () => {
    const [a, b] = await Promise.all([
      call('POST', '/v1/services/stock/decision', { doBack: false }),
      call('POST', '/v1/services/stock/decision', { doBack: false }),
    ]);
    assert.deepEqual([a.statusCode, b.statusCode].sort(), [200, 409]);
    const log = repo.logData.filter((l) => l.annual === 2026);
    assert.equal(log.length, 1);
    assert.deepEqual([log[0]!.doBack, log[0]!.backStockNo, log[0]!.bankAccount], ['N', 0, null]);
  });

  it('當年度沒有資料顯示服務已結束', async () => {
    repo.rowsData = [row({ annual: 2025 })];
    assert.equal((await call('GET', '/v1/services/stock')).json().open, false);
    const r = await call('POST', '/v1/services/stock/decision', { doBack: false });
    assert.equal(r.statusCode, 410);
  });

  it('設定為姓名時 UserName 寫姓名(Q-F11)', async () => {
    const s = new StockService(repo, 'name');
    await s.decide({ empNo: 'S112009', name: null, dept: null, companies: [] }, 2026, { doBack: false });
    assert.equal(repo.logData.find((l) => l.annual === 2026)!.userName, '測試員');
  });
});
