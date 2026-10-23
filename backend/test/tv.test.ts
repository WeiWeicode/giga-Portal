/** docs/Gherkin/services/tv.feature(測試名稱 = 場景名稱) */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { TvService, type LegacyTvImage, type NewTvImage, type TvMessage, type TvRepo } from '../src/modules/services/tv.js';
import { testApp, type TestApp } from './helpers.js';

const UUID = '0bc59e51-9188-4e5d-87eb-6467d178efdd';

class MemoryTv implements TvRepo {
  msg: TvMessage | null = null;
  legacy: LegacyTvImage[] = [];
  uploaded: NewTvImage[] = [];
  async message() {
    return this.msg;
  }
  async setMessage(m: TvMessage) {
    this.msg = m;
  }
  async legacyImages() {
    return this.legacy;
  }
  async newImages() {
    return this.uploaded;
  }
  async addImage(fileId: string, fileName: string, sort: number) {
    const x = { id: this.uploaded.length + 1, fileId, fileName, sort, active: true };
    this.uploaded.push(x);
    return x;
  }
  async updateLegacy(path: string, index: number, active: boolean) {
    const rows = this.legacy.filter((l) => l.path === path);
    for (const r of rows) Object.assign(r, { index, active });
    return rows.length;
  }
  async updateNew(id: number, sort: number, active: boolean) {
    const r = this.uploaded.find((x) => x.id === id);
    if (!r) return false;
    Object.assign(r, { sort, active });
    return true;
  }
  async deleteNew(id: number) {
    const n = this.uploaded.length;
    this.uploaded = this.uploaded.filter((x) => x.id !== id);
    return n !== this.uploaded.length;
  }
}

describe('電視看板', () => {
  let t: TestApp;
  const repo = new MemoryTv();
  const call = async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) =>
    t.app.inject({ method, url, ...(payload ? { payload } : {}), headers: { 'x-internal-token': await t.token({ sub: '1', emp: 'S112009' }) } });

  before(async () => {
    t = await testApp({ services: { tv: new TvService(repo, 'http://10.10.130.166/PortalSolar') } });
  });
  after(() => t.close());
  beforeEach(() => {
    repo.msg = { message: '歡迎蒞臨碩禾', fontSize: 30 };
    repo.legacy = [
      { path: '丙棟 1.jpg', index: 2, active: true },
      { path: 'hidden.png', index: 1, active: false },
      { path: '../web.config', index: 0, active: true },
    ];
    repo.uploaded = [{ id: 1, fileId: UUID, fileName: 'new.png', sort: 1, active: true }];
  });

  it('看板不需登入', async () => {
    const r = await t.app.inject({ method: 'GET', url: '/v1/tv/board' });
    assert.equal(r.statusCode, 200);
    const j = r.json();
    assert.equal(j.message, '歡迎蒞臨碩禾');
    assert.equal(j.fontSize, 30);
    assert.deepEqual(
      j.images.map((i: { key: string }) => i.key),
      ['file:1', 'legacy:丙棟 1.jpg'],
      '依順序;隱藏與不合格檔名不列',
    );
    assert.equal(j.images[1].url, 'http://10.10.130.166/PortalSolar/Document/%E4%B8%99%E6%A3%9F%201.jpg');
  });

  it('設定頁需登入與權限', async () => {
    assert.equal((await t.app.inject({ method: 'GET', url: '/v1/services/tv' })).statusCode, 401);
    const j = (await call('GET', '/v1/services/tv')).json();
    assert.equal(j.legacy.length, 3);
    assert.equal(j.uploaded.length, 1);
  });

  it('更新跑馬燈', async () => {
    assert.equal((await call('PUT', '/v1/services/tv/message', { message: '<b>x</b>', fontSize: 20 })).statusCode, 400);
    assert.equal((await call('PUT', '/v1/services/tv/message', { message: 'ok', fontSize: 300 })).statusCode, 400);
    assert.equal((await call('PUT', '/v1/services/tv/message', { message: '  年終尾牙  ', fontSize: 40 })).statusCode, 204);
    assert.deepEqual(repo.msg, { message: '年終尾牙', fontSize: 40 });
  });

  it('新增圖片只收圖片', async () => {
    assert.equal((await call('POST', '/v1/services/tv/images', { fileId: UUID, fileName: 'a.exe' })).statusCode, 400);
    assert.equal((await call('POST', '/v1/services/tv/images', { fileId: 'x', fileName: 'a.png' })).statusCode, 400);
    const r = await call('POST', '/v1/services/tv/images', { fileId: UUID.toUpperCase(), fileName: 'b.webp' });
    assert.equal(r.statusCode, 201);
    assert.deepEqual([r.json().fileId, r.json().sort], [UUID, 3]);
  });

  it('調整順序與顯示', async () => {
    const r = await call('PUT', '/v1/services/tv/images', {
      items: [
        { source: 'legacy', path: 'hidden.png', sort: 0, active: true },
        { source: 'file', id: 1, sort: 9, active: false },
      ],
    });
    assert.equal(r.statusCode, 204);
    assert.deepEqual(repo.legacy[1], { path: 'hidden.png', index: 0, active: true });
    assert.equal(repo.uploaded[0]!.active, false);
    assert.equal((await call('PUT', '/v1/services/tv/images', { items: [{ source: 'file', sort: 1, active: true }] })).statusCode, 400);
    assert.equal((await call('PUT', '/v1/services/tv/images', { items: [{ source: 'legacy', path: 'none', sort: 1, active: true }] })).statusCode, 404);
    assert.equal((await call('DELETE', '/v1/services/tv/images/1')).statusCode, 204);
    assert.equal((await call('DELETE', '/v1/services/tv/images/1')).statusCode, 404);
  });
});
