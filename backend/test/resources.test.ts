/** docs/Gherkin/resources/directory.feature、jobs.feature(測試名稱 = 場景名稱) */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { parseTerms, type DirectoryEntry, type DirectoryRepo } from '../src/routes/directory.js';
import { hrRoutes } from '../src/routes/hr.js';
import { legacyDate, todayTw, type Job, type JobInput, type JobRepo } from '../src/routes/jobs.js';
import { testApp, type TestApp } from './helpers.js';

const person = (empNo: string, over: Partial<DirectoryEntry> = {}): DirectoryEntry => ({
  empNo,
  name: '王小明',
  englishName: 'Ming',
  dept: 'S1800',
  deptName: '資訊服務部',
  title: '工程師',
  phone: '2109',
  ...over,
});

class MemoryDirectory implements DirectoryRepo {
  rows = [person('S112009'), person('A001'), person('F12345'), person('S1'), person('S000002', { dept: 'S4100', phone: '1538' })];
  lastTerms: string[] = [];
  async search(terms: string[]) {
    this.lastTerms = terms;
    const text = (p: DirectoryEntry) => [p.dept, p.empNo, p.englishName, p.name, p.title, p.phone].join(',');
    return this.rows.filter((p) => terms.every((t) => text(p).includes(t)));
  }
  async updatePhone(empNo: string, phone: string) {
    const p = this.rows.find((r) => r.empNo === empNo);
    if (!p) return false;
    p.phone = phone;
    return true;
  }
}

class MemoryJobs implements JobRepo {
  rows: (Job & { no: number })[] = [];
  seq = 0;
  async list(all: boolean) {
    return all ? this.rows : this.rows.filter((r) => r.open);
  }
  async create(input: JobInput) {
    this.rows.push({ no: ++this.seq, title: input.title, content: input.content, postedAt: todayTw(), closeAt: legacyDate(input.closeAt), open: true });
    return this.seq;
  }
  async update(no: number, input: JobInput) {
    const r = this.rows.find((x) => x.no === no);
    if (!r) return false;
    Object.assign(r, { title: input.title, content: input.content, closeAt: legacyDate(input.closeAt) });
    return true;
  }
  async remove(no: number) {
    const i = this.rows.findIndex((x) => x.no === no);
    if (i < 0) return false;
    this.rows.splice(i, 1);
    return true;
  }
}

