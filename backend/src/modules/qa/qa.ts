/**
 * 問卷調查服務(FEATURE-PLAN §3.4;PORTAL-API-PLAN D-18、D-19、D-28;docs/Gherkin/resources/qa.feature)。
 *   填答者(所有員工):我的待填問卷 → 填答(後端再驗資格、必填 / 複選上限,整份一個交易,已填過 409)
 *   出題者(portal.qa.edit):只看 / 改自己建立的(CLgNo = 本人);代管(portal.qa.admin):全部
 *   身分只取內部 Token(工號、部門);資料存取在 MssqlQaRepo(repo.ts)
 */
import { AppError, dataAccessDenied } from '../../errors.js';
import type { Employee } from '../../identity.js';
import { MAX_HTML_CHARS, sanitizeQaHtml } from './html.js';
import {
  buildAnswerRows,
  buildStats,
  copyTitle,
  inPeriod,
  isTarget,
  newQaNo,
  normalizeQuestions,
  parseTargets,
  RuleError,
  serializeTargets,
  structureChanges,
  twParts,
  type AnswerCount,
  type AnswerInput,
  type AnswerRow,
  type NormalizedQuestion,
  type Question,
  type QuestionInput,
  type QuestionStats,
  type Targets,
} from './rules.js';

export interface SurveyHeader {
  qaNo: string;
  title: string;
  /** 主辦單位(QADept) */
  dept: string | null;
  /** 前言 / 結語(HTML,未清洗的原始資料) */
  intro: string | null;
  outro: string | null;
  /** YYYY-MM-DD */
  startDate: string | null;
  endDate: string | null;
  kdept: string | null;
  kpep: string | null;
  creator: string | null;
  active: boolean;
}

export interface Survey extends SurveyHeader {
  questions: Question[];
}

export interface SurveyListRow {
  qaNo: string;
  title: string;
  dept: string | null;
  startDate: string | null;
  endDate: string | null;
  creator: string | null;
  active: boolean;
  questionCount: number;
  respondents: number;
}

export interface SurveyWrite {
  title: string;
  dept: string;
  intro: string;
  outro: string;
  startDate: string;
  endDate: string;
  kdept: string;
  kpep: string;
  questions: NormalizedQuestion[];
}

/** update 時於交易內決定寫入範圍:full = 重建題目;text = 結構鎖定,只改題目文字與圖片 */
export type UpdateMode = 'full' | 'text';

export interface ListFilter {
  /** null = 全部出題者(代管) */
  creator: string | null;
  /** 標題關鍵字 */
  q?: string;
  /** 只列今天在起訖日內的(YYYY-MM-DD) */
  today?: string;
}

export interface ExportRow {
  dept: string | null;
  empNo: string;
  name: string | null;
  no: number;
  question: string | null;
  answer: string | null;
  /** yyyy/MM/dd HH:mm:ss */
  answeredAt: string | null;
}

export interface Dept {
  code: string;
  name: string | null;
  parent: string | null;
}

export interface QaRepo {
  /** 開放中(IsActive = 1、今天在起訖日內)的問卷與題數 */
  openSurveys(today: string): Promise<(SurveyHeader & { questionCount: number })[]>;
  /** 本人已作答的問卷編號 */
  answered(empNo: string, qaNos: readonly string[]): Promise<Set<string>>;
  get(qaNo: string): Promise<Survey | null>;
  /** 交易內:鎖定並重新讀取問卷與本人作答狀態,由 build 驗證並產生作答列後寫入 */
  submit(qaNo: string, empNo: string, answeredAt: string, build: (s: Survey | null, alreadyAnswered: boolean) => AnswerRow[]): Promise<void>;
  list(filter: ListFilter, page: number, pageSize: number): Promise<{ items: SurveyListRow[]; total: number }>;
  /** 已存在同編號回 false */
  create(qaNo: string, creator: string, w: SurveyWrite): Promise<boolean>;
  /** 交易內:鎖定並讀取現況與作答人數,由 guard 檢查(擁有者、結構鎖定)並決定寫入範圍 */
  update(qaNo: string, w: SurveyWrite, guard: (s: Survey | null, respondents: number) => UpdateMode): Promise<void>;
  softDelete(qaNo: string): Promise<boolean>;
  /** 複製主檔、題目、圖片(不複製作答);新編號已存在回 false */
  copy(from: string, to: string, creator: string, title: string): Promise<boolean>;
  respondents(qaNo: string): Promise<number>;
  answerCounts(qaNo: string): Promise<{ respondents: number; counts: AnswerCount[]; answeredBy: Map<number, number> }>;
  exportRows(qaNo: string): Promise<ExportRow[]>;
  departments(): Promise<Dept[]>;
}

