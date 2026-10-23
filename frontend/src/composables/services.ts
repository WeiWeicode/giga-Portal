/**
 * P7 臨時服務畫面邏輯(FEATURE-PLAN §9、D-8;docs/Gherkin/services/*.feature)。
 * 頁面不在選單:路由沒有 group、meta.hidden = true(側欄 / 麵包屑不列),仍需登入與權限(BFF 一定再檢查)。
 */
import type { ConsentState } from '@/api/portal';

/** 集保帳號:去除 - 與空白後須為 11 碼數字(與後端 depositoryAccount 一致) */
export const normalizeAccount = (raw: string) => raw.replace(/[-\s]/g, '');
export const accountValid = (raw: string) => /^\d{11}$/.test(normalizeAccount(raw));

/** 狀態說明(過期一律顯示「服務已結束」) */
export function consentStateText(state: ConsentState, signedAt: string | null): { tone: 'success' | 'neutral' | 'warning' | 'info'; text: string } {
  if (state === 'signed') return { tone: 'success', text: `您已於 ${signedAt ?? ''} 簽署此同意書` };
  if (state === 'ended') return { tone: 'neutral', text: '服務已結束' };
  if (state === 'not-started') return { tone: 'warning', text: '尚未開放' };
  return { tone: 'info', text: '開放中' };
}

/** 後端錯誤代碼 → 服務已結束(410)時畫面改顯示結束狀態 */
export const isServiceEnded = (e: unknown) => (e as { code?: string } | null)?.code === 'PORTAL_SERVICE_ENDED';

/** 金額千分位 */
export const money = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('zh-TW'));

/** 出價下限:目前最高價 + 1000;尚無出價時 1(與後端 AUCTION_STEP 一致) */
export const AUCTION_STEP = 1000;
export const minBid = (highest: number | null) => (highest === null ? 1 : highest + AUCTION_STEP);
