/** docs/Gherkin/personal/bpm.feature、approval/approval.feature(測試名稱 = 場景名稱) */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { loadConfig } from '../src/config.js';
import { pickUser } from '../src/modules/bpm/nana-repo.js';
import { BpmService, TODO_LIMIT, type BpmRepo, type HandledRow, type RequestedRow, type RequestedState, type TodoRow } from '../src/modules/bpm/bpm.js';
import { DB_ENV, testApp, type TestApp } from './helpers.js';

const WEB = 'http://10.10.130.191:8080';
const COS = ['碩禾', '碩禾電子材料'];
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
  requesterId: 'S090005',
  requesterName: '申請人甲',
  submittedAt: '2026-10-11T01:00:00.000Z',
  ...over,
});
const handled = (i: number, over: Partial<HandledRow> = {}): HandledRow => ({
  workItemOid: `H${i}`,
  workItemName: '主管簽核',
  completedAt: '2026-10-12T02:00:00.000Z',
  contextOid: `C${i}`,
  processOid: `P${i}`,
  serialNumber: `SN${i}`,
  processName: '請購單',
  subject: `主旨${i}`,
  processState: 1,
  requesterId: 'S090005',
  requesterName: '申請人甲',
  submittedAt: '2026-10-11T01:00:00.000Z',
  ...over,
});

class MemoryBpmRepo implements BpmRepo {
  users = new Map([['S112009', { oid: 'U1', id: 'S112009' }]]);
  todoRows: TodoRow[] = [];
  requestedRows: RequestedRow[] = [];
  handledRows: HandledRow[] = [];
  /** 呼叫紀錄:非碩禾系不應查到 NaNa */
  calls: string[] = [];
  async user(empNo: string) {
    this.calls.push(`user:${empNo}`);
    return this.users.get(empNo) ?? null;
  }
  async todos(userOid: string) {
    return userOid === 'U1' ? this.todoRows : [];
  }
  async requested(_u: string, state: RequestedState, offset: number, limit: number) {
    const rows = state === 'open' ? this.requestedRows.filter((r) => r.processState === 1) : this.requestedRows;
    return { total: rows.length, rows: rows.slice(offset, offset + limit) };
  }
  async handled(_u: string, offset: number, limit: number) {
    return { total: this.handledRows.length, rows: this.handledRows.slice(offset, offset + limit) };
  }
  activityCalls: string[][] = [];
  async openActivities(oids: string[]) {
    this.activityCalls.push(oids);
    return new Map(oids.map((o) => [o, ['經理核准']]));
  }
}

describe('BPM 簽核資訊', () => {
  let t: TestApp;
  let repo: MemoryBpmRepo;
  const get = async (url: string, emp = 'S112009', cos: string[] = ['碩禾']) =>
    t.app.inject({ url, headers: { 'x-internal-token': await t.token({ sub: emp, emp, cos }) } });

  before(async () => {
    repo = new MemoryBpmRepo();
    t = await testApp({ bpm: new BpmService(repo, WEB, COS) });
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
    assert.equal(j.applicable, true);
    assert.deepEqual([j.items[0].requesterId, j.items[0].requesterName, j.items[0].submittedAt], ['S090005', '申請人甲', '2026-10-11T01:00:00.000Z']);
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
    assert.equal(j.state, 'open');
    assert.deepEqual(j.items[0].currentActivities, ['經理核准']);
    assert.match(j.items[0].traceUrl, /hdnProcessInstOID=P2$/);
  });

  it('BPM 沒有帳號', async () => {
    const j = (await get('/v1/bpm/pending', 'A000001')).json();
    assert.deepEqual(j, { applicable: true, total: 0, abnormal: 0, hasAccount: false, truncated: false, items: [] });
    assert.equal((await get('/v1/bpm/requested', 'A000001')).json().hasAccount, false);
  });

  it('我送出的可列全部狀態', async () => {
    repo.requestedRows = [1, 3, 4].map((ps, i) => ({
      processOid: `P${i}`,
      contextOid: `C${i}`,
      serialNumber: `SN${i}`,
      processName: '採購單',
      subject: null,
      processState: ps,
      createdAt: null,
    }));
    assert.equal((await get('/v1/bpm/requested')).json().total, 1, '預設只列未結案');
    const j = (await get('/v1/bpm/requested?state=all')).json();
    assert.equal(j.state, 'all');
    assert.deepEqual(
      j.items.map((i: { processState: string }) => i.processState),
      ['進行中', '已結案', '已撤銷'],
    );
    assert.equal((await get('/v1/bpm/requested?state=closed')).statusCode, 400, 'state 只接受 open / all');
  });

  it('查看已簽核', async () => {
    repo.handledRows = [handled(1), handled(2, { processState: 3, contextOid: 'C2' }), handled(3)];
    repo.activityCalls = [];
    const j = (await get('/v1/bpm/handled?pageSize=2')).json();
    assert.deepEqual([j.applicable, j.hasAccount, j.total, j.page, j.pageSize, j.items.length], [true, true, 3, 1, 2, 2]);
    assert.equal(j.items[0].workItemName, '主管簽核');
    assert.equal(j.items[0].requesterName, '申請人甲');
    assert.deepEqual(j.items[0].currentActivities, ['經理核准']);
    assert.deepEqual(j.items[1].currentActivities, [], '已結案的流程沒有目前關卡');
    assert.deepEqual(repo.activityCalls.at(-1), ['C1'], '只查進行中流程的目前關卡');
    assert.match(j.items[0].traceUrl, /hdnProcessInstOID=P1$/);
    assert.equal(j.items[0].performUrl, undefined, '已簽核沒有簽核連結');
    assert.equal((await get('/v1/bpm/handled?pageSize=101')).statusCode, 400);
    assert.equal((await get('/v1/bpm/handled?page=10001')).statusCode, 400, 'page 有上限(offset 不超出 int)');
  });

  it('非碩禾系公司不查 BPM', async () => {
    repo.todoRows = [todo({})];
    repo.calls = [];
    for (const url of ['/v1/bpm/pending', '/v1/bpm/requested', '/v1/bpm/handled']) {
      const r = await get(url, 'S112009', ['禾迅']);
      assert.equal(r.statusCode, 200, url);
      const j = r.json();
      assert.equal(j.applicable, false, url);
      assert.equal(j.total, 0, url);
      assert.deepEqual(j.items, [], url);
    }
    assert.equal((await get('/v1/bpm/pending', 'S112009', [])).json().applicable, false, 'Token 沒有公司');
    assert.deepEqual(repo.calls, [], '不連 NaNa');
    const none = new BpmService(repo, WEB, []);
    assert.equal(none.applies(['碩禾']), false, '未設定 BPM_COMPANIES 時任何人都不查');
    assert.equal((await get('/v1/bpm/pending', 'S112009', ['禾迅', '碩禾電子材料'])).json().applicable, true, '任一家屬碩禾系即適用');
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
    const s = new BpmService(repo, WEB, COS);
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

  it('同工號多帳號時只認唯一在職的一個', () => {
    const u = (oid: string, active: boolean) => ({ oid, id: 'S1', active });
    assert.deepEqual(pickUser([u('A', false)]), { oid: 'A', id: 'S1' });
    assert.deepEqual(pickUser([u('A', false), u('B', true)]), { oid: 'B', id: 'S1' });
    assert.equal(pickUser([u('A', true), u('B', true)]), null);
    assert.equal(pickUser([u('A', false), u('B', false)]), null);
    assert.equal(pickUser([]), null);
  });
});
