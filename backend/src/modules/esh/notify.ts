/**
 * ESH 複訓通知(P6;FEATURE-PLAN §8「複訓通知」;docs/Gherkin/esh/notify.feature;舊程式 EHLicense.aspx.cs:482-612 SendMailBtn_Click)。
 * 與舊版的刻意差異:
 *   - 改排程(預設每週一 08:00 台灣時間,scheduler.ts)+ 手動「立即通知」(按鈕 portal.esh.notify.send,只含本人管理的公司;舊版不分公司)
 *   - 對象:**距下次複訓天數 < 通知天數 且 尚未失效**者寄本人與主管(LOS RankInfo.BossID);已失效**不再寄本人**,另列給管理員
 *   - 各公司 SendMail = 1 的在職管理員收一封彙整(即將複訓、已失效、證照短缺)
 *   - 收件人以工號交給 Gateway 通知中心(POST /api/notify/send,逐人寄;Email 由 Gateway 依工號查),不再以 NotesID + 寫死網域組信箱,
 *     不再寄寫死的兩位收件人;查不到 Email 由 Gateway 回 skipped 並記錄
 *   - 每封寫寄送紀錄(portal.esh_notify_log);單封失敗不中斷其他收件人
 *   - 寄送方式由設定決定:dry-run(預設,只寫紀錄不寄送)/ gateway(實際入列 Gateway);測試區 Gateway 另會把 Email 改寄測試信箱
 */
import { createHash } from 'node:crypto';
import { AppError } from '../../errors.js';
import type { Employee } from '../../identity.js';
import type { EshLicenseService } from './license.js';
import { daysLeft, normEmp, taipeiToday } from './rules.js';
import type { DashboardRow, EshRepo, HolderRow, ManagerRow, NeedRow } from './types.js';

/** Gateway 通知範本代碼(由 Gateway 負責人以 CLI apply notifyTemplates 建立;CONFIRM-NEEDED P6) */
export const TEMPLATES = {
  holder: 'ESH_LICENSE_RETRAIN',
  boss: 'ESH_LICENSE_RETRAIN_BOSS',
  admin: 'ESH_LICENSE_ADMIN_DIGEST',
} as const;
export type MessageKind = keyof typeof TEMPLATES;

/** 通知內的站內連結(Gateway 只接受 / 開頭或 https) */
export const ESH_LINK = '/esh/personal';
/** 手動通知冷卻時間:同一公司在此時間內已有手動通知時拒絕(避免重複按造成連續寄信) */
export const MANUAL_COOLDOWN_MS = 10 * 60_000;

export type SendStatus = 'queued' | 'skipped' | 'dry-run' | 'duplicate' | 'failed';

export interface MailRequest {
  templateCode: string;
  empNo: string;
  data: Record<string, string | number>;
  idempotencyKey: string;
}

export interface EshMailer {
  readonly mode: 'gateway' | 'dry-run';
  send(m: MailRequest): Promise<Exclude<SendStatus, 'failed'>>;
}

/** 測試 / 預設:不寄送,只回 dry-run(寄送紀錄照寫) */
export class DryRunMailer implements EshMailer {
  readonly mode = 'dry-run' as const;
  readonly sent: MailRequest[] = [];
  async send(m: MailRequest) {
    this.sent.push(m);
    return 'dry-run' as const;
  }
}

