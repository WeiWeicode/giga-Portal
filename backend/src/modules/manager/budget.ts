/**
 * 部門預算與預算編列(FEATURE-PLAN §7.2;PORTAL-API-PLAN D-26;docs/Gherkin/manager/budget.feature)。
 *   公司:LOS 公司別 → Budget 公司(設定 BUDGET_COMPANY_MAP;舊 Budget_DeptData 的 DS11 / DS36 / DS15 對應)
 *   可看部門:Budget UserInfo(以 Token 工號、啟用、該公司):管理者 = 全部啟用部門;部門主管 = 登記的部門;且須具 portal-manager
 *   實際金額(TIPTOP 傳票)系統轉移中(D-1):actual = null、unavailable ['actual']
 *   編列:只對未結案版本;部門已送出(Status 1 / 2 / 5)或版本已結案時後端拒絕;禁填 / 可填合計科目清單為設定
 */
import type { BudgetSettings } from '../../config.js';
import { AppError, dataAccessDenied } from '../../errors.js';
import type { Employee } from '../../identity.js';
import type { BudgetAccount, BudgetCell, BudgetDept, BudgetRepo, BudgetVersion, CellWrite, DeptStatus } from './budget-repo.js';
import { requireManagerRole } from './scope.js';
import { UNSAFE_MESSAGE, unsafeText } from './text.js';

/** 視為「已送出」的部門狀態:1 完成、2 待簽核、5 簽核同意(3 退回待重提、4 自行退回可再編) */
export const SUBMITTED_STATUS = [1, 2, 5];
export const isLocked = (s: DeptStatus) => s.isFinal || (s.status !== null && SUBMITTED_STATUS.includes(s.status));
const UNAVAILABLE = ['actual'];

export interface BudgetContext {
  company: { id: string; name: string | null };
  depts: BudgetDept[];
}

export interface BudgetRow {
  code: string;
  name: string | null;
  months: number[];
  total: number;
}

export interface ApplyRow {
  code: string;
  name: string | null;
  isSum: boolean;
  /** 整列可否填寫(合計科目、禁填科目為 false) */
  editable: boolean;
  months: ({ amount: number; mark: string | null } | null)[];
  total: number;
}

const versionOut = (v: BudgetVersion) => ({
  flag: v.flag,
  year: v.year,
  ver: v.ver,
  standard: v.standard,
  isFinal: v.isFinal,
  label: `${v.year} ${v.companyId} V.${v.ver} ${v.standard}`,
});

const notFoundVersion = () => new AppError(404, 'PORTAL_MGR_BUDGET_VERSION_NOT_FOUND', '找不到此預算版本');
const lockedErr = (s: DeptStatus) =>
  new AppError(409, 'PORTAL_MGR_BUDGET_LOCKED', s.isFinal ? '預算版本已結案,不能再修改' : '部門預算已送出,不能再修改', {
    isFinal: s.isFinal,
    status: s.status,
  });

