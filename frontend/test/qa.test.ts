import { describe, expect, it } from 'vitest';
import type { QaDept, QaQuestion } from '../src/api/portal';
import {
  addDepts,
  buildDeptTree,
  emptyFill,
  fillErrors,
  fromQuestion,
  moveQuestion,
  newQuestion,
  parseEmpList,
  surveyErrors,
  targetSummary,
  toAnswers,
  toDisplayHtml,
  toggleChoice,
  toQuestionInput,
  withDescendants,
} from '../src/composables/qa';

const q = (no: number, over: Partial<QaQuestion>): QaQuestion => ({
  no,
  type: 'single',
  text: `Q${no}`,
  options: [],
  limit: null,
  required: false,
  image: null,
  legacyImage: false,
  ...over,
});

const QS: QaQuestion[] = [
  q(1, { type: 'single', options: ['滿意', '不滿意'], required: true }),
  q(2, { type: 'multi', options: ['A', 'B', 'C'], limit: 2 }),
  q(3, { type: 'text', required: true }),
  q(4, { type: null, required: true }),
];

describe('問卷填答', () => {
  it('送出前檢查(訊息同舊系統)', () => {
    const s = emptyFill(QS);
    expect(fillErrors(QS, s)).toEqual(['題1 單選題為必填,請確認選項!', '題3 問答題為必填,請確認填寫內容!']);
    s[1]!.choice = '滿意';
    s[3]!.text = 'ok';
    s[2]!.choices = ['A', 'B', 'C'];
    expect(fillErrors(QS, s)).toEqual(['題2 複選題選項超過2項,請確認選項!']);
  });

  it('複選題達上限後不再加入;作答依選項順序', () => {
    const s = emptyFill(QS);
    toggleChoice(QS[1]!, s[2]!, 'C', true);
    toggleChoice(QS[1]!, s[2]!, 'A', true);
    toggleChoice(QS[1]!, s[2]!, 'B', true);
    expect(s[2]!.choices).toEqual(['C', 'A']);
    s[1]!.choice = '滿意';
    s[3]!.text = '  建議  ';
    expect(toAnswers(QS, s)).toEqual([
      { no: 1, choices: ['滿意'] },
      { no: 2, choices: ['A', 'C'] },
      { no: 3, text: '建議' },
    ]);
    toggleChoice(QS[1]!, s[2]!, 'C', false);
    expect(s[2]!.choices).toEqual(['A']);
  });

  it('前言:純文字換行轉 <br>,HTML 原樣交給白名單清洗', () => {
    expect(toDisplayHtml('第一行\n&lt;第二行&gt;')).toBe('第一行<br>&lt;第二行&gt;');
    expect(toDisplayHtml('<p>說明</p>')).toBe('<p>說明</p>');
  });
});

describe('問卷出題', () => {
  it('題目轉送出格式', () => {
    const e = fromQuestion(QS[1]!);
    expect(e).toMatchObject({ type: 'multi', optionsText: 'A\nB\nC', limit: '2' });
    e.optionsText = ' A \n\nB\n';
    e.limit = '';
    expect(toQuestionInput(e)).toEqual({ type: 'multi', text: 'Q2', options: ['A', 'B'], limit: null, required: false, image: null });
    const t = { ...newQuestion(), type: 'text' as const, text: ' 問 ', optionsText: 'x' };
    expect(toQuestionInput(t)).toEqual({ type: 'text', text: '問', required: true, image: null });
    expect(fromQuestion(QS[3]!).type).toBe('text');
    const img = { ...newQuestion(), image: { fileId: 'u', position: 'after' as const, width: '' as unknown as number, height: 0 } };
    expect(toQuestionInput(img).image).toEqual({ fileId: 'u', position: 'after', width: 0, height: 0 });
  });

  it('題目上移 / 下移', () => {
    expect(moveQuestion(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveQuestion(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });

  it('出題檢查', () => {
    const base = {
      title: 'T',
      dept: '',
      intro: '',
      outro: '',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      targets: { all: true, depts: [], emps: [] },
      questions: [{ type: 'single' as const, text: 'Q', options: ['a'], required: true }],
    };
    expect(surveyErrors(base)).toEqual([]);
    expect(surveyErrors({ ...base, title: '<b>', endDate: '2026-09-01', targets: { all: false, depts: [], emps: [] } })).toEqual([
      '標題不可包含 < >',
      '結束日不可早於開始日',
      '請設定填寫對象(全集團、部門或人員)',
    ]);
    expect(surveyErrors({ ...base, questions: [{ type: 'multi', text: 'Q', options: ['a', 'a●'], limit: 3, required: false }] })).toEqual([
      '題 1 選項不可包含「●」或 < >',
      '題 1 複選上限需介於 1 與選項數之間',
    ]);
  });

  it('工號清單:各種分隔、轉大寫、去重複', () => {
    expect(parseEmpList('s112009, S112010\nS112009、S1;')).toEqual(['S112009', 'S112010', 'S1']);
  });

  const DEPTS: QaDept[] = [
    { code: 'GSMC', name: '碩禾', parent: null },
    { code: 'S1400', name: '製造處', parent: 'GSMC' },
    { code: 'S1420', name: '一課', parent: 'S1400' },
    { code: 'S1430', name: '二課', parent: 'S1400' },
    { code: 'X1', name: '孤兒', parent: 'NOPE' },
    { code: 'L1', name: '循環', parent: 'L2' },
    { code: 'L2', name: '循環', parent: 'L1' },
  ];

  it('部門樹與含下層展開', () => {
    const tree = buildDeptTree(DEPTS.slice(0, 5));
    expect(tree.map((n) => n.code)).toEqual(['GSMC', 'X1']);
    expect(tree[0]!.children[0]!.children.map((n) => n.code)).toEqual(['S1420', 'S1430']);
    expect(withDescendants('S1400', DEPTS).sort()).toEqual(['S1400', 'S1420', 'S1430']);
    // 循環資料不會無限展開
    expect(withDescendants('L1', DEPTS).sort()).toEqual(['L1', 'L2']);
    const t = addDepts({ all: false, depts: ['S1420'], emps: [] }, 'S1400', DEPTS);
    expect(t.depts.sort()).toEqual(['S1400', 'S1420', 'S1430']);
    expect(targetSummary({ ...t, emps: ['S1'] })).toBe('部門 3 個、人員 1 位');
    expect(targetSummary({ all: true, depts: [], emps: [] })).toBe('全集團');
  });
});
