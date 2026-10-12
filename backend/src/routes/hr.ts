/**
 * 人資專區文件(PORTAL-API-PLAN D-14):含人員姓名的文件不放前端公開目錄,經 Gateway 驗證與權限後由 portal-api 提供。
 *   GET /v1/hr/manager-agents:各部門主管職務代理人名單 PDF(舊站 Document/碩禾主管職務代理人名單_2501023.pdf;backend/assets/hr/)
 * 檔案隨映像檔發佈;更新名單時替換 backend/assets/hr/manager-agents.pdf 後重新部署。
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { AppError } from '../errors.js';
import { employeeOf } from '../identity.js';

export const ASSETS_DIR = path.resolve(process.cwd(), 'assets');
const AGENTS_FILE = 'hr/manager-agents.pdf';
const AGENTS_NAME = '碩禾主管職務代理人名單.pdf';

export function hrRoutes(assetsDir = ASSETS_DIR) {
  return async (app: FastifyInstance): Promise<void> => {
    app.get(
      '/v1/hr/manager-agents',
      {
        schema: {
          operationId: 'portal.hr.manager-agents',
          summary: '人資專區:主管職務代理人名單',
          description: '下載各部門主管職務代理人名單 PDF(含人員姓名,需登入與權限;不放在公開的 /legacy-docs)。',
          'x-permission': 'portal.api.hr.read',
          'x-gherkin': '場景: 開啟主管職務代理人名單\n  假如 同仁已登入且有人資專區權限\n  當 呼叫 GET /api/portal/hr/manager-agents\n  那麼 回應 PDF',
        },
      },
      async (req, reply) => {
        employeeOf(req);
        let pdf: Buffer;
        try {
          pdf = await readFile(path.join(assetsDir, AGENTS_FILE));
        } catch {
          throw new AppError(404, 'PORTAL_DOCUMENT_NOT_FOUND', '找不到此文件');
        }
        return reply
          .header('content-type', 'application/pdf')
          .header('content-disposition', `inline; filename="manager-agents.pdf"; filename*=UTF-8''${encodeURIComponent(AGENTS_NAME)}`)
          .header('cache-control', 'private, no-store')
          .send(pdf);
      },
    );
  };
}