function grid(accounts: BudgetAccount[], cells: BudgetCell[]) {
  const map = new Map<string, Map<number, BudgetCell>>();
  for (const c of cells) {
    if (!(c.month >= 1 && c.month <= 12)) continue;
    const m = map.get(c.code) ?? new Map<number, BudgetCell>();
    if (!m.has(c.month)) m.set(c.month, c);
    map.set(c.code, m);
  }
  return (code: string) => map.get(code) ?? new Map<number, BudgetCell>();
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export class BudgetService {
  constructor(
    private readonly repo: BudgetRepo,
    private readonly settings: BudgetSettings,
  ) {}

  /** 公司 + 可看部門 */
  async context(emp: Employee): Promise<BudgetContext> {
    requireManagerRole(emp);
    const comps = await this.repo.compDbs(emp.empNo);
    const id = comps.map((c) => this.settings.companyMap[c]).find(Boolean);
    if (!id) throw dataAccessDenied('您的公司別沒有對應的預算系統公司');
    const [flag, access] = await Promise.all([this.repo.currentFlag(id), this.repo.access(emp.empNo, id)]);
    let depts: BudgetDept[] = [];
    if (access.manager) depts = await this.repo.depts(id);
    else if (access.depts.length) {
      const all = await this.repo.depts(id);
      depts = all.filter((d) => access.depts.includes(d.id));
    }
    return { company: { id, name: flag?.companyName ?? null }, depts };
  }

  private allowDept(ctx: BudgetContext, dept: string): string {
    const d = dept.trim().toUpperCase();
    if (!ctx.depts.some((x) => x.id === d)) throw dataAccessDenied('此部門不在您的預算權限內');
    return d;
  }

  private async versionOf(ctx: BudgetContext, flag: number, open: boolean): Promise<BudgetVersion> {
    const v = await this.repo.version(flag);
    if (!v || v.companyId.toUpperCase() !== ctx.company.id.toUpperCase()) throw notFoundVersion();
    if (open && v.isFinal) throw notFoundVersion();
    return v;
  }

  async viewOptions(emp: Employee) {
    const ctx = await this.context(emp);
    const flag = await this.repo.currentFlag(ctx.company.id);
    const versions = flag ? await this.repo.versions(ctx.company.id, { year: flag.year }) : [];
    return { company: ctx.company, year: flag?.year ?? null, versions: versions.map(versionOut), depts: ctx.depts };
  }

  async view(emp: Employee, flag: number, dept: string, includeZeroPrefix: boolean) {
    const ctx = await this.context(emp);
    const d = this.allowDept(ctx, dept);
    const v = await this.versionOf(ctx, flag, false);
    const current = await this.repo.currentFlag(ctx.company.id);
    if (!current || v.year !== current.year) throw notFoundVersion();
    const { accounts, cells } = await this.repo.viewData(v.flag, d, v.companyId, this.settings.viewExcludedCodes, includeZeroPrefix);
    const at = grid(accounts, cells);
    const rows: BudgetRow[] = accounts.map((a) => {
      const m = at(a.code);
      const months = Array.from({ length: 12 }, (_, i) => m.get(i + 1)?.amount ?? 0);
      return { code: a.code, name: a.name, months, total: round2(months.reduce((s, x) => s + x, 0)) };
    });
    const monthTotals = Array.from({ length: 12 }, (_, i) => round2(rows.reduce((s, r) => s + r.months[i]!, 0)));
    return {
      version: versionOut(v),
      dept: d,
      rows,
      monthTotals,
      total: round2(monthTotals.reduce((s, x) => s + x, 0)),
      actual: null,
      unavailable: UNAVAILABLE,
    };
  }

  async applyOptions(emp: Employee) {
    const ctx = await this.context(emp);
    const versions = await this.repo.versions(ctx.company.id, { openOnly: true });
    return { company: ctx.company, versions: versions.map(versionOut), depts: ctx.depts };
  }

  private rowEditable(a: BudgetAccount): boolean {
    if (this.settings.lockedCodes.includes(a.code)) return false;
    return !a.isSum || this.settings.sumEditableCodes.includes(a.code);
  }

  private async applyState(v: BudgetVersion, d: string) {
    const [data, status] = await Promise.all([this.repo.applyData(v, d), this.repo.status(v, d)]);
    const at = grid(data.accounts, data.cells);
    const rows: ApplyRow[] = data.accounts.map((a) => {
      const m = at(a.code);
      const months = Array.from({ length: 12 }, (_, i) => {
        const c = m.get(i + 1);
        return c ? { amount: c.amount, mark: c.mark } : null;
      });
      return {
        code: a.code,
        name: a.name,
        isSum: a.isSum,
        editable: this.rowEditable(a),
        months,
        total: round2(months.reduce((s, x) => s + (x?.amount ?? 0), 0)),
      };
    });
    return { rows, remark: data.remark, status };
  }

  async apply(emp: Employee, flag: number, dept: string) {
    const ctx = await this.context(emp);
    const d = this.allowDept(ctx, dept);
    const v = await this.versionOf(ctx, flag, true);
    const { rows, remark, status } = await this.applyState(v, d);
    return {
      version: versionOut(v),
      dept: d,
      status: status.status,
      locked: isLocked(status),
      remark,
      rows,
      lastYearActual: null,
      unavailable: UNAVAILABLE,
    };
  }

  async save(emp: Employee, flag: number, dept: string, body: { remark?: string; cells: CellWrite[] }) {
    const ctx = await this.context(emp);
    const d = this.allowDept(ctx, dept);
    const v = await this.versionOf(ctx, flag, true);
    const { rows, status } = await this.applyState(v, d);
    if (isLocked(status)) throw lockedErr(status);
    const byCode = new Map(rows.map((r) => [r.code, r]));
    const errors: { field: string; message: string }[] = [];
    const seen = new Set<string>();
    if (body.remark !== undefined && unsafeText(body.remark, true)) errors.push({ field: 'remark', message: `部門備註${UNSAFE_MESSAGE}` });
    for (const c of body.cells) {
      const r = byCode.get(c.code);
      const key = `${c.code}/${c.month}`;
      if (seen.has(key)) errors.push({ field: key, message: '同一科目月份重複' });
      seen.add(key);
      if (c.mark !== undefined && unsafeText(c.mark, true)) errors.push({ field: key, message: `備註${UNSAFE_MESSAGE}` });
      if (!r) errors.push({ field: key, message: `科目 ${c.code} 不屬於此部門` });
      else if (!r.editable) errors.push({ field: key, message: `${r.name ?? c.code} 為合計或禁填科目,不可填寫` });
      else if (!r.months[c.month - 1]) errors.push({ field: key, message: `${r.name ?? c.code} ${c.month} 月份沒有預算資料列` });
      if (!Number.isFinite(c.amount) || Math.abs(c.amount * 100 - Math.round(c.amount * 100)) > 1e-6 || Math.abs(c.amount) >= 1e12)
        errors.push({ field: key, message: `${c.month} 月份金額必須是最多 2 位小數的數字` });
    }
    if (errors.length) throw new AppError(400, 'VALIDATION_FAILED', '請確認預算資料', errors);
    const r = await this.repo.save({ version: v, dept: d, empNo: emp.empNo, remark: body.remark, cells: body.cells }, isLocked);
    if (!r.ok) {
      if (r.reason === 'locked') throw lockedErr(await this.repo.status(v, d));
      throw new AppError(409, 'PORTAL_MGR_BUDGET_CHANGED', `${r.code} ${r.month} 月份的預算資料列已不存在,請重新整理`);
    }
    return this.apply(emp, flag, dept);
  }

  async submit(emp: Employee, flag: number, dept: string) {
    const ctx = await this.context(emp);
    const d = this.allowDept(ctx, dept);
    const v = await this.versionOf(ctx, flag, true);
    if (!(await this.repo.submit(v, d, isLocked)).ok) throw lockedErr(await this.repo.status(v, d));
    return this.apply(emp, flag, dept);
  }
}
