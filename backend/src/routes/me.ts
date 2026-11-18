/** GET /v1/me:目前登入者的身分(docs/Gherkin/api/skeleton.feature);前端與部署後冒煙測試用 */
import type { FastifyInstance } from 'fastify';
import { employeeOf } from '../identity.js';

const meSchema = {
  type: 'object',
  required: ['empNo', 'name', 'dept', 'companies'],
  properties: {
    empNo: { type: 'string' },
    name: { type: ['string', 'null'] },
    dept: { type: ['string', 'null'] },
    companies: { type: 'array', items: { type: 'string' } },
  },
} as const;

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/v1/me',
    {
      schema: {
        operationId: 'portal.me.get',
        summary: '目前登入者',
        description: '回傳內部 Token 中的工號、姓名、部門與公司;系統對系統呼叫回 403。',
        'x-permission': 'authenticated',
        'x-gherkin':
          '場景: 取得目前登入者的身分\n  假如 內部 Token 的工號 "S112009"\n  當 呼叫 GET /api/portal/me\n  那麼 回應 200,內容為工號、姓名、部門、公司',
        response: { 200: meSchema },
      },
    },
    async (req) => employeeOf(req),
  );
}
