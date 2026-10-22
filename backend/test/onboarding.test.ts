/** docs/Gherkin/resources/onboarding.feature(測試名稱 = 場景名稱) */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { gradeQuiz, legacyAnswer, PASS_SCORE, QUESTIONS, QUIZ_TOTAL } from '../src/modules/onboarding/quiz.js';
import { isoFromLegacy, makeTimeToday, readTimeToday, type OnboardingRepo, type PassRecord } from '../src/routes/onboarding.js';
import { testApp, type TestApp } from './helpers.js';

/** 舊系統 HRnewPep05.aspx.cs:18-56 的標準答案(測試獨立寫一份,避免與實作共用而失去檢查意義) */
const KEY = '是是否是是是否是是否否否是是否否是否是是'.split('').map((c) => c === '是');

class MemoryOnboarding implements OnboardingRepo {
  reads: { LgNo: string; LgTime: string }[] = [];
  tests: ({ LgNo: string; PGrade: string; MakeTime: string } & Partial<PassRecord>)[] = [];
  async status(empNo: string) {
    const max = (xs: (string | null)[]) =>
      xs
        .filter((x): x is string => !!x)
        .sort()
        .at(-1) ?? null;
    return {
      readAt: max(this.reads.filter((r) => r.LgNo === empNo).map((r) => isoFromLegacy(r.LgTime))),
      passedAt: max(this.tests.filter((r) => r.LgNo === empNo && r.PGrade === '100').map((r) => isoFromLegacy(r.MakeTime))),
    };
  }
  async markRead(empNo: string, lgTime: string) {
    if (!this.reads.some((r) => r.LgNo === empNo && r.LgTime === lgTime)) this.reads.push({ LgNo: empNo, LgTime: lgTime });
  }
  async savePass(empNo: string, rec: PassRecord) {
    this.tests = this.tests.filter((r) => r.LgNo !== empNo);
    this.tests.push({ LgNo: empNo, PGrade: String(PASS_SCORE), MakeTime: rec.makeTime, ...rec });
  }
}

