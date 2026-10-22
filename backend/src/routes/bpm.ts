/**
 * BPM 簽核資訊 /v1/bpm/*(docs/Gherkin/personal/bpm.feature、approval/approval.feature;modules/bpm/bpm.ts)。
 * P1-3「BPM 簽核資訊」與 P4「待我簽核」共用:待簽核(pending)、我送出的(requested)、已簽核 / 經辦過(handled)。
 * 只讀 NaNa;核准 / 退回一律以深連結回 BPM 原畫面完成(D-6、D-24)。D-29:非碩禾系公司回空清單(applicable = false)。
 */
import type { FastifyInstance } from 'fastify';
import { AppError } from '../errors.js';
import { employeeOf } from '../identity.js';
import { REQUESTED_STATES, type BpmService, type RequestedState } from '../modules/bpm/bpm.js';

const nstr = { type: ['string', 'null'] } as const;
// page 設上限:避免 (page - 1) * pageSize 超出 sql.Int(資安審查 L-1)
const pageQuery = {
  page: { type: 'integer', minimum: 1, maximum: 10000, default: 1 },
  pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
} as const;
const requesterProps = { requesterId: nstr, requesterName: nstr, submittedAt: nstr } as const;
const pagedRequired = ['applicable', 'total', 'page', 'pageSize', 'hasAccount', 'items'];

export function bpmRoutes(service: BpmService | null) {
  const need = () => {
    if (!service) throw new AppError(503, 'PORTAL_BPM_UNAVAILABLE', 'BPM 資料來源未設定');
    return service;
  };
  return async (app: FastifyInstance): Promise<void> => {
    app.get(
      '/v1/bpm/pending',
      {
        schema: {
          operationId: 'portal.bpm.pending',
          summary: 'BPM:待簽核',
          description:
            '本人在 BPM 的待簽核單據(LocalToDoWorkItem,關卡狀態 0 / 1),附申請人、送出時間、目前關卡與簽核 / 追蹤深連結;狀態 97 的異常關卡另外標示、不計入待簽核數。' +
            '只對 Token 公司屬 BPM_COMPANIES(碩禾系)者查詢,其他公司回 applicable = false 與空清單(D-29)。',
          'x-permission': 'portal.api.bpm.read',
          'x-gherkin':
            '場景: 查看待簽核\n  假如 同仁在 BPM 有 2 筆待簽核\n  當 呼叫 GET /api/portal/bpm/pending\n  那麼 回應 total 為 2,每筆附申請人、送出時間與「前往簽核」「追蹤」連結',
          response: {
            200: {
              type: 'object',
              required: ['applicable', 'total', 'abnormal', 'hasAccount', 'truncated', 'items'],
              properties: {
                applicable: { type: 'boolean' },
                total: { type: 'integer' },
                abnormal: { type: 'integer' },
                hasAccount: { type: 'boolean' },
                truncated: { type: 'boolean' },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      workItemName: nstr,
                      subject: nstr,
                      processName: nstr,
                      serialNumber: nstr,
                      processState: { type: 'string' },
                      abnormal: { type: 'boolean' },
                      createdAt: nstr,
                      ...requesterProps,
                      performUrl: nstr,
                      traceUrl: nstr,
                    },
                  },
                },
              },
            },
          },
        },
      },
      async (req) => need().pending(employeeOf(req)),
    );

    app.get<{ Querystring: { page?: number; pageSize?: number; state?: RequestedState } }>(
      '/v1/bpm/requested',
      {
        schema: {
          operationId: 'portal.bpm.requested',
          summary: 'BPM:我送出的(預設只列未結案)',
          description:
            '本人申請的單據:state = open(預設)只列流程仍進行中者(ProcessInstance.currentState = 1,即「未結案」);state = all 列全部狀態。附目前關卡與追蹤連結;分頁,新到舊。非碩禾系回空清單(D-29)。',
          'x-permission': 'portal.api.bpm.read',
          'x-gherkin':
            '場景: 查看我送出的\n  假如 同仁申請的單據有 1 筆進行中、1 筆已結案\n  當 呼叫 GET /api/portal/bpm/requested\n  那麼 只回應進行中的 1 筆與目前關卡;加 state=all 則回應 2 筆',
          querystring: {
            type: 'object',
            additionalProperties: false,
            properties: { ...pageQuery, state: { type: 'string', enum: [...REQUESTED_STATES], default: 'open' } },
          },
          response: {
            200: {
              type: 'object',
              required: [...pagedRequired, 'state'],
              properties: {
                applicable: { type: 'boolean' },
                state: { type: 'string' },
                total: { type: 'integer' },
                page: { type: 'integer' },
                pageSize: { type: 'integer' },
                hasAccount: { type: 'boolean' },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      serialNumber: nstr,
                      processName: nstr,
                      subject: nstr,
                      processState: { type: 'string' },
                      currentActivities: { type: 'array', items: { type: 'string' } },
                      createdAt: nstr,
                      traceUrl: nstr,
                    },
                  },
                },
              },
            },
          },
        },
      },
      async (req) => need().requested(employeeOf(req), req.query.page ?? 1, req.query.pageSize ?? 20, req.query.state ?? 'open'),
    );

    app.get<{ Querystring: { page?: number; pageSize?: number } }>(
      '/v1/bpm/handled',
      {
        schema: {
          operationId: 'portal.bpm.handled',
          summary: 'BPM:已簽核(經辦過)',
          description:
            '本人經辦完成的關卡(WorkItem.performerOID = 本人、currentState = 3),附關卡名稱、完成時間、申請人、送出時間、流程目前關卡與追蹤連結;分頁,完成時間新到舊。非碩禾系回空清單(D-29)。',
          'x-permission': 'portal.api.bpm.read',
          'x-gherkin':
            '場景: 查看已簽核\n  假如 同仁在 BPM 經辦完成 3 個關卡\n  當 呼叫 GET /api/portal/bpm/handled?pageSize=2\n  那麼 回應 total 為 3、本頁 2 筆,每筆附申請人與追蹤連結',
          querystring: { type: 'object', additionalProperties: false, properties: pageQuery },
          response: {
            200: {
              type: 'object',
              required: pagedRequired,
              properties: {
                applicable: { type: 'boolean' },
                total: { type: 'integer' },
                page: { type: 'integer' },
                pageSize: { type: 'integer' },
                hasAccount: { type: 'boolean' },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      workItemName: nstr,
                      completedAt: nstr,
                      serialNumber: nstr,
                      processName: nstr,
                      subject: nstr,
                      processState: { type: 'string' },
                      currentActivities: { type: 'array', items: { type: 'string' } },
                      ...requesterProps,
                      traceUrl: nstr,
                    },
                  },
                },
              },
            },
          },
        },
      },
      async (req) => need().handled(employeeOf(req), req.query.page ?? 1, req.query.pageSize ?? 20),
    );
  };
}
