/** docs/Gherkin/personal/courses.feature(測試名稱 = 場景名稱) */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { CourseRepo } from '../src/modules/courses/repo.js';
import { evaluate, type CompletionRecord, type EmployeeRow, type Membership } from '../src/modules/courses/rules.js';
import { testApp, type TestApp } from './helpers.js';

const Y = 2026;
const SAFETY = '工安課程(必修)';
const emp = (over: Partial<EmployeeRow> = {}): EmployeeRow => ({ compDb: 'DS11', dept: 'S1800', jobName: '工程師', jobDate: '2026-01-05', ...over });
const rec = (className: string, courseType: string | null = SAFETY, hours = '1'): CompletionRecord => ({ className, courseType, hours });
const statusOf = (r: ReturnType<typeof evaluate>, key: string) => r.courses.find((c) => c.key === key)!.status;
const none = new Set<Membership>();

describe('年度必上課程', () => {
  it('公司別不在 DS11 / DS15 / DS36 的同仁沒有必上課程', () => {
    // repo 依公司別過濾,其他公司沒有資料列
    const r = evaluate(Y, [], none, [rec('自衛消防編組訓練')]);
    assert.equal(r.eligible, false);
    assert.ok(r.courses.every((c) => c.status === 'na'));
    assert.equal(r.courses.length, 12);
    assert.equal(r.deduction, 0);
  });

  it('9/30 之後到職的同仁今年都不適用', () => {
    const r = evaluate(Y, [emp({ jobDate: '2026-10-01' })], none, []);
    assert.equal(r.inYear, false);
    assert.ok(r.courses.every((c) => c.status === 'na'));
    assert.equal(r.deduction, 0);
    assert.equal(evaluate(Y, [emp({ jobDate: '2026-09-30' })], none, []).inYear, true);
  });

  it('工安課程未完成各扣 2 分,其他課程不扣分', () => {
    const r = evaluate(Y, [emp()], none, [rec('115年度自衛消防編組訓練(湖口)'), rec('資安宣導-社交工程', '資訊課程')]);
    assert.equal(statusOf(r, 'fire-team'), 'done');
    assert.equal(statusOf(r, 'hazard'), 'missing');
    assert.equal(statusOf(r, 'infosec'), 'done');
    assert.equal(statusOf(r, 'trade-secret'), 'missing');
    // 一般職稱、不在名單:基層主管、呼吸防護具、專題報告不適用
    assert.equal(statusOf(r, 'supervisor-safety'), 'na');
    assert.equal(r.deduction, -2);
  });

  it('工安課程要符合課程類別「工安課程(必修)」', () => {
    const r = evaluate(Y, [emp()], none, [rec('自衛消防編組訓練', '一般課程')]);
    assert.equal(statusOf(r, 'fire-team'), 'missing');
  });

  it('適用對象依職稱與名單判斷', () => {
    const r = evaluate(Y, [emp({ jobName: '課長' })], new Set<Membership>(['scba']), []);
    assert.equal(statusOf(r, 'supervisor-safety'), 'missing');
    assert.equal(statusOf(r, 'respirator'), 'missing');
    assert.equal(statusOf(r, 'bullying-manager'), 'missing');
    assert.equal(statusOf(r, 'esh-report'), 'na');
    assert.equal(statusOf(r, 'bullying-investigator'), 'na');
    // 工安:自衛消防、危害通識、基層主管、呼吸防護具 各 -2
    assert.equal(r.deduction, -8);
  });

  it('免訓名單只排除前 3 門工安課程', () => {
    const r = evaluate(Y, [emp({ jobName: '課長' })], new Set<Membership>(['exempt']), []);
    for (const k of ['fire-team', 'hazard', 'supervisor-safety']) assert.equal(statusOf(r, k), 'na', k);
    assert.equal(statusOf(r, 'infosec'), 'missing');
    assert.equal(r.deduction, 0);
  });

  it('專題報告要累積 2 小時才算完成', () => {
    const members = new Set<Membership>(['project', 'exempt']);
    const half = evaluate(Y, [emp()], members, [rec('環安衛專題報告暨教育訓練', SAFETY, '1.5')]);
    const report = half.courses.find((c) => c.key === 'esh-report')!;
    assert.deepEqual([report.status, report.hours, report.minHours], ['missing', 1.5, 2]);
    assert.equal(half.deduction, -2);
    const full = evaluate(Y, [emp()], members, [rec('環安衛專題報告暨教育訓練', SAFETY, '1.5'), rec('環安衛專題報告暨教育訓練(下)', SAFETY, '0.5')]);
    assert.equal(statusOf(full, 'esh-report'), 'done');
    // 部門 S0 開頭不適用
    assert.equal(statusOf(evaluate(Y, [emp({ dept: 'S0100' })], members, []), 'esh-report'), 'na');
  });

  it('舊規則的主管職稱清單照舊(公關處長與副課長不在主管課程對象內)', () => {
    const r = evaluate(Y, [emp({ jobName: '副課長' })], none, []);
    assert.equal(statusOf(r, 'bullying-manager'), 'na');
    assert.equal(statusOf(r, 'supervisor-safety'), 'missing');
    assert.equal(statusOf(evaluate(Y, [emp({ jobName: '公關處長' })], none, []), 'bullying-manager'), 'na');
  });

  describe('API', () => {
    let t: TestApp;
    const asked: string[] = [];
    const repo: CourseRepo = {
      employee: async (e) => (asked.push(e), [emp()]),
      memberships: async () => new Set(),
      completions: async () => [rec('自衛消防編組訓練')],
    };
    before(async () => {
      t = await testApp({ courses: repo });
    });
    after(() => t.close());

    it('查詢年度必上課程只能看本人', async () => {
      // 指定他人工號的參數會被忽略(querystring 只允許 year),仍以 Token 工號查詢
      const ok = await t.app.inject({ url: '/v1/courses/required?year=2026&empNo=A000001', headers: { 'x-internal-token': await t.token() } });
      assert.equal(ok.statusCode, 200);
      assert.deepEqual(asked, ['S112009']);
      assert.equal(ok.json().courses.find((c: { key: string }) => c.key === 'fire-team').status, 'done');
    });
  });
});
