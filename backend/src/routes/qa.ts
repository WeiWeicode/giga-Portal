/**
 * 問卷調查 /v1/qa/*(old_PortalSolar QA/MyQAList、QuestSetting、QuestView;FEATURE-PLAN §3.4;PORTAL-API-PLAN D-18、D-19、D-28;
 * docs/Gherkin/resources/qa.feature;邏輯在 modules/qa/qa.ts)。
 *   填答:  /v1/qa/pending*                portal.api.qa.read / portal.api.qa.write(所有員工)
 *   出題者:/v1/qa/surveys*、/v1/qa/org/*  portal.api.qa.edit(按鈕 portal.qa.edit;只看自己建立的)
 *   代管:  /v1/qa/admin/surveys*          portal.api.qa.admin(按鈕 portal.qa.admin;全部出題者)
 * 權限由 BFF 依 x-permission 檢查;代管與一般出題者用不同路徑,讓 BFF 分別控管(內部 Token 不帶權限清單)。
 */
import type { FastifyInstance, FastifyReply } from 'fastify';
import { AppError } from '../errors.js';
import { employeeOf } from '../identity.js';
import { buildAnswerWorkbook, contentDisposition } from '../modules/qa/export.js';
import type { JobTier, QaService, Scope, SurveyInput } from '../modules/qa/qa.js';
import type { AnswerInput } from '../modules/qa/rules.js';

const qaNoParam = { type: 'object', required: ['qaNo'], properties: { qaNo: { type: 'string', pattern: '^[A-Za-z0-9]{1,50}$' } } } as const;

const imageSchema = {
  type: 'object',
  required: ['fileId', 'position'],
  additionalProperties: false,
  properties: {
    fileId: { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' },
    position: { type: 'string', enum: ['before', 'after'] },
    width: { type: 'integer', minimum: 0, maximum: 2000 },
    height: { type: 'integer', minimum: 0, maximum: 2000 },
  },
} as const;

const questionOut = {
  type: 'object',
  required: ['no', 'type', 'text', 'options', 'limit', 'required', 'image', 'legacyImage'],
  properties: {
    no: { type: 'integer' },
    type: { type: ['string', 'null'] },
    text: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } },
    limit: { type: ['integer', 'null'] },
    required: { type: 'boolean' },
    image: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: { fileId: { type: 'string' }, position: { type: 'string' }, width: { type: 'integer' }, height: { type: 'integer' } },
        },
      ],
    },
    legacyImage: { type: 'boolean' },
  },
} as const;

const viewProps = {
  qaNo: { type: 'string' },
  title: { type: 'string' },
  dept: { type: ['string', 'null'] },
  intro: { type: 'string' },
  outro: { type: 'string' },
  startDate: { type: ['string', 'null'] },
  endDate: { type: ['string', 'null'] },
  questions: { type: 'array', items: questionOut },
} as const;

const targetsSchema = {
  type: 'object',
  required: ['all', 'depts', 'emps'],
  additionalProperties: false,
  properties: {
    all: { type: 'boolean' },
    depts: { type: 'array', maxItems: 1000, items: { type: 'string', maxLength: 20 } },
    emps: { type: 'array', maxItems: 2000, items: { type: 'string', maxLength: 20 } },
  },
} as const;

const surveyBody = {
  type: 'object',
  required: ['title', 'startDate', 'endDate', 'targets', 'questions'],
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 400 },
    dept: { type: 'string', maxLength: 20 },
    intro: { type: 'string', maxLength: 400_000 },
    outro: { type: 'string', maxLength: 400_000 },
    startDate: { type: 'string', format: 'date' },
    endDate: { type: 'string', format: 'date' },
    targets: targetsSchema,
    questions: {
      type: 'array',
      minItems: 1,
      maxItems: 200,
      items: {
        type: 'object',
        required: ['type', 'text', 'required'],
        additionalProperties: false,
        properties: {
          type: { type: 'string', enum: ['single', 'multi', 'text'] },
          text: { type: 'string', maxLength: 1000 },
          options: { type: 'array', maxItems: 100, items: { type: 'string', maxLength: 100 } },
          limit: { type: ['integer', 'null'], minimum: 1 },
          required: { type: 'boolean' },
          image: { anyOf: [{ type: 'null' }, imageSchema] },
        },
      },
    },
  },
} as const;