/** 職級快速帶入(「理級以上 / 課級以上」):Gateway 職級(gw.user.job_level,BPM FunctionLevel)由 Gateway 提供,介面待確認 */
export type JobTier = 'section' | 'manager';
export interface JobTierDirectory {
  /** 指定公司(Token cos)中職級達門檻的在職工號 */
  employees(tier: JobTier, companies: readonly string[]): Promise<string[]>;
}

export interface SurveyInput {
  title: string;
  dept?: string;
  intro?: string;
  outro?: string;
  startDate: string;
  endDate: string;
  targets: Targets;
  questions: QuestionInput[];
}

/** 給畫面的問卷(前言 / 結語已清洗) */
export interface SurveyView {
  qaNo: string;
  title: string;
  dept: string | null;
  intro: string;
  outro: string;
  startDate: string | null;
  endDate: string | null;
  questions: Question[];
}

export interface SurveyDetail extends SurveyView {
  creator: string | null;
  active: boolean;
  targets: Targets;
  respondents: number;
  /** 已有作答:題目結構鎖定 */
  locked: boolean;
}

/** 出題者的範圍:admin = portal.qa.admin 代管全部,否則只限本人建立的 */
export interface Scope {
  empNo: string;
  admin: boolean;
}

export const qaNotFound = () => new AppError(404, 'PORTAL_QA_NOT_FOUND', '找不到此問卷,或問卷已截止 / 不在填寫對象內');
export const qaAnswered = () => new AppError(409, 'PORTAL_QA_ANSWERED', '您已作過此問卷,謝謝!');
const invalid = (e: RuleError) => new AppError(400, 'PORTAL_QA_INVALID', e.message, e.details);

/** 舊表欄位長度與格式 */
const TITLE_MAX = 400;
const DEPT_MAX = 20;
const LIST_MAX = 3000;
const DEPT_CODE = /^[A-Za-z0-9_-]{1,20}$/;
const EMP_NO = /^[A-Za-z0-9]{1,20}$/;
const NO_ANGLE = /[<>]/;
/** CLgNo nvarchar(10) */
export const CREATOR_MAX = 10;

const view = (s: Survey): SurveyView => ({
  qaNo: s.qaNo,
  title: s.title,
  dept: s.dept,
  intro: sanitizeQaHtml(s.intro),
  outro: sanitizeQaHtml(s.outro),
  startDate: s.startDate,
  endDate: s.endDate,
  questions: s.questions,
});

export class QaService {
  constructor(
    private readonly repo: QaRepo,
    private readonly tiers: JobTierDirectory | null = null,
    private readonly now: () => number = Date.now,
  ) {}

  private today() {
    return twParts(this.now()).date;
  }

  /** 填寫資格:啟用、今天在起訖日內、在對象內 */
  private eligible(s: SurveyHeader, me: Employee): boolean {
    return s.active && inPeriod(s.startDate, s.endDate, this.today()) && isTarget(parseTargets(s.kdept, s.kpep), me.empNo, me.dept);
  }

  /** 我的待填問卷(FEATURE-PLAN §3.4) */
  async pending(me: Employee) {
    const open = (await this.repo.openSurveys(this.today())).filter((s) => isTarget(parseTargets(s.kdept, s.kpep), me.empNo, me.dept));
    const done = await this.repo.answered(
      me.empNo,
      open.map((s) => s.qaNo),
    );
    return open
      .filter((s) => !done.has(s.qaNo))
      .sort((a, b) => (a.endDate ?? '').localeCompare(b.endDate ?? '') || a.qaNo.localeCompare(b.qaNo))
      .map((s) => ({ qaNo: s.qaNo, title: s.title, dept: s.dept, startDate: s.startDate, endDate: s.endDate, questionCount: s.questionCount }));
  }

  /** 填答畫面:不符資格回 404(不透露問卷是否存在),已填過回 409 */
  async forFill(me: Employee, qaNo: string): Promise<SurveyView> {
    const s = await this.repo.get(qaNo);
    if (!s || !this.eligible(s, me)) throw qaNotFound();
    if ((await this.repo.answered(me.empNo, [qaNo])).has(qaNo)) throw qaAnswered();
    return view(s);
  }

