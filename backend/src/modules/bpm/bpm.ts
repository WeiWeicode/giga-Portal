/**
 * BPM 簽核資訊(P1-3;PORTAL-API-PLAN §3.3、D-6、D-13;docs/Gherkin/personal/bpm.feature)。
 * 查詢規則沿用 BPM 快速開發工具包 6_todo_viewer(docs/待辦狀態語意.md,191 實測):
 *   - 待簽核在 LocalToDoWorkItem(userOID = 我),不在 WorkItem.performerOID(未完成關卡該欄為 NULL)
 *   - 待辦只取 WorkItem.currentState 0 / 1;97 是卡住的異常關卡,列出並標示但不計入待簽核數
 *   - 同一關卡可能同時派給多人:清單以 LocalToDoWorkItem 的列為單位
 *   - 「未結案」= 我申請的(ProcessInstance.requesterOID = 我)且流程 currentState = 1(進行中)
 *   - 深連結跟著資料來源主機:簽核 PerformWorkFromMail(WorkItem OID)、追蹤 TraceProcessMain(ProcessInstance OID)
 *   - 「經辦過」= WorkItem.performerOID = 我 且 currentState = 3(已完成的關卡;P4 待我簽核「已簽核」)
 * 只用 SQL 唯讀查 NaNa,不呼叫 SOAP、不寫入。BPM 帳號以工號(Users.id)對應內部 Token 的 emp。
 * D-29:只有 Token 公司(cos)屬於設定 BPM_COMPANIES(碩禾系)的人才查 NaNa,其他公司一律回空清單(applicable = false),
 *   避免其他公司本機帳號的工號與 BPM 上碩禾同仁的 id 撞號而看到別人的單據(Q-D13)。
 */

export const TODO_STATES = [0, 1] as const;
export const ABNORMAL_STATE = 97;
/** 待簽核最多回傳筆數(191 實測最多 194);repo 多取 1 筆以判斷是否截斷 */
export const TODO_LIMIT = 500;

/** ProcessInstance.currentState(與 BPMGeneralController.js convertProcessStateToChinese 一致) */
export const PROCESS_STATES: Record<number, string> = { 0: '未開始', 1: '進行中', 2: '已暫停', 3: '已結案', 4: '已撤銷', 5: '已中止' };
export const processStateLabel = (code: number | null) => (code === null ? '' : (PROCESS_STATES[code] ?? `其他(${code})`));

/** 我送出的:open = 進行中(currentState = 1,即「未結案」,P1-3);all = 全部狀態 */
export const REQUESTED_STATES = ['open', 'all'] as const;
export type RequestedState = (typeof REQUESTED_STATES)[number];

/** 查詢者:工號與公司都取自內部 Token(不接受前端傳入) */
export interface BpmViewer {
  empNo: string;
  companies: readonly string[];
}

export interface BpmUser {
  oid: string;
  id: string;
}

export interface TodoRow {
  workItemOid: string;
  workItemName: string | null;
  workItemState: number;
  subject: string | null;
  processName: string | null;
  serialNumber: string | null;
  processOid: string | null;
  processState: number | null;
  /** ISO 字串(NaNa datetime 為台灣時間,已轉 +08:00);派送給我的時間 */
  createdAt: string | null;
  /** 申請人(ProcessInstance.requesterOID → Users) */
  requesterId: string | null;
  requesterName: string | null;
  /** 申請(送出)時間 = ProcessInstance.createdTime */
  submittedAt: string | null;
}

export interface RequestedRow {
  processOid: string;
  contextOid: string;
  serialNumber: string | null;
  processName: string | null;
  subject: string | null;
  processState: number | null;
  createdAt: string | null;
}

/** 我經辦過的關卡(WorkItem.performerOID = 我、currentState = 3) */
export interface HandledRow {
  workItemOid: string;
  workItemName: string | null;
  completedAt: string | null;
  contextOid: string | null;
  processOid: string | null;
  serialNumber: string | null;
  processName: string | null;
  subject: string | null;
  processState: number | null;
  requesterId: string | null;
  requesterName: string | null;
  submittedAt: string | null;
}

