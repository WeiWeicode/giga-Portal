/** BPM 簽核資訊 /v1/bpm/*(docs/Gherkin/personal/bpm.feature;modules/bpm/bpm.ts) */
import type { FastifyInstance } from 'fastify';
import { AppError } from '../errors.js';
import { employeeOf } from '../identity.js';
import type { BpmService } from '../modules/bpm/bpm.js';

const nstr = { type: ['string', 'null'] } as const;

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
          description: '本人在 BPM 的待簽核單據(LocalToDoWorkItem,關卡狀態 0 / 1),附簽核與追蹤深連結;狀態 97 的異常關卡另外標示、不計入待簽核數。',
          'x-permission': 'portal.api.bpm.read',
          'x-gherkin':
            '場景: 查看待簽核\n  假如 同仁在 BPM 有 2 筆待簽核\n  當 呼叫 GET /api/portal/bpm/pending\n  那麼 回應 total 為 2,每筆附「簽核」與「追蹤」連結',
          response: {
            200: {
              type: 'object',
              required: ['total', 'abnormal', 'hasAccount', 'truncated', 'items'],
              properties: {
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
      async (req) => need().pending(employeeOf(req).empNo),
    );

    app.get<{ Querystring: { page?: number; pageSize?: number } }>(
      '/v1/bpm/requested',
      {
        schema: {
          operationId: 'portal.bpm.requested',
          summary: 'BPM:我申請的未結案',
          description: '本人申請、流程仍進行中的單據(ProcessInstance.currentState = 1),附目前關卡與追蹤連結;分頁,新到舊。',
          'x-permission': 'portal.api.bpm.read',
          'x-gherkin':
            '場景: 查看我申請的未結案\n  假如 同仁申請的單據有 1 筆進行中、1 筆已結案\n  當 呼叫 GET /api/portal/bpm/requested\n  那麼 只回應進行中的 1 筆與目前關卡',
          querystring: {
            type: 'object',
            additionalProperties: false,
            properties: { page: { type: 'integer', minimum: 1, default: 1 }, pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          },
          response: {
            200: {
              type: 'object',
              required: ['total', 'page', 'pageSize', 'hasAccount', 'items'],
              properties: {
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
      async (req) => need().requested(employeeOf(req).empNo, req.query.page ?? 1, req.query.pageSize ?? 20),
    );
  };
}
