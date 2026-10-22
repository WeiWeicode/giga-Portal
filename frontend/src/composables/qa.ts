/**
 * 問卷調查的畫面邏輯(FEATURE-PLAN §3.4;docs/Gherkin/resources/qa.feature)。
 * 填答檢查與後端相同(訊息沿用舊 QuestView.aspx.cs),後端仍會再驗;出題的題目、對象、部門樹展開在此組成送出格式。
 */
import type { QaAnswer, QaDept, QaImage, QaQuestion, QaQuestionInput, QaQuestionType, QaSurveyInput, QaTargets } from '@/api/portal';

// ───────────── 填答 ─────────────

export interface FillAnswer {
  /** 單選 */
  choice: string;
  /** 複選 */
  choices: string[];
  /** 問答 */
  text: string;
}

export const emptyFill = (qs: readonly QaQuestion[]): Record<number, FillAnswer> =>
  Object.fromEntries(qs.map((q) => [q.no, { choice: '', choices: [], text: '' }]));

/** 送出前檢查(同後端;回傳錯誤訊息,空陣列 = 可送出) */
export function fillErrors(qs: readonly QaQuestion[], state: Record<number, FillAnswer>): string[] {
  const out: string[] = [];
  for (const q of qs) {
    const a = state[q.no];
    if (!q.type || !a) continue;
    if (q.type === 'text') {
      if (q.required && !a.text.trim()) out.push(`題${q.no} 問答題為必填,請確認填寫內容!`);
      if (a.text.trim().length > 300) out.push(`題${q.no} 回答超過 300 字`);
    } else if (q.type === 'single') {
      if (q.required && !a.choice) out.push(`題${q.no} 單選題為必填,請確認選項!`);
    } else {
      if (q.required && !a.choices.length) out.push(`題${q.no} 複選題為必填,請確認選項!`);
      if (q.limit !== null && a.choices.length > q.limit) out.push(`題${q.no} 複選題選項超過${q.limit}項,請確認選項!`);
    }
  }
  return out;
}

export function toAnswers(qs: readonly QaQuestion[], state: Record<number, FillAnswer>): QaAnswer[] {
  return qs
    .filter((q) => q.type)
    .map((q) => {
      const a = state[q.no] ?? { choice: '', choices: [], text: '' };
      if (q.type === 'text') return { no: q.no, text: a.text.trim() };
      if (q.type === 'single') return { no: q.no, choices: a.choice ? [a.choice] : [] };
      return { no: q.no, choices: q.options.filter((o) => a.choices.includes(o)) };
    });
}

/** 複選題切換勾選;已達上限時不再加入 */
export function toggleChoice(q: QaQuestion, a: FillAnswer, option: string, on: boolean): void {
  if (!on) a.choices = a.choices.filter((c) => c !== option);
  else if (!a.choices.includes(option) && (q.limit === null || a.choices.length < q.limit)) a.choices = [...a.choices, option];
}

// ───────────── 前言 / 結語 ─────────────

/**
 * 舊資料有 CKEditor HTML 也有純文字(後端已白名單清洗,特殊字元已轉成實體):
 * 沒有標籤的純文字把換行轉 <br>(同舊站 \r → <br />);呼叫端一律再經 web-kit sanitizeHtml 才 v-html
 */
export const toDisplayHtml = (s: string): string => (/<[a-z][^>]*>/i.test(s) ? s : s.replace(/\r?\n/g, '<br>'));

// ───────────── 出題 ─────────────

export const QA_TYPES: { label: string; value: QaQuestionType }[] = [
  { label: '單選題', value: 'single' },
  { label: '複選題', value: 'multi' },
  { label: '問答題', value: 'text' },
];

/** 舊頁的主辦單位下拉(QuestSetting.aspx:311-317) */
export const QA_DEPTS = ['行政部', '人力資源部', '資訊服務部', '福委會', '其他'];

/** 舊頁的選項範本(QuestSetting.aspx.cs:142-350) */
export const OPTION_TEMPLATES: Record<string, string[]> = {
  滿意程度: ['很滿意', '滿意', '尚可', '不滿意', '很不滿意', '不清楚'],
  滿意分數: ['100 分', '90分~99分', '80分~89分', '70分~79分', '60分~69分', '50分~59分', '40分~49分', '30分~39分', '20分~29分', '10分~19分', '01分~09分', '0分'],
  同意程度: ['非常同意', '同意', '普通', '不同意', '非常不同意'],
};

export interface EditQuestion {
  type: QaQuestionType;
  text: string;
  /** 選項一行一個 */
  optionsText: string;
  /** 複選上限;'' = 不限 */
  limit: string;
  required: boolean;
  image: QaImage | null;
  legacyImage: boolean;
}

export const newQuestion = (): EditQuestion => ({ type: 'single', text: '', optionsText: '', limit: '', required: true, image: null, legacyImage: false });

export const splitOptions = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