const listItem = {
  type: 'object',
  properties: {
    qaNo: { type: 'string' },
    title: { type: 'string' },
    dept: { type: ['string', 'null'] },
    startDate: { type: ['string', 'null'] },
    endDate: { type: ['string', 'null'] },
    creator: { type: ['string', 'null'] },
    active: { type: 'boolean' },
    questionCount: { type: 'integer' },
    respondents: { type: 'integer' },
    locked: { type: 'boolean' },
  },
} as const;

const statsSchema = {
  type: 'object',
  required: ['qaNo', 'title', 'respondents', 'questions', 'unavailable'],
  properties: {
    qaNo: { type: 'string' },
    title: { type: 'string' },
    respondents: { type: 'integer' },
    unavailable: { type: 'array', items: { type: 'string' } },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          no: { type: 'integer' },
          text: { type: 'string' },
          type: { type: ['string', 'null'] },
          answered: { type: 'integer' },
          items: {
            type: 'array',
            items: { type: 'object', properties: { answer: { type: 'string' }, count: { type: 'integer' }, percent: { type: 'number' } } },
          },
        },
      },
    },
  },
} as const;

/** 前言 / 結語可含舊站內嵌圖片(data:image),放寬到 4 MB(BFF 上限 10 MB) */
const BODY_LIMIT = 4 * 1024 * 1024;

const created = { 201: { type: 'object', required: ['qaNo'], properties: { qaNo: { type: 'string' } } } } as const;

