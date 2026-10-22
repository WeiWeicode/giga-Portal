/**
 * 集團系統 /v1/links、個人常用連結 /v1/personal-links(FEATURE-PLAN §1、§5、§6.3;PORTAL-API-PLAN D-22;
 * docs/Gherkin/group/links.feature、home/home.feature;modules/links/links.ts)
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError } from '../errors.js';
import { employeeOf } from '../identity.js';
import { OPEN_MODES, type LinkService, type PersonalLinkInput, type SystemLinkInput } from '../modules/links/links.js';

const systemSchema = {
  type: 'object',
  required: ['id', 'name', 'description', 'category', 'url', 'openMode', 'legacyDes', 'sort', 'active'],
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    category: { type: 'string' },
    url: { type: ['string', 'null'] },
    openMode: { type: 'string' },
    legacyDes: { type: 'boolean' },
    sort: { type: 'integer' },
    active: { type: 'boolean' },
  },
} as const;
const systemBody = {
  type: 'object',
  required: ['name', 'category', 'openMode', 'legacyDes', 'sort', 'active'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100, pattern: '\\S' },
    description: { type: ['string', 'null'], maxLength: 300 },
    category: { type: 'string', minLength: 1, maxLength: 30, pattern: '\\S' },
    url: { type: ['string', 'null'], maxLength: 500 },
    openMode: { type: 'string', enum: [...OPEN_MODES] },
    legacyDes: { type: 'boolean' },
    sort: { type: 'integer', minimum: 0, maximum: 100000 },
    active: { type: 'boolean' },
  },
} as const;

const personalSchema = {
  type: 'object',
  required: ['id', 'name', 'url', 'sort'],
  properties: { id: { type: 'integer' }, name: { type: 'string' }, url: { type: 'string' }, sort: { type: 'integer' } },
} as const;
const personalBody = {
  type: 'object',
  required: ['name', 'url'],
  additionalProperties: false,
  properties: { name: { type: 'string', minLength: 1, maxLength: 50, pattern: '\\S' }, url: { type: 'string', minLength: 1, maxLength: 500 } },
} as const;

const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } } as const;
const items = (schema: object) => ({ 200: { type: 'object', required: ['items'], properties: { items: { type: 'array', items: schema } } } });

export function linkRoutes(service: LinkService | null) {
  const need = () => {
    if (!service) throw new AppError(503, 'PORTAL_SOURCE_UNAVAILABLE', '資料來源未設定');
    return service;
  };
  const emp = (req: FastifyRequest) => employeeOf(req).empNo;
  return async (app: FastifyInstance): Promise<void> => {
    // ───────── 集團系統 ─────────
    app.get(
      '/v1/links',
      {
        schema: {
          operationId: 'portal.link.list',
          summary: '集團系統:清單',
          description: '啟用中的集團系統連結(依排序)。legacyDes = true 的項目為舊站 DES 跳轉系統,url 一律 null,畫面只顯示「DES 跳轉(待重構)」(D-22)。',
          'x-permission': 'portal.api.link.read',
          'x-gherkin': '場景: DES 跳轉系統只顯示標示\n  當 呼叫 GET /api/portal/links\n  那麼 訂便當等舊 DES 跳轉系統 legacyDes=true、url=null',
          response: items(systemSchema),
        },
      },
      async (req) => {
        employeeOf(req);
        return { items: await need().systemLinks(false) };
      },
    );

    app.get(
      '/v1/links/admin',
      {
        schema: {
          operationId: 'portal.link.admin-list',
          summary: '集團系統:維護清單',
          description: '全部集團系統連結(含停用),供維護畫面(按鈕 portal.links.edit)。',
          'x-permission': 'portal.api.link.edit',
          'x-gherkin': '場景: 維護清單含停用項目\n  當 具 portal.links.edit 者呼叫 GET /api/portal/links/admin\n  那麼 回應含停用的連結',
          response: items(systemSchema),
        },
      },
      async (req) => {
        employeeOf(req);
        return { items: await need().systemLinks(true) };
      },
    );

    app.post<{ Body: SystemLinkInput }>(
      '/v1/links',
      {
        schema: {
          operationId: 'portal.link.create',
          summary: '集團系統:新增',
          description: '新增連結;網址只接受 http(s) 或站內路徑。勾選 legacyDes 時不存網址。',
          'x-permission': 'portal.api.link.edit',
          'x-gherkin':
            '場景: 新增集團系統\n  當 呼叫 POST /api/portal/links,名稱「BPM」、網址 http://bpm.example/NaNaWeb/\n  那麼 回應 201\n場景: 拒絕不安全的網址\n  當 網址為 javascript:alert(1)\n  那麼 回應 400 VALIDATION_FAILED',
          body: systemBody,
          response: { 201: systemSchema },
        },
      },
      async (req, reply) => reply.status(201).send(await need().createSystemLink(req.body, emp(req))),
    );

    app.put<{ Params: { id: number }; Body: SystemLinkInput }>(
      '/v1/links/:id',
      {
        schema: {
          operationId: 'portal.link.update',
          summary: '集團系統:修改',
          description: '修改連結;不存在回 404 PORTAL_LINK_NOT_FOUND。',
          'x-permission': 'portal.api.link.edit',
          'x-gherkin': '場景: 停用集團系統\n  當 呼叫 PUT /api/portal/links/1,active=false\n  那麼 GET /api/portal/links 不再列出',
          params: idParam,
          body: systemBody,
          response: { 200: systemSchema },
        },
      },
      async (req) => need().updateSystemLink(req.params.id, req.body, emp(req)),
    );

    app.delete<{ Params: { id: number } }>(
      '/v1/links/:id',
      {
        schema: {
          operationId: 'portal.link.delete',
          summary: '集團系統:刪除',
          description: '刪除連結;不存在回 404 PORTAL_LINK_NOT_FOUND。',
          'x-permission': 'portal.api.link.edit',
          'x-gherkin': '場景: 刪除集團系統\n  當 呼叫 DELETE /api/portal/links/1\n  那麼 回應 204',
          params: idParam,
        },
      },
      async (req, reply) => {
        employeeOf(req);
        await need().deleteSystemLink(req.params.id);
        return reply.status(204).send();
      },
    );

    // ───────── 個人常用連結 ─────────
    app.get(
      '/v1/personal-links',
      {
        schema: {
          operationId: 'portal.personal-link.list',
          summary: '個人常用連結:清單',
          description: '本人的常用連結(依排序)。',
          'x-permission': 'portal.api.personal-link.read',
          'x-gherkin': '場景: 只看得到自己的常用連結\n  當 呼叫 GET /api/portal/personal-links\n  那麼 只回應本人的連結',
          response: items(personalSchema),
        },
      },
      async (req) => ({ items: await need().personalLinks(emp(req)) }),
    );

    app.post<{ Body: PersonalLinkInput }>(
      '/v1/personal-links',
      {
        schema: {
          operationId: 'portal.personal-link.create',
          summary: '個人常用連結:新增',
          description: '新增本人的常用連結(每人最多 20 筆,409 PORTAL_LINK_LIMIT);網址只接受 http(s) 或站內路徑。',
          'x-permission': 'portal.api.personal-link.write',
          'x-gherkin':
            '場景: 新增常用連結\n  當 呼叫 POST /api/portal/personal-links,名稱「報修」、網址 https://it.example/\n  那麼 回應 201,首頁個人秘書列出此連結',
          body: personalBody,
          response: { 201: personalSchema },
        },
      },
      async (req, reply) => reply.status(201).send(await need().createPersonalLink(emp(req), req.body)),
    );

    app.put<{ Body: { ids: number[] } }>(
      '/v1/personal-links/order',
      {
        schema: {
          operationId: 'portal.personal-link.reorder',
          summary: '個人常用連結:排序',
          description: '依 ids 順序重設排序;ids 必須剛好是本人全部連結。',
          'x-permission': 'portal.api.personal-link.write',
          'x-gherkin': '場景: 調整常用連結順序\n  當 呼叫 PUT /api/portal/personal-links/order,ids [3, 1, 2]\n  那麼 回應依新順序排列的清單',
          body: {
            type: 'object',
            required: ['ids'],
            additionalProperties: false,
            properties: { ids: { type: 'array', maxItems: 50, items: { type: 'integer', minimum: 1 } } },
          },
          response: items(personalSchema),
        },
      },
      async (req) => ({ items: await need().reorderPersonalLinks(emp(req), req.body.ids) }),
    );

    app.put<{ Params: { id: number }; Body: PersonalLinkInput }>(
      '/v1/personal-links/:id',
      {
        schema: {
          operationId: 'portal.personal-link.update',
          summary: '個人常用連結:修改',
          description: '修改本人的連結;別人的回 404 PORTAL_LINK_NOT_FOUND。',
          'x-permission': 'portal.api.personal-link.write',
          'x-gherkin': '場景: 不能改別人的常用連結\n  當 呼叫 PUT /api/portal/personal-links/<別人的 id>\n  那麼 回應 404',
          params: idParam,
          body: personalBody,
          response: { 200: personalSchema },
        },
      },
      async (req) => need().updatePersonalLink(emp(req), req.params.id, req.body),
    );

    app.delete<{ Params: { id: number } }>(
      '/v1/personal-links/:id',
      {
        schema: {
          operationId: 'portal.personal-link.delete',
          summary: '個人常用連結:刪除',
          description: '刪除本人的連結;別人的回 404 PORTAL_LINK_NOT_FOUND。',
          'x-permission': 'portal.api.personal-link.write',
          'x-gherkin': '場景: 刪除常用連結\n  當 呼叫 DELETE /api/portal/personal-links/1\n  那麼 回應 204',
          params: idParam,
        },
      },
      async (req, reply) => {
        await need().deletePersonalLink(emp(req), req.params.id);
        return reply.status(204).send();
      },
    );
  };
}
