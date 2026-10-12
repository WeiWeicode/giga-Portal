/** docs/Gherkin/personal/bpm.feature(測試名稱 = 場景名稱) */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { loadConfig } from '../src/config.js';
import { BpmService, TODO_LIMIT, type BpmRepo, type RequestedRow, type TodoRow } from '../src/modules/bpm/bpm.js';
import { DB_ENV, testApp, type TestApp } from './helpers.js';

const WEB = 'http://10.10.130.191:8080';
const todo = (over: Partial<TodoRow>): TodoRow => ({
  workItemOid: 'WI1',
  workItemName: '主管簽核',
  workItemState: 0,
  subject: '請假單',
  processName: '請假流程',
  serialNumber: 'LV0001',
  processOid: 'PI1',
  processState: 1,
  createdAt: '2026-10-12T01:00:00.000Z',
  ...over,
});

class MemoryBpmRepo implements BpmRepo {
  users = new Map([['S112009', { oid: 'U1', id: 'S112009' }]]);
  todoRows: TodoRow[] = [];
  requestedRows: RequestedRow[] = [];
  async user(empNo: string) {
    return this.users.get(empNo) ?? null;
  }
  async todos(userOid: string) {
    return userOid === 'U1' ? this.todoRows : [];
  }
  async requested(_u: string, offset: number, limit: number) {
    return { total: this.requestedRows.length, rows: this.requestedRows.slice(offset, offset + limit) };
  }
  async openActivities(oids: string[]) {
    return new Map(oids.map((o) => [o, ['經理核准']]));
  }
}

describe('BPM 簽核資訊', () => {
  let t: TestApp;
  let repo: MemoryBpmRepo;
  const get = async (url: string, emp = 'S112009') => t.app.inject({ url, headers: { 'x-internal-token': await t.token({ sub: emp, emp }) } });

  before(async () => {
    repo = new MemoryBpmRepo();
    t = await testApp({ bpm: new BpmService(repo, WEB) });
  });
  after(() => t.close());

  it('查看待簽核', async () => {
    repo.todoRows = [todo({}), todo({ workItemOid: 'WI2', workItemState: 1 }), todo({ workItemOid: 'WI3', workItemState: 3 })];
    const j = (await get('/v1/bpm/pending')).json();
    assert.equal(j.total, 2);
    assert.equal(j.items.length, 2);
    assert.equal(j.items[0].performUrl, `${WEB}/NaNaWeb/GP/PerformWorkFromMail?hdnMethod=performWorkFromMail&hdnUserId=S112009&hdnWorkItemOID=WI1`);
    assert.equal(
      j.items[0].traceUrl,
      `${WEB}/NaNaWeb/GP/WMS/TraceProcess/TraceProcessMain?hdnMethod=traceProcessFromMail&hdnCurrentUserId=S112009&hdnProcessInstOID=PI1`,
    );
    assert.equal(j.items[0].processState, '進行中');
  });

  it('異常關卡另外標示', async () => {
    repo.todoRows = [todo({}), todo({ workItemOid: 'WI9', workItemState: 97 })];
    const j = (await get('/v1/bpm/pending')).json();
    assert.equal(j.total, 1);
    assert.equal(j.abnormal, 1);
    const bad = j.items.find((i: { abnormal: boolean }) => i.abnormal);
    assert.equal(bad.performUrl, null);
    assert.ok(bad.traceUrl);
  });

  it('查看我申請的未結案', async () => {
    repo.requestedRows = Array.from({ length: 3 }, (_, i) => ({
      processOid: `P${i}`,
      contextOid: `C${i}`,
      serialNumber: `SN${i}`,
      processName: '採購單',
      subject: `主旨${i}`,
      processState: 1,
      createdAt: null,
    }));
    const j = (await get('/v1/bpm/requested?page=2&pageSize=2')).json();
    assert.equal(j.total, 3);
    assert.equal(j.items.length, 1);
    assert.equal(j.items[0].serialNumber, 'SN2');
    assert.deepEqual(j.items[0].currentActivities, ['經理核准']);
    assert.match(j.items[0].traceUrl, /hdnProcessInstOID=P2$/);
  });

  it('BPM 沒有帳號', async () => {
    const j = (await get('/v1/bpm/pending', 'A000001')).json();
    assert.deepEqual(j, { total: 0, abnormal: 0, hasAccount: false, truncated: false, items: [] });
    assert.equal((await get('/v1/bpm/requested', 'A000001')).json().hasAccount, false);
  });

  it('BPM 未設定', async () => {
    const none = await testApp();
    try {
      const r = await none.app.inject({ url: '/v1/bpm/pending', headers: { 'x-internal-token': await none.token() } });
      assert.equal(r.statusCode, 503);
      assert.equal(r.json().code, 'PORTAL_BPM_UNAVAILABLE');
    } finally {
      await none.close();
    }
  });

  it('深連結參數經 URL 編碼', () => {
    const s = new BpmService(repo, WEB);
    const u = new URL(s.performUrl('S1&x=1', 'A B#c')!);
    assert.equal(u.origin + u.pathname, `${WEB}/NaNaWeb/GP/PerformWorkFromMail`);
    assert.equal(u.searchParams.get('hdnUserId'), 'S1&x=1');
    assert.equal(u.searchParams.get('hdnWorkItemOID'), 'A B#c');
    assert.equal(s.traceUrl('S1', null), null);
  });

  it('待簽核超過上限時標示截斷', async () => {
    repo.todoRows = Array.from({ length: TODO_LIMIT + 1 }, (_, i) => todo({ workItemOid: `W${i}` }));
    const j = (await get('/v1/bpm/pending')).json();
    assert.equal(j.truncated, true);
    assert.equal(j.items.length, TODO_LIMIT);
  });

  it('BPM 設定檢查', () => {
    const base = { GW_ENV: 'dev', SERVICE_CODE: 'portal-api', ...DB_ENV };
    assert.equal(loadConfig({ ...base, BPM_DB_HOST: ' ' }).bpm, null);
    assert.throws(() => loadConfig({ ...base, BPM_DB_HOST: 'h', BPM_DB_USER: 'u', BPM_DB_PASSWORD: 'p' }), /BPM_WEB_URL/);
    for (const bad of ['http://h:8080/NaNaWeb', 'javascript:alert(1)', 'http://u:p@h:8080', 'ftp://h'])
      assert.throws(() => loadConfig({ ...base, BPM_DB_HOST: 'h', BPM_DB_USER: 'u', BPM_DB_PASSWORD: 'p', BPM_WEB_URL: bad }), /BPM_WEB_URL/, bad);
    const ok = loadConfig({ ...base, BPM_DB_HOST: '10.10.130.191', BPM_DB_USER: 'u', BPM_DB_PASSWORD: 'p', BPM_WEB_URL: 'http://10.10.130.191:8080/' });
    assert.equal(ok.bpm?.webUrl, 'http://10.10.130.191:8080');
    assert.equal(ok.bpm?.sql.database, 'NaNa');
  });
});
