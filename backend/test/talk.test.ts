/** docs/Gherkin/group/talk.feature(測試名稱 = 場景名稱)。資料存取以記憶體假物件取代;金鑰為測試用隨機值 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { loadConfig } from '../src/config.js';
import { AuthorCipher, parseAuthorKey } from '../src/modules/talk/author-cipher.js';
import { BLOCKED_TEXT, maskForViewer, TalkService, type NewPost, type RevealResult, type TalkRepo, type TalkRow } from '../src/modules/talk/talk.js';
import { DB_ENV, testApp, type TestApp } from './helpers.js';

/** 測試專用金鑰(每次執行隨機產生,不寫進程式) */
const TEST_KEY = randomBytes(32).toString('base64');

class MemoryTalk implements TalkRepo {
  rows: (TalkRow & { mark: string | null })[] = [];
  likes: { sn: number; emp: string }[] = [];
  authors = new Map<number, { cipher: string; keyId: string }>();
  audits: { sn: number; action: string; result?: RevealResult; emp: string; approvalNo?: string; reason?: string | null }[] = [];
  private seq = 100;
  private withLikes = (r: TalkRow & { mark: string | null }): TalkRow => {
    const { mark: _m, ...rest } = r;
    return { ...rest, likes: this.likes.filter((l) => l.sn === r.sn).length };
  };
  async list(type: string | null) {
    return this.rows
      .filter((r) => type === null || r.type === type)
      .map(this.withLikes)
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.sn - a.sn);
  }
  async get(sn: number) {
    const r = this.rows.find((x) => x.sn === sn);
    return r ? this.withLikes(r) : null;
  }
  async likedBy(empNo: string) {
    return new Set(this.likes.filter((l) => l.emp === empNo).map((l) => l.sn));
  }
  async create(post: NewPost, seal: (sn: number) => { cipher: string; keyId: string }) {
    const sn = ++this.seq;
    this.rows.push({ sn, ...post, createdAt: `2026-10-22 10:${String(sn % 60).padStart(2, '0')}:00`, blocked: false, likes: 0, mark: null });
    this.authors.set(sn, seal(sn));
    return sn;
  }
  async like(sn: number, empNo: string) {
    if (this.likes.some((l) => l.sn === sn && l.emp === empNo)) return false;
    this.likes.push({ sn, emp: empNo });
    return true;
  }
  async setBlocked(sn: number, blocked: boolean, byEmp: string) {
    this.rows.find((r) => r.sn === sn)!.blocked = blocked;
    this.audits.push({ sn, action: blocked ? 'block' : 'unblock', emp: byEmp });
  }
  async author(sn: number) {
    return this.authors.get(sn) ?? null;
  }
  async hasLegacyMark(sn: number) {
    return !!this.rows.find((r) => r.sn === sn)?.mark;
  }
  async auditReveal(sn: number, byEmp: string, approvalNo: string, reason: string | null, result: RevealResult) {
    this.audits.push({ sn, action: 'reveal', result, emp: byEmp, approvalNo, reason });
  }
}

const row = (sn: number, parentSn: number | null, extra: Partial<TalkRow & { mark: string | null }> = {}) => ({
  sn,
  parentSn,
  type: '舉手發問',
  title: `T${sn}`,
  content: `C${sn}`,
  createdAt: `2026-01-0${sn % 9} 00:00:00`,
  blocked: false,
  likes: 0,
  mark: null,
  ...extra,
});

