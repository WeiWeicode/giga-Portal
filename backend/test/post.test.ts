/** docs/Gherkin/services/post.feature(測試名稱 = 場景名稱) */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { PostService, type PostInput, type PostItem, type PostRepo, type PostWriteResult, type Sender } from '../src/modules/services/post.js';
import { testApp, type TestApp } from './helpers.js';

const NOW = Date.parse('2026-10-23T04:00:00Z');

class MemoryPost implements PostRepo {
  items: (PostItem & { active: boolean })[] = [];
  staff: Sender[] = [
    { empNo: 'S112009', name: '測試員', dept: 'S1800' },
    { empNo: 'S112010', name: '王小明', dept: 'S1800' },
  ];
  lastQuery: [string, string] | null = null;
  async list(e: string, from: string, to: string) {
    this.lastQuery = [from, to];
    return this.items.filter((i) => i.active && i.senderId === e && i.sendDate! >= from && i.sendDate! <= to);
  }
  async activeEmployee(e: string) {
    return this.staff.find((s) => s.empNo === e) ?? null;
  }
  async searchEmployees(q: string) {
    return this.staff.filter((s) => s.empNo.startsWith(q.toUpperCase()) || s.name.includes(q));
  }
  async create(i: PostInput & { senderName: string }) {
    const sn = this.items.length + 1;
    this.items.push({ sn, ...i, callMailNo: null, mailMoney: null, mailReturnMoney: null, locked: false, active: true });
    return sn;
  }
  private guard(sn: number, owner: string): PostWriteResult | PostItem {
    const it = this.items.find((x) => x.sn === sn && x.active);
    if (!it) return 'not-found';
    if (it.senderId !== owner) return 'forbidden';
    if (it.mailMoney) return 'locked';
    return it;
  }
  async update(sn: number, owner: string, i: PostInput & { senderName: string }) {
    const g = this.guard(sn, owner);
    if (typeof g === 'string') return g;
    Object.assign(g, i);
    return 'ok' as const;
  }
  async void(sn: number, owner: string) {
    const g = this.guard(sn, owner);
    if (typeof g === 'string') return g;
    (g as PostItem & { active: boolean }).active = false;
    return 'ok' as const;
  }
}

describe('中華郵政寄件登記', () => {
  let t: TestApp;
  const repo = new MemoryPost();
  const body = (over: Partial<PostInput> = {}): PostInput => ({
    senderId: 's112009',
    dept: 's1800',
    receiver: '新竹縣政府',
    zip: '302',
    sendDate: '2026-10-23',
    mailType: '掛號',
    ...over,
  });
  const call = async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object, emp = 'S112009') =>
    t.app.inject({ method, url, ...(payload ? { payload } : {}), headers: { 'x-internal-token': await t.token({ sub: '1', emp }) } });

  before(async () => {
    t = await testApp({ services: { post: new PostService(repo), now: () => NOW } });
  });
  after(() => t.close());
  beforeEach(() => {
    repo.items = [];
  });

  it('本人清單', async () => {
    await call('POST', '/v1/services/post', body());
    await call('POST', '/v1/services/post', body({ senderId: 'S112010' }));
    const j = (await call('GET', '/v1/services/post')).json();
    assert.deepEqual(repo.lastQuery, ['2026-09-23', '2026-10-23']);
    assert.equal(j.items.length, 1);
    assert.equal(j.items[0].senderName, '測試員');
    assert.ok(j.mailTypes.includes('雙掛號'));
    assert.equal((await call('GET', '/v1/services/post?from=2026-10-30&to=2026-10-01')).statusCode, 400);
  });

  it('寄件人以工號精確選擇', async () => {
    assert.equal((await call('POST', '/v1/services/post', body({ senderId: 'S1120' }))).statusCode, 400);
    assert.equal((await call('POST', '/v1/services/post', body({ receiver: '<script>' }))).statusCode, 400);
    assert.equal((await call('POST', '/v1/services/post', body({ mailType: '包裹' }))).statusCode, 400);
    assert.equal((await call('POST', '/v1/services/post', body({ sendDate: '2026-02-30' }))).statusCode, 400);
    const r = await call('POST', '/v1/services/post', body());
    assert.equal(r.statusCode, 201);
    assert.deepEqual([repo.items[0]!.senderId, repo.items[0]!.senderName, repo.items[0]!.dept], ['S112009', '測試員', 'S1800']);
    const s = (await call('GET', '/v1/services/post/senders?q=王')).json();
    assert.deepEqual(s.items, [{ empNo: 'S112010', name: '王小明', dept: 'S1800' }]);
  });

  it('只能修改或作廢自己的', async () => {
    await call('POST', '/v1/services/post', body({ senderId: 'S112010' }));
    assert.equal((await call('PUT', '/v1/services/post/1', body())).statusCode, 403);
    assert.equal((await call('PUT', '/v1/services/post/1', body({ senderId: 'S112009' }), 'S112010')).statusCode, 400, '修改不可變更寄件人');
    assert.equal((await call('DELETE', '/v1/services/post/1')).statusCode, 403);
    assert.equal((await call('DELETE', '/v1/services/post/1', undefined, 'S112010')).statusCode, 204);
    assert.equal((await call('DELETE', '/v1/services/post/1', undefined, 'S112010')).statusCode, 404);
  });

  it('有郵資後不可改或作廢', async () => {
    await call('POST', '/v1/services/post', body());
    repo.items[0]!.mailMoney = '35';
    const r = await call('PUT', '/v1/services/post/1', body({ receiver: '改' }));
    assert.equal(r.statusCode, 409);
    assert.equal(r.json().code, 'PORTAL_POST_LOCKED');
    assert.equal((await call('DELETE', '/v1/services/post/1')).statusCode, 409);
    repo.items[0]!.mailMoney = null;
    assert.equal((await call('PUT', '/v1/services/post/1', body({ receiver: '改' }))).statusCode, 204);
    assert.equal(repo.items[0]!.receiver, '改');
  });
});
