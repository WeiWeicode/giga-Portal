/** docs/Gherkin/services/consent.feature(測試名稱 = 場景名稱) */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { DashboardService } from '../src/modules/home/dashboard.js';
import {
  ConsentService,
  renderConsentBody,
  xTargeted,
  type ConsentDefRow,
  type ConsentEmployee,
  type ConsentRepo,
  type SignResult,
  type XConsentRow,
} from '../src/modules/services/consent.js';
import { testApp, type TestApp } from './helpers.js';

const GUID = '953c6656-e759-46ef-9c3f-bedbb04b21a0';
const SIGN = '0bc59e51-9188-4e5d-87eb-6467d178efdd';
// 2026-10-23 12:00(台灣)
const NOW = Date.parse('2026-10-23T04:00:00Z');

class MemoryConsents implements ConsentRepo {
  xs: XConsentRow[] = [];
  defRows: ConsentDefRow[] = [];
  xb: { guid: string; emp: string }[] = [];
  bInfo: { id: number; emp: string; data: string | null }[] = [];
  cInfo: { id: number; emp: string }[] = [];
  signs: { ref: string; emp: string; file: string }[] = [];
  emp: ConsentEmployee | null = { empNo: 'S112009', name: '測試員', compFullName: '禾迅科技股份有限公司', nationalId: 'A123456789', birthDate: '1990-01-02' };
  async xConsents() {
    return this.xs.map((x) => ({ ...x, body: null }));
  }
  async xConsent(g: string) {
    return this.xs.find((x) => x.guid === g) ?? null;
  }
  async xSigned(e: string) {
    return new Map(this.xb.filter((x) => x.emp === e).map((x) => [x.guid, '2026-10-01']));
  }
  async defs() {
    return this.defRows;
  }
  async assigned(e: string) {
    return this.cInfo.filter((c) => c.emp === e).map((c) => c.id);
  }
  async bSigned(e: string) {
    return new Map(this.bInfo.filter((x) => x.emp === e).map((x) => [x.id, '2026-10-01']));
  }
  async employee() {
    return this.emp;
  }
  async signX(g: string, e: string, f: string | null): Promise<SignResult> {
    if (this.xb.some((x) => x.guid === g && x.emp === e)) return { ok: false };
    this.xb.push({ guid: g, emp: e });
    if (f) this.signs.push({ ref: g, emp: e, file: f });
    return { ok: true, signedAt: '2026-10-23' };
  }
  async signB(id: number, e: string, data: string | null, f: string | null): Promise<SignResult> {
    if (this.bInfo.some((x) => x.id === id && x.emp === e)) return { ok: false };
    this.bInfo.push({ id, emp: e, data });
    if (f) this.signs.push({ ref: String(id), emp: e, file: f });
    return { ok: true, signedAt: '2026-10-23' };
  }
}

const xRow = (over: Partial<XConsentRow> = {}): XConsentRow => ({
  guid: GUID,
  title: '國碩集團聯合職工福利委員會同意書',
  body: '<p>本人 UserName(UserID)任職於 CompFullName</p><script>alert(1)</script>',
  startDate: '2026/10/01',
  endDate: '2026/12/31',
  kdept: 'all',
  kpep: null,
  ...over,
});

