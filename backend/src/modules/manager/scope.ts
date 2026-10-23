/**
 * 主管專區資料範圍(FEATURE-PLAN §7 共通、PORTAL-API-PLAN D-5;docs/Gherkin/manager/manager.feature):
 *   - 範圍 = 內部 Token 的 dept + LOS DeptInfo.ParentDept 往下展開的全部下層
 *   - 角色 portal-manager-all:全公司(任一部門都可指定;清單 API 必須指定部門,避免一次查全公司)
 *   - 舊系統 LoadDept(RankInfo 正 / 副主管)、IsBoss、寫死工號 860000 與特權工號一律不沿用
 * 部門樹快取 10 分鐘(LOS 部門變動不頻繁);部門代碼比對不分大小寫、去前後空白。
 */
import sql from 'mssql';
import type { Sources } from '../../db/sources.js';
import { AppError, dataAccessDenied } from '../../errors.js';
import type { Employee } from '../../identity.js';

export const MANAGER_ROLE = 'portal-manager';
export const MANAGER_ALL_ROLE = 'portal-manager-all';

export interface DeptRow {
  code: string;
  name: string | null;
  parent: string | null;
}

export interface DeptSource {
  departments(): Promise<DeptRow[]>;
}

export const normDept = (d: string | null | undefined) => (d ?? '').trim().toUpperCase();

export class MssqlDeptSource implements DeptSource {
  constructor(
    private readonly pool: sql.ConnectionPool,
    private readonly src: Sources,
  ) {}

  async departments(): Promise<DeptRow[]> {
    const r = await this.pool.request().query<DeptRow>(
      `SELECT LTRIM(RTRIM(Dept)) AS code, DeptName AS name, NULLIF(LTRIM(RTRIM(ParentDept)), N'') AS parent FROM ${this.src.table('LOS', 'DeptInfo')}
       WHERE Dept IS NOT NULL AND LTRIM(RTRIM(Dept)) <> N'' ORDER BY Dept`,
    );
    return r.recordset;
  }
}

/** 一位使用者的資料範圍 */
export class ManagerScope {
  private readonly set: Set<string>;

  constructor(
    /** 全公司(portal-manager-all) */
    readonly all: boolean,
    /** 可選部門(all 時為全部部門) */
    readonly depts: readonly DeptRow[],
    private readonly tree: DeptTree,
  ) {
    this.set = new Set(depts.map((d) => normDept(d.code)));
  }

  has(dept: string | null | undefined): boolean {
    const d = normDept(dept);
    return !!d && (this.all || this.set.has(d));
  }

  /**
   * 查詢用的部門清單:指定 dept 時 = 該部門(includeSub 含下層,且限縮在範圍內);未指定時 = 整個範圍(全公司角色必須指定)。
   * 不在範圍內回 403 PORTAL_DATA_ACCESS_DENIED。
   */
  resolve(dept: string | undefined, includeSub = true): string[] {
    if (dept === undefined || dept.trim() === '') {
      if (this.all) throw new AppError(400, 'PORTAL_MGR_DEPT_REQUIRED', '全公司範圍請指定部門');
      return [...this.set];
    }
    if (!this.has(dept)) throw dataAccessDenied('此部門不在您的主管範圍內');
    const root = normDept(dept);
    if (!includeSub) return [root];
    return this.tree.subtree(root).filter((d) => this.all || this.set.has(d));
  }
}

export class DeptTree {
  private readonly children = new Map<string, string[]>();
  readonly byCode = new Map<string, DeptRow>();

  constructor(readonly rows: readonly DeptRow[]) {
    for (const r of rows) {
      const code = normDept(r.code);
      if (!code || this.byCode.has(code)) continue;
      this.byCode.set(code, { code, name: r.name, parent: r.parent ? normDept(r.parent) : null });
      if (r.parent) {
        const p = normDept(r.parent);
        if (p && p !== code) this.children.set(p, [...(this.children.get(p) ?? []), code]);
      }
    }
  }

  /** 部門本身 + 全部下層(防循環) */
  subtree(root: string): string[] {
    const start = normDept(root);
    const seen = new Set<string>([start]);
    const queue = [start];
    while (queue.length) {
      for (const c of this.children.get(queue.shift()!) ?? []) {
        if (seen.has(c)) continue;
        seen.add(c);
        queue.push(c);
      }
    }
    return [...seen];
  }

  row(code: string): DeptRow {
    const c = normDept(code);
    return this.byCode.get(c) ?? { code: c, name: null, parent: null };
  }
}

export class ScopeService {
  private cache: { at: number; tree: DeptTree } | null = null;
  private loading: Promise<DeptTree> | null = null;

  constructor(
    private readonly source: DeptSource,
    private readonly ttlMs = 10 * 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  async tree(): Promise<DeptTree> {
    if (this.cache && this.now() - this.cache.at < this.ttlMs) return this.cache.tree;
    this.loading ??= this.source
      .departments()
      .then((rows) => {
        const tree = new DeptTree(rows);
        this.cache = { at: this.now(), tree };
        return tree;
      })
      .finally(() => {
        this.loading = null;
      });
    return this.loading;
  }

  /** 須具 portal-manager 或 portal-manager-all(縱深防禦:Tab / 按鈕被授給非主管時仍不給部門資料;資安審查 M-1) */
  async of(emp: Employee): Promise<ManagerScope> {
    requireManagerRole(emp);
    const tree = await this.tree();
    if ((emp.roles ?? []).includes(MANAGER_ALL_ROLE)) return new ManagerScope(true, [...tree.byCode.values()], tree);
    const root = normDept(emp.dept);
    if (!root) return new ManagerScope(false, [], tree);
    return new ManagerScope(
      false,
      tree.subtree(root).map((c) => tree.row(c)),
      tree,
    );
  }
}

/** 主管專區資料(含 D-26 預算)須具 portal-manager 或全公司角色 */
export function requireManagerRole(emp: Employee): void {
  const roles = emp.roles ?? [];
  if (!roles.includes(MANAGER_ROLE) && !roles.includes(MANAGER_ALL_ROLE)) throw dataAccessDenied('主管專區資料需具主管角色(portal-manager)');
}

/** 把清單切成每批 n 筆(SQL Server 參數上限 2100) */
export function chunks<T>(list: readonly T[], n = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

/** 在 request 加入 @p0..@pN 參數,回傳 "@p0, @p1, ..." */
export function inList(req: sql.Request, prefix: string, values: readonly string[], type: () => sql.ISqlType = () => sql.NVarChar(40)): string {
  if (!values.length) return 'NULL';
  values.forEach((v, i) => req.input(`${prefix}${i}`, type(), v));
  return values.map((_, i) => `@${prefix}${i}`).join(', ');
}
