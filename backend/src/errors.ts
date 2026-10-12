/** 錯誤(BACKEND-GUIDE.md §5.3):自訂代碼以 PORTAL_ 開頭;不可使用 Gateway 專用代碼 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** 資料依身分過濾,違反時一律回此錯誤(HANDOFF §3) */
export const dataAccessDenied = (message = '無權存取此資料') => new AppError(403, 'PORTAL_DATA_ACCESS_DENIED', message);
