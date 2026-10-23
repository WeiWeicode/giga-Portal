/**
 * P7 臨時服務共通(FEATURE-PLAN §9、PORTAL-API-PLAN D-8):
 *   - 開放期間由資料決定;過期回 410 PORTAL_SERVICE_ENDED(畫面顯示「服務已結束」)
 *   - 個資欄位(身分證、集保帳號)只回末 4 碼
 *   - 寫入舊表的文字只當純文字:拒收 < >、控制字元與雙向控制字元(同 P4 forms / P5 text.ts 原則)
 */
import { AppError } from '../../errors.js';

export const serviceEnded = (message = '服務已結束') => new AppError(410, 'PORTAL_SERVICE_ENDED', message);
export const invalid = (field: string, message: string) => new AppError(400, 'VALIDATION_FAILED', message, [{ field, message }]);

/** 只留末 4 碼,其餘以 * 取代(長度 ≤ 4 時全部遮蔽) */
export function maskTail(value: string | null | undefined, keep = 4): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  if (v.length <= keep) return '*'.repeat(v.length);
  return `${'*'.repeat(v.length - keep)}${v.slice(-keep)}`;
}

/** 只回末 4 碼本身(值不足 5 碼時不回,避免整個值外露) */
export function last4(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  return v.length > 4 ? v.slice(-4) : null;
}

const BIDI = /[​-‏‪-‮⁦-⁩﻿]/;
const UNSAFE = new RegExp(`[\\u0000-\\u001f\\u007f<>]|${BIDI.source}`);

/** 純文字欄位:去頭尾空白,空白或含不安全字元回 400 */
export function plainText(field: string, label: string, raw: string, max: number, opts: { optional?: boolean; extra?: RegExp } = {}): string {
  const v = raw.trim();
  if (!v) {
    if (opts.optional) return '';
    throw invalid(field, `${label}未填寫`);
  }
  if (v.length > max) throw invalid(field, `${label}最多 ${max} 字`);
  if (UNSAFE.test(v) || (opts.extra && opts.extra.test(v))) throw invalid(field, `${label}不可含 < > 或控制字元`);
  return v;
}

/** 集保帳號:去除 - 與空白後須為 11 碼數字(舊版只檢查長度) */
export function depositoryAccount(field: string, raw: string): string {
  const v = raw.replace(/[-\s]/g, '');
  if (!/^\d{11}$/.test(v)) throw invalid(field, '集保帳號為 11 碼數字,請確認');
  return v;
}

/** 'yyyy/MM/dd'、'yyyy/M/d'、'yyyy-MM-dd' → 'YYYY-MM-DD';空白或格式不符回 null(舊表日期為字串) */
export function legacyDate(raw: string | null | undefined): string | null {
  const m = /^\s*(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(raw ?? '');
  if (!m) return null;
  return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`;
}

export type PeriodState = 'open' | 'not-started' | 'ended';

/** 期間判斷(起訖日含當天;null = 不限) */
export function periodState(start: string | null, end: string | null, today: string): PeriodState {
  if (start && today < start) return 'not-started';
  if (end && today > end) return 'ended';
  return 'open';
}

/** 逗號分隔清單 → 去空白、大寫、去重 */
export const csvList = (raw: string | null | undefined) => [
  ...new Set(
    (raw ?? '')
      .split(/[,，;\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  ),
];

/** HTML 跳脫(取代範本文字時使用) */
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 圖片 / 簽名檔名(file-service 另以副檔名白名單與檔頭檢查) */
export const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;
