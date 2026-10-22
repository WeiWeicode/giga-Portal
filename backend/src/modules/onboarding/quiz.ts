/**
 * 新人驗收測驗題目與計分(old_PortalSolar HRnewPep05.aspx 題目、HRnewPep05.aspx.cs:15-73 標準答案;PORTAL-API-PLAN D-20)。
 *   - 20 題是非題、每題 5 分,滿分(100)才算通過
 *   - 標準答案只放在後端,不回傳給前端(題目 API 只回題號與題目)
 *   - 題目文字照搬舊頁(含舊頁原本的寫法,例如第 10 題吸菸區「A棟6樓」為錯誤敘述、正解為「否」)
 */

export const QUESTIONS: readonly string[] = [
  '員工只要進出廠區均需刷卡',
  '學習意願是試用評核項目中的其中一項',
  '報到工作一天後覺得不適合可以不辦離職手續，反正公司不會給薪水',
  '公司的緊急疏散地點在A棟1樓大廳前的空地',
  '新進人員應繳交資料未繳齊或出勤狀況不佳會被延長試用期',
  '未依規定辦妥離職手續或移交不清，當月薪資會轉為現金需至人資部親領',
  '進入廠區為了連絡方便可以不關手機',
  '配合節能措施，辦公區在7:30pm將會關燈',
  '未領有堆高機證照不得駕駛堆高機，限速每小時10公里',
  '吸煙區位於A棟6樓，吸菸區外吸煙，首犯記大過乙次，再犯則予解僱',
  '為了方便作業可以攜帶自己的筆記型電腦到公司工作',
  '廠區全面禁止吃東西但可以喝飲料',
  '辦公室不准食用明顯有氣味的食物',
  '生產線直接生產人員不可外出用餐',
  '公務需要需攜帶公物出廠直接攜出廠外即可',
  '薪資及獎金可以和同事們互相討論',
  '下班時間參加內外訓練活動均不得申請加班或補休',
  '休息區及置物櫃是否可以放置食物及飲料?',
  '申請停車證至警衛室領取時是否須掃描E-tag?',
  '做好資源回收是否可增加福利金?',
];

/** 標準答案:true =「是」、false =「否」(HRnewPep05.aspx.cs:18-56) */
const ANSWERS: readonly boolean[] = [
  true,
  true,
  false,
  true,
  true,
  true,
  false,
  true,
  true,
  false,
  false,
  false,
  true,
  true,
  false,
  false,
  true,
  false,
  true,
  true,
];

export const QUIZ_TOTAL = QUESTIONS.length;
export const POINTS_PER_QUESTION = 5;
export const PASS_SCORE = QUIZ_TOTAL * POINTS_PER_QUESTION;

export interface QuizResult {
  correct: number;
  score: number;
  passed: boolean;
}

/** 計分:answers 長度必須等於題數(由路由 schema 保證,這裡再檢查一次) */
export function gradeQuiz(answers: readonly boolean[]): QuizResult {
  if (answers.length !== QUIZ_TOTAL) throw new Error(`作答數量錯誤:${answers.length}`);
  const correct = answers.reduce((n, a, i) => n + (a === ANSWERS[i] ? 1 : 0), 0);
  const score = correct * POINTS_PER_QUESTION;
  return { correct, score, passed: score === PASS_SCORE };
}

/** 舊表 HRNewPtest.t1~t20 的寫法:「是」/「否」 */
export const legacyAnswer = (a: boolean) => (a ? '是' : '否');
