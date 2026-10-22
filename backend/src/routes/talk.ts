/** 3691 全民開講 /v1/talk/*(docs/Gherkin/group/talk.feature;modules/talk/talk.ts) */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError } from '../errors.js';
import { employeeOf } from '../identity.js';
import { CONTENT_MAX, TALK_TYPES, TITLE_MAX, type TalkService } from '../modules/talk/talk.js';

const postSchema = {
  type: 'object',
  required: ['sn', 'parentSn', 'type', 'title', 'content', 'createdAt', 'blocked', 'likes', 'likedByMe'],
  properties: {
    sn: { type: 'integer' },
    parentSn: { type: ['integer', 'null'] },
    type: { type: 'string' },
    title: { type: 'string' },
    content: { type: 'string' },
    createdAt: { type: ['string', 'null'] },
    blocked: { type: 'boolean' },
    likes: { type: 'integer' },
    likedByMe: { type: 'boolean' },
  },
} as const;

const listResponse = {
  200: {
    type: 'object',
    required: ['items', 'types', 'canPost'],
    properties: { items: { type: 'array', items: postSchema }, types: { type: 'array', items: { type: 'string' } }, canPost: { type: 'boolean' } },
  },
} as const;

const typeQuery = { type: 'object', additionalProperties: false, properties: { type: { type: 'string', maxLength: 20 } } } as const;
const snParam = { type: 'object', required: ['sn'], properties: { sn: { type: 'integer', minimum: 1 } } } as const;

/** 「全部文件」或空白 = 不篩選 */
const typeOf = (q: { type?: string }) => (q.type && q.type !== '全部文件' ? q.type : null);

