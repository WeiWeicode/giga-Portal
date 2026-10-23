/**
 * ESH 證照管理的純規則(FEATURE-PLAN §8;docs/Gherkin/esh/license.feature、notify.feature):不做 I/O,方便單元測試。
 *   - 下次複訓日由後端計算(舊版前端 JS 計算、伺服器照收,EHLicense.aspx:241-287):取得 / 初訓 / 複訓日中最晚者 + 有效期 N 個月 − 1 天
 *     (月份加法同 SQL Server DATEADD:月底對齊,例 1/31 + 1 個月 = 2/28);有效期 ≥ PERMANENT_MONTHS 視為永久,同舊資料寫 2100-01-01
 *   - 狀態:已離職 / 未設定 / 已失效(距下次複訓 < 0)/ 需通知(0 ≤ 距下次複訓 < 通知天數)/ 正常(同舊 EHLicense 的 CASE)
 *   - 符合度:有效張數 * 100 / 應有張數(整數除法,應有為 0 時分母用 1;同舊 EHManagement)
 */

/** 有效期(月)達此值視為永久(舊資料 ActiveYear = 9999999、NextTrainingDate = 2100-01-01) */
export const PERMANENT_MONTHS = 1200;
export const PERMANENT_NEXT_DATE = '2100-01-01';
/** 舊資料表示永久的有效期值(新站寫入永久證照時沿用,舊站顯示一致) */
export const LEGACY_PERMANENT_VALUE = 9999999;
export const MAX_MONTHS = 600;
export const MAX_NOTIFY_DAYS = 3650;
export const DEFAULT_NOTIFY_DAYS = 90;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** YYYY-MM-DD 是否為存在的日期(1900~2100) */
export function isDate(s: string | null | undefined): s is string {
  const m = DATE_RE.exec(s ?? '');
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** 台灣時間的今天(YYYY-MM-DD) */
export const taipeiToday = (now: Date = new Date()) => new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);

const toUtc = (s: string) => {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (t: number) => new Date(t).toISOString().slice(0, 10);

/** 加月份(月底對齊,同 SQL Server DATEADD(month)) */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return fromUtc(Date.UTC(ny, nm, Math.min(d, last)));
}

export const addDays = (date: string, days: number) => fromUtc(toUtc(date) + days * 86_400_000);
export const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / 86_400_000);

export interface HolderDates {
  /** 初訓日 TrainingDate */
  trainingDate: string | null;
  /** 取得日 GatDate */
  gatDate: string | null;
  /** 複訓日 Training2Date */
  retrainDate: string | null;
}

/** 有效期(月)是否為永久 */
export const isPermanent = (months: number | null | undefined) => (months ?? 0) >= PERMANENT_MONTHS;

/**
 * 下次複訓日:三個日期中最晚者 + 有效期 − 1 天;沒有任何日期或有效期未設定(≤ 0)回 null;永久回 2100-01-01
 */
export function nextTrainingDate(dates: HolderDates, months: number | null | undefined): string | null {
  const base = [dates.trainingDate, dates.gatDate, dates.retrainDate]
    .filter((d): d is string => isDate(d))
    .sort()
    .at(-1);
  if (!base) return null;
  if (isPermanent(months)) return PERMANENT_NEXT_DATE;
  if (!months || months <= 0 || !Number.isFinite(months)) return null;
  return addDays(addMonths(base, Math.floor(months)), -1);
}

export type HolderStatus = 'left' | 'unset' | 'expired' | 'notify' | 'ok';

export interface StatusInput {
  inService: boolean;
  nextTrainingDate: string | null;
  notifyDays: number | null;
}

export function daysLeft(next: string | null, today: string): number | null {
  return next ? daysBetween(today, next) : null;
}

/** 人員證照狀態(同舊 EHLicense:離職優先,其次失效 / 需通知) */
export function holderStatus(h: StatusInput, today: string): HolderStatus {
  if (!h.inService) return 'left';
  const left = daysLeft(h.nextTrainingDate, today);
  if (left === null) return 'unset';
  if (left < 0) return 'expired';
  if (left < (h.notifyDays ?? 0)) return 'notify';
  return 'ok';
}

/** 有效證照:在職、未刪除、下次複訓日 ≥ 今天(同舊 EHManagement) */
export const isValidHolder = (h: StatusInput & { active: boolean }, today: string) =>
  h.active && h.inService && !!h.nextTrainingDate && h.nextTrainingDate >= today;

/** 符合度(%):整數除法,應有為 0 時分母用 1(可超過 100) */
export const complianceRatio = (valid: number, required: number) => Math.floor((valid * 100) / (required > 0 ? required : 1));

/** 工號格式(Token / LOS 工號:英數字,不分大小寫一律轉大寫) */
export const EMP_RE = /^[A-Za-z0-9]{3,20}$/;
export const normEmp = (s: string | null | undefined) => (s ?? '').trim().toUpperCase();

/** 證照影本 / Logo / SDS 副檔名(file-service 另以副檔名白名單與檔頭檢查) */
export const DOC_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'] as const;
export const LOGO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'] as const;
export const SDS_EXTENSIONS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'] as const;

export function hasExtension(fileName: string, allowed: readonly string[]): boolean {
  const m = /\.([A-Za-z0-9]+)$/.exec(fileName.trim());
  return !!m && allowed.includes(m[1]!.toLowerCase());
}

/** 舊站檔名(LicenseFileC.FileName、LogoPath、SDS 檔名)組成舊入口網網址;只取最後一段,不允許路徑 */
export function legacyFileUrl(base: string | null, folder: 'License' | 'SDS', name: string | null | undefined): string | null {
  const n = (name ?? '').split(/[\\/]/).pop()?.trim();
  if (!base || !n || n === '.' || n === '..') return null;
  return `${base}/EHS/${folder}/${encodeURIComponent(n)}`;
}

/** 對外連結只接受 http(s)(舊資料 ESHChemicalDataC.AttachmentFile 為 BPM SDSFILES 網址) */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || u.username || u.password) return null;
    return u.href;
  } catch {
    return null;
  }
}
