/**
 * 首頁 /v1/dashboard、首頁輪播維護 /v1/home/slides、舊入口網公告 /v1/news/legacy
 * (FEATURE-PLAN §1、§5;PORTAL-API-PLAN D-21;docs/Gherkin/home/home.feature、group/news.feature)
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError } from '../errors.js';
import { employeeOf } from '../identity.js';
import { SLIDE_KINDS, type ContentService, type SlideInput } from '../modules/home/content.js';
import type { DashboardService } from '../modules/home/dashboard.js';
import type { LegacyNewsRepo } from '../modules/home/legacy-repo.js';
import { twParts } from '../modules/qa/rules.js';

const nstr = { type: ['string', 'null'] } as const;
const dateOrNull = { anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }] } as const;

const slideSchema = {
  type: 'object',
  required: ['id', 'kind', 'title', 'fileId', 'linkUrl', 'startDate', 'endDate', 'sort', 'active'],
  properties: {
    id: { type: 'integer' },
    kind: { type: 'string' },
    title: { type: 'string' },
    fileId: { type: 'string' },
    linkUrl: nstr,
    startDate: nstr,
    endDate: nstr,
    sort: { type: 'integer' },
    active: { type: 'boolean' },
  },
} as const;

const slideBody = {
  type: 'object',
  required: ['kind', 'title', 'fileId', 'sort', 'active'],
  additionalProperties: false,
  properties: {
    kind: { type: 'string', enum: [...SLIDE_KINDS] },
    title: { type: 'string', minLength: 1, maxLength: 100, pattern: '\\S' },
    fileId: { type: 'string', maxLength: 36 },
    linkUrl: { type: ['string', 'null'], maxLength: 500 },
    startDate: dateOrNull,
    endDate: dateOrNull,
    sort: { type: 'integer', minimum: 0, maximum: 100000 },
    active: { type: 'boolean' },
  },
} as const;

const newsSchema = {
  type: 'object',
  required: ['id', 'title', 'type', 'date', 'url'],
  properties: { id: { type: 'string' }, title: { type: 'string' }, type: { type: 'string' }, date: nstr, url: nstr },
} as const;

const linkSchema = {
  type: 'object',
  required: ['id', 'name', 'url', 'sort'],
  properties: { id: { type: 'integer' }, name: { type: 'string' }, url: { type: 'string' }, sort: { type: 'integer' } },
} as const;

const todoSchema = {
  type: 'object',
  required: ['kind', 'title', 'count', 'date', 'to', 'href'],
  properties: { kind: { type: 'string' }, title: { type: 'string' }, count: { type: ['integer', 'null'] }, date: nstr, to: nstr, href: nstr },
} as const;

const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } } as const;

export function homeRoutes(dashboard: DashboardService | null, content: ContentService | null, news: LegacyNewsRepo | null) {
  const needContent = () => {
    if (!content) throw new AppError(503, 'PORTAL_SOURCE_UNAVAILABLE', '資料來源未設定');
    return content;
  };
  const emp = (req: FastifyRequest) => employeeOf(req).empNo;
  return async (app: FastifyInstance): Promise<void> => {
    app.get(
      '/v1/dashboard',
      {
        schema: {
          operationId: 'portal.home.dashboard',
          summary: '首頁聚合',
          description:
            '首頁一次取得:待辦事項(BPM 待簽核 / 未結案、未填問卷、到職 90 天內未完成新人導覽、今天到期的個人提醒)、個人秘書(BPM 筆數與前往 BPM、個人常用連結)、舊入口網公告(D-21)、公告輪播 / 集團動態。單一來源失敗只在 _meta.errors 標示,該區塊回 null;未設定或未實作的來源列在 _meta.unavailable(FR-4.8)。',
          'x-permission': 'portal.api.home.read',
          'x-gherkin':
            '場景: 首屏只呼叫兩支 API\n  當 開啟首頁\n  那麼 只呼叫 GET /api/auth/me 與 GET /api/portal/dashboard\n場景: 部分區塊失敗不影響其他區塊\n  假如 BPM 查詢失敗\n  當 呼叫 GET /api/portal/dashboard\n  那麼 回應 200,_meta.errors 含 bpm,其他區塊正常',
          response: {
            200: {
              type: 'object',
              required: ['todos', 'secretary', 'news', 'slides', '_meta'],
              properties: {
                todos: { type: 'object', required: ['items'], properties: { items: { type: 'array', items: todoSchema } } },
                secretary: {
                  type: 'object',
                  required: ['bpm', 'links'],
                  properties: {
                    bpm: {
                      type: ['object', 'null'],
                      required: ['pending', 'abnormal', 'unclosed', 'hasAccount', 'homeUrl'],
                      properties: {
                        pending: { type: 'integer' },
                        abnormal: { type: 'integer' },
                        unclosed: { type: 'integer' },
                        hasAccount: { type: 'boolean' },
                        homeUrl: { type: 'string' },
                      },
                    },
                    links: { type: ['array', 'null'], items: linkSchema },
                  },
                },
                news: {
                  type: ['object', 'null'],
                  required: ['total', 'items'],
                  properties: { total: { type: 'integer' }, items: { type: 'array', items: newsSchema } },
                },
                slides: {
                  type: ['object', 'null'],
                  required: ['policy', 'gallery'],
                  properties: { policy: { type: 'array', items: slideSchema }, gallery: { type: 'array', items: slideSchema } },
                },
                _meta: {
                  type: 'object',
                  required: ['errors', 'unavailable'],
                  properties: {
                    errors: {
                      type: 'array',
                      items: { type: 'object', required: ['section', 'message'], properties: { section: { type: 'string' }, message: { type: 'string' } } },
                    },
                    unavailable: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
      async (req) => {
        if (!dashboard) throw new AppError(503, 'PORTAL_SOURCE_UNAVAILABLE', '資料來源未設定');
        return dashboard.build(employeeOf(req), req.log);
      },
    );

    app.get<{ Querystring: { q?: string; page?: number; pageSize?: number } }>(
      '/v1/news/legacy',
      {
        schema: {
          operationId: 'portal.news.legacy',
          summary: '舊入口網公告(唯讀)',
          description:
            'D-21:並行期把舊站 ContentX 公告唯讀併入「最新公告」,條件同舊首頁(類型 最新消息 / 環安公告 / 集團Notes公告、期間內、未下架、Notes 公告對象為三家全體);url 為舊站公告頁(未設定 LEGACY_PORTAL_URL 時為 null)。舊站下線後移除。',
          'x-permission': 'portal.api.news.read',
          'x-gherkin': '場景: 舊入口網公告唯讀併入\n  當 呼叫 GET /api/portal/news/legacy\n  那麼 回應期間內的舊站公告(新到舊、分頁),畫面標示來源「舊入口網」',
          querystring: {
            type: 'object',
            additionalProperties: false,
            properties: {
              q: { type: 'string', maxLength: 50 },
              page: { type: 'integer', minimum: 1, default: 1 },
              pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            },
          },
          response: {
            200: {
              type: 'object',
              required: ['items', 'total', 'page', 'pageSize'],
              properties: { items: { type: 'array', items: newsSchema }, total: { type: 'integer' }, page: { type: 'integer' }, pageSize: { type: 'integer' } },
            },
          },
        },
      },
      async (req) => {
        employeeOf(req);
        if (!news) throw new AppError(503, 'PORTAL_SOURCE_UNAVAILABLE', '資料來源未設定');
        const page = req.query.page ?? 1;
        const pageSize = req.query.pageSize ?? 20;
        const today = twParts().date.replaceAll('-', '/');
        const r = await news.list({ today, q: req.query.q, offset: (page - 1) * pageSize, limit: pageSize });
        return { ...r, page, pageSize };
      },
    );

    app.get(
      '/v1/home/slides',
      {
        schema: {
          operationId: 'portal.home.slide-list',
          summary: '首頁輪播:維護清單',
          description: '全部輪播圖片(含停用與過期),供維護畫面使用(按鈕 portal.home.edit)。',
          'x-permission': 'portal.api.home.edit',
          'x-gherkin': '場景: 維護首頁輪播\n  當 具 portal.home.edit 者呼叫 GET /api/portal/home/slides\n  那麼 回應全部輪播圖片(含停用、過期)',
          response: { 200: { type: 'object', required: ['items'], properties: { items: { type: 'array', items: slideSchema } } } },
        },
      },
      async (req) => {
        employeeOf(req);
        return { items: await needContent().allSlides() };
      },
    );

    app.post<{ Body: SlideInput }>(
      '/v1/home/slides',
      {
        schema: {
          operationId: 'portal.home.slide-create',
          summary: '首頁輪播:新增',
          description:
            '登記一張已上傳到 giga-file-service 的圖片(fileId = UUID;前端上傳後以 refType portal-home 綁定)。種類 policy = 公告輪播、gallery = 集團動態;起訖日空白 = 不限。',
          'x-permission': 'portal.api.home.edit',
          'x-gherkin':
            '場景: 新增輪播圖片\n  當 呼叫 POST /api/portal/home/slides,種類 policy、圖片 UUID、起訖日\n  那麼 回應 201;期間內首頁「公告輪播」顯示此圖',
          body: slideBody,
          response: { 201: slideSchema },
        },
      },
      async (req, reply) => reply.status(201).send(await needContent().createSlide(req.body, emp(req))),
    );

    app.put<{ Params: { id: number }; Body: SlideInput }>(
      '/v1/home/slides/:id',
      {
        schema: {
          operationId: 'portal.home.slide-update',
          summary: '首頁輪播:修改',
          description: '修改標題、圖片、連結、起訖日、排序、啟用;不存在回 404 PORTAL_SLIDE_NOT_FOUND。',
          'x-permission': 'portal.api.home.edit',
          'x-gherkin': '場景: 停用輪播圖片\n  當 呼叫 PUT /api/portal/home/slides/1,active=false\n  那麼 首頁不再顯示此圖',
          params: idParam,
          body: slideBody,
          response: { 200: slideSchema },
        },
      },
      async (req) => needContent().updateSlide(req.params.id, req.body, emp(req)),
    );

    app.delete<{ Params: { id: number } }>(
      '/v1/home/slides/:id',
      {
        schema: {
          operationId: 'portal.home.slide-delete',
          summary: '首頁輪播:刪除',
          description: '刪除登記(圖片檔仍在 file-service,依其保存規則處理)。',
          'x-permission': 'portal.api.home.edit',
          'x-gherkin': '場景: 刪除輪播圖片\n  當 呼叫 DELETE /api/portal/home/slides/1\n  那麼 回應 204',
          params: idParam,
        },
      },
      async (req, reply) => {
        employeeOf(req);
        await needContent().deleteSlide(req.params.id);
        return reply.status(204).send();
      },
    );
  };
}