describe('分機表 / 內部職缺', () => {
  let t: TestApp;
  const dir = new MemoryDirectory();
  const jobs = new MemoryJobs();
  const call = async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object, emp = 'S112009') =>
    t.app.inject({ method, url, ...(payload ? { payload } : {}), headers: { 'x-internal-token': await t.token({ sub: emp, emp }) } });

  before(async () => {
    t = await testApp({ directory: dir, jobs });
  });
  after(() => t.close());

  it('以關鍵字查分機', async () => {
    const j = (await call('GET', `/v1/directory?q=${encodeURIComponent('S1800,2109')}`)).json();
    assert.deepEqual(
      j.items.map((p: DirectoryEntry) => p.empNo),
      ['S112009'],
    );
    assert.equal(j.truncated, false);
  });

  it('不列系統帳號', async () => {
    const j = (await call('GET', '/v1/directory?q=2109')).json();
    assert.deepEqual(
      j.items.map((p: DirectoryEntry) => p.empNo),
      ['S112009'],
    );
  });

  it('關鍵字最多兩個', async () => {
    assert.deepEqual(parseTerms(' a, b  c '), ['a', 'b']);
    await call('GET', '/v1/directory?q=a%20b%20c');
    assert.deepEqual(dir.lastTerms, ['a', 'b']);
    assert.equal((await call('GET', '/v1/directory?q=%20,%20')).statusCode, 400);
    assert.equal((await call('GET', '/v1/directory?q=a')).statusCode, 400, '至少 2 字');
  });

  it('更新本人分機', async () => {
    const r = await call('PUT', '/v1/directory/me/phone', { phone: ' 2110 ' });
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().phone, '2110');
    assert.equal(dir.rows.find((p) => p.empNo === 'S112009')!.phone, '2110');
  });

  it('分機格式驗證與本人不在分機表', async () => {
    assert.equal((await call('PUT', '/v1/directory/me/phone', { phone: 'abc' })).statusCode, 400);
    assert.equal((await call('PUT', '/v1/directory/me/phone', { phone: '1'.repeat(31) })).statusCode, 400);
    const r = await call('PUT', '/v1/directory/me/phone', { phone: '1234' }, 'X999999');
    assert.equal(r.statusCode, 404);
    assert.equal(r.json().code, 'PORTAL_DIRECTORY_NOT_FOUND');
  });

  it('查看開放中的職缺', async () => {
    jobs.rows = [
      { no: 1, title: '開放中', content: 'c', postedAt: '2026/10/01', closeAt: '2099/12/31', open: true },
      { no: 2, title: '已截止', content: 'c', postedAt: '2023/01/01', closeAt: '2023/06/30', open: false },
    ];
    jobs.seq = 2;
    assert.equal((await call('GET', '/v1/jobs')).json().items.length, 1);
    const all = (await call('GET', '/v1/jobs?all=true')).json().items;
    assert.deepEqual(
      all.map((j: Job) => j.open),
      [true, false],
    );
  });

  it('人資新增、修改、刪除職缺', async () => {
    const c = await call('POST', '/v1/jobs', { title: ' 製程工程師 ', content: '負責…', closeAt: '2026-12-31' });
    assert.equal(c.statusCode, 201);
    const no = c.json().no;
    const row = jobs.rows.find((r) => r.no === no)!;
    assert.deepEqual([row.title, row.closeAt, row.postedAt], ['製程工程師', '2026/12/31', todayTw()]);
    assert.match(todayTw(), /^\d{4}\/\d{2}\/\d{2}$/);
    assert.equal((await call('PUT', `/v1/jobs/${no}`, { title: '資深製程工程師', content: 'x', closeAt: '2027-01-31' })).statusCode, 204);
    assert.equal(jobs.rows.find((r) => r.no === no)!.closeAt, '2027/01/31');
    assert.equal((await call('DELETE', `/v1/jobs/${no}`)).statusCode, 204);
    const nf = await call('DELETE', `/v1/jobs/${no}`);
    assert.equal(nf.statusCode, 404);
    assert.equal(nf.json().code, 'PORTAL_JOB_NOT_FOUND');
  });

  it('職缺欄位驗證', async () => {
    for (const bad of [
      { title: ' ', content: 'x', closeAt: '2026-12-31' },
      { title: 'x'.repeat(51), content: 'x', closeAt: '2026-12-31' },
      { title: 'x', content: 'x', closeAt: '2026/12/31' },
      { title: '<b>x</b>', content: 'x', closeAt: '2026-12-31' },
      { title: 'x', content: '<img src=x onerror=alert(1)>', closeAt: '2026-12-31' },
    ])
      assert.equal((await call('POST', '/v1/jobs', bad)).statusCode, 400, JSON.stringify(bad));
  });

  it('開啟主管職務代理人名單', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'portal-assets-'));
    mkdirSync(path.join(dir, 'hr'));
    writeFileSync(path.join(dir, 'hr', 'manager-agents.pdf'), '%PDF-1.5 test');
    const app2 = await testApp();
    try {
      await app2.app.register(hrRoutes(dir), { prefix: '/t' });
      const r = await app2.app.inject({ url: '/t/v1/hr/manager-agents', headers: { 'x-internal-token': await app2.token() } });
      assert.equal(r.statusCode, 200);
      assert.equal(r.headers['content-type'], 'application/pdf');
      assert.equal(r.headers['cache-control'], 'private, no-store');
      assert.equal(r.body, '%PDF-1.5 test');
      assert.equal((await app2.app.inject({ url: '/t/v1/hr/manager-agents' })).statusCode, 401, '未帶內部 Token');
    } finally {
      await app2.close();
    }
  });
});
