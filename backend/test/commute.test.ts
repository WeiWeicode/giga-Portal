/** docs/Gherkin/personal/commute.feature(測試名稱 = 場景名稱) */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { CommuteService, type CommuteRecord, type CommuteRepo, type CommuteRow } from '../src/modules/commute/commute.js';
import { GeocodeError, GoogleGeocoder, type Geocoder, type GeoResult } from '../src/modules/geocode.js';
import { testApp, type TestApp } from './helpers.js';

/** 記憶體版 CpfExInfo:replace 時舊資料失效 */
class MemoryRepo implements CommuteRepo {
  rows: (CommuteRow & { active: boolean })[] = [];
  async current(empNo: string): Promise<CommuteRecord | null> {
    const r = [...this.rows].reverse().find((x) => x.userId === empNo && x.active);
    if (!r) return null;
    return { ...r, updatedAt: '2026-10-12T00:00:00.000Z', address: r.address } as unknown as CommuteRecord;
  }
  async replace(row: CommuteRow): Promise<void> {
    for (const r of this.rows) if (r.userId === row.userId) r.active = false;
    this.rows.push({ ...row, active: true });
  }
}

class FakeGeocoder implements Geocoder {
  result: GeoResult | null | 'error' = { lat: 24.8210925, lng: 121.0235172, formattedAddress: '302新竹縣竹北市光明六路' };
  async geocode(): Promise<GeoResult | null> {
    if (this.result === 'error') throw new GeocodeError('timeout');
    return this.result;
  }
}

const body = { address: '新竹縣竹北市光明六路 1 號', transport: '機車' };

