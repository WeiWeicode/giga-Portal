/**
 * 登入後導回的 redirect 參數(PRD FR-1.2、AGENT §8):只接受同網域相對路徑(以 / 開頭、不是 // 或 /\),否則導回 /,防止開放重新導向。
 */
export function safeRedirect(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return '/';
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  // 控制字元(含 Tab、換行)會被瀏覽器忽略,可能組成 //host
  if (/[\u0000-\u001f\u007f]/.test(raw)) return '/';
  return raw;
}
