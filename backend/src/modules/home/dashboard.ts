/**
 * 首頁聚合 GET /dashboard(FEATURE-PLAN §1;PRD FR-4.8;docs/Gherkin/home/home.feature)。
 * 一次回傳首頁各區塊;**每個資料來源各自 try / catch**:失敗的只在 _meta.errors 標示、該區塊回 null 或少列該項,其他區塊照常(FR-4.8)。
 * 未設定的來源(例:BPM 未設定)與尚未實作的項目(待簽同意書,P7)列在 _meta.unavailable,不算錯誤。
 *
 * 待辦事項依序合併(每項附連結):
 *   ① BPM 待簽核 / 未結案筆數(modules/bpm;簽核以「前往簽核」深連結到 BPM,D-24)
 *   ② 未填問卷(modules/qa 資格規則)
 *   ③ 未完成新人導覽 / 驗收:到職 ONBOARDING_DAYS 天內(到職日取 LOS EmployeeInfo.JobDate,TIPTOP 轉移中的替代,CONFIRM-NEEDED P3)
 *   ④ 待簽同意書(P7 未實作,unavailable: todos.consent)
 *   ⑤ 個人提醒中今天到期且未完成者
 * 只依本人(Token 工號 / 部門)資料;不檢查舊系統的 IsBoss 等旗標。
 * BPM 只對 Token 公司屬碩禾系者查詢(D-29:公司清單由設定 BPM_COMPANIES 提供,判斷在 BpmService.applies;未設定或不屬於清單時 BPM 列為 unavailable),
 * 避免其他公司本機帳號工號與 BPM 帳號撞號時看到別人的筆數。
 */
import type { BpmService } from '../bpm/bpm.js';
import type { LinkService, PersonalLink } from '../links/links.js';
import type { NoteService } from '../notes/notes.js';
import type { QaService } from '../qa/qa.js';
import { twParts } from '../qa/rules.js';
import type { Employee } from '../../identity.js';
import type { OnboardingStatus } from '../../routes/onboarding.js';
import type { ContentService, Slide } from './content.js';
import type { HireDateRepo, LegacyNews, LegacyNewsRepo } from './legacy-repo.js';

/** 新人導覽提醒期間:到職日起 N 天內(FEATURE-PLAN §1 建議 90 天) */
export const ONBOARDING_DAYS = 90;
/** 首頁舊公告筆數 */
export const HOME_NEWS_LIMIT = 8;

export type TodoKind = 'bpm-pending' | 'bpm-unclosed' | 'qa' | 'onboarding-read' | 'onboarding-quiz' | 'note';

export interface TodoItem {
  kind: TodoKind;
  title: string;
  count: number | null;
  /** YYYY-MM-DD(問卷截止日、提醒到期日) */
  date: string | null;
  /** 站內路徑 */
  to: string | null;
  /** 外部連結(BPM) */
  href: string | null;
}

export interface SectionError {
  section: string;
  message: string;
}

export interface Dashboard {
  todos: { items: TodoItem[] };
  secretary: {
    bpm: { pending: number; abnormal: number; unclosed: number; hasAccount: boolean; homeUrl: string } | null;
    links: PersonalLink[] | null;
  };
  news: { total: number; items: LegacyNews[] } | null;
  slides: { policy: Slide[]; gallery: Slide[] } | null;
  _meta: { errors: SectionError[]; unavailable: string[] };
}

export interface DashboardDeps {
  bpm?: BpmService | null;
  qa?: QaService | null;
  onboarding?: { status(empNo: string): Promise<OnboardingStatus> } | null;
  hireDates?: HireDateRepo | null;
  notes?: NoteService | null;
  links?: LinkService | null;
  news?: LegacyNewsRepo | null;
  content?: ContentService | null;
  now?: () => number;
}

/** 兩個 YYYY-MM-DD 相差天數(b - a) */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** 只回傳不含內部細節的訊息;完整錯誤寫入日誌 */
type Log = { error: (obj: object, msg: string) => void };

export class DashboardService {
  constructor(private readonly deps: DashboardDeps) {}

  async build(me: Employee, log: Log): Promise<Dashboard> {
    const d = this.deps;
    const today = twParts((d.now ?? Date.now)()).date;
    const errors: SectionError[] = [];
    const unavailable: string[] = ['todos.consent'];
    const attempt = async <T>(section: string, fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (err) {
        log.error({ err, section }, '首頁區塊取得失敗');
        errors.push({ section, message: '暫時無法取得' });
        return null;
      }
    };
    const skip = (section: string) => {
      unavailable.push(section);
      return Promise.resolve(null);
    };

    const [bpm, qa, onboarding, notes, links, news, slides] = await Promise.all([
      d.bpm && d.bpm.applies(me.companies)
        ? attempt('bpm', async () => {
            const [p, r] = await Promise.all([d.bpm!.pending(me), d.bpm!.requested(me, 1, 1)]);
            return { pending: p.total, abnormal: p.abnormal, unclosed: r.total, hasAccount: p.hasAccount, homeUrl: d.bpm!.homeUrl };
          })
        : skip('bpm'),
      d.qa ? attempt('todos.qa', () => d.qa!.pending(me)) : skip('todos.qa'),
      d.onboarding && d.hireDates
        ? attempt('todos.onboarding', async () => {
            const hired = await d.hireDates!.hireDate(me.empNo);
            if (!hired) return null;
            const days = daysBetween(hired, today);
            if (days < 0 || days > ONBOARDING_DAYS) return null;
            return d.onboarding!.status(me.empNo);
          })
        : skip('todos.onboarding'),
      d.notes ? attempt('todos.notes', () => d.notes!.list(me.empNo)) : skip('todos.notes'),
      d.links ? attempt('secretary.links', () => d.links!.personalLinks(me.empNo)) : skip('secretary.links'),
      d.news ? attempt('news', () => d.news!.list({ today: today.replaceAll('-', '/'), offset: 0, limit: HOME_NEWS_LIMIT })) : skip('news'),
      d.content ? attempt('slides', () => d.content!.visibleSlides(today)) : skip('slides'),
    ]);

    const items: TodoItem[] = [];
    const todo = (t: Partial<TodoItem> & Pick<TodoItem, 'kind' | 'title'>) => items.push({ count: null, date: null, to: null, href: null, ...t });
    if (bpm?.hasAccount) {
      if (bpm.pending > 0) todo({ kind: 'bpm-pending', title: `BPM 待簽核 ${bpm.pending} 筆`, count: bpm.pending, to: '/personal/ef-info', href: bpm.homeUrl });
      if (bpm.unclosed > 0) todo({ kind: 'bpm-unclosed', title: `BPM 未結案 ${bpm.unclosed} 筆`, count: bpm.unclosed, to: '/personal/ef-info/unclosed' });
    }
    for (const s of qa ?? []) todo({ kind: 'qa', title: `問卷:${s.title}`, date: s.endDate, to: '/resources/qa' });
    if (onboarding) {
      if (!onboarding.readAt) todo({ kind: 'onboarding-read', title: '新人導覽:請閱讀小叮嚀', to: '/onboarding' });
      if (!onboarding.passedAt) todo({ kind: 'onboarding-quiz', title: '新人導覽:請完成驗收測驗', to: '/onboarding/quiz' });
    }
    for (const n of notes ?? []) if (!n.done && n.dueDate === today) todo({ kind: 'note', title: `提醒:${n.title}`, date: n.dueDate, to: '/personal/notes' });

    return {
      todos: { items },
      secretary: { bpm, links },
      news,
      slides,
      _meta: { errors, unavailable },
    };
  }
}