export function talkRoutes(service: TalkService | null) {
  const need = () => {
    if (!service) throw new AppError(503, 'PORTAL_SOURCE_UNAVAILABLE', '資料來源未設定');
    return service;
  };
  const emp = (req: FastifyRequest) => employeeOf(req).empNo;
  return async (app: FastifyInstance): Promise<void> => {
    app.get<{ Querystring: { type?: string } }>(
      '/v1/talk/posts',
      {
        schema: {
          operationId: 'portal.talk.list',
          summary: '3691:主題與回覆',
          description: '依分類列出主題與回覆(扁平清單,parentSn 組成樹狀;新到舊)。被屏蔽的發言標題與內容改為「該發言已屏蔽」、其下回覆不列出;不回傳作者。',
          'x-permission': 'portal.api.talk.read',
          'x-gherkin':
            '場景: 瀏覽討論串\n  當 呼叫 GET /api/portal/talk/posts?type=舉手發問\n  那麼 回應該分類的主題與回覆,不含作者;被屏蔽的顯示「該發言已屏蔽」',
          querystring: typeQuery,
          response: listResponse,
        },
      },
      async (req) => {
        const s = need();
        return { items: await s.list(emp(req), typeOf(req.query)), types: [...TALK_TYPES], canPost: s.canPost };
      },
    );

    app.get<{ Querystring: { type?: string } }>(
      '/v1/talk/moderation/posts',
      {
        schema: {
          operationId: 'portal.talk.moderation-list',
          summary: '3691:管理檢視(含被屏蔽原文)',
          description: '同一般檢視,但被屏蔽的發言顯示原標題與內容,其下回覆也列出(按鈕 portal.talk.moderate)。不回傳作者。',
          'x-permission': 'portal.api.talk.moderate',
          'x-gherkin':
            '場景: 管理者看得到被屏蔽的原文\n  假如 某發言已屏蔽\n  當 具 portal.talk.moderate 者呼叫 GET /api/portal/talk/moderation/posts\n  那麼 回應該發言原文與 blocked=true',
          querystring: typeQuery,
          response: listResponse,
        },
      },
      async (req) => {
        const s = need();
        return { items: await s.listForModerator(emp(req), typeOf(req.query)), types: [...TALK_TYPES], canPost: s.canPost };
      },
    );

    app.post<{ Body: { parentSn?: number | null; type?: string; title?: string; content: string } }>(
      '/v1/talk/posts',
      {
        schema: {
          operationId: 'portal.talk.post',
          summary: '3691:發表新主題 / 回覆',
          description:
            '新主題需分類(6 類)與標題;回覆帶 parentSn,分類沿用上層。內容為純文字(畫面一律編碼輸出)。作者工號以伺服器金鑰加密存 portal.talk_author(D-23),舊表 mark 留空;畫面與 API 不回傳作者。金鑰未設定回 503。',
          'x-permission': 'portal.api.talk.write',
          // 不可讓 Gateway 存取紀錄留下「誰在何時發文」:可與 CreateTime 比對回推匿名作者,繞過 D-23 解碼核准(資安審查 H-1)
          'x-audit-level': 'none',
          'x-gherkin':
            '場景: 匿名發文\n  當 呼叫 POST /api/portal/talk/posts,分類「舉手發問」、標題與內容\n  那麼 回應 201 與新 SN;Talk3691Data 多一筆(mark 為 NULL),portal.talk_author 存作者密文\n場景: 回覆被屏蔽的發言\n  那麼 回應 409 PORTAL_TALK_BLOCKED',
          body: {
            type: 'object',
            required: ['content'],
            additionalProperties: false,
            properties: {
              parentSn: { type: ['integer', 'null'], minimum: 1 },
              type: { type: 'string', enum: [...TALK_TYPES] },
              title: { type: 'string', maxLength: TITLE_MAX },
              content: { type: 'string', minLength: 1, maxLength: CONTENT_MAX },
            },
          },
          response: { 201: { type: 'object', required: ['sn'], properties: { sn: { type: 'integer' } } } },
        },
      },
      async (req, reply) => reply.status(201).send(await need().post(emp(req), req.body)),
    );

    app.post<{ Params: { sn: number } }>(
      '/v1/talk/posts/:sn/like',
      {
        schema: {
          operationId: 'portal.talk.like',
          summary: '3691:按讚',
          description: '每人每則一次(Talk3691Like,已按過不重複寫);被屏蔽的發言回 409。',
          'x-permission': 'portal.api.talk.write',
          'x-gherkin': '場景: 按讚\n  當 呼叫 POST /api/portal/talk/posts/12/like 兩次\n  那麼 Talk3691Like 只有一筆本人紀錄',
          params: snParam,
          response: { 200: { type: 'object', required: ['likes'], properties: { likes: { type: 'integer' } } } },
        },
      },
      async (req) => need().like(emp(req), req.params.sn),
    );

    app.put<{ Params: { sn: number }; Body: { blocked: boolean } }>(
      '/v1/talk/posts/:sn/block',
      {
        schema: {
          operationId: 'portal.talk.block',
          summary: '3691:屏蔽 / 取消屏蔽',
          description:
            '設定 Talk3691Data.IsBlack(與舊入口網共用)並寫 portal.talk_audit(誰、何時、屏蔽或取消)。按鈕 portal.talk.moderate,取代舊系統寫死的 5 個工號。',
          'x-permission': 'portal.api.talk.moderate',
          'x-audit-level': 'body',
          'x-gherkin':
            '場景: 屏蔽發言\n  當 具 portal.talk.moderate 者呼叫 PUT /api/portal/talk/posts/12/block,blocked=true\n  那麼 回應 204,一般檢視顯示「該發言已屏蔽」,稽核多一筆 block',
          params: snParam,
          body: { type: 'object', required: ['blocked'], additionalProperties: false, properties: { blocked: { type: 'boolean' } } },
        },
      },
      async (req, reply) => {
        await need().setBlocked(emp(req), req.params.sn, req.body.blocked);
        return reply.status(204).send();
      },
    );

    app.post<{ Params: { sn: number }; Body: { approvalNo: string; reason?: string } }>(
      '/v1/talk/posts/:sn/reveal',
      {
        schema: {
          operationId: 'portal.talk.reveal',
          summary: '3691:解碼作者(需核准文號)',
          description:
            'D-23:以伺服器金鑰解開作者工號;必填核准文號,每次嘗試(成功、舊站發文、無資料、解不開)都寫 portal.talk_audit。舊站發文(只有舊 DES mark)回 409 PORTAL_TALK_AUTHOR_LEGACY;沒有作者資料回 404 PORTAL_TALK_AUTHOR_NOT_FOUND。按鈕 portal.talk.reveal。**上線前需人資 / 法務書面確認(CONFIRM-NEEDED P3)**。',
          'x-permission': 'portal.api.talk.reveal',
          'x-audit-level': 'body',
          'x-gherkin':
            '場景: 解碼作者需核准文號並留稽核\n  當 具 portal.talk.reveal 者呼叫 POST /api/portal/talk/posts/12/reveal,核准文號「HR-2026-001」\n  那麼 回應作者工號,portal.talk_audit 多一筆 reveal(result=ok、核准文號)',
          params: snParam,
          body: {
            type: 'object',
            required: ['approvalNo'],
            additionalProperties: false,
            properties: { approvalNo: { type: 'string', minLength: 1, maxLength: 50, pattern: '\\S' }, reason: { type: 'string', maxLength: 200 } },
          },
          response: { 200: { type: 'object', required: ['sn', 'empNo'], properties: { sn: { type: 'integer' }, empNo: { type: 'string' } } } },
        },
      },
      async (req) => need().reveal(emp(req), req.params.sn, req.body.approvalNo, req.body.reason ?? null),
    );
  };
}