export interface BpmRepo {
  /** 以工號找 BPM 帳號;找不到回 null */
  user(empNo: string): Promise<BpmUser | null>;
  /** 待辦(含 currentState 97);最多 TODO_LIMIT + 1 筆,新到舊 */
  todos(userOid: string): Promise<TodoRow[]>;
  /** 我申請的流程(state = open 只取進行中;分頁,新到舊) */
  requested(userOid: string, state: RequestedState, offset: number, limit: number): Promise<{ total: number; rows: RequestedRow[] }>;
  /** 我經辦過(已完成)的關卡(分頁,完成時間新到舊) */
  handled(userOid: string, offset: number, limit: number): Promise<{ total: number; rows: HandledRow[] }>;
  /** 各流程目前未完成的關卡名稱(contextOID → 名稱) */
  openActivities(contextOids: string[]): Promise<Map<string, string[]>>;
}

export interface Pending {
  /** D-29:本人公司是否適用 BPM(碩禾系);false 時其他欄位一律為空 */
  applicable: boolean;
  /** 待簽核數(不含異常) */
  total: number;
  /** currentState 97 的異常關卡數 */
  abnormal: number;
  /** 本人在 BPM 是否有帳號 */
  hasAccount: boolean;
  /** 超過 TODO_LIMIT 筆,只回最新的部分 */
  truncated: boolean;
  items: {
    workItemName: string | null;
    subject: string | null;
    processName: string | null;
    serialNumber: string | null;
    processState: string;
    abnormal: boolean;
    createdAt: string | null;
    requesterId: string | null;
    requesterName: string | null;
    submittedAt: string | null;
    performUrl: string | null;
    traceUrl: string | null;
  }[];
}

export interface Requested {
  applicable: boolean;
  state: RequestedState;
  total: number;
  page: number;
  pageSize: number;
  hasAccount: boolean;
  items: {
    serialNumber: string | null;
    processName: string | null;
    subject: string | null;
    processState: string;
    currentActivities: string[];
    createdAt: string | null;
    traceUrl: string | null;
  }[];
}

export interface Handled {
  applicable: boolean;
  total: number;
  page: number;
  pageSize: number;
  hasAccount: boolean;
  items: {
    workItemName: string | null;
    completedAt: string | null;
    serialNumber: string | null;
    processName: string | null;
    subject: string | null;
    processState: string;
    currentActivities: string[];
    requesterId: string | null;
    requesterName: string | null;
    submittedAt: string | null;
    traceUrl: string | null;
  }[];
}

export class BpmService {
  constructor(
    private readonly repo: BpmRepo,
    /** BPM 網站位址(例 http://10.10.130.191:8080);深連結用,與資料來源同一台 */
    private readonly webUrl: string,
    /** D-29:可查 BPM 的公司(Token cos,設定 BPM_COMPANIES);空 = 任何人都不查 */
    private readonly companies: readonly string[],
  ) {}

  /** D-29:Token 公司有任一家在 BPM_COMPANIES 內才查 NaNa */
  applies(companies: readonly string[]): boolean {
    return this.companies.some((c) => companies.includes(c));
  }

  /** BPM 首頁(首頁個人秘書「前往 BPM」;D-24 簽核一律回 BPM 完成) */
  get homeUrl(): string {
    return `${this.webUrl}/NaNaWeb/`;
  }

  /** 只是產生給人點的連結,不對 BPM 發出請求;缺材料回 null(不給半條網址) */
  performUrl(userId: string, workItemOid: string): string | null {
    if (!userId || !workItemOid) return null;
    const q = new URLSearchParams({ hdnMethod: 'performWorkFromMail', hdnUserId: userId, hdnWorkItemOID: workItemOid });
    return `${this.webUrl}/NaNaWeb/GP/PerformWorkFromMail?${q}`;
  }

