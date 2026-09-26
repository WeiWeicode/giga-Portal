/**
 * 應用切換與應用層守衛(PRD FR-2.1–2.4;Gateway PRD §8.3.3、FRONTEND-GUIDE §7.4)。
 * 以 /api/auth/me 的 apps 為準;apps 尚未由 Gateway 提供(G3 未實作)時,**暫時**以 permissions 中的 app 權限對照 TEMP_APPS 推導。
 * TODO(Gateway G3 上線後):移除 TEMP_APPS 與推導,只用 me.apps。
 */
import type { AppEntry } from '@/api/gateway';

export const CURRENT_APP = 'portal';

/** 暫時做法:應用登記的對照表(正式資料在 Gateway gw.app,由 CLI apply 維護) */
export const TEMP_APPS: readonly (AppEntry & { permission: string })[] = [
  { code: 'portal', name: '員工入口網', basePath: '/', icon: 'home', permission: 'portal.app.access' },
  { code: 'it', name: 'IT 管理系統', basePath: '/it/', icon: 'monitor', permission: 'it.app.access' },
];

export interface AppsResult {
  apps: AppEntry[];
  /** true = me 沒有 apps,由 permissions 推導(畫面需標示暫時做法) */
  derived: boolean;
}

export function resolveApps(me: { apps?: AppEntry[]; permissions: string[] } | null): AppsResult {
  if (!me) return { apps: [], derived: false };
  if (Array.isArray(me.apps)) return { apps: me.apps, derived: false };
  const perms = new Set(me.permissions);
  return { apps: TEMP_APPS.filter((a) => perms.has(a.permission)).map(({ permission: _p, ...a }) => a), derived: true };
}

export const hasApp = (r: AppsResult, code: string) => r.apps.some((a) => a.code === code);

/** 其他應用以 /?denied=<應用代碼> 導回入口網時的提示(FR-2.5) */
export function deniedMessage(code: unknown): string | null {
  if (typeof code !== 'string' || !code || code === CURRENT_APP) return null;
  const name = TEMP_APPS.find((a) => a.code === code)?.name;
  return name ? `您沒有${name}的使用權限` : '您沒有該應用的使用權限';
}