export function qaRoutes(service: QaService | null) {
  const need = () => {
    if (!service) throw new AppError(503, 'PORTAL_SOURCE_UNAVAILABLE', '資料來源未設定');
    return service;
  };

  /** 出題者路由:prefix /v1/qa/surveys(本人)或 /v1/qa/admin/surveys(代管) */
  const manage = (app: FastifyInstance, admin: boolean) => {
    const base = admin ? '/v1/qa/admin/surveys' : '/v1/qa/surveys';
    const perm = admin ? 'portal.api.qa.admin' : 'portal.api.qa.edit';
    const op = admin ? 'portal.qa.admin' : 'portal.qa';
    const who = admin ? '(代管:全部出題者)' : '(只限本人建立的問卷,他人的回 403)';
    const scopeOf = (req: Parameters<typeof employeeOf>[0]): Scope => ({ empNo: employeeOf(req).empNo, admin });

    app.get<{ Querystring: { q?: string; current?: boolean; creator?: string; page?: number; pageSize?: number } }>(
      base,
      {
        schema: {
          operationId: `${op}.list`,
          summary: `問卷維護:清單${admin ? '(代管)' : ''}`,
          description: `啟用中的問卷${who};current=true 只列今天在起訖日內的;q 比對標題${admin ? ';creator 篩選出題者工號' : ''}。新到舊分頁。`,
          'x-permission': perm,
          'x-gherkin': admin
            ? '場景: 代管查看全部問卷\n  當 具 portal.qa.admin 者呼叫 GET /api/portal/qa/admin/surveys?creator=S100001\n  那麼 回應該出題者的問卷'
            : '場景: 只列自己建立的問卷\n  假如 S100001 與 S100002 各建立一份問卷\n  當 S100001 呼叫 GET /api/portal/qa/surveys\n  那麼 只回應 S100001 的問卷',
          querystring: {
            type: 'object',
            additionalProperties: false,
            properties: {
              q: { type: 'string', maxLength: 100 },
              current: { type: 'boolean', default: false },
              ...(admin ? { creator: { type: 'string', maxLength: 20, pattern: '^[A-Za-z0-9]*$' } } : {}),
              page: { type: 'integer', minimum: 1, default: 1 },
              pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            },
          },
          response: {
            200: {
              type: 'object',
              required: ['items', 'total', 'page', 'pageSize'],
              properties: { items: { type: 'array', items: listItem }, total: { type: 'integer' }, page: { type: 'integer' }, pageSize: { type: 'integer' } },
            },
          },
        },
      },
      async (req) => {
        const q = req.query;
        return need().list(
          scopeOf(req),
          { ...(q.q ? { q: q.q } : {}), current: q.current ?? false, ...(q.creator ? { creator: q.creator } : {}) },
          q.page ?? 1,
          q.pageSize ?? 20,
        );
      },
    );

    app.get<{ Params: { qaNo: string } }>(
      `${base}/:qaNo`,
      {
        schema: {
          operationId: `${op}.get`,
          summary: `問卷維護:內容${admin ? '(代管)' : ''}`,
          description: `問卷設定、題目、對象、作答人數與是否鎖定${who};前言 / 結語以白名單清洗後回傳。也用於預覽(預覽不會寫入作答)。`,
          'x-permission': perm,
          'x-gherkin': '場景: 讀取問卷設定\n  當 出題者呼叫 GET /api/portal/qa/surveys/{QANo}\n  那麼 回應題目、對象與 locked(已有作答為 true)',
          params: qaNoParam,
          response: {
            200: {
              type: 'object',
              properties: {
                ...viewProps,
                creator: { type: ['string', 'null'] },
                active: { type: 'boolean' },
                targets: targetsSchema,
                respondents: { type: 'integer' },
                locked: { type: 'boolean' },
              },
            },
          },
        },
      },
      async (req) => need().detail(scopeOf(req), req.params.qaNo),
    );

    app.put<{ Params: { qaNo: string }; Body: SurveyInput }>(
      `${base}/:qaNo`,
      {
        bodyLimit: BODY_LIMIT,
        schema: {
          operationId: `${op}.update`,
          summary: `問卷維護:修改${admin ? '(代管)' : ''}`,
          description: `修改問卷${who};不改建立者。已有作答時題目結構(題數、題型、選項、複選上限、必填)鎖定,只能改文字、圖片、對象與起訖日,違反回 409 PORTAL_QA_LOCKED。`,
          'x-permission': perm,
          'x-audit-level': 'meta',
          'x-gherkin':
            '場景: 已有作答後不可改題目結構\n  假如 問卷已有 1 人作答\n  當 呼叫 PUT 刪除一題\n  那麼 回應 409 PORTAL_QA_LOCKED,資料不變\n場景: 已有作答仍可改起訖日\n  當 呼叫 PUT 只改結束日\n  那麼 回應 204',
          params: qaNoParam,
          body: surveyBody,
        },
      },
      async (req, reply) => {
        await need().update(scopeOf(req), req.params.qaNo, req.body);
        return reply.status(204).send();
      },
    );

    app.delete<{ Params: { qaNo: string } }>(
      `${base}/:qaNo`,
      {
        schema: {
          operationId: `${op}.delete`,
          summary: `問卷維護:刪除${admin ? '(代管)' : ''}`,
          description: `軟刪除(IsActive = 0),題目與作答保留${who}。`,
          'x-permission': perm,
          'x-audit-level': 'meta',
          'x-gherkin': '場景: 刪除問卷\n  當 呼叫 DELETE /api/portal/qa/surveys/{QANo}\n  那麼 回應 204,QAAnnual.IsActive = 0,作答保留',
          params: qaNoParam,
        },
      },
      async (req, reply) => {
        await need().remove(scopeOf(req), req.params.qaNo);
        return reply.status(204).send();
      },
    );

    app.post<{ Params: { qaNo: string } }>(
      `${base}/:qaNo/copy`,
      {
        schema: {
          operationId: `${op}.copy`,
          summary: `問卷維護:複製${admin ? '(代管)' : ''}`,
          description: `複製主檔、題目、圖片(不複製作答)${who};新編號 Q + 時間 + 操作者工號,建立者為操作者,標題加 Copy。`,
          'x-permission': perm,
          'x-audit-level': 'meta',
          'x-gherkin': '場景: 複製問卷\n  當 呼叫 POST /api/portal/qa/surveys/{QANo}/copy\n  那麼 回應 201 與新編號;新問卷沒有作答',
          params: qaNoParam,
          response: created,
        },
      },
      async (req, reply) => reply.status(201).send(await need().copy(scopeOf(req), employeeOf(req), req.params.qaNo)),
    );

    app.get<{ Params: { qaNo: string } }>(
      `${base}/:qaNo/stats`,
      {
        schema: {
          operationId: `${op}.stats`,
          summary: `問卷維護:統計${admin ? '(代管)' : ''}`,
          description: `每題答案分布(人數、百分比;分母 = 作答人數,複選題可超過 100%)${who};依人事屬性分組系統轉移中(unavailable 含 hr)。`,
          'x-permission': perm,
          'x-gherkin': '場景: 單題統計\n  假如 2 人作答,單選題 1 人選「滿意」\n  當 呼叫 GET /api/portal/qa/surveys/{QANo}/stats\n  那麼「滿意」為 1 人、50%',
          params: qaNoParam,
          response: { 200: statsSchema },
        },
      },
      async (req) => need().stats(scopeOf(req), req.params.qaNo),
    );

    app.get<{ Params: { qaNo: string } }>(
      `${base}/:qaNo/export`,
      {
        schema: {
          operationId: `${op}.export`,
          summary: `問卷維護:匯出作答明細 Excel${admin ? '(代管)' : ''}`,
          description: `作答明細 .xlsx(部門、工號、姓名、題號、題目、答案、填答時間)${who};人事屬性系統轉移中不匯出。`,
          'x-permission': perm,
          'x-audit-level': 'meta',
          'x-gherkin': '場景: 匯出作答明細\n  當 呼叫 GET /api/portal/qa/surveys/{QANo}/export\n  那麼 下載 xlsx,一列一個答案',
          params: qaNoParam,
        },
      },
      async (req, reply: FastifyReply) => {
        const { title, rows } = await need().exportRows(scopeOf(req), req.params.qaNo);
        const buf = await buildAnswerWorkbook(title, rows);
        return reply
          .header('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
          .header('content-disposition', contentDisposition(title))
          .header('cache-control', 'no-store')
          .send(buf);
      },
    );
  };

  return async (app: FastifyInstance): Promise<void> => {
    // ───────────── 填答 ─────────────
    app.get(
      '/v1/qa/pending',
      {
        schema: {
          operationId: 'portal.qa.pending',
          summary: '問卷:我的待填問卷',
          description: '啟用中、今天在起訖日內、本人在對象內(全集團;或 Token 部門完整比對在對象部門;或工號在對象人員)且尚未作答的問卷,依截止日排序。',
          'x-permission': 'portal.api.qa.read',
          'x-gherkin':
            '場景: 只列待填問卷\n  假如 本人部門 S1420,問卷 A 對象部門 S1420、問卷 B 對象部門 S14、問卷 C 已作答\n  當 呼叫 GET /api/portal/qa/pending\n  那麼 只回應問卷 A(部門完整比對)',
          response: {
            200: {
              type: 'object',
              required: ['items'],
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      qaNo: { type: 'string' },
                      title: { type: 'string' },
                      dept: { type: ['string', 'null'] },
                      startDate: { type: ['string', 'null'] },
                      endDate: { type: ['string', 'null'] },
                      questionCount: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      async (req) => ({ items: await need().pending(employeeOf(req)) }),
    );

    app.get<{ Params: { qaNo: string } }>(
      '/v1/qa/pending/:qaNo',
      {
        schema: {
          operationId: 'portal.qa.fill',
          summary: '問卷:填答內容',
          description: '問卷標題、前言 / 結語(白名單清洗)、題目;不符填寫資格(已刪除、不在期間、非對象)回 404,已作答回 409 PORTAL_QA_ANSWERED。',
          'x-permission': 'portal.api.qa.read',
          'x-gherkin': '場景: 非對象不可開啟\n  假如 問卷對象為其他部門\n  當 呼叫 GET /api/portal/qa/pending/{QANo}\n  那麼 回應 404 PORTAL_QA_NOT_FOUND',
          params: qaNoParam,
          response: { 200: { type: 'object', properties: viewProps } },
        },
      },
      async (req) => need().forFill(employeeOf(req), req.params.qaNo),
    );

    app.post<{ Params: { qaNo: string }; Body: { answers: AnswerInput[] } }>(
      '/v1/qa/pending/:qaNo/answers',
      {
        schema: {
          operationId: 'portal.qa.submit',
          summary: '問卷:送出作答',
          description:
            '一次送出整份作答(單 / 複選以選項文字、問答以 text)。後端再驗填寫資格、必填、單選一項、複選上限;整份一個交易寫入 QAAnnualC(每題一列、複選每個勾選項一列、人事屬性 NULL);已作答回 409 PORTAL_QA_ANSWERED。',
          'x-permission': 'portal.api.qa.write',
          'x-audit-level': 'meta',
          'x-gherkin':
            '場景: 複選題全部勾選項都寫入\n  當 送出複選題勾選第 1、3 項\n  那麼 QAAnnualC 該題寫入 2 列\n場景: 已填過\n  假如 本人已作答\n  當 再送出\n  那麼 回應 409 PORTAL_QA_ANSWERED,不寫入',
          params: qaNoParam,
          body: {
            type: 'object',
            required: ['answers'],
            additionalProperties: false,
            properties: {
              answers: {
                type: 'array',
                maxItems: 200,
                items: {
                  type: 'object',
                  required: ['no'],
                  additionalProperties: false,
                  properties: {
                    no: { type: 'integer', minimum: 1 },
                    choices: { type: 'array', maxItems: 100, items: { type: 'string', maxLength: 300 } },
                    text: { type: 'string', maxLength: 2000 },
                  },
                },
              },
            },
          },
          response: { 201: { type: 'object', required: ['answeredAt'], properties: { answeredAt: { type: 'string' } } } },
        },
      },
      async (req, reply) => reply.status(201).send(await need().submit(employeeOf(req), req.params.qaNo, req.body.answers)),
    );

    // ───────────── 出題者 ─────────────
    app.post<{ Body: SurveyInput }>(
      '/v1/qa/surveys',
      {
        bodyLimit: BODY_LIMIT,
        schema: {
          operationId: 'portal.qa.create',
          summary: '問卷維護:新增',
          description:
            '新增問卷:編號 Q + yyyyMMddHHmmss + 工號、建立者 = 本人;主檔、題目、圖片同一交易寫入。題目 / 選項 / 標題不可包含 < >,前言 / 結語以白名單清洗;對象部門(含下層由畫面展開)與工號寫成逗號清單。',
          'x-permission': 'portal.api.qa.edit',
          'x-audit-level': 'meta',
          'x-gherkin':
            '場景: 新增問卷\n  當 呼叫 POST /api/portal/qa/surveys,1 題單選題、對象部門 S1420\n  那麼 回應 201 與新編號;QAAnnual.CLgNo = 本人、IsActive = 1',
          body: surveyBody,
          response: created,
        },
      },
      async (req, reply) => reply.status(201).send(await need().create(employeeOf(req), req.body)),
    );
    manage(app, false);
    manage(app, true);

    app.get(
      '/v1/qa/org/departments',
      {
        schema: {
          operationId: 'portal.qa.departments',
          summary: '問卷維護:部門樹',
          description: '設定對象部門用的部門清單(LOS DeptInfo:代碼、名稱、上層代碼),畫面組成部門樹並展開下層。',
          'x-permission': 'portal.api.qa.edit',
          'x-gherkin': '場景: 取得部門樹\n  當 呼叫 GET /api/portal/qa/org/departments\n  那麼 回應部門代碼、名稱與上層代碼',
          response: {
            200: {
              type: 'object',
              required: ['items'],
              properties: {
                items: {
                  type: 'array',
                  items: { type: 'object', properties: { code: { type: 'string' }, name: { type: ['string', 'null'] }, parent: { type: ['string', 'null'] } } },
                },
              },
            },
          },
        },
      },
      async (req) => {
        employeeOf(req);
        return { items: await need().departments() };
      },
    );

    app.get<{ Querystring: { tier: JobTier } }>(
      '/v1/qa/org/job-tier',
      {
        schema: {
          operationId: 'portal.qa.job-tier',
          summary: '問卷維護:職級快速帶入',
          description:
            '「課級以上(section)/ 理級以上(manager)」的在職工號,依 Gateway 職級門檻(PRD §8.3.4);Gateway 尚未提供查詢介面前回 503 PORTAL_JOB_TIER_UNAVAILABLE。',
          'x-permission': 'portal.api.qa.edit',
          'x-gherkin': '場景: 職級資料未提供\n  當 呼叫 GET /api/portal/qa/org/job-tier?tier=manager\n  那麼 回應 503 PORTAL_JOB_TIER_UNAVAILABLE',
          querystring: {
            type: 'object',
            required: ['tier'],
            additionalProperties: false,
            properties: { tier: { type: 'string', enum: ['section', 'manager'] } },
          },
          response: { 200: { type: 'object', required: ['emps'], properties: { emps: { type: 'array', items: { type: 'string' } } } } },
        },
      },
      async (req) => ({ emps: await need().jobTier(employeeOf(req), req.query.tier) }),
    );
  };
}