export const fromQuestion = (q: QaQuestion): EditQuestion => ({
  type: q.type ?? 'text',
  text: q.text,
  optionsText: q.options.join('\n'),
  limit: q.limit === null ? '' : String(q.limit),
  required: q.required,
  image: q.image,
  legacyImage: q.legacyImage,
});

export function toQuestionInput(q: EditQuestion): QaQuestionInput {
  const choice = q.type === 'single' || q.type === 'multi';
  return {
    type: q.type,
    text: q.text.trim(),
    ...(choice ? { options: splitOptions(q.optionsText) } : {}),
    ...(q.type === 'multi' ? { limit: q.limit.trim() ? Number(q.limit) : null } : {}),
    required: q.required,
    image: q.image
      ? { ...q.image, width: Math.max(0, Math.trunc(Number(q.image.width) || 0)), height: Math.max(0, Math.trunc(Number(q.image.height) || 0)) }
      : null,
  };
}

/** 題目移動(上移 / 下移);題號依順序重編 */
export function moveQuestion<T>(list: T[], i: number, delta: -1 | 1): T[] {
  const j = i + delta;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/** 出題畫面的檢查(後端仍會再驗);回傳錯誤訊息 */
export function surveyErrors(input: QaSurveyInput): string[] {
  const out: string[] = [];
  if (!input.title.trim()) out.push('請輸入標題');
  if (/[<>]/.test(input.title)) out.push('標題不可包含 < >');
  if (!input.startDate || !input.endDate) out.push('請輸入開始日與結束日');
  else if (input.endDate < input.startDate) out.push('結束日不可早於開始日');
  if (!input.targets.all && !input.targets.depts.length && !input.targets.emps.length) out.push('請設定填寫對象(全集團、部門或人員)');
  if (!input.questions.length) out.push('至少要有一題');
  input.questions.forEach((q, i) => {
    const no = i + 1;
    if (!q.text) out.push(`題 ${no} 題目不可空白`);
    if (/[<>]/.test(q.text)) out.push(`題 ${no} 題目不可包含 < >`);
    if ((q.type === 'single' || q.type === 'multi') && !q.options?.length) out.push(`題 ${no} 單 / 複選題至少要有一個選項`);
    if (q.options && new Set(q.options).size !== q.options.length) out.push(`題 ${no} 選項重複`);
    if (q.options?.some((o) => o.includes('●') || /[<>]/.test(o))) out.push(`題 ${no} 選項不可包含「●」或 < >`);
    if (q.type === 'multi' && q.limit !== null && q.limit !== undefined && (!Number.isInteger(q.limit) || q.limit < 1 || q.limit > (q.options?.length ?? 0)))
      out.push(`題 ${no} 複選上限需介於 1 與選項數之間`);
  });
  return out;
}

// ───────────── 對象 ─────────────

/** 工號清單:逗號、空白、換行分隔;轉大寫、去重複 */
export function parseEmpList(text: string): string[] {
  const seen = new Set<string>();
  for (const s of text.split(/[\s,，、;]+/)) {
    const v = s.trim().toUpperCase();
    if (v) seen.add(v);
  }
  return [...seen];
}

export interface DeptNode {
  code: string;
  name: string;
  children: DeptNode[];
}

/** 部門樹(LOS DeptInfo 的上層代碼);上層不存在的部門當作根 */
export function buildDeptTree(depts: readonly QaDept[]): DeptNode[] {
  const nodes = new Map<string, DeptNode>(depts.map((d) => [d.code, { code: d.code, name: d.name ?? d.code, children: [] }]));
  const roots: DeptNode[] = [];
  for (const d of depts) {
    const n = nodes.get(d.code)!;
    const p = d.parent && d.parent !== d.code ? nodes.get(d.parent) : undefined;
    (p ? p.children : roots).push(n);
  }
  return roots;
}

/** 部門與其所有下層的代碼(含下層展開;避免資料有循環) */
export function withDescendants(code: string, depts: readonly QaDept[]): string[] {
  const children = new Map<string, string[]>();
  for (const d of depts) if (d.parent) children.set(d.parent, [...(children.get(d.parent) ?? []), d.code]);
  const out = new Set<string>();
  const stack = [code];
  while (stack.length) {
    const c = stack.pop()!;
    if (out.has(c)) continue;
    out.add(c);
    stack.push(...(children.get(c) ?? []));
  }
  return [...out];
}

/** 加入部門(含下層)到對象 */
export function addDepts(targets: QaTargets, code: string, depts: readonly QaDept[]): QaTargets {
  return { ...targets, depts: [...new Set([...targets.depts, ...withDescendants(code, depts)])] };
}

/** 對象摘要文字 */
export function targetSummary(t: QaTargets): string {
  if (t.all) return '全集團';
  const parts: string[] = [];
  if (t.depts.length) parts.push(`部門 ${t.depts.length} 個`);
  if (t.emps.length) parts.push(`人員 ${t.emps.length} 位`);
  return parts.join('、') || '未設定';
}
