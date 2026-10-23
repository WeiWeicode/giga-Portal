/**
 * P7 臨時服務 /v1/services/*、/v1/tv/board(FEATURE-PLAN §9、PORTAL-API-PLAN D-8;docs/Gherkin/services/*.feature)。
 * 有網址、不在選單:畫面節點在 deploy/gateway-rbac.yaml 目錄 portal.group.services(前端路由沒有 group,側欄 / 麵包屑不列),
 * 仍需登入與權限代碼;資料只看本人(Token 工號 / 部門),開放期間由資料決定,過期回 410 PORTAL_SERVICE_ENDED。
 * 邏輯在 modules/services/*;此檔只做 schema 驗證與權限宣告。
 */
import type { FastifyInstance } from 'fastify';
import { AppError } from '../errors.js';
import { employeeOf } from '../identity.js';
import { twParts } from '../modules/qa/rules.js';
import type { ConsentService, SignInput } from '../modules/services/consent.js';
import type { StockService } from '../modules/services/stock.js';
import { MAIL_TYPES, type PostInput, type PostService } from '../modules/services/post.js';
import { AUCTION_STEP, buildBidWorkbook, type AuctionService } from '../modules/services/auction.js';
import type { TvImageUpdate, TvService } from '../modules/services/tv.js';
import type { IsoService } from '../modules/services/iso.js';

export interface ServiceDeps {
  consent?: ConsentService | null;
  stock?: StockService | null;
  post?: PostService | null;
  auction?: AuctionService | null;
  tv?: TvService | null;
  iso?: IsoService | null;
  /** 測試用:固定「今天」 */
  now?: () => number;
}

const unavailable = () => new AppError(503, 'PORTAL_SOURCE_UNAVAILABLE', '資料來源未設定');
function need<T>(v: T | null | undefined): T {
  if (!v) throw unavailable();
  return v;
}

const consentDetail = {
  type: 'object',
  required: ['id', 'source', 'kind', 'title', 'html', 'startDate', 'endDate', 'state', 'signedAt', 'requireSign', 'agreeText', 'profile'],
  properties: {
    id: { type: 'string' },
    source: { type: 'string', enum: ['x', 'b'] },
    kind: { type: 'string' },
    title: { type: 'string' },
    html: { type: ['string', 'null'] },
    startDate: { type: ['string', 'null'] },
    endDate: { type: ['string', 'null'] },
    state: { type: 'string', enum: ['open', 'not-started', 'ended', 'signed'] },
    signedAt: { type: ['string', 'null'] },
    requireSign: { type: 'boolean' },
    agreeText: { type: 'string' },
    profile: {
      type: ['object', 'null'],
      properties: {
        empNo: { type: 'string' },
        name: { type: ['string', 'null'] },
        nationalIdLast4: { type: ['string', 'null'] },
        birthDate: { type: ['string', 'null'] },
      },
    },
  },
} as const;
const consentIdParam = { type: 'object', required: ['id'], properties: { id: { type: 'string', maxLength: 40 } } } as const;
const nullable = (type: string) => ({ type: [type, 'null'] }) as const;
const stockRowProps = {
  annual: { type: 'integer' },
  userId: { type: 'string' },
  userName: nullable('string'),
  stockType: nullable('string'),
  backStockNo: nullable('integer'),
  totalStockNo: nullable('integer'),
  joinDate: nullable('string'),
  backDate: nullable('string'),
  canBack: { type: 'boolean' },
} as const;
const stockDecision = {
  type: ['object', 'null'],
  properties: {
    annual: { type: 'integer' },
    doBack: { type: 'string' },
    backStockNo: nullable('integer'),
    confirmTime: nullable('string'),
    accountLast4: nullable('string'),
  },
} as const;
const stockView = {
  type: 'object',
  required: ['year', 'open', 'current', 'canDecide', 'decision', 'history'],
  properties: {
    year: { type: 'integer' },
    open: { type: 'boolean' },
    current: { type: 'array', items: { type: 'object', properties: { ...stockRowProps, selfProvided: { type: 'boolean' } } } },
    canDecide: { type: 'boolean' },
    decision: stockDecision,
    history: { type: 'array', items: { type: 'object', properties: { ...stockRowProps, decision: stockDecision } } },
  },
} as const;
const text = (max: number) => ({ type: 'string', maxLength: max }) as const;

