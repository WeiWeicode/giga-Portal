/**
 * 問卷調查的純邏輯(FEATURE-PLAN §3.4;PORTAL-API-PLAN D-18、D-19、D-28;docs/Gherkin/resources/qa.feature)。不做 I/O。
 * 舊表(PortalSolar,與舊入口網共用,D-7)的欄位寫法:
 *   QAAnnual  Kdept / Kpep:逗號分隔(舊資料常有結尾逗號、nchar 補空白);Kdept = "all" 表示全集團
 *   QAAnnualB Type:單選題 / 複選題 / 問答題;SubItem:選項以「●」串接(結尾也有「●」);LimNo:-1 = 不限;IsWrite:Y = 必填
 *   QAAnnualC 每題一列、複選題每個勾選項一列;人事屬性 CPF* / CPK02 寫 NULL(D-18)
 *   QAAnnualD 題目圖片:舊站以題目文字(Item)綁定;新站以題號綁定(Item = "#<題號>",FileName = file-service UUID,D-28)
 */

export type QuestionType = 'single' | 'multi' | 'text';

/** 舊表題型文字 */
export const LEGACY_TYPE: Readonly<Record<QuestionType, string>> = { single: '單選題', multi: '複選題', text: '問答題' };

/** 舊表題型 → 新題型;空白或不認得(舊資料有 3 題)回 null:填答頁不顯示輸入、不寫作答(同舊程式) */
export function parseType(raw: string | null | undefined): QuestionType | null {
  const t = (raw ?? '').trim();
  if (t === LEGACY_TYPE.single) return 'single';
  if (t === LEGACY_TYPE.multi) return 'multi';
  if (t === LEGACY_TYPE.text) return 'text';
  return null;
}

export const OPTION_SEP = '●';

/** SubItem → 選項(去掉空白項,同 QuestView.aspx.cs:174-183) */
export const parseOptions = (raw: string | null | undefined): string[] =>
  (raw ?? '')
    .split(OPTION_SEP)
    .map((s) => s.trim())
    .filter((s) => s !== '');

/** 選項 → SubItem(照舊格式結尾加「●」) */
export const serializeOptions = (options: readonly string[]): string => (options.length ? options.join(OPTION_SEP) + OPTION_SEP : '');

/** LimNo → 複選上限;-1、0、NULL 為不限(null) */
export const parseLimit = (raw: number | null | undefined): number | null => (raw !== null && raw !== undefined && raw > 0 ? raw : null);

/** 逗號清單(Kdept / Kpep)→ 去空白、去重複(不分大小寫) */
export function parseList(raw: string | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of (raw ?? '').split(',')) {
    const v = s.trim();
    if (!v || seen.has(v.toUpperCase())) continue;
    seen.add(v.toUpperCase());
    out.push(v);
  }
  return out;
}

/** 清單 → 舊格式(結尾加逗號:舊首頁以 LIKE '%,工號,%' 比對,只有一個工號時也比對得到) */
export const serializeList = (items: readonly string[]): string => (items.length ? items.join(',') + ',' : '');

export interface Targets {
  /** 全集團(Kdept = "all") */
  all: boolean;
  /** 部門代碼(含下層已在選擇時展開;比對為完整比對) */
  depts: string[];
  /** 工號 */
  emps: string[];
}

export function parseTargets(kdept: string | null | undefined, kpep: string | null | undefined): Targets {
  const depts = parseList(kdept);
  const all = depts.some((d) => d.toLowerCase() === 'all');
  return { all, depts: all ? [] : depts, emps: parseList(kpep) };
}

export function serializeTargets(t: Targets): { kdept: string; kpep: string } {
  return { kdept: t.all ? 'all' : serializeList(t.depts), kpep: serializeList(t.emps) };
}

/**
 * 對象是否符合(FEATURE-PLAN §3.4):全集團;或本人部門**完整比對**在部門清單(舊版 LIKE 部分比對,S14 會比到 S1420);
 * 或工號在工號清單(以逗號切開比對,不分大小寫;舊資料有小寫工號)
 */
export function isTarget(t: Targets, empNo: string, dept: string | null): boolean {
  if (t.all) return true;
  const d = dept?.trim().toUpperCase();
  if (d && t.depts.some((x) => x.toUpperCase() === d)) return true;
  const e = empNo.trim().toUpperCase();
  return t.emps.some((x) => x.toUpperCase() === e);
}

