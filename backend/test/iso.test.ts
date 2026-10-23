/** docs/Gherkin/services/iso.feature(測試名稱 = 場景名稱) */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { IsoService, type IsoDocVersion, type IsoSource } from '../src/modules/services/iso.js';
import { testApp, type TestApp } from './helpers.js';

const ver = (docNo: string, over: Partial<IsoDocVersion> = {}): IsoDocVersion => ({
  docNo,
  docName: `${docNo} 名稱`,
  displayVersion: '3',
  version: '30',
  clauseName: '品質管理',
  validFrom: '2025-01-01',
  validTo: null,
  levelId: '2',
  ...over,
});

const fake: IsoSource = {
  clauses: async () => ['品質管理', '環安衛'],
  byClause: async (c) => (c === '品質管理' ? [{ docNo: 'QM-01', docName: '品質手冊', levelId: '1' }] : []),
  search: async (q) => [{ docNo: 'QM-01', docName: `含${q}`, levelId: '1' }],
  current: async (d) => (d === 'QM-01' || d === 'GS4-4-01' ? ver(d) : null),
  latestAny: async (d) => ver(d, { displayVersion: '5', version: '50' }),
  file: async (d) => ({ physicalName: d === 'QM-02' ? '../x.doc' : `${d}.docx`, extensionType: 'docx' }),
  references: async () => [{ docNo: 'QM-02', docName: '參考' }],
  uppers: async () => [],
  lowers: async () => [{ docNo: 'WI-01', docName: '作業指導書' }],
};

describe('ISO 文件庫', () => {
  let t: TestApp;
  const call = async (url: string) => t.app.inject({ method: 'GET', url, headers: { 'x-internal-token': await t.token() } });
  before(async () => {
    t = await testApp({ services: { iso: new IsoService(fake, 'http://10.10.130.190/ISO2') } });
  });
  after(() => t.close());

  it('依條文分類列出文件', async () => {
    assert.deepEqual((await call('/v1/services/iso/clauses')).json().items, ['品質管理', '環安衛']);
    assert.equal((await call(`/v1/services/iso/docs?clause=${encodeURIComponent('品質管理')}`)).json().items[0].docNo, 'QM-01');
    assert.equal((await call('/v1/services/iso/docs')).statusCode, 400);
  });

  it('關鍵字查詢', async () => {
    assert.equal((await call(`/v1/services/iso/docs?q=${encodeURIComponent("手冊' OR 1=1")}`)).json().items[0].docName, "含手冊' OR 1=1");
  });

  it('文件明細', async () => {
    const j = (await call('/v1/services/iso/docs/QM-01')).json();
    assert.equal(j.url, 'http://10.10.130.190/ISO2/QM-01/30/QM-01.pdf');
    assert.equal(j.references[0].url, null, '檔名含路徑不產生連結');
    assert.equal(j.lowers[0].url, 'http://10.10.130.190/ISO2/WI-01/50/WI-01.pdf');
    // 4-4 文件用原檔名(同舊版)
    assert.equal((await call('/v1/services/iso/docs/GS4-4-01')).json().url, 'http://10.10.130.190/ISO2/GS4-4-01/30/GS4-4-01.docx');
    assert.equal((await call('/v1/services/iso/docs/NONE')).statusCode, 404);
    assert.equal((await call(`/v1/services/iso/docs/${encodeURIComponent('a/b')}`)).statusCode, 404);
  });

  it('來源未設定回 503', async () => {
    const t2 = await testApp({ services: { iso: new IsoService(null, null) } });
    const r = await t2.app.inject({ method: 'GET', url: '/v1/services/iso/clauses', headers: { 'x-internal-token': await t2.token() } });
    assert.equal(r.statusCode, 503);
    assert.equal(r.json().code, 'PORTAL_SOURCE_UNAVAILABLE');
    await t2.close();
  });
});
