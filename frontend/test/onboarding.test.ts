import { describe, expect, it } from 'vitest';
import { quizResultMessage, toAnswers, unansweredCount, type QuizChoice } from '../src/composables/onboarding';
import { EXTRA_TIPS, FAQ, SHIFTS, TIPS } from '../src/pages/resources/onboarding/content';

describe('新人導覽驗收測驗', () => {
  it('全部作答才能送出,未預選答案', () => {
    const choices: QuizChoice[] = Array(20).fill('');
    expect(unansweredCount(choices)).toBe(20);
    expect(toAnswers(choices)).toBeNull();
    choices.fill('yes');
    choices[2] = 'no';
    expect(unansweredCount(choices)).toBe(0);
    const a = toAnswers(choices)!;
    expect(a).toHaveLength(20);
    expect(a[0]).toBe(true);
    expect(a[2]).toBe(false);
    choices[19] = '';
    expect(toAnswers(choices)).toBeNull();
    expect(toAnswers([])).toBeNull();
  });

  it('結果訊息只顯示答對題數', () => {
    expect(quizResultMessage({ correct: 17, total: 20, score: 85, passed: false, passedAt: null })).toEqual({
      tone: 'warning',
      title: '您答對 17 題,不及格,請重新測驗',
      message: '得分 85 分;需 20 題全對才算通過',
    });
    expect(quizResultMessage({ correct: 20, total: 20, score: 100, passed: true, passedAt: '2026-10-22' }).tone).toBe('success');
  });
});

describe('小叮嚀內容(照搬舊頁)', () => {
  it('29 條注意事項、5 種班別、7 組 Q&A 主題', () => {
    expect(TIPS).toHaveLength(29);
    expect(EXTRA_TIPS).toHaveLength(6);
    expect(SHIFTS.map((s) => s.name)).toEqual(['常日班', '彈性早班', '輪班日班', '輪班夜班', '固定夜']);
    expect(FAQ.flatMap((s) => s.items)).toHaveLength(25);
  });
});