describe('溫室氣體盤查員工通勤調查', () => {
  let t: TestApp;
  let repo: MemoryRepo;
  let geo: FakeGeocoder;
  const put = async (payload: object) =>
    t.app.inject({ method: 'PUT', url: '/v1/commute', payload, headers: { 'x-internal-token': await t.token(), 'content-type': 'application/json' } });

  before(async () => {
    repo = new MemoryRepo();
    geo = new FakeGeocoder();
    // 時間每次呼叫前進 1 分鐘,不觸發送出間隔限制(另有專門測試)
    let clock = 0;
    t = await testApp({ commute: new CommuteService(repo, geo, () => (clock += 60_000)) });
  });
  after(() => t.close());

  it('查看本人通勤調查', async () => {
    await repo.replace({
      userId: 'S112009',
      address: '舊地址',
      latitude: '1',
      longitude: '2',
      googleAddress: 'g',
      transport: '汽車',
      startStation: '',
      endStation: '',
      transport2: null,
      startStation2: null,
      endStation2: null,
      note: '',
    });
    await repo.replace({
      userId: 'A000001',
      address: '別人',
      latitude: '1',
      longitude: '2',
      googleAddress: 'g',
      transport: '汽車',
      startStation: '',
      endStation: '',
      transport2: null,
      startStation2: null,
      endStation2: null,
      note: '',
    });
    const res = await t.app.inject({ url: '/v1/commute', headers: { 'x-internal-token': await t.token() } });
    assert.equal(res.statusCode, 200);
    const j = res.json();
    assert.equal(j.record.address, '舊地址');
    assert.equal(j.canSubmit, true);
    assert.ok(j.transport.includes('捷運'));
    assert.deepEqual(j.publicTransport, ['火車', '高鐵', '公車', '捷運']);
  });

  it('送出通勤調查', async () => {
    const res = await put({ ...body, note: '備註' });
    assert.equal(res.statusCode, 200);
    const mine = repo.rows.filter((r) => r.userId === 'S112009');
    assert.equal(mine.filter((r) => r.active).length, 1);
    const last = mine.at(-1)!;
    assert.deepEqual([last.latitude, last.longitude, last.googleAddress, last.transport], ['24.8210925', '121.0235172', '302新竹縣竹北市光明六路', '機車']);
    assert.equal(res.json().address, '新竹縣竹北市光明六路 1 號');
    assert.equal(repo.rows.find((r) => r.userId === 'A000001')!.active, true, '不影響其他人');
  });

  it('大眾運輸要填起點與終點站', async () => {
    const r1 = await put({ ...body, transport: '捷運', startStation: '台北車站' });
    assert.equal(r1.statusCode, 400);
    assert.equal(r1.json().code, 'VALIDATION_FAILED');
    assert.equal(r1.json().details[0].message, '選取大眾交通工具,未填入起點/終點站');
    const r2 = await put({ ...body, transport2: '公車', endStation2: '竹北' });
    assert.equal(r2.statusCode, 400);
  });

  it('通勤方式要在選項內', async () => {
    assert.equal((await put({ ...body, transport: '飛機' })).statusCode, 400);
    assert.equal((await put({ ...body, transport2: '飛機' })).statusCode, 400);
  });

  it('地址解析不到不能送出', async () => {
    const before = repo.rows.length;
    geo.result = null;
    const res = await put({ ...body, address: '查無此地址' });
    geo.result = { lat: 1, lng: 2, formattedAddress: 'x' };
    assert.equal(res.statusCode, 422);
    assert.equal(res.json().code, 'PORTAL_ADDRESS_UNRESOLVED');
    assert.equal(repo.rows.length, before);
  });

  it('地址定位服務異常或未設定', async () => {
    geo.result = 'error';
    const res = await put({ ...body, address: '另一個地址' });
    geo.result = { lat: 1, lng: 2, formattedAddress: 'x' };
    assert.equal(res.statusCode, 502);
    assert.equal(res.json().code, 'PORTAL_GEOCODE_FAILED');

    const noKey = await testApp({ commute: new CommuteService(new MemoryRepo(), null) });
    try {
      const h = { 'x-internal-token': await noKey.token() };
      assert.equal((await noKey.app.inject({ url: '/v1/commute', headers: h })).json().canSubmit, false);
      const r = await noKey.app.inject({ method: 'PUT', url: '/v1/commute', payload: body, headers: h });
      assert.equal(r.statusCode, 503);
      assert.equal(r.json().code, 'PORTAL_GEOCODE_UNAVAILABLE');
    } finally {
      await noKey.close();
    }
  });

  it('沒有次要通勤方式時次要欄位寫入空值', async () => {
    await put({ ...body, startStation2: '不該寫入' });
    const last = repo.rows.at(-1)!;
    assert.deepEqual([last.transport2, last.startStation2, last.endStation2], [null, null, null]);
  });

  it('Google 回應解析(OK / ZERO_RESULTS / 其他狀態,錯誤不含金鑰)', async () => {
    const reply = (j: object) => (async () => new Response(JSON.stringify(j))) as unknown as typeof fetch;
    const ok = new GoogleGeocoder(
      'SECRET',
      1000,
      reply({ status: 'OK', results: [{ formatted_address: 'A', geometry: { location: { lat: 1.5, lng: 2.5 } } }] }),
    );
    assert.deepEqual(await ok.geocode('x'), { lat: 1.5, lng: 2.5, formattedAddress: 'A' });
    assert.equal(await new GoogleGeocoder('SECRET', 1000, reply({ status: 'ZERO_RESULTS', results: [] })).geocode('x'), null);
    await assert.rejects(new GoogleGeocoder('SECRET', 1000, reply({ status: 'REQUEST_DENIED' })).geocode('x'), (e: Error) => !e.message.includes('SECRET'));
  });

  it('重複送出的保護(間隔限制、地址未變沿用座標)', async () => {
    const r = new MemoryRepo();
    let calls = 0;
    const g: Geocoder = { geocode: async () => (calls++, { lat: 1, lng: 2, formattedAddress: 'g' }) };
    let now = 0;
    const s = new CommuteService(r, g, () => now);
    await s.submit('S1', body);
    now = 5_000;
    await assert.rejects(s.submit('S1', body), (e: { code?: string }) => e.code === 'PORTAL_TOO_MANY_REQUESTS');
    now = 20_000;
    await s.submit('S1', { ...body, transport: '汽車' });
    assert.equal(calls, 1, '地址相同不再呼叫 Google');
    now = 40_000;
    await s.submit('S1', { ...body, address: '新地址' });
    assert.equal(calls, 2);
  });
});
