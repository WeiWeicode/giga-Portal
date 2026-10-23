/** ESH 證照管理與危害性化學品畫面邏輯(P6;FEATURE-PLAN §8;docs/Gherkin/esh/*.feature) */
import {
  fileUrl,
  type EshDashboardItem,
  type EshHolder,
  type EshHolderDoc,
  type EshHolderStatus,
  type EshItem,
  type EshNotifyResult,
  type EshSds,
} from '@/api/portal';

/** 與後端 rules.ts 一致(file-service 另有自己的白名單與檔頭檢查) */
export const DOC_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'] as const;
export const LOGO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'] as const;
export const SDS_EXTENSIONS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'] as const;
export const accept = (exts: readonly string[]) => exts.map((e) => `.${e}`).join(',');
export function hasExt(name: string, exts: readonly string[]): boolean {
  const m = /\.([A-Za-z0-9]+)$/.exec(name.trim());
  return !!m && exts.includes(m[1]!.toLowerCase());
}

/** file-service 的 sourceApp / refType(綁定用) */
export const REF = { logo: 'portal-esh-logo', license: 'portal-esh-license', sds: 'portal-esh-sds' } as const;

export const STATUS_LABEL: Record<EshHolderStatus, string> = { ok: '有效', notify: '需通知', expired: '已失效', unset: '未設定複訓日', left: '已離職' };
export const STATUS_TONE: Record<EshHolderStatus, string> = { ok: 'success', notify: 'warning', expired: 'danger', unset: 'neutral', left: 'neutral' };

/** 「需通知(剩 38 天)」「已失效(逾 23 天)」 */
export function statusText(h: Pick<EshHolder, 'status' | 'daysLeft' | 'active'>): string {
  const base = STATUS_LABEL[h.status];
  const extra =
    h.status === 'notify' || h.status === 'ok' ? `剩 ${h.daysLeft} 天` : h.status === 'expired' && h.daysLeft !== null ? `逾 ${-h.daysLeft} 天` : '';
  return `${h.active ? '' : '已刪除 · '}${base}${extra && h.status !== 'ok' ? `(${extra})` : ''}`;
}

export type DashboardFilter = 'all' | 'ng' | 'ok';
export function dashboardCounts(items: readonly EshDashboardItem[]) {
  const ng = items.filter((i) => !i.ok).length;
  return { all: items.length, ng, ok: items.length - ng };
}
export const filterDashboard = (items: readonly EshDashboardItem[], f: DashboardFilter) => items.filter((i) => f === 'all' || (f === 'ng' ? !i.ok : i.ok));

/** Logo:新站上傳(file-service)優先,其次舊站檔名;都沒有回 null */
export const logoSrc = (i: Pick<EshItem, 'logo' | 'legacyLogoUrl'>) => (i.logo ? fileUrl(i.logo.fileId) : i.legacyLogoUrl);

export const docHref = (d: EshHolderDoc) => (d.kind === 'file' ? fileUrl(d.fileId) : d.url);
export function sdsLink(s: EshSds | null): { href: string | null; name: string; legacy: boolean } | null {
  if (!s) return null;
  if (s.kind === 'file') return { href: fileUrl(s.fileId), name: s.fileName, legacy: false };
  return { href: s.url, name: s.name, legacy: s.kind === 'legacy' };
}

/** 有效期顯示 */
export const monthsText = (i: { months: number | null; permanent: boolean }) => (i.permanent ? '永久' : i.months ? `${i.months} 個月` : '未設定');

/** 人員清單關鍵字(工號、姓名、部門、證照) */
export function filterHolders(items: readonly EshHolder[], keyword: string, licenseId = ''): EshHolder[] {
  const kw = keyword.trim().toLowerCase();
  return items.filter(
    (h) =>
      (!licenseId || String(h.licenseId) === licenseId) &&
      (!kw || [h.empNo, h.name ?? '', h.dept ?? '', h.licenseName].some((s) => s.toLowerCase().includes(kw))),
  );
}

/**
 * 下次複訓日預覽(與後端 rules.ts nextTrainingDate 相同規則;實際值以後端計算為準):
 * 取得 / 初訓 / 複訓日最晚者 + 有效期 N 個月(月底對齊)− 1 天;永久 = 2100-01-01
 */
export function previewNextDate(dates: (string | null | undefined)[], months: number | null, permanent: boolean): string | null {
  const base = dates
    .filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .at(-1);
  if (!base) return null;
  if (permanent) return '2100-01-01';
  if (!months || months <= 0) return null;
  const [y, m, d] = base.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const t = Date.UTC(ny, nm, Math.min(d, last)) - 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

const SEND_LABEL: Record<string, string> = { queued: '已入列', skipped: '略過(無 Email)', 'dry-run': '模擬(未寄出)', duplicate: '重複', failed: '失敗' };
export const sendStatusText = (s: string) => SEND_LABEL[s] ?? s;
export function notifySummary(r: EshNotifyResult): string {
  const parts = Object.entries(r.counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${sendStatusText(k)} ${n}`);
  return `${r.mode === 'dry-run' ? '模擬寄送:' : ''}共 ${r.total} 封${parts.length ? `(${parts.join('、')})` : ''}`;
}

/** 化學品清單預設區間:去年本月 1 日 ~ 今天(同舊版;today 為 YYYY-MM-DD) */
export function chemicalDefaultRange(today: string): { from: string; to: string } {
  const [y, m] = today.split('-') as [string, string];
  return { from: `${Number(y) - 1}-${m}-01`, to: today };
}