  traceUrl(userId: string, processOid: string | null): string | null {
    if (!userId || !processOid) return null;
    const q = new URLSearchParams({ hdnMethod: 'traceProcessFromMail', hdnCurrentUserId: userId, hdnProcessInstOID: processOid });
    return `${this.webUrl}/NaNaWeb/GP/WMS/TraceProcess/TraceProcessMain?${q}`;
  }

  async pending(me: BpmViewer): Promise<Pending> {
    const applicable = this.applies(me.companies);
    const user = applicable ? await this.repo.user(me.empNo) : null;
    if (!user) return { applicable, total: 0, abnormal: 0, hasAccount: false, truncated: false, items: [] };
    const all = await this.repo.todos(user.oid);
    const truncated = all.length > TODO_LIMIT;
    const rows = all.slice(0, TODO_LIMIT).filter((r) => (TODO_STATES as readonly number[]).includes(r.workItemState) || r.workItemState === ABNORMAL_STATE);
    const abnormal = rows.filter((r) => r.workItemState === ABNORMAL_STATE).length;
    return {
      applicable,
      total: rows.length - abnormal,
      abnormal,
      hasAccount: true,
      truncated,
      items: rows.map((r) => ({
        workItemName: r.workItemName,
        subject: r.subject,
        processName: r.processName,
        serialNumber: r.serialNumber,
        processState: processStateLabel(r.processState),
        abnormal: r.workItemState === ABNORMAL_STATE,
        createdAt: r.createdAt,
        requesterId: r.requesterId,
        requesterName: r.requesterName,
        submittedAt: r.submittedAt,
        performUrl: r.workItemState === ABNORMAL_STATE ? null : this.performUrl(user.id, r.workItemOid),
        traceUrl: this.traceUrl(user.id, r.processOid),
      })),
    };
  }

  async requested(me: BpmViewer, page: number, pageSize: number, state: RequestedState = 'open'): Promise<Requested> {
    const applicable = this.applies(me.companies);
    const user = applicable ? await this.repo.user(me.empNo) : null;
    if (!user) return { applicable, state, total: 0, page, pageSize, hasAccount: false, items: [] };
    const { total, rows } = await this.repo.requested(user.oid, state, (page - 1) * pageSize, pageSize);
    const open = await this.repo.openActivities(rows.map((r) => r.contextOid));
    return {
      applicable,
      state,
      total,
      page,
      pageSize,
      hasAccount: true,
      items: rows.map((r) => ({
        serialNumber: r.serialNumber,
        processName: r.processName,
        subject: r.subject,
        processState: processStateLabel(r.processState),
        currentActivities: open.get(r.contextOid) ?? [],
        createdAt: r.createdAt,
        traceUrl: this.traceUrl(user.id, r.processOid),
      })),
    };
  }

  async handled(me: BpmViewer, page: number, pageSize: number): Promise<Handled> {
    const applicable = this.applies(me.companies);
    const user = applicable ? await this.repo.user(me.empNo) : null;
    if (!user) return { applicable, total: 0, page, pageSize, hasAccount: false, items: [] };
    const { total, rows } = await this.repo.handled(user.oid, (page - 1) * pageSize, pageSize);
    // 目前關卡只對仍進行中的流程查(已結案的流程沒有未完成關卡)
    const open = await this.repo.openActivities([...new Set(rows.filter((r) => r.processState === 1 && r.contextOid).map((r) => r.contextOid!))]);
    return {
      applicable,
      total,
      page,
      pageSize,
      hasAccount: true,
      items: rows.map((r) => ({
        workItemName: r.workItemName,
        completedAt: r.completedAt,
        serialNumber: r.serialNumber,
        processName: r.processName,
        subject: r.subject,
        processState: processStateLabel(r.processState),
        currentActivities: (r.contextOid && open.get(r.contextOid)) || [],
        requesterId: r.requesterId,
        requesterName: r.requesterName,
        submittedAt: r.submittedAt,
        traceUrl: this.traceUrl(user.id, r.processOid),
      })),
    };
  }
}
