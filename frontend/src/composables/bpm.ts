/**
 * BPM 簽核畫面共用邏輯(P1-3 BPM 簽核資訊、P4 待我簽核;docs/Gherkin/personal/bpm.feature、approval/approval.feature)。
 * 入口網只讀 NaNa,核准 / 退回一律以「前往簽核」深連結到 BPM 原畫面完成(D-6、D-24)。
 */

/** 只接受 http(s) 連結(縱深防禦;後端已限制 BPM_WEB_URL);其他回 null */
export function safeBpmUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
}

/** 以新視窗開啟 BPM 原畫面;回傳是否已開啟 */
export function openBpmLink(url: string | null | undefined): boolean {
  const safe = safeBpmUrl(url);
  if (safe) window.open(safe, '_blank', 'noopener');
  return !!safe;
}

/** NaNa 時間(後端已轉 ISO)以台灣時間顯示 */
export const fmtBpmTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString('zh-TW', { hour12: false, timeZone: 'Asia/Taipei' }) : '—');

/** 申請人顯示:姓名(工號) */
export function requesterLabel(r: { requesterId: string | null; requesterName: string | null }): string {
  if (r.requesterName && r.requesterId) return `${r.requesterName}(${r.requesterId})`;
  return r.requesterName ?? r.requesterId ?? '—';
}

/** 清單為空的原因:D-29 非碩禾系 → not-applicable;BPM 沒有帳號 → no-account;其他 → null(照常顯示清單) */
export function bpmBlocker(d: { applicable: boolean; hasAccount: boolean } | null): 'not-applicable' | 'no-account' | null {
  if (!d) return null;
  if (!d.applicable) return 'not-applicable';
  if (!d.hasAccount) return 'no-account';
  return null;
}

export const BPM_BLOCKER_TEXT = {
  'not-applicable': { title: 'BPM 簽核資訊不適用', description: 'BPM 簽核目前只提供碩禾系公司同仁使用;其他公司的簽核請依貴公司流程辦理。' },
  'no-account': { title: 'BPM 沒有您的帳號', description: '以工號在 BPM 找不到帳號,請洽資訊單位。' },
} as const;
