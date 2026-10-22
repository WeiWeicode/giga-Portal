/**
 * 新人導覽驗收測驗的畫面邏輯(FEATURE-PLAN §3.5、PORTAL-API-PLAN D-20;docs/Gherkin/resources/onboarding.feature)。
 * 標準答案與計分在 portal-api;前端只收集作答、檢查是否全部作答、組成結果訊息。
 * 作答預設不預選(舊版每題預設「是」,容易未讀題就送出)。
 */
import type { OnboardingQuizResult } from '@/api/portal';

/** 每題的選擇:'' 未作答、'yes' 是、'no' 否 */
export type QuizChoice = '' | 'yes' | 'no';

export const QUIZ_OPTIONS = [
  { label: '是', value: 'yes' },
  { label: '否', value: 'no' },
];

export const unansweredCount = (choices: readonly QuizChoice[]) => choices.filter((c) => c === '').length;

/** 全部作答才回傳送出用的 boolean 陣列(true = 是);有未作答回 null */
export function toAnswers(choices: readonly QuizChoice[]): boolean[] | null {
  if (!choices.length || unansweredCount(choices) > 0) return null;
  return choices.map((c) => c === 'yes');
}

/** 結果訊息(對應舊頁 HRnewPep05.aspx.cs:60、67 的提示文字) */
export function quizResultMessage(r: OnboardingQuizResult): { tone: 'success' | 'warning'; title: string; message: string } {
  return r.passed
    ? { tone: 'success', title: `您答對 ${r.correct} 題,恭喜您已完成測驗!`, message: `得分 ${r.score} 分` }
    : { tone: 'warning', title: `您答對 ${r.correct} 題,不及格,請重新測驗`, message: `得分 ${r.score} 分;需 ${r.total} 題全對才算通過` };
}