/** Gateway 通知中心(BACKEND-GUIDE §7.7:X-Api-Key、notify.message.send);只在 ESH_NOTIFY_MODE=gateway 時使用 */
export class GatewayNotifyMailer implements EshMailer {
  readonly mode = 'gateway' as const;
  constructor(
    private readonly gatewayUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(m: MailRequest) {
    const res = await this.fetchImpl(`${this.gatewayUrl.replace(/\/+$/, '')}/api/notify/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey },
      body: JSON.stringify({ templateCode: m.templateCode, channels: ['email'], to: { users: [m.empNo] }, data: m.data, idempotencyKey: m.idempotencyKey }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { queued?: number; code?: string };
    if (res.status === 200 && body.code === 'DUPLICATE_REQUEST') return 'duplicate' as const;
    if (res.status !== 202) throw new Error(`Gateway 通知回應 ${res.status} ${body.code ?? ''}`.trim());
    return (body.queued ?? 0) > 0 ? ('queued' as const) : ('skipped' as const);
  }
}

export interface PlannedMessage {
  kind: MessageKind;
  empNo: string;
  company: string | null;
  itemCount: number;
  data: Record<string, string | number>;
}

export interface PlanInput {
  holders: HolderRow[];
  needs: NeedRow[];
  /** 各公司儀表板(證照短缺) */
  dashboards: Map<string, DashboardRow[]>;
  admins: ManagerRow[];
  companies: readonly string[];
  today: string;
}

interface Line {
  h: HolderRow;
  left: number;
}

const lineText = (x: Line) =>
  `${x.h.company}|${x.h.empNo} ${x.h.name ?? ''}|${x.h.licenseName}|下次複訓日 ${x.h.nextTrainingDate}(${x.left >= 0 ? `剩 ${x.left} 天` : `已失效 ${-x.left} 天`})`;
const sortLines = (a: Line, b: Line) => a.left - b.left || a.h.empNo.localeCompare(b.h.empNo) || a.h.licenseName.localeCompare(b.h.licenseName);

/**
 * 依規則產生要寄的訊息(純函式):
 *   追蹤對象 = 啟用中、在職、通知天數 > 0、該公司此證照需求 > 0(同舊版 INNER JOIN LicenseBInfo AND LicenseCount <> 0)
 *   即將複訓 = 0 ≤ 距下次複訓天數 < 通知天數 → 本人、主管(主管 = 本人時不重複寄)、管理員彙整
 *   已失效 = 距下次複訓天數 < 0 → 只列在管理員彙整
 */
export function planNotifications(input: PlanInput): PlannedMessage[] {
  const scope = new Set(input.companies);
  const required = new Map(input.needs.map((n) => [`${n.company}\u0000${n.licenseId}`, n.required]));
  const upcoming: Line[] = [];
  const expired: Line[] = [];
  for (const h of input.holders) {
    if (!scope.has(h.company) || !h.active || !h.inService || !((h.notifyDays ?? 0) > 0)) continue;
    if (!((required.get(`${h.company}\u0000${h.licenseId}`) ?? 0) > 0)) continue;
    const left = daysLeft(h.nextTrainingDate, input.today);
    if (left === null) continue;
    if (left < 0) expired.push({ h, left });
    else if (left < h.notifyDays!) upcoming.push({ h, left });
  }
  upcoming.sort(sortLines);
  expired.sort(sortLines);

  const out: PlannedMessage[] = [];
  const group = (lines: Line[], key: (l: Line) => string | null) => {
    const m = new Map<string, Line[]>();
    for (const l of lines) {
      const k = key(l);
      if (k) m.set(k, [...(m.get(k) ?? []), l]);
    }
    return m;
  };
  for (const [empNo, lines] of group(upcoming, (l) => l.h.empNo))
    out.push({
      kind: 'holder',
      empNo,
      company: lines[0]!.h.company,
      itemCount: lines.length,
      data: { name: lines[0]!.h.name ?? empNo, count: lines.length, items: lines.map(lineText).join('\n'), linkUrl: ESH_LINK },
    });
  for (const [empNo, lines] of group(upcoming, (l) => (l.h.bossId && l.h.bossId !== l.h.empNo ? l.h.bossId : null)))
    out.push({
      kind: 'boss',
      empNo,
      company: lines[0]!.h.company,
      itemCount: lines.length,
      data: { count: lines.length, items: lines.map(lineText).join('\n'), linkUrl: ESH_LINK },
    });

  for (const company of input.companies) {
    const up = upcoming.filter((l) => l.h.company === company);
    const ex = expired.filter((l) => l.h.company === company);
    const short = (input.dashboards.get(company) ?? []).filter((d) => d.valid < d.required);
    if (!up.length && !ex.length && !short.length) continue;
    const admins = [...new Set(input.admins.filter((a) => a.company === company && a.sendMail && a.inService).map((a) => a.empNo))];
    for (const empNo of admins)
      out.push({
        kind: 'admin',
        empNo,
        company,
        itemCount: up.length + ex.length + short.length,
        data: {
          company,
          upcomingCount: up.length,
          upcoming: up.map(lineText).join('\n'),
          expiredCount: ex.length,
          expired: ex.map(lineText).join('\n'),
          shortageCount: short.length,
          shortage: short.map((d) => `${d.licenseName}|有效 ${d.valid} / 應有 ${d.required}`).join('\n'),
          linkUrl: ESH_LINK,
        },
      });
  }
  return out;
}

// ───── 執行紀錄 ─────
export type JobName = 'notify' | 'chemical-sync';
export type JobTrigger = 'schedule' | 'manual';

export interface JobRun {
  id: number;
  job: JobName;
  trigger: JobTrigger;
  runKey: string;
  requestedBy: string | null;
  /** 公司範圍(以 | 分隔;化學品同步為空) */
  scope: string;
  status: 'running' | 'ok' | 'failed';
  summary: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface NotifyLogEntry {
  runId: number;
  kind: MessageKind;
  empNo: string;
  company: string | null;
  itemCount: number;
  status: SendStatus;
  message: string | null;
}

export interface EshJobRepo {
  /** 新增執行紀錄;runKey 重複(同一週已排程執行過)回 null */
  start(run: { job: JobName; trigger: JobTrigger; runKey: string; requestedBy: string | null; scope: string }): Promise<number | null>;
  finish(id: number, status: 'ok' | 'failed', summary: string): Promise<void>;
  addLogs(entries: NotifyLogEntry[]): Promise<void>;
  recentRuns(job: JobName, limit: number): Promise<JobRun[]>;
  /** since 之後開始的手動執行 */
  manualRunsSince(job: JobName, since: Date): Promise<JobRun[]>;
  logs(runId: number): Promise<(NotifyLogEntry & { createdAt: string })[]>;
}

export interface NotifyResult {
  runId: number;
  mode: EshMailer['mode'];
  total: number;
  counts: Record<SendStatus, number>;
}

const summaryOf = (counts: Record<SendStatus, number>, mode: string) =>
  `${mode};` + (Object.entries(counts) as [SendStatus, number][]).map(([k, v]) => `${k}=${v}`).join(',');

/** 臺灣時間的週一日期(排程鍵) */
export function weekKey(now: Date): string {
  const tw = new Date(now.getTime() + 8 * 3600_000);
  const dow = (tw.getUTCDay() + 6) % 7;
  return new Date(tw.getTime() - dow * 86_400_000).toISOString().slice(0, 10);
}

export class EshNotifyService {
  constructor(
    private readonly repo: EshRepo,
    private readonly jobs: EshJobRepo,
    private readonly mailer: EshMailer,
    private readonly license: EshLicenseService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get mode(): EshMailer['mode'] {
    return this.mailer.mode;
  }

  /** 手動「立即通知」:只含本人管理的公司;同公司 10 分鐘內已手動通知過回 409 */
  async runManual(emp: Employee): Promise<NotifyResult> {
    const scope = await this.license.scope(emp);
    if (!scope.companies.length) throw new AppError(403, 'PORTAL_DATA_ACCESS_DENIED', '您不是任何公司的證照管理員(LicenseManagerInfo)');
    const recent = await this.jobs.manualRunsSince('notify', new Date(this.now().getTime() - MANUAL_COOLDOWN_MS));
    if (recent.some((r) => r.scope.split('|').some((c) => scope.has(c))))
      throw new AppError(409, 'PORTAL_ESH_NOTIFY_TOO_SOON', '10 分鐘內已發送過通知,請稍後再試');
    // 同一組公司在同一個 10 分鐘時間槽只能有一筆(唯一索引擋同時送出的請求;資安審查 L2)
    const slot = Math.floor(this.now().getTime() / MANUAL_COOLDOWN_MS);
    const hash = createHash('sha256').update(scope.companies.join('|')).digest('hex').slice(0, 16);
    const runKey = `notify-manual-${hash}-${slot}`;
    const r = await this.run('manual', runKey, scope.companies, normEmp(emp.empNo));
    if (!r) throw new AppError(409, 'PORTAL_ESH_NOTIFY_TOO_SOON', '通知已在執行中');
    return r;
  }

  /** 排程:全部公司;同一週只執行一次(runKey = notify-weekly-<週一日期>) */
  async runScheduled(): Promise<NotifyResult | null> {
    return this.run('schedule', `notify-weekly-${weekKey(this.now())}`, await this.repo.companies(), null);
  }

  private async run(trigger: JobTrigger, runKey: string, companies: readonly string[], by: string | null): Promise<NotifyResult | null> {
    const runId = await this.jobs.start({ job: 'notify', trigger, runKey, requestedBy: by, scope: companies.join('|') });
    if (runId === null) return null;
    const counts: Record<SendStatus, number> = { queued: 0, skipped: 0, 'dry-run': 0, duplicate: 0, failed: 0 };
    try {
      const today = taipeiToday(this.now());
      const list = [...companies];
      const [holders, needs, admins] = await Promise.all([this.repo.holders(list), this.repo.needs(list), this.repo.managers(list)]);
      const dashboards = new Map<string, DashboardRow[]>();
      for (const c of list) dashboards.set(c, await this.repo.dashboard(c, today));
      const plan = planNotifications({ holders, needs, dashboards, admins, companies: list, today });
      const logs: NotifyLogEntry[] = [];
      for (const m of plan) {
        let status: SendStatus;
        let message: string | null = null;
        try {
          status = await this.mailer.send({
            templateCode: TEMPLATES[m.kind],
            empNo: m.empNo,
            data: m.data,
            idempotencyKey: `esh-${runKey}-${m.kind}-${m.company ?? ''}-${m.empNo}`.slice(0, 100),
          });
        } catch (err) {
          status = 'failed';
          message = (err as Error).message.slice(0, 200);
        }
        counts[status]++;
        logs.push({ runId, kind: m.kind, empNo: m.empNo, company: m.company, itemCount: m.itemCount, status, message });
      }
      await this.jobs.addLogs(logs);
      await this.jobs.finish(runId, 'ok', summaryOf(counts, this.mailer.mode));
      return { runId, mode: this.mailer.mode, total: plan.length, counts };
    } catch (err) {
      await this.jobs.finish(runId, 'failed', (err as Error).message.slice(0, 500)).catch(() => undefined);
      throw err;
    }
  }

  /** 寄送紀錄:與本人管理公司有交集的執行(排程含全部公司,一律列出) */
  /** 公司範圍只回本人管理的公司;別人發起或排程的執行不回彙總與執行者(資安審查 L1) */
  async runs(emp: Employee, limit = 20): Promise<JobRun[]> {
    const scope = await this.license.scope(emp);
    const me = normEmp(emp.empNo);
    return (await this.jobs.recentRuns('notify', 100))
      .filter((r) => r.scope.split('|').some((c) => scope.has(c)))
      .slice(0, limit)
      .map((r) => {
        const mine = r.requestedBy === me;
        return {
          ...r,
          scope: r.scope
            .split('|')
            .filter((c) => scope.has(c))
            .join('|'),
          requestedBy: mine ? r.requestedBy : null,
          summary: mine ? r.summary : null,
        };
      });
  }

  /** 單次執行的寄送明細:只列本人管理公司的紀錄(本人 / 主管通知以第一筆證照的公司歸屬) */
  async logs(emp: Employee, runId: number) {
    const scope = await this.license.scope(emp);
    const run = (await this.jobs.recentRuns('notify', 100)).find((r) => r.id === runId);
    if (!run || !run.scope.split('|').some((c) => scope.has(c))) throw new AppError(404, 'PORTAL_ESH_RUN_NOT_FOUND', '找不到此通知紀錄');
    return (await this.jobs.logs(runId)).filter((l) => scope.has(l.company));
  }
}
