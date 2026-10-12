/**
 * 身分(PORTAL-API-PLAN D-5):員工 / 部門以 Gateway 內部 Token 為準,LOS 只在舊表需要對照時查。
 * 系統對系統呼叫(API Key、Webhook)沒有員工身分,員工資料 API 一律拒絕。
 */
import type { FastifyRequest } from 'fastify';
import { AppError, dataAccessDenied } from './errors.js';

export interface Employee {
  /** 工號(Token emp;舊表的 UserID / LgNo) */
  empNo: string;
  name: string | null;
  /** 部門代碼(Token dept);部門含下層由需要的功能另行查詢 */
  dept: string | null;
  companies: string[];
}

export function employeeOf(req: FastifyRequest): Employee {
  const id = req.identity;
  if (!id) throw new AppError(401, 'PORTAL_INTERNAL_TOKEN_INVALID', '缺少內部 Token');
  const isSystem = id.amr === 'api_key' || id.amr === 'webhook' || id.sub.startsWith('client:') || id.sub.startsWith('webhook:');
  if (isSystem || !id.emp) throw dataAccessDenied('此 API 只提供員工本人使用');
  return { empNo: id.emp, name: id.name ?? null, dept: id.dept ?? null, companies: id.cos ?? [] };
}