  /** 送出作答:交易內再驗資格與是否已填過,再驗必填 / 複選上限;QATimes = 台灣時間 */
  async submit(me: Employee, qaNo: string, answers: readonly AnswerInput[]): Promise<{ answeredAt: string }> {
    // QAAnnualC.LgNo nvarchar(20)
    if (me.empNo.length > 20) throw new AppError(400, 'VALIDATION_FAILED', '工號長度超過舊表欄位');
    const t = twParts(this.now());
    const answeredAt = `${t.date} ${t.time}`;
    await this.repo.submit(qaNo, me.empNo, answeredAt, (s, already) => {
      if (!s || !this.eligible(s, me)) throw qaNotFound();
      if (already) throw qaAnswered();
      try {
        return buildAnswerRows(s.questions, answers);
      } catch (e) {
        if (e instanceof RuleError) throw invalid(e);
        throw e;
      }
    });
    return { answeredAt };
  }

  // ───────────── 出題者 ─────────────

  private own(s: Survey | null, scope: Scope): Survey {
    if (!s || !s.active) throw qaNotFound();
    if (!scope.admin && (s.creator ?? '').trim().toUpperCase() !== scope.empNo.trim().toUpperCase()) throw dataAccessDenied('只能管理自己建立的問卷');
    return s;
  }

  async list(scope: Scope, opts: { q?: string; current?: boolean; creator?: string }, page: number, pageSize: number) {
    const filter: ListFilter = {
      creator: scope.admin ? opts.creator?.trim() || null : scope.empNo,
      ...(opts.q?.trim() ? { q: opts.q.trim() } : {}),
      ...(opts.current ? { today: this.today() } : {}),
    };
    const r = await this.repo.list(filter, page, pageSize);
    return { items: r.items.map((x) => ({ ...x, locked: x.respondents > 0 })), total: r.total, page, pageSize };
  }

  async detail(scope: Scope, qaNo: string): Promise<SurveyDetail> {
    const s = this.own(await this.repo.get(qaNo), scope);
    const respondents = await this.repo.respondents(qaNo);
    return { ...view(s), creator: s.creator, active: s.active, targets: parseTargets(s.kdept, s.kpep), respondents, locked: respondents > 0 };
  }

  /** 驗證並轉成舊表寫法 */
  private toWrite(input: SurveyInput): SurveyWrite {
    const errors: { field: string; message: string }[] = [];
    const title = input.title.trim();
    const dept = (input.dept ?? '').trim();
    if (!title || title.length > TITLE_MAX || NO_ANGLE.test(title)) errors.push({ field: 'title', message: `標題需 1~${TITLE_MAX} 字且不可包含 < >` });
    if (dept.length > DEPT_MAX || NO_ANGLE.test(dept)) errors.push({ field: 'dept', message: `主辦單位最多 ${DEPT_MAX} 字且不可包含 < >` });
    if (input.endDate < input.startDate) errors.push({ field: 'endDate', message: '結束日不可早於開始日' });
    const intro = sanitizeQaHtml(input.intro);
    const outro = sanitizeQaHtml(input.outro);
    if (intro.length > MAX_HTML_CHARS || outro.length > MAX_HTML_CHARS) errors.push({ field: 'intro', message: '前言 / 結語過長' });

    const depts = [...new Set(input.targets.depts.map((d) => d.trim()).filter(Boolean))];
    const emps = [...new Set(input.targets.emps.map((e) => e.trim().toUpperCase()).filter(Boolean))];
    if (depts.some((d) => !DEPT_CODE.test(d))) errors.push({ field: 'targets/depts', message: '部門代碼格式錯誤' });
    if (emps.some((e) => !EMP_NO.test(e))) errors.push({ field: 'targets/emps', message: '工號格式錯誤(只允許英數字)' });
    const targets: Targets = { all: input.targets.all, depts: input.targets.all ? [] : depts, emps };
    const { kdept, kpep } = serializeTargets(targets);
    if (kdept.length > LIST_MAX) errors.push({ field: 'targets/depts', message: `對象部門過多(超過舊表 ${LIST_MAX} 字)` });
    if (kpep.length > LIST_MAX) errors.push({ field: 'targets/emps', message: `對象人員過多(超過舊表 ${LIST_MAX} 字)` });
    if (!targets.all && !targets.depts.length && !targets.emps.length) errors.push({ field: 'targets', message: '請設定填寫對象(全集團、部門或人員)' });

    let questions: NormalizedQuestion[] = [];
    try {
      questions = normalizeQuestions(input.questions);
    } catch (e) {
      if (!(e instanceof RuleError)) throw e;
      errors.push(...(e.details ?? []));
    }
    if (errors.length) throw invalid(new RuleError('問卷設定有誤', errors));
    return { title, dept, intro, outro, startDate: input.startDate, endDate: input.endDate, kdept, kpep, questions };
  }