export function serviceRoutes(deps: ServiceDeps) {
  const today = () => twParts((deps.now ?? Date.now)()).date;
  const year = () => Number(today().slice(0, 4));
  return async (app: FastifyInstance): Promise<void> => {
    // ───────────── 同意書 ─────────────
    app.get(
      '/v1/services/consents',
      {
        schema: {
          operationId: 'portal.services.consent-pending',
          summary: '同意書:本人待簽清單',
          description: '開放中、對象含本人且尚未簽署的同意書(GUID 版 ConsentX 與編號版 consent_def + ConsentCInfo);首頁待辦同一規則。',
          'x-permission': 'portal.api.svc.consent.read',
          'x-gherkin':
            '場景: 首頁待辦列出待簽同意書\n  假如 本人有 1 份開放中、未簽的同意書\n  當 呼叫 GET /api/portal/services/consents\n  那麼 回應 1 筆,含編號與標題',
          response: {
            200: {
              type: 'object',
              required: ['items'],
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['id', 'title', 'endDate'],
                    properties: { id: { type: 'string' }, title: { type: 'string' }, endDate: { type: ['string', 'null'] } },
                  },
                },
              },
            },
          },
        },
      },
      async (req) => ({ items: await need(deps.consent).pending(employeeOf(req), today()) }),
    );

    app.get<{ Params: { id: string } }>(
      '/v1/services/consents/:id',
      {
        schema: {
          operationId: 'portal.services.consent-detail',
          summary: '同意書:內容與簽署狀態',
          description:
            'id = ConsentX GUID 或編號(ConsentID)。對象不含本人回 403 PORTAL_DATA_ACCESS_DENIED;state = open / not-started / ended / signed;內文已白名單清洗並代入本人資料;身分證只回末 4 碼。',
          'x-permission': 'portal.api.svc.consent.read',
          'x-gherkin':
            '場景: 對象以部門完整比對\n  假如 同意書 Kdept = "S1800,S1900"\n  當 部門 S1810 的同仁呼叫 GET /api/portal/services/consents/<GUID>\n  那麼 回應 403 PORTAL_DATA_ACCESS_DENIED',
          params: consentIdParam,
          response: { 200: consentDetail },
        },
      },
      async (req) => need(deps.consent).detail(employeeOf(req), req.params.id, today()),
    );

    app.post<{ Params: { id: string }; Body: SignInput }>(
      '/v1/services/consents/:id/sign',
      {
        schema: {
          operationId: 'portal.services.consent-sign',
          summary: '同意書:勾選同意並簽署',
          description:
            '需 agree = true;GUID 版需簽名檔(前端先上傳 file-service,sourceApp portal-consent,送出後以 refType portal-consent 綁定);集保帳號調查需 fields(集保帳號 11 碼)。過期 410 PORTAL_SERVICE_ENDED,已簽 409 PORTAL_CONSENT_SIGNED(交易內檢查)。',
          'x-permission': 'portal.api.svc.consent.sign',
          'x-audit-level': 'meta',
          'x-gherkin':
            '場景: 後端擋重簽\n  假如 本人已簽過此同意書\n  當 呼叫 POST /api/portal/services/consents/<GUID>/sign\n  那麼 回應 409 PORTAL_CONSENT_SIGNED,ConsentXB 仍只有一筆',
          params: consentIdParam,
          body: {
            type: 'object',
            required: ['agree'],
            additionalProperties: false,
            properties: {
              agree: { type: 'boolean' },
              signatureFileId: { type: ['string', 'null'], maxLength: 36 },
              fields: {
                type: ['object', 'null'],
                required: ['phone', 'homeAddress', 'mailAddress', 'account'],
                additionalProperties: false,
                properties: { phone: text(40), homeAddress: text(200), mailAddress: text(200), account: text(20) },
              },
            },
          },
          response: {
            200: {
              type: 'object',
              required: ['signedAt', 'accountLast4'],
              properties: { signedAt: { type: 'string' }, accountLast4: { type: ['string', 'null'] } },
            },
          },
        },
      },
      async (req) => need(deps.consent).sign(employeeOf(req), req.params.id, req.body, today()),
    );

    // ───────────── 員工持股領回 ─────────────
    app.get(
      '/v1/services/stock',
      {
        schema: {
          operationId: 'portal.services.stock',
          summary: '員工持股領回:本人持股與回覆',
          description: '本人今年與歷年的持股(EmployeeStockInfo)與回覆(EmployeeStockLog);集保帳號只回末 4 碼;open = 今年有本人資料。',
          'x-permission': 'portal.api.svc.stock.read',
          'x-gherkin': '場景: 只列本人資料\n  當 呼叫 GET /api/portal/services/stock\n  那麼 只回本人的持股,集保帳號只顯示末 4 碼',
          response: { 200: stockView },
        },
      },
      async (req) => need(deps.stock).view(employeeOf(req), year()),
    );

    app.post<{ Body: { doBack: boolean; account?: string | null } }>(
      '/v1/services/stock/decision',
      {
        schema: {
          operationId: 'portal.services.stock-decide',
          summary: '員工持股領回:領回 / 不領回',
          description:
            '今年自提持股 CanBack = Y 才可送出(否則 409 PORTAL_STOCK_NOT_ELIGIBLE);領回需 11 碼集保帳號;每年度一筆(409 PORTAL_STOCK_DECIDED);今年沒有資料 410 PORTAL_SERVICE_ENDED。',
          'x-permission': 'portal.api.svc.stock.write',
          'x-audit-level': 'meta',
          'x-gherkin':
            '場景: 每年度一筆\n  假如 本人當年度已有回覆紀錄\n  當 呼叫 POST /api/portal/services/stock/decision\n  那麼 回應 409 PORTAL_STOCK_DECIDED',
          body: {
            type: 'object',
            required: ['doBack'],
            additionalProperties: false,
            properties: { doBack: { type: 'boolean' }, account: { type: ['string', 'null'], maxLength: 20 } },
          },
          response: { 200: stockView },
        },
      },
      async (req) => need(deps.stock).decide(employeeOf(req), year(), req.body),
    );

    // ───────────── 中華郵政寄件登記 ─────────────
    const postItem = {
      type: 'object',
      properties: {
        sn: { type: 'integer' },
        senderId: { type: 'string' },
        senderName: nullable('string'),
        sendDate: nullable('string'),
        dept: nullable('string'),
        receiver: nullable('string'),
        zip: nullable('string'),
        mailType: nullable('string'),
        callMailNo: nullable('string'),
        mailMoney: nullable('string'),
        mailReturnMoney: nullable('string'),
        locked: { type: 'boolean' },
      },
    } as const;
    const postBody = {
      type: 'object',
      required: ['senderId', 'dept', 'receiver', 'zip', 'sendDate', 'mailType'],
      additionalProperties: false,
      properties: {
        senderId: text(20),
        dept: text(20),
        receiver: text(100),
        zip: text(20),
        sendDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        mailType: { type: 'string', enum: [...MAIL_TYPES] },
      },
    } as const;
    const snParam = { type: 'object', required: ['sn'], properties: { sn: { type: 'integer', minimum: 1 } } } as const;
    const monthAgo = () => {
      const d = new Date(`${today()}T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() - 1);
      return d.toISOString().slice(0, 10);
    };

    app.get<{ Querystring: { from?: string; to?: string } }>(
      '/v1/services/post',
      {
        schema: {
          operationId: 'portal.services.post-list',
          summary: '中華郵政寄件登記:本人清單',
          description: '寄件人 = 本人、未作廢、寄件日期在區間內(預設近一個月,最多 400 天);locked = 已有郵資,不可修改 / 作廢。',
          'x-permission': 'portal.api.svc.post.read',
          'x-gherkin': '場景: 本人清單\n  當 呼叫 GET /api/portal/services/post\n  那麼 只列寄件人 = 本人、未作廢的登記',
          querystring: {
            type: 'object',
            properties: { from: { type: 'string', maxLength: 10 }, to: { type: 'string', maxLength: 10 } },
          },
          response: {
            200: {
              type: 'object',
              required: ['items', 'mailTypes'],
              properties: { items: { type: 'array', items: postItem }, mailTypes: { type: 'array', items: { type: 'string' } } },
            },
          },
        },
      },
      async (req) => ({
        items: await need(deps.post).list(employeeOf(req), req.query.from || monthAgo(), req.query.to || today()),
        mailTypes: [...MAIL_TYPES],
      }),
    );

    app.get<{ Querystring: { q: string } }>(
      '/v1/services/post/senders',
      {
        schema: {
          operationId: 'portal.services.post-senders',
          summary: '中華郵政寄件登記:選擇寄件人',
          description: '在職員工搜尋(工號開頭或姓名包含),最多 20 筆;只回工號、姓名、部門代碼。',
          'x-permission': 'portal.api.svc.post.read',
          'x-gherkin': '場景: 寄件人以工號精確選擇\n  當 呼叫 GET /api/portal/services/post/senders?q=S1120\n  那麼 回應在職員工的工號與姓名',
          querystring: { type: 'object', required: ['q'], properties: { q: { type: 'string', minLength: 1, maxLength: 20 } } },
          response: {
            200: {
              type: 'object',
              required: ['items'],
              properties: {
                items: {
                  type: 'array',
                  items: { type: 'object', properties: { empNo: { type: 'string' }, name: { type: 'string' }, dept: nullable('string') } },
                },
              },
            },
          },
        },
      },
      async (req) => {
        employeeOf(req);
        return { items: await need(deps.post).senders(req.query.q) };
      },
    );

    app.post<{ Body: PostInput }>(
      '/v1/services/post',
      {
        schema: {
          operationId: 'portal.services.post-create',
          summary: '中華郵政寄件登記:新增',
          description: '寄件人須為在職員工(工號精確比對);費用部門、收件人、郵遞區號、寄件日期、類別必填。',
          'x-permission': 'portal.api.svc.post.write',
          'x-audit-level': 'body',
          'x-gherkin': '場景: 寄件人以工號精確選擇\n  當 呼叫 POST /api/portal/services/post,寄件人工號不是在職員工\n  那麼 回應 400',
          body: postBody,
          response: { 201: { type: 'object', required: ['sn'], properties: { sn: { type: 'integer' } } } },
        },
      },
      async (req, reply) => {
        employeeOf(req);
        return reply.status(201).send(await need(deps.post).create(req.body));
      },
    );

    app.put<{ Params: { sn: number }; Body: PostInput }>(
      '/v1/services/post/:sn',
      {
        schema: {
          operationId: 'portal.services.post-update',
          summary: '中華郵政寄件登記:修改',
          description: '只能修改寄件人 = 本人的登記(403 PORTAL_DATA_ACCESS_DENIED);已有郵資回 409 PORTAL_POST_LOCKED。',
          'x-permission': 'portal.api.svc.post.write',
          'x-audit-level': 'body',
          'x-gherkin': '場景: 有郵資後不可改或作廢\n  假如 總務已填入郵資\n  當 呼叫 PUT /api/portal/services/post/1\n  那麼 回應 409 PORTAL_POST_LOCKED',
          params: snParam,
          body: postBody,
        },
      },
      async (req, reply) => {
        await need(deps.post).update(employeeOf(req), req.params.sn, req.body);
        return reply.status(204).send();
      },
    );

    app.delete<{ Params: { sn: number } }>(
      '/v1/services/post/:sn',
      {
        schema: {
          operationId: 'portal.services.post-void',
          summary: '中華郵政寄件登記:作廢',
          description: '設 IsActive = 0(同舊版);只能作廢寄件人 = 本人且尚無郵資的登記。',
          'x-permission': 'portal.api.svc.post.write',
          'x-audit-level': 'meta',
          'x-gherkin':
            '場景: 只能修改或作廢自己的\n  假如 登記的寄件人不是本人\n  當 呼叫 DELETE /api/portal/services/post/1\n  那麼 回應 403 PORTAL_DATA_ACCESS_DENIED',
          params: snParam,
        },
      },
      async (req, reply) => {
        await need(deps.post).void(employeeOf(req), req.params.sn);
        return reply.status(204).send();
      },
    );

    // ───────────── 內部拍賣 ─────────────
    const bidView = {
      type: 'object',
      properties: {
        key: nullable('string'),
        amount: nullable('integer'),
        time: nullable('string'),
        mine: { type: 'boolean' },
        empNo: nullable('string'),
        name: nullable('string'),
      },
    } as const;
    const auctionList = {
      200: {
        type: 'object',
        required: ['items', 'step'],
        properties: {
          step: { type: 'integer' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                html: { type: 'string' },
                startDate: nullable('string'),
                endDate: nullable('string'),
                highest: nullable('integer'),
                minBid: { type: 'integer' },
                bidCount: { type: 'integer' },
                bids: { type: 'array', items: bidView },
              },
            },
          },
        },
      },
    } as const;
    const guidParam = { type: 'object', required: ['id'], properties: { id: { type: 'string', maxLength: 40 } } } as const;

    app.get(
      '/v1/services/auction',
      {
        schema: {
          operationId: 'portal.services.auction-list',
          summary: '內部拍賣:拍賣品與出價',
          description: 'ContentType = 購物台、未下架、今天在起訖日內的拍賣品;出價人工號 / 姓名只在本人的出價回傳,其他人的為 null。',
          'x-permission': 'portal.api.svc.auction.read',
          'x-gherkin': '場景: 列出期間內的拍賣品\n  當 呼叫 GET /api/portal/services/auction\n  那麼 出價人姓名只在本人的出價顯示',
          response: auctionList,
        },
      },
      async (req) => ({ step: AUCTION_STEP, items: await need(deps.auction).list(employeeOf(req), today(), false) }),
    );

    app.get(
      '/v1/services/auction/admin',
      {
        schema: {
          operationId: 'portal.services.auction-admin',
          summary: '內部拍賣:管理清單',
          description: '同拍賣品清單,另含每筆出價的工號、姓名與刪除用識別碼;須具 portal.svc.auction.admin(取代舊版寫死的 3 個工號)。',
          'x-permission': 'portal.api.svc.auction.admin',
          'x-gherkin':
            '場景: 管理員刪除出價與匯出\n  當 具 portal.svc.auction.admin 者呼叫 GET /api/portal/services/auction/admin\n  那麼 看得到每筆出價的工號與姓名',
          response: auctionList,
        },
      },
      async (req) => ({ step: AUCTION_STEP, items: await need(deps.auction).list(employeeOf(req), today(), true) }),
    );

    app.post<{ Params: { id: string }; Body: { amount: number } }>(
      '/v1/services/auction/:id/bids',
      {
        schema: {
          operationId: 'portal.services.auction-bid',
          summary: '內部拍賣:出價',
          description: `出價須 ≥ 該品項目前最高價 + ${AUCTION_STEP}(409 PORTAL_AUCTION_BID_TOO_LOW,details 含 minBid);已過期或下架 410 PORTAL_SERVICE_ENDED;交易內鎖定該品項出價。`,
          'x-permission': 'portal.api.svc.auction.bid',
          'x-audit-level': 'body',
          'x-gherkin': '場景: 出價至少比目前最高價高 1000\n  假如 目前最高價 10000\n  當 出價 10500\n  那麼 回應 409 PORTAL_AUCTION_BID_TOO_LOW',
          params: guidParam,
          body: {
            type: 'object',
            required: ['amount'],
            additionalProperties: false,
            properties: { amount: { type: 'integer', minimum: 1, maximum: 100000000 } },
          },
        },
      },
      async (req, reply) => {
        await need(deps.auction).bid(employeeOf(req), req.params.id, req.body.amount, today());
        return reply.status(204).send();
      },
    );

    app.delete<{ Params: { id: string }; Querystring: { key: string } }>(
      '/v1/services/auction/:id/bids',
      {
        schema: {
          operationId: 'portal.services.auction-bid-delete',
          summary: '內部拍賣:刪除出價',
          description: '以管理清單的出價識別碼刪除(IsActive = 0、DeleteDate = 現在,同舊版);須具 portal.svc.auction.admin。',
          'x-permission': 'portal.api.svc.auction.admin',
          'x-audit-level': 'meta',
          'x-gherkin':
            '場景: 管理員刪除出價與匯出\n  當 呼叫 DELETE /api/portal/services/auction/<GUID>/bids?key=<識別碼>\n  那麼 該筆 IsActive = 0,最高價重新計算',
          params: guidParam,
          querystring: { type: 'object', required: ['key'], properties: { key: { type: 'string', maxLength: 50 } } },
        },
      },
      async (req, reply) => {
        employeeOf(req);
        await need(deps.auction).deleteBid(req.params.id, req.query.key);
        return reply.status(204).send();
      },
    );

    app.get<{ Params: { id: string } }>(
      '/v1/services/auction/:id/export',
      {
        schema: {
          operationId: 'portal.services.auction-export',
          summary: '內部拍賣:匯出出價',
          description: '該品項全部有效出價 .xlsx(上傳日期、工號、姓名、出價);須具 portal.svc.auction.admin。',
          'x-permission': 'portal.api.svc.auction.admin',
          'x-audit-level': 'meta',
          'x-gherkin': '場景: 管理員刪除出價與匯出\n  當 呼叫 GET /api/portal/services/auction/<GUID>/export\n  那麼 下載 xlsx',
          params: guidParam,
        },
      },
      async (req, reply) => {
        employeeOf(req);
        const buf = await buildBidWorkbook(await need(deps.auction).exportRows(req.params.id));
        return reply
          .header('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
          .header('content-disposition', `attachment; filename="auction.xlsx"; filename*=UTF-8''${encodeURIComponent('拍賣出價.xlsx')}`)
          .header('cache-control', 'no-store')
          .send(buf);
      },
    );

    // ───────────── 電視看板 ─────────────
    const boardImage = {
      type: 'object',
      properties: {
        source: { type: 'string', enum: ['legacy', 'file'] },
        key: { type: 'string' },
        url: nullable('string'),
        fileId: { type: 'string' },
        name: { type: 'string' },
      },
    } as const;
    const boardProps = { message: { type: 'string' }, fontSize: { type: 'integer' }, images: { type: 'array', items: boardImage } } as const;
    const tvSettings = {
      200: {
        type: 'object',
        properties: {
          ...boardProps,
          legacy: {
            type: 'array',
            items: {
              type: 'object',
              properties: { path: { type: 'string' }, index: nullable('integer'), active: { type: 'boolean' }, url: nullable('string') },
            },
          },
          uploaded: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                fileId: { type: 'string' },
                fileName: { type: 'string' },
                sort: { type: 'integer' },
                active: { type: 'boolean' },
              },
            },
          },
        },
      },
    } as const;

    app.get(
      '/v1/tv/board',
      {
        // 公共螢幕匿名顯示:Gateway 路由為 public(需 IT 核准),不帶內部 Token;只回看板內容,不含人員資料
        config: { gatewayAuth: false },
        schema: {
          operationId: 'portal.tv.board',
          summary: '電視看板:看板內容(免登入)',
          description:
            '跑馬燈文字、字級與顯示中的圖片(舊圖 = 舊入口網 Document 網址;新圖 = file-service 檔案編號,下載仍需 file-service 權限,見 CONFIRM-NEEDED P7)。',
          'x-permission': 'public',
          'x-gherkin': '場景: 看板不需登入\n  當 未登入呼叫 GET /api/portal/tv/board\n  那麼 回應跑馬燈文字、字級與顯示中的圖片,不含人員資料',
          response: { 200: { type: 'object', required: ['message', 'fontSize', 'images'], properties: boardProps } },
        },
      },
      async (_req, reply) => reply.header('cache-control', 'no-store').send(await need(deps.tv).board()),
    );

    app.get(
      '/v1/services/tv',
      {
        schema: {
          operationId: 'portal.services.tv-settings',
          summary: '電視看板:設定',
          description: '跑馬燈、舊圖(TVImgInfo,含隱藏)與新站上傳的圖片(portal.tv_image)。',
          'x-permission': 'portal.api.svc.tv.read',
          'x-gherkin': '場景: 設定頁需登入與權限\n  當 具 portal.api.svc.tv.read 者呼叫 GET /api/portal/services/tv\n  那麼 回應跑馬燈與全部圖片',
          response: tvSettings,
        },
      },
      async (req) => {
        employeeOf(req);
        return need(deps.tv).settings();
      },
    );

    app.put<{ Body: { message: string; fontSize: number } }>(
      '/v1/services/tv/message',
      {
        schema: {
          operationId: 'portal.services.tv-message',
          summary: '電視看板:更新跑馬燈',
          description: '更新 TVShowInfo(舊看板同步顯示);文字最多 500 字、不可含 < > 與控制字元;字級 8~200。',
          'x-permission': 'portal.api.svc.tv.edit',
          'x-audit-level': 'body',
          'x-gherkin': '場景: 更新跑馬燈\n  當 呼叫 PUT /api/portal/services/tv/message,文字含 < >\n  那麼 回應 400',
          body: {
            type: 'object',
            required: ['message', 'fontSize'],
            additionalProperties: false,
            properties: { message: text(500), fontSize: { type: 'integer', minimum: 8, maximum: 200 } },
          },
        },
      },
      async (req, reply) => {
        employeeOf(req);
        await need(deps.tv).setMessage(req.body);
        return reply.status(204).send();
      },
    );

    app.post<{ Body: { fileId: string; fileName: string } }>(
      '/v1/services/tv/images',
      {
        schema: {
          operationId: 'portal.services.tv-image-add',
          summary: '電視看板:新增圖片',
          description: '前端先上傳到 file-service(sourceApp / refType portal-tv),再登記檔案編號;只接受 jpg / png / gif / webp。',
          'x-permission': 'portal.api.svc.tv.edit',
          'x-audit-level': 'body',
          'x-gherkin': '場景: 新增圖片只收圖片\n  當 呼叫 POST /api/portal/services/tv/images,檔名為 .exe\n  那麼 回應 400',
          body: {
            type: 'object',
            required: ['fileId', 'fileName'],
            additionalProperties: false,
            properties: { fileId: text(36), fileName: text(200) },
          },
          response: {
            201: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                fileId: { type: 'string' },
                fileName: { type: 'string' },
                sort: { type: 'integer' },
                active: { type: 'boolean' },
              },
            },
          },
        },
      },
      async (req, reply) => reply.status(201).send(await need(deps.tv).addImage(req.body.fileId, req.body.fileName, employeeOf(req).empNo)),
    );

    app.put<{ Body: { items: TvImageUpdate[] } }>(
      '/v1/services/tv/images',
      {
        schema: {
          operationId: 'portal.services.tv-image-update',
          summary: '電視看板:調整圖片順序與顯示',
          description: '舊圖以 ImgPath 更新 TVImgInfo._Index / IsActive(同舊版);新圖更新 portal.tv_image;順序 0~255。',
          'x-permission': 'portal.api.svc.tv.edit',
          'x-audit-level': 'body',
          'x-gherkin': '場景: 調整順序與顯示\n  當 呼叫 PUT /api/portal/services/tv/images\n  那麼 舊圖更新 TVImgInfo、新圖更新 portal.tv_image',
          body: {
            type: 'object',
            required: ['items'],
            additionalProperties: false,
            properties: {
              items: {
                type: 'array',
                maxItems: 200,
                items: {
                  type: 'object',
                  required: ['source', 'sort', 'active'],
                  additionalProperties: false,
                  properties: {
                    source: { type: 'string', enum: ['legacy', 'file'] },
                    path: text(1000),
                    id: { type: 'integer', minimum: 1 },
                    sort: { type: 'integer', minimum: 0, maximum: 255 },
                    active: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
      async (req, reply) => {
        const me = employeeOf(req);
        for (const i of req.body.items)
          if ((i.source === 'legacy' && !i.path) || (i.source === 'file' && !i.id)) throw new AppError(400, 'VALIDATION_FAILED', '舊圖需 path、新圖需 id');
        await need(deps.tv).updateImages(req.body.items, me.empNo);
        return reply.status(204).send();
      },
    );

    app.delete<{ Params: { id: number } }>(
      '/v1/services/tv/images/:id',
      {
        schema: {
          operationId: 'portal.services.tv-image-delete',
          summary: '電視看板:刪除新站圖片',
          description: '移除 portal.tv_image 登記(file-service 檔案依其保存規則處理);舊圖只能隱藏。',
          'x-permission': 'portal.api.svc.tv.edit',
          'x-audit-level': 'meta',
          'x-gherkin': '場景: 調整順序與顯示\n  當 呼叫 DELETE /api/portal/services/tv/images/1\n  那麼 回應 204',
          params: { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } },
        },
      },
      async (req, reply) => {
        employeeOf(req);
        await need(deps.tv).deleteImage(req.params.id);
        return reply.status(204).send();
      },
    );

    // ───────────── ISO 文件庫(唯讀,來源待確認)─────────────
    const isoDoc = { type: 'object', properties: { docNo: { type: 'string' }, docName: { type: 'string' }, levelId: nullable('string') } } as const;
    const isoLink = {
      type: 'object',
      properties: { docNo: { type: 'string' }, docName: { type: 'string' }, displayVersion: nullable('string'), url: nullable('string') },
    } as const;

    app.get(
      '/v1/services/iso/clauses',
      {
        schema: {
          operationId: 'portal.services.iso-clauses',
          summary: 'ISO 文件庫:條文分類',
          description: 'NaNa v_ISO_Docs_Clause_Solar 的條文分類(排除「合約」「矽晶材料」開頭);來源未設定或未授權回 503 PORTAL_SOURCE_UNAVAILABLE。',
          'x-permission': 'portal.api.svc.iso.read',
          'x-gherkin': '場景: 依條文分類列出文件\n  當 呼叫 GET /api/portal/services/iso/clauses\n  那麼 列出條文分類',
          response: { 200: { type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'string' } } } } },
        },
      },
      async (req) => {
        employeeOf(req);
        return { items: await need(deps.iso).clauses() };
      },
    );

    app.get<{ Querystring: { clause?: string; q?: string } }>(
      '/v1/services/iso/docs',
      {
        schema: {
          operationId: 'portal.services.iso-docs',
          summary: 'ISO 文件庫:文件清單',
          description: '依條文分類(clause)或關鍵字(q:文件名稱、條文、文件編號部分比對,最多 200 筆)列出現行有效文件。',
          'x-permission': 'portal.api.svc.iso.read',
          'x-gherkin': '場景: 關鍵字查詢\n  當 呼叫 GET /api/portal/services/iso/docs?q=管理\n  那麼 以文件名稱、條文、文件編號部分比對',
          querystring: { type: 'object', properties: { clause: { type: 'string', maxLength: 200 }, q: { type: 'string', maxLength: 100 } } },
          response: { 200: { type: 'object', required: ['items'], properties: { items: { type: 'array', items: isoDoc } } } },
        },
      },
      async (req) => {
        employeeOf(req);
        return { items: await need(deps.iso).docs(req.query) };
      },
    );

    app.get<{ Params: { docNo: string } }>(
      '/v1/services/iso/docs/:docNo',
      {
        schema: {
          operationId: 'portal.services.iso-doc',
          summary: 'ISO 文件庫:文件明細',
          description: '現行版本、生效 / 失效日、檔案連結(ISO_DOC_BASE_URL)與參考 / 上階 / 下階文件;已失效或不存在回 404 PORTAL_ISO_NOT_FOUND。',
          'x-permission': 'portal.api.svc.iso.read',
          'x-gherkin': '場景: 文件明細\n  當 呼叫 GET /api/portal/services/iso/docs/QM-01\n  那麼 回應現行版本、檔案連結與相關文件',
          params: { type: 'object', required: ['docNo'], properties: { docNo: { type: 'string', maxLength: 60 } } },
          response: {
            200: {
              type: 'object',
              properties: {
                docNo: { type: 'string' },
                docName: { type: 'string' },
                displayVersion: nullable('string'),
                version: nullable('string'),
                clauseName: nullable('string'),
                validFrom: nullable('string'),
                validTo: nullable('string'),
                levelId: nullable('string'),
                url: nullable('string'),
                references: { type: 'array', items: isoLink },
                uppers: { type: 'array', items: isoLink },
                lowers: { type: 'array', items: isoLink },
              },
            },
          },
        },
      },
      async (req) => {
        employeeOf(req);
        return need(deps.iso).detail(req.params.docNo);
      },
    );
  };
}