/** 今天(YYYY-MM-DD)是否在起訖日內(含兩端;日期未設定的問卷不開放,同舊首頁) */
export const inPeriod = (start: string | null, end: string | null, today: string): boolean => !!start && !!end && start <= today && today <= end;

// ───────────── 題目 ─────────────

export interface QuestionImage {
  /** giga-file-service 檔案 UUID */
  fileId: string;
  position: 'before' | 'after';
  /** 0 = 不指定 */
  width: number;
  height: number;
}

export interface Question {
  no: number;
  type: QuestionType | null;
  text: string;
  options: string[];
  /** 複選上限;null = 不限 */
  limit: number | null;
  required: boolean;
  image: QuestionImage | null;
  /** 舊站上傳的圖片(以題目文字綁定、存在舊網站目錄):新入口網不顯示 */
  legacyImage: boolean;
}

/** 舊表一列題目 */
export interface QuestionRow {
  No: number | null;
  Type: string | null;
  LimNo: number | null;
  Item: string | null;
  SubItem: string | null;
  IsWrite: string | null;
}

/** 舊表一列圖片 */
export interface ImageRow {
  Item: string | null;
  FileName: string | null;
  Position: number | null;
  Width: number | null;
  Height: number | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isFileId = (s: string | null | undefined) => !!s && UUID.test(s.trim());

/** 新站圖片的 QAAnnualD.Item(以題號綁定) */
export const imageKey = (no: number) => `#${no}`;

export function buildQuestions(rows: readonly QuestionRow[], images: readonly ImageRow[]): Question[] {
  return rows
    .filter((r) => r.No !== null)
    .sort((a, b) => a.No! - b.No!)
    .map((r) => {
      const no = r.No!;
      const text = (r.Item ?? '').trim();
      const img = images.find((d) => isFileId(d.FileName) && (d.Item ?? '').trim() === imageKey(no));
      const legacy = images.some((d) => !isFileId(d.FileName) && (d.Item ?? '').trim() === text && text !== '');
      const type = parseType(r.Type);
      return {
        no,
        type,
        text,
        options: type === 'single' || type === 'multi' ? parseOptions(r.SubItem) : [],
        limit: type === 'multi' ? parseLimit(r.LimNo) : null,
        required: (r.IsWrite ?? '').trim().toUpperCase() === 'Y',
        image: img
          ? { fileId: img.FileName!.trim().toLowerCase(), position: img.Position === 0 ? 'before' : 'after', width: img.Width ?? 0, height: img.Height ?? 0 }
          : null,
        legacyImage: legacy,
      };
    });
}

/** 編輯畫面送來的題目(題號依陣列順序 1..N) */
export interface QuestionInput {
  type: QuestionType;
  text: string;
  options?: string[];
  limit?: number | null;
  required: boolean;
  /** 寬高省略為 0(不指定) */
  image?: (Pick<QuestionImage, 'fileId' | 'position'> & { width?: number; height?: number }) | null;
}

export interface NormalizedQuestion {
  no: number;
  type: QuestionType;
  text: string;
  options: string[];
  limit: number | null;
  required: boolean;
  image: QuestionImage | null;
}

export class RuleError extends Error {
  constructor(
    message: string,
    readonly details?: { field: string; message: string }[],
  ) {
    super(message);
  }
}

/** 舊表欄位長度:Item nvarchar(200)、SubItem nvarchar(3000) */
export const ITEM_MAX = 200;
export const SUBITEM_MAX = 3000;
/** 舊站以 Label 輸出不做 HTML 編碼:題目、選項、標題不允許 < >(並行期新站寫入的內容會在舊站顯示) */
const NO_ANGLE = /[<>]/;

export function normalizeQuestions(input: readonly QuestionInput[]): NormalizedQuestion[] {
  const errors: { field: string; message: string }[] = [];
  const out = input.map((q, i): NormalizedQuestion => {
    const no = i + 1;
    const f = `questions/${i}`;
    const text = q.text.trim();
    if (!text) errors.push({ field: `${f}/text`, message: `題 ${no} 題目不可空白` });
    if (text.length > ITEM_MAX) errors.push({ field: `${f}/text`, message: `題 ${no} 題目超過 ${ITEM_MAX} 字` });
    if (NO_ANGLE.test(text)) errors.push({ field: `${f}/text`, message: `題 ${no} 題目不可包含 < >` });
    const choice = q.type === 'single' || q.type === 'multi';
    const options = choice ? (q.options ?? []).map((o) => o.trim()).filter((o) => o !== '') : [];
    if (choice) {
      if (!options.length) errors.push({ field: `${f}/options`, message: `題 ${no} 單 / 複選題至少要有一個選項` });
      if (new Set(options).size !== options.length) errors.push({ field: `${f}/options`, message: `題 ${no} 選項重複` });
      if (options.some((o) => o.includes(OPTION_SEP) || NO_ANGLE.test(o)))
        errors.push({ field: `${f}/options`, message: `題 ${no} 選項不可包含「${OPTION_SEP}」或 < >` });
      if (serializeOptions(options).length > SUBITEM_MAX) errors.push({ field: `${f}/options`, message: `題 ${no} 選項總長度超過 ${SUBITEM_MAX} 字` });
    }
    let limit: number | null = null;
    if (q.type === 'multi' && q.limit !== null && q.limit !== undefined) {
      if (!Number.isInteger(q.limit) || q.limit < 1 || q.limit > options.length)
        errors.push({ field: `${f}/limit`, message: `題 ${no} 複選上限需介於 1 與選項數之間` });
      else limit = q.limit === options.length ? null : q.limit;
    }
    const image: QuestionImage | null = q.image
      ? { fileId: q.image.fileId.toLowerCase(), position: q.image.position, width: q.image.width ?? 0, height: q.image.height ?? 0 }
      : null;
    return { no, type: q.type, text, options, limit, required: q.required, image };
  });
  if (!out.length) errors.push({ field: 'questions', message: '至少要有一題' });
  if (errors.length) throw new RuleError('題目設定有誤', errors);
  return out;
}

/** 已有作答時題目結構鎖定:題數、題號、題型、選項、複選上限、必填不可改(只能改題目文字、圖片) */
export function structureChanges(current: readonly Question[], next: readonly NormalizedQuestion[]): string[] {
  const out: string[] = [];
  if (current.length !== next.length) return [`題數不可變更(目前 ${current.length} 題)`];
  current.forEach((c, i) => {
    const n = next[i]!;
    const type = c.type ?? 'text';
    if (c.no !== n.no) out.push(`題號不可變更`);
    if (type !== n.type) out.push(`題 ${c.no} 題型不可變更`);
    if (c.options.length !== n.options.length || c.options.some((o, j) => o !== n.options[j])) out.push(`題 ${c.no} 選項不可變更`);
    if (type === 'multi' && c.limit !== n.limit) out.push(`題 ${c.no} 複選上限不可變更`);
    if (c.required !== n.required) out.push(`題 ${c.no} 必填設定不可變更`);
  });
  return out;
}

// ───────────── 填答 ─────────────

export interface AnswerInput {
  no: number;
  /** 單選 / 複選:勾選的選項文字 */
  choices?: string[];
  /** 問答題 */
  text?: string;
}

/** 寫入 QAAnnualC 的一列 */
export interface AnswerRow {
  no: number;
  answer: string;
}

/** 舊表 Answer nvarchar(300) */
export const ANSWER_MAX = 300;

/**
 * 驗證作答並轉成 QAAnnualC 列(後端再驗,舊版只在畫面檢查;訊息沿用 QuestView.aspx.cs:217-297):
 *   - 必填、單選只能一項且必須是選項、複選不可超過上限且必須是選項、問答題 ≤ 300 字
 *   - 問答 / 單選:每題一列,未作答寫空字串(同舊程式,讓舊報表筆數一致);複選:每個勾選項一列(全部勾選項都寫,修正舊版)
 *   - 題型不明的舊題目不寫;送來不存在的題號視為錯誤
 */
export function buildAnswerRows(questions: readonly Question[], answers: readonly AnswerInput[]): AnswerRow[] {
  const errors: { field: string; message: string }[] = [];
  const byNo = new Map<number, AnswerInput>();
  for (const a of answers) {
    if (byNo.has(a.no)) errors.push({ field: `answers/${a.no}`, message: `題 ${a.no} 重複作答` });
    byNo.set(a.no, a);
  }
  const known = new Set(questions.map((q) => q.no));
  for (const no of byNo.keys()) if (!known.has(no)) errors.push({ field: `answers/${no}`, message: `題 ${no} 不存在` });

  const rows: AnswerRow[] = [];
  for (const q of questions) {
    if (!q.type) continue;
    const a = byNo.get(q.no);
    const field = `answers/${q.no}`;
    if (q.type === 'text') {
      // 舊站統計頁以 Label 輸出答案不做 HTML 編碼(MyQAList.aspx:181):< > 改為全形,避免並行期在舊站執行
      const text = (a?.text ?? '').trim().replace(/</g, '＜').replace(/>/g, '＞');
      if (a?.choices?.length) errors.push({ field, message: `題 ${q.no} 問答題不可勾選選項` });
      if (q.required && !text) errors.push({ field, message: `題${q.no} 問答題為必填,請確認填寫內容!` });
      if (text.length > ANSWER_MAX) errors.push({ field, message: `題 ${q.no} 回答超過 ${ANSWER_MAX} 字` });
      rows.push({ no: q.no, answer: text });
      continue;
    }
    const picked = (a?.choices ?? []).map((c) => c.trim());
    if (a?.text) errors.push({ field, message: `題 ${q.no} 選擇題不可填寫文字` });
    if (picked.some((c) => !q.options.includes(c))) errors.push({ field, message: `題 ${q.no} 選項不存在` });
    if (new Set(picked).size !== picked.length) errors.push({ field, message: `題 ${q.no} 選項重複` });
    if (q.type === 'single') {
      if (picked.length > 1) errors.push({ field, message: `題 ${q.no} 單選題只能選一項` });
      if (q.required && !picked.length) errors.push({ field, message: `題${q.no} 單選題為必填,請確認選項!` });
      rows.push({ no: q.no, answer: picked[0] ?? '' });
      continue;
    }
    if (q.required && !picked.length) errors.push({ field, message: `題${q.no} 複選題為必填,請確認選項!` });
    if (q.limit !== null && picked.length > q.limit) errors.push({ field, message: `題${q.no} 複選題選項超過${q.limit}項,請確認選項!` });
    // 依選項順序寫入(與畫面順序一致)
    for (const o of q.options) if (picked.includes(o)) rows.push({ no: q.no, answer: o });
  }
  if (errors.length) throw new RuleError('作答內容有誤', errors);
  return rows;
}

// ───────────── 統計 ─────────────

export interface AnswerCount {
  no: number;
  answer: string;
  count: number;
}

export interface QuestionStats {
  no: number;
  text: string;
  type: QuestionType | null;
  /** 有作答(非空白)的人數 */
  answered: number;
  items: { answer: string; count: number; percent: number }[];
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

/**
 * 每題答案分布(FEATURE-PLAN §3.4):人數與百分比,分母 = 作答人數(舊版分母 = 答案列數,複選題會被稀釋)。
 * 單 / 複選題先列出全部選項(0 人也列),再列不在選項中的舊答案;問答題依答案文字分組。空白答案不列(計入未作答)。
 * answeredBy:每題有非空白作答的不重複人數。
 */
export function buildStats(
  questions: readonly Question[],
  counts: readonly AnswerCount[],
  respondents: number,
  answeredBy: ReadonlyMap<number, number>,
): QuestionStats[] {
  return questions.map((q) => {
    const mine = counts.filter((c) => c.no === q.no && c.answer.trim() !== '');
    const byAnswer = new Map<string, number>();
    for (const c of mine) byAnswer.set(c.answer.trim(), (byAnswer.get(c.answer.trim()) ?? 0) + c.count);
    const items: { answer: string; count: number; percent: number }[] = [];
    for (const o of q.options) {
      items.push({ answer: o, count: byAnswer.get(o) ?? 0, percent: pct(byAnswer.get(o) ?? 0, respondents) });
      byAnswer.delete(o);
    }
    const rest = [...byAnswer.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    for (const [answer, count] of rest) items.push({ answer, count, percent: pct(count, respondents) });
    return { no: q.no, text: q.text, type: q.type, answered: answeredBy.get(q.no) ?? 0, items };
  });
}

// ───────────── 編號與時間 ─────────────

/** 台灣時間(UTC+8)的各欄位 */
export function twParts(now = Date.now()) {
  const d = new Date(now + 8 * 3600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
    time: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`,
    stamp: `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`,
  };
}

/** 新問卷編號 = "Q" + yyyyMMddHHmmss + 工號(同 QuestSetting.aspx.cs:595) */
export const newQaNo = (empNo: string, now = Date.now()) => `Q${twParts(now).stamp}${empNo}`;

/** 複製時標題加 "Copy"(同 MyQAList.aspx.cs:131-160);超過欄位長度時截斷原標題 */
export const copyTitle = (title: string, max = 400) => `${title.slice(0, max - 4)}Copy`;