describe('3691 全民開講', () => {
  let t: TestApp;
  const repo = new MemoryTalk();
  const cipher = new AuthorCipher(parseAuthorKey('k1', TEST_KEY));
  const call = async (method: 'GET' | 'POST' | 'PUT', url: string, payload?: object, emp = 'S112009') =>
    t.app.inject({ method, url, ...(payload ? { payload } : {}), headers: { 'x-internal-token': await t.token({ sub: emp, emp, dept: 'S1800' }) } });

  before(async () => {
    t = await testApp({ talk: new TalkService(repo, cipher) });
  });
  after(() => t.close());
  beforeEach(() => {
    repo.rows = [row(1, null), row(2, 1), row(3, 2), row(4, null, { blocked: true, mark: 'legacyDES==' }), row(5, 4), row(6, null, { type: '不吐不快' })];
    repo.likes = [];
    repo.authors.clear();
    repo.audits = [];
  });

  it('瀏覽討論串', async () => {
    const r = await call('GET', '/v1/talk/posts?type=舉手發問');
    assert.equal(r.statusCode, 200);
    const j = r.json();
    assert.deepEqual(j.types, ['不吐不快', '開講公告', '老王賣瓜', '馬路消息', '資訊分享', '舉手發問']);
    assert.equal(j.canPost, true);
    assert.deepEqual(j.items.map((x: { sn: number }) => x.sn).sort(), [1, 2, 3, 4], '分類篩選;被屏蔽主題的回覆不列出');
    assert.ok(!JSON.stringify(j).match(/mark|author|empNo|S112009/), '不回傳作者');
    assert.equal((await call('GET', '/v1/talk/posts')).json().items.length, 5, '全部文件');
    assert.equal((await call('GET', `/v1/talk/posts?type=${encodeURIComponent('全部文件')}`)).json().items.length, 5);
  });

  it('被屏蔽的發言對一般人遮蔽', async () => {
    const items = (await call('GET', '/v1/talk/posts')).json().items as TalkRow[];
    const blocked = items.find((x) => x.sn === 4)!;
    assert.deepEqual([blocked.title, blocked.content, blocked.blocked], [BLOCKED_TEXT, BLOCKED_TEXT, true]);
    // 純函式:多層回覆一併隱藏
    const masked = maskForViewer([row(1, null, { blocked: true }), row(2, 1), row(3, 2), row(7, null)]);
    assert.deepEqual(
      masked.map((r) => r.sn),
      [1, 7],
    );
  });

  it('管理者看得到被屏蔽的原文', async () => {
    const items = (await call('GET', '/v1/talk/moderation/posts')).json().items as TalkRow[];
    assert.equal(items.find((x) => x.sn === 4)!.title, 'T4');
    assert.ok(
      items.some((x) => x.sn === 5),
      '被屏蔽主題的回覆也列出',
    );
  });

  it('匿名發文', async () => {
    const r = await call('POST', '/v1/talk/posts', { type: '舉手發問', title: ' 問題 ', content: ' <b>內容</b> ', parentSn: null });
    assert.equal(r.statusCode, 201);
    const sn = r.json().sn as number;
    const saved = repo.rows.find((x) => x.sn === sn)!;
    assert.deepEqual(
      [saved.title, saved.content, saved.type, saved.parentSn, saved.mark],
      ['問題', '＜b＞內容＜/b＞', '舉手發問', null, null],
      '< > 改全形(舊站原樣輸出)、mark 留 NULL',
    );
    const sealed = repo.authors.get(sn)!;
    assert.equal(sealed.keyId, 'k1');
    assert.ok(!sealed.cipher.includes('S112009'));
    assert.equal(cipher.decrypt(sn, sealed.cipher, sealed.keyId), 'S112009');
    assert.throws(() => cipher.decrypt(sn + 1, sealed.cipher, sealed.keyId), '密文綁定 SN,搬到別篇解不開');
  });

  it('回覆沿用上層分類', async () => {
    const r = await call('POST', '/v1/talk/posts', { parentSn: 6, type: '舉手發問', content: '回覆' });
    assert.equal(r.statusCode, 201);
    const saved = repo.rows.find((x) => x.sn === r.json().sn)!;
    assert.deepEqual([saved.parentSn, saved.type, saved.title], [6, '不吐不快', '']);
    assert.equal((await call('POST', '/v1/talk/posts', { parentSn: 999, content: 'x' })).statusCode, 404);
  });

  it('回覆被屏蔽的發言', async () => {
    const r = await call('POST', '/v1/talk/posts', { parentSn: 4, content: 'x' });
    assert.equal(r.statusCode, 409);
    assert.equal(r.json().code, 'PORTAL_TALK_BLOCKED');
    assert.equal((await call('POST', '/v1/talk/posts/4/like')).json().code, 'PORTAL_TALK_BLOCKED');
    // 被屏蔽主題底下的回覆(一般檢視已隱藏)也不能回覆或按讚
    assert.equal((await call('POST', '/v1/talk/posts', { parentSn: 5, content: 'x' })).json().code, 'PORTAL_TALK_BLOCKED');
    assert.equal((await call('POST', '/v1/talk/posts/5/like')).json().code, 'PORTAL_TALK_BLOCKED');
  });

  it('發文欄位驗證', async () => {
    for (const body of [
      { title: 'x', content: 'x' },
      { type: '其他', title: 'x', content: 'x' },
      { type: '舉手發問', title: '  ', content: 'x' },
      { type: '舉手發問', title: 'x', content: '   ' },
      { type: '舉手發問', title: 'x'.repeat(101), content: 'x' },
      { type: '舉手發問', title: 'x', content: 'x'.repeat(4001) },
    ]) {
      const r = await call('POST', '/v1/talk/posts', body);
      assert.ok(r.statusCode === 400, `${JSON.stringify(body).slice(0, 60)} → ${r.statusCode}`);
    }
    assert.equal(repo.authors.size, 0);
    // 瀏覽器另外送來的作者欄位被忽略,一律以 Token 工號加密
    const r = await call('POST', '/v1/talk/posts', { type: '舉手發問', title: 'x', content: 'x', author: 'S000001' });
    assert.equal(r.statusCode, 201);
    const sealed = repo.authors.get(r.json().sn)!;
    assert.equal(cipher.decrypt(r.json().sn, sealed.cipher, sealed.keyId), 'S112009');
  });

  it('按讚', async () => {
    assert.equal((await call('POST', '/v1/talk/posts/1/like')).json().likes, 1);
    assert.equal((await call('POST', '/v1/talk/posts/1/like')).json().likes, 1, '每人每則一次');
    assert.equal((await call('POST', '/v1/talk/posts/1/like', undefined, 'S000002')).json().likes, 2);
    const mine = (await call('GET', '/v1/talk/posts')).json().items.find((x: TalkRow) => x.sn === 1);
    assert.deepEqual([mine.likes, mine.likedByMe], [2, true]);
    assert.equal((await call('POST', '/v1/talk/posts/1/like', undefined, 'S1234567890')).statusCode, 400, '工號超過舊表 UserID 長度');
    assert.equal((await call('POST', '/v1/talk/posts/999/like')).statusCode, 404);
  });

  it('屏蔽發言', async () => {
    assert.equal((await call('PUT', '/v1/talk/posts/1/block', { blocked: true }, 'S000009')).statusCode, 204);
    assert.equal((await call('GET', '/v1/talk/posts')).json().items.find((x: TalkRow) => x.sn === 1).title, BLOCKED_TEXT);
    assert.equal((await call('PUT', '/v1/talk/posts/1/block', { blocked: false }, 'S000009')).statusCode, 204);
    assert.deepEqual(
      repo.audits.map((a) => [a.sn, a.action, a.emp]),
      [
        [1, 'block', 'S000009'],
        [1, 'unblock', 'S000009'],
      ],
    );
    assert.equal((await call('PUT', '/v1/talk/posts/999/block', { blocked: true })).statusCode, 404);
  });

  it('解碼作者需核准文號並留稽核', async () => {
    const sn = (await call('POST', '/v1/talk/posts', { type: '不吐不快', title: 't', content: 'c' }, 'S100001')).json().sn;
    assert.equal((await call('POST', `/v1/talk/posts/${sn}/reveal`, {}, 'S900001')).statusCode, 400, '缺核准文號');
    assert.equal((await call('POST', `/v1/talk/posts/${sn}/reveal`, { approvalNo: '   ' }, 'S900001')).statusCode, 400);
    const r = await call('POST', `/v1/talk/posts/${sn}/reveal`, { approvalNo: 'HR-2026-001', reason: '申訴調查' }, 'S900001');
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.json(), { sn, empNo: 'S100001' });
    assert.deepEqual(repo.audits.at(-1), { sn, action: 'reveal', result: 'ok', emp: 'S900001', approvalNo: 'HR-2026-001', reason: '申訴調查' });
  });

  it('舊入口網發文不解碼', async () => {
    const r = await call('POST', '/v1/talk/posts/4/reveal', { approvalNo: 'HR-1' }, 'S900001');
    assert.equal(r.statusCode, 409);
    assert.equal(r.json().code, 'PORTAL_TALK_AUTHOR_LEGACY');
    const none = await call('POST', '/v1/talk/posts/1/reveal', { approvalNo: 'HR-1' }, 'S900001');
    assert.equal(none.json().code, 'PORTAL_TALK_AUTHOR_NOT_FOUND');
    assert.equal((await call('POST', '/v1/talk/posts/999/reveal', { approvalNo: 'HR-1' }, 'S900001')).statusCode, 404);
    assert.deepEqual(
      repo.audits.map((a) => a.result),
      ['legacy', 'none', 'none'],
      '失敗的嘗試也寫稽核',
    );
  });

  it('密文毀損時解碼失敗並留稽核', async () => {
    const sn = (await call('POST', '/v1/talk/posts', { type: '不吐不快', title: 't', content: 'c' })).json().sn;
    const s = repo.authors.get(sn)!;
    repo.authors.set(sn, { ...s, cipher: Buffer.from(randomBytes(40)).toString('base64') });
    const r = await call('POST', `/v1/talk/posts/${sn}/reveal`, { approvalNo: 'HR-1' }, 'S900001');
    assert.equal(r.statusCode, 500);
    assert.equal(r.json().code, 'PORTAL_TALK_AUTHOR_DECRYPT_FAILED');
    assert.equal(repo.audits.at(-1)!.result, 'error');
  });

  it('金鑰未設定時不能發文與解碼', async () => {
    const noKey = await testApp({ talk: new TalkService(repo, null) });
    try {
      const h = { 'x-internal-token': await noKey.token() };
      assert.equal((await noKey.app.inject({ url: '/v1/talk/posts', headers: h })).json().canPost, false, '仍可瀏覽');
      const p = await noKey.app.inject({ method: 'POST', url: '/v1/talk/posts', headers: h, payload: { type: '不吐不快', title: 't', content: 'c' } });
      assert.equal(p.statusCode, 503);
      assert.equal(p.json().code, 'PORTAL_TALK_KEY_UNAVAILABLE');
      const rv = await noKey.app.inject({ method: 'POST', url: '/v1/talk/posts/1/reveal', headers: h, payload: { approvalNo: 'x' } });
      assert.equal(rv.statusCode, 503);
    } finally {
      await noKey.close();
    }
  });
});

