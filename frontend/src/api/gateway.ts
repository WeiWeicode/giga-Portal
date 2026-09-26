/**
 * Gateway BFF 呼叫(全站唯一入口,頁面不直接 fetch):一律經 Gateway web-kit(CSRF、401 自動 Refresh、useAuth / can)。
 * 登入相關 API 見 Gateway PRD §8.2.4;錯誤代碼見 §8.1.1。本專案不保存帳號、密碼、Token。
 */
import { ApiError, http, setMe, type Me } from '@giganexus/web-kit';

export { ApiError, http, loadMe, logout, useAuth } from '@giganexus/web-kit';

/** 應用登記(Gateway PRD §8.3.3);`/api/auth/me` 的 apps 由 Gateway G3 提供,尚未實作前為 undefined */
export interface AppEntry {
  code: string;
  name: string;
  basePath: string;
  icon: string;
}
export type PortalMe = Me & { apps?: AppEntry[] };

/** 登入頁與未登入頁面的請求:401 不自動導向登入頁 */
const PUBLIC = { redirectOnAuthFailure: false } as const;

export async function login(username: string, password: string, remember: boolean): Promise<PortalMe> {
  const me = await http.post<PortalMe>('/api/auth/login', { username, password, remember }, PUBLIC);
  setMe(me);
  return me;
}

/** 變更密碼:已登入者需提供目前密碼;PASSWORD_CHANGE_REQUIRED 後持限定憑證者不需要(成功即完成登入) */
export async function changePassword(newPassword: string, currentPassword?: string): Promise<PortalMe> {
  const me = await http.post<PortalMe>('/api/auth/password/change', currentPassword === undefined ? { newPassword } : { currentPassword, newPassword }, PUBLIC);
  setMe(me);
  return me;
}

/** 自行註冊申請(工號 + 姓名;無 Email 者另填到職日)(Gateway PRD §8.2.5) */
export const register = (body: { employeeNo: string; name: string; hireDate?: string }) =>
  http.post<{ code: string; message: string }>('/api/auth/register', body, PUBLIC);

/** 以驗證 / 啟用連結的 token 設定密碼並啟用帳號 */
export const verifyRegistration = (token: string, password: string) =>
  http.post<{ code: string; message: string }>('/api/auth/register/verify', { token, password }, PUBLIC);

/** 寄送重設密碼連結(僅本機帳號) */
export const forgotPassword = (employeeNo: string) => http.post<{ code: string; message: string }>('/api/auth/password/forgot', { employeeNo }, PUBLIC);

/** 以 Email 連結的 token 重設密碼 */
export const resetPassword = (token: string, password: string) =>
  http.post<{ code: string; message: string }>('/api/auth/password/reset', { token, password }, PUBLIC);

/** 錯誤訊息顯示 BFF message 與 requestId 前 12 碼(PRD FR-6.9) */
export function describeError(e: unknown): string {
  if (e instanceof ApiError) return `${e.message}${e.requestId ? `(requestId ${e.requestId.slice(0, 12)})` : ''}`;
  if (e instanceof TypeError) return '無法連線伺服器,請確認網路';
  return e instanceof Error ? e.message : String(e);
}

/** 密碼政策錯誤的逐條說明(PASSWORD_POLICY_VIOLATION 的 details) */
export function policyMessages(e: unknown): string[] {
  if (!(e instanceof ApiError) || !Array.isArray(e.details)) return [];
  return e.details.map((d: { message?: string }) => d.message ?? '').filter(Boolean);
}