  /** 新增:編號 Q + yyyyMMddHHmmss + 工號,CLgNo = 本人;同一秒重複時往後順延 */
  async create(me: Employee, input: SurveyInput): Promise<{ qaNo: string }> {
    if (me.empNo.length > CREATOR_MAX) throw new AppError(400, 'VALIDATION_FAILED', '工號長度超過舊表欄位');
    const w = this.toWrite(input);
    for (let i = 0; i < 5; i++) {
      const qaNo = newQaNo(me.empNo, this.now() + i * 1000);
      if (await this.repo.create(qaNo, me.empNo, w)) return { qaNo };
    }
    throw new AppError(409, 'PORTAL_QA_CONFLICT', '問卷編號重複,請稍後再試');
  }

  /** 編輯:不改 CLgNo;已有作答時題目結構鎖定(409 PORTAL_QA_LOCKED),只能改文字、圖片、對象與起訖日 */
  async update(scope: Scope, qaNo: string, input: SurveyInput): Promise<void> {
    const w = this.toWrite(input);
    await this.repo.update(qaNo, w, (s, respondents) => {
      const cur = this.own(s, scope);
      if (respondents === 0) return 'full';
      const changes = structureChanges(cur.questions, w.questions);
      if (changes.length)
        throw new AppError(
          409,
          'PORTAL_QA_LOCKED',
          '已有作答,題目結構不可變更',
          changes.map((m) => ({ field: 'questions', message: m })),
        );
      return 'text';
    });
  }

  /** 刪除:軟刪 IsActive = 0(題目、作答保留,同舊系統) */
  async remove(scope: Scope, qaNo: string): Promise<void> {
    this.own(await this.repo.get(qaNo), scope);
    if (!(await this.repo.softDelete(qaNo))) throw qaNotFound();
  }

  /** 複製:新編號與 CLgNo 用操作者(舊版沿用原出題者,複製者會看不到);標題加 Copy;不複製作答 */
  async copy(scope: Scope, me: Employee, qaNo: string): Promise<{ qaNo: string }> {
    const s = this.own(await this.repo.get(qaNo), scope);
    if (me.empNo.length > CREATOR_MAX) throw new AppError(400, 'VALIDATION_FAILED', '工號長度超過舊表欄位');
    for (let i = 0; i < 5; i++) {
      const to = newQaNo(me.empNo, this.now() + i * 1000);
      if (await this.repo.copy(qaNo, to, me.empNo, copyTitle(s.title))) return { qaNo: to };
    }
    throw new AppError(409, 'PORTAL_QA_CONFLICT', '問卷編號重複,請稍後再試');
  }

  /** 統計:每題答案分布;依人事屬性分組顯示系統轉移中(D-18) */
  async stats(scope: Scope, qaNo: string): Promise<{ qaNo: string; title: string; respondents: number; questions: QuestionStats[]; unavailable: string[] }> {
    const s = this.own(await this.repo.get(qaNo), scope);
    const r = await this.repo.answerCounts(qaNo);
    return { qaNo, title: s.title, respondents: r.respondents, questions: buildStats(s.questions, r.counts, r.respondents, r.answeredBy), unavailable: ['hr'] };
  }

  async exportRows(scope: Scope, qaNo: string): Promise<{ title: string; rows: ExportRow[] }> {
    const s = this.own(await this.repo.get(qaNo), scope);
    return { title: s.title, rows: await this.repo.exportRows(qaNo) };
  }

  departments() {
    return this.repo.departments();
  }

  /** 職級快速帶入:Gateway 尚未提供職級查詢介面時回 503 */
  async jobTier(me: Employee, tier: JobTier): Promise<string[]> {
    if (!this.tiers) throw new AppError(503, 'PORTAL_JOB_TIER_UNAVAILABLE', '職級資料尚未由 Gateway 提供,請以部門或工號設定對象');
    return this.tiers.employees(tier, me.companies);
  }
}