describe('同意書', () => {
  let t: TestApp;
  const repo = new MemoryConsents();
  const service = new ConsentService(repo);
  const call = async (method: 'GET' | 'POST', url: string, payload?: object, claims: Record<string, unknown> = {}) =>
    t.app.inject({
      method,
      url,
      ...(payload ? { payload } : {}),
      headers: { 'x-internal-token': await t.token({ sub: '1', emp: 'S112009', name: '測試員', dept: 'S1800', ...claims }) },
    });

  before(async () => {
    t = await testApp({ services: { consent: service, now: () => NOW } });
  });
  after(() => t.close());
  beforeEach(() => {
    repo.xs = [xRow()];
    repo.defRows = [
      {
        consentId: 20260814,
        kind: 'account-survey',
        title: '2026年禾迅現金增資集保帳號調查',
        startDate: '2026-08-14',
        endDate: null,
        requireSign: false,
        active: true,
      },
    ];
    repo.xb = [];
    repo.bInfo = [];
    repo.cInfo = [{ id: 20260814, emp: 'S112009' }];
    repo.signs = [];
  });

  it('依 GUID 開啟通用同意書', async () => {
    const r = await call('GET', `/v1/services/consents/${GUID.toUpperCase()}`);
    assert.equal(r.statusCode, 200);
    const j = r.json();
    assert.equal(j.state, 'open');
    assert.equal(j.requireSign, true);
    assert.equal(j.agreeText, '我已閱讀完畢，充分了解並同意簽名。');
    assert.match(j.html, /本人 測試員\(S112009\)任職於 禾迅科技股份有限公司/);
    assert.doesNotMatch(j.html, /script/);
  });

  it('對象以部門完整比對', async () => {
    repo.xs = [xRow({ kdept: 'S1800,S1900', kpep: 'S094009' })];
    assert.equal((await call('GET', `/v1/services/consents/${GUID}`, undefined, { dept: 'S1810' })).statusCode, 403);
    assert.equal((await call('GET', `/v1/services/consents/${GUID}`, undefined, { dept: 'S1800' })).json().state, 'open');
    // 工號以清單精確比對(不因為子字串相符)
    assert.equal(xTargeted({ kdept: '', kpep: 'S1120091,S094009' }, 'S112009', null), false);
    assert.equal(xTargeted({ kdept: '', kpep: 'S094009, s112009' }, 'S112009', null), true);
  });

  it('過期的同意書顯示服務已結束', async () => {
    repo.xs = [xRow({ endDate: '2026/10/22' })];
    assert.equal((await call('GET', `/v1/services/consents/${GUID}`)).json().state, 'ended');
    const r = await call('POST', `/v1/services/consents/${GUID}/sign`, { agree: true, signatureFileId: SIGN });
    assert.equal(r.statusCode, 410);
    assert.equal(r.json().code, 'PORTAL_SERVICE_ENDED');
    repo.xs = [xRow({ startDate: '2026/11/01' })];
    const ns = (await call('GET', `/v1/services/consents/${GUID}`)).json();
    assert.deepEqual([ns.state, ns.html], ['not-started', null], '尚未開放不回內文');
    assert.equal(repo.xb.length, 0);
  });

  it('勾選與簽名驗證完才寫入', async () => {
    assert.equal((await call('POST', `/v1/services/consents/${GUID}/sign`, { agree: false, signatureFileId: SIGN })).statusCode, 400);
    assert.equal((await call('POST', `/v1/services/consents/${GUID}/sign`, { agree: true })).statusCode, 400);
    assert.equal((await call('POST', `/v1/services/consents/${GUID}/sign`, { agree: true, signatureFileId: '../x' })).statusCode, 400);
    assert.equal(repo.xb.length, 0);
    const r = await call('POST', `/v1/services/consents/${GUID}/sign`, { agree: true, signatureFileId: SIGN.toUpperCase() });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(repo.xb, [{ guid: GUID, emp: 'S112009' }]);
    assert.deepEqual(repo.signs, [{ ref: GUID, emp: 'S112009', file: SIGN }]);
    assert.equal((await call('GET', `/v1/services/consents/${GUID}`)).json().state, 'signed');
  });

  it('後端擋重簽', async () => {
    const body = { agree: true, signatureFileId: SIGN };
    const [a, b] = await Promise.all([call('POST', `/v1/services/consents/${GUID}/sign`, body), call('POST', `/v1/services/consents/${GUID}/sign`, body)]);
    assert.deepEqual([a.statusCode, b.statusCode].sort(), [200, 409]);
    assert.equal(repo.xb.length, 1);
  });

  it('指派名單的集保帳號調查', async () => {
    const d = (await call('GET', '/v1/services/consents/20260814')).json();
    assert.equal(d.kind, 'account-survey');
    assert.equal(d.requireSign, false);
    assert.deepEqual(d.profile, { empNo: 'S112009', name: '測試員', nationalIdLast4: '6789', birthDate: '1990-01-02' });
    assert.doesNotMatch(JSON.stringify(d), /A123456789/);
    const fields = { phone: '03-5970000', homeAddress: '新竹縣湖口鄉', mailAddress: '新竹縣湖口鄉', account: '1234-5678-901' };
    const bad = await call('POST', '/v1/services/consents/20260814/sign', { agree: true, fields: { ...fields, account: '1234567890' } });
    assert.equal(bad.statusCode, 400);
    const semi = await call('POST', '/v1/services/consents/20260814/sign', { agree: true, fields: { ...fields, phone: '03;1' } });
    assert.equal(semi.statusCode, 400);
    const r = await call('POST', '/v1/services/consents/20260814/sign', { agree: true, fields });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.json(), { signedAt: '2026-10-23', accountLast4: '8901' });
    assert.deepEqual(repo.bInfo, [{ id: 20260814, emp: 'S112009', data: '03-5970000;新竹縣湖口鄉;新竹縣湖口鄉;12345678901' }]);
    // 未被指派
    assert.equal((await call('GET', '/v1/services/consents/20260814', undefined, { emp: 'S100001' })).statusCode, 403);
    // 未登記型式 / 不存在
    assert.equal((await call('GET', '/v1/services/consents/8')).statusCode, 404);
    assert.equal((await call('GET', '/v1/services/consents/abc')).statusCode, 404);
  });

  it('首頁待辦列出待簽同意書', async () => {
    const list = (await call('GET', '/v1/services/consents')).json().items;
    assert.deepEqual(
      list.map((x: { id: string }) => x.id),
      [GUID, '20260814'],
    );
    const dash = new DashboardService({ consents: service, now: () => NOW });
    const out = await dash.build({ empNo: 'S112009', name: null, dept: 'S1800', companies: [] }, { error: () => undefined });
    assert.deepEqual(
      out.todos.items.map((x) => [x.kind, x.to]),
      [
        ['consent', `/services/consent/${GUID}`],
        ['consent', '/services/consent/20260814'],
      ],
    );
    assert.ok(!out._meta.unavailable.includes('todos.consent'));
  });

  it('內文代入的值先跳脫', () => {
    const html = renderConsentBody(
      '<p>UserName</p>',
      { empNo: 'S1', name: '<img src=x onerror=alert(1)>', compFullName: null, nationalId: null, birthDate: null },
      'S1',
    );
    assert.equal(html, '<p>&lt;img src=x onerror=alert(1)&gt;</p>');
  });

  it('系統身分不能使用', async () => {
    const r = await t.app.inject({
      method: 'GET',
      url: '/v1/services/consents',
      headers: { 'x-internal-token': await t.token({ sub: 'client:x', emp: 'client:x', amr: 'api_key' }) },
    });
    assert.equal(r.statusCode, 403);
  });
});