describe('新人導覽', () => {
  let t: TestApp;
  const repo = new MemoryOnboarding();
  const call = async (method: 'GET' | 'POST', url: string, payload?: object, emp = 'S112009') =>
    t.app.inject({ method, url, ...(payload ? { payload } : {}), headers: { 'x-internal-token': await t.token({ sub: emp, emp }) } });

  before(async () => {
    t = await testApp({ onboarding: repo });
  });
  after(() => t.close());
  beforeEach(() => {
    repo.reads = [];
    repo.tests = [];
  });

  it('查詢本人完成狀態', async () => {
    assert.deepEqual((await call('GET', '/v1/onboarding/status')).json(), { readAt: null, passedAt: null });
    repo.reads.push({ LgNo: 'S112009', LgTime: '2026/09/09' }, { LgNo: 'S112009', LgTime: '2026/10/05' }, { LgNo: 'X', LgTime: '2026/10/20' });
    repo.tests.push({ LgNo: 'S112009', PGrade: '155', MakeTime: '2020/1/2' });
    assert.deepEqual((await call('GET', '/v1/onboarding/status')).json(), { readAt: '2026-10-05', passedAt: null }, '只認本人、PGrade 100');
    repo.tests.push({ LgNo: 'S112009', PGrade: '100', MakeTime: '2026/9/8' });
    assert.equal((await call('GET', '/v1/onboarding/status')).json().passedAt, '2026-09-08');
  });

  it('記錄已閱讀', async () => {
    const r = await call('POST', '/v1/onboarding/read');
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().readAt, isoFromLegacy(readTimeToday()));
    assert.match(readTimeToday(), /^\d{4}\/\d{2}\/\d{2}$/, 'LgTime 同舊程式 yyyy/MM/dd');
    await call('POST', '/v1/onboarding/read');
    assert.equal(repo.reads.length, 1, '同一天不重複寫');
    assert.deepEqual(repo.reads[0], { LgNo: 'S112009', LgTime: readTimeToday() });
  });

  it('取得驗收測驗題目', async () => {
    const j = (await call('GET', '/v1/onboarding/quiz')).json();
    assert.equal(j.questions.length, 20);
    assert.equal(j.passScore, 100);
    assert.deepEqual(j.questions[0], { no: 1, text: QUESTIONS[0] });
    assert.ok(!JSON.stringify(j).match(/answer|true|false/i), '不含標準答案');
  });

  it('標準答案(寫死在後端)', () => {
    assert.equal(QUIZ_TOTAL, 20);
    assert.deepEqual(gradeQuiz(KEY), { correct: 20, score: 100, passed: true });
    for (let i = 0; i < 20; i++) {
      const wrong = KEY.map((a, j) => (j === i ? !a : a));
      assert.deepEqual(gradeQuiz(wrong), { correct: 19, score: 95, passed: false }, `第 ${i + 1} 題`);
    }
    assert.equal(gradeQuiz(KEY.map((a) => !a)).correct, 0);
    assert.throws(() => gradeQuiz(KEY.slice(1)));
    assert.equal(legacyAnswer(true), '是');
    assert.equal(legacyAnswer(false), '否');
  });

  it('未全對', async () => {
    repo.tests.push({ LgNo: 'S112009', PGrade: '100', MakeTime: '2026/1/1' });
    const r = await call('POST', '/v1/onboarding/quiz', { answers: KEY.map((a, i) => (i < 3 ? !a : a)), comment: 'x' });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.json(), { correct: 17, total: 20, score: 85, passed: false, passedAt: null });
    assert.deepEqual(
      repo.tests.map((x) => x.MakeTime),
      ['2026/1/1'],
      '不寫入、不刪除舊紀錄',
    );
  });

  it('全對通過', async () => {
    repo.tests.push({ LgNo: 'S112009', PGrade: '100', MakeTime: '2025/1/1' }, { LgNo: 'S000001', PGrade: '100', MakeTime: '2025/1/1' });
    const r = await call('POST', '/v1/onboarding/quiz', { answers: KEY, comment: '  很清楚  ' });
    assert.equal(r.statusCode, 200);
    const today = isoFromLegacy(makeTimeToday());
    assert.deepEqual(r.json(), { correct: 20, total: 20, score: 100, passed: true, passedAt: today });
    assert.match(makeTimeToday(), /^\d{4}\/\d{1,2}\/\d{1,2}$/, 'MakeTime 同舊資料 yyyy/M/d');
    const mine = repo.tests.filter((x) => x.LgNo === 'S112009');
    assert.equal(mine.length, 1, '先刪本人舊紀錄');
    assert.deepEqual(mine[0]!.answers, KEY.map(legacyAnswer));
    assert.equal(mine[0]!.comment, '很清楚');
    assert.equal(mine[0]!.PGrade, '100');
    assert.equal(repo.tests.filter((x) => x.LgNo === 'S000001').length, 1, '不動別人的紀錄');
  });

  it('作答格式驗證', async () => {
    for (const bad of [
      {},
      { answers: KEY.slice(0, 19) },
      { answers: [...KEY, true] },
      { answers: KEY.map((a) => (a ? '是' : '否')) },
      { answers: KEY, comment: 'x'.repeat(501) },
    ])
      assert.equal((await call('POST', '/v1/onboarding/quiz', bad)).statusCode, 400, JSON.stringify(bad).slice(0, 80));
    assert.equal(repo.tests.length, 0);
    // 瀏覽器送來的工號被忽略(Fastify 移除未宣告欄位),一律寫入 Token 的工號
    assert.equal((await call('POST', '/v1/onboarding/quiz', { answers: KEY, empNo: 'S000001' })).statusCode, 200);
    assert.deepEqual(
      repo.tests.map((x) => x.LgNo),
      ['S112009'],
    );
  });

  it('未經 Gateway 或系統帳號不能使用', async () => {
    assert.equal((await t.app.inject({ url: '/v1/onboarding/status' })).statusCode, 401);
    const sys = await t.app.inject({
      method: 'POST',
      url: '/v1/onboarding/read',
      headers: { 'x-internal-token': await t.token({ sub: 'client:abc', amr: 'api_key' }) },
    });
    assert.equal(sys.statusCode, 403);
    assert.equal(repo.reads.length, 0);
  });

  it('舊字串日期轉換', () => {
    assert.equal(isoFromLegacy('2026/9/9'), '2026-09-09');
    assert.equal(isoFromLegacy('2026/10/05'), '2026-10-05');
    assert.equal(isoFromLegacy('abc'), null);
  });
});