describe('3691 作者金鑰設定', () => {
  const base = { GW_ENV: 'dev', SERVICE_CODE: 'portal-api', LOG_LEVEL: 'silent', ...DB_ENV };

  it('金鑰只從設定讀取並檢查長度', () => {
    assert.equal(loadConfig(base).talkKeys, null);
    const c = loadConfig({ ...base, TALK_AUTHOR_KEY: TEST_KEY, TALK_AUTHOR_KEY_ID: 'k2' });
    assert.equal(c.talkKeys?.current.id, 'k2');
    assert.throws(() => loadConfig({ ...base, TALK_AUTHOR_KEY: Buffer.alloc(16).toString('base64') }), /32 bytes/);
    assert.throws(() => loadConfig({ ...base, TALK_AUTHOR_KEY: TEST_KEY, TALK_AUTHOR_KEY_ID: 'bad id!' }), /格式/);
    const dir = mkdtempSync(path.join(tmpdir(), 'talk-old-'));
    const bad = path.join(dir, 'old');
    writeFileSync(bad, `${TEST_KEY}:k0\n`);
    assert.throws(
      () => loadConfig({ ...base, TALK_AUTHOR_KEY: TEST_KEY, TALK_AUTHOR_OLD_KEYS_FILE: bad }),
      (e: Error) => /第 1 個金鑰格式錯誤/.test(e.message) && !e.message.includes(TEST_KEY),
      '錯誤訊息不回顯金鑰',
    );
  });

  it('測試區與正式區只接受金鑰檔', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'talk-key-'));
    const keyFile = path.join(dir, 'key');
    writeFileSync(keyFile, `${TEST_KEY}\n`);
    const oldFile = path.join(dir, 'old');
    const oldKey = randomBytes(32).toString('base64');
    writeFileSync(oldFile, `k0:${oldKey}\n\n`);
    const test = {
      ...base,
      GW_ENV: 'test',
      GW_API_KEY_FILE: keyFile,
      SERVICE_ADVERTISE_URL: 'http://portal-api:51271',
      GW_JWKS_URL: 'http://127.0.0.1/jwks',
      PORTAL_DB_PASSWORD: undefined,
      PORTAL_DB_PASSWORD_FILE: keyFile,
    };
    assert.throws(() => loadConfig({ ...test, TALK_AUTHOR_KEY: TEST_KEY }), /_FILE/);
    const c = loadConfig({ ...test, TALK_AUTHOR_KEY_FILE: keyFile, TALK_AUTHOR_OLD_KEYS_FILE: oldFile });
    assert.deepEqual(
      c.talkKeys?.old.map((k) => k.id),
      ['k0'],
    );
    // 舊金鑰可解開以前的密文
    const old = new AuthorCipher(parseAuthorKey('k0', oldKey));
    const sealed = old.encrypt(7, 'S1');
    const now = new AuthorCipher(c.talkKeys!.current, c.talkKeys!.old);
    assert.equal(now.decrypt(7, sealed.cipher, 'k0'), 'S1');
    assert.equal(now.encrypt(7, 'S1').keyId, 'k1');
  });
});
