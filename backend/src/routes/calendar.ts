/**
 * 年度行事曆 /v1/calendar(FEATURE-PLAN §5「行事曆」;docs/Gherkin/group/calendar.feature)。
 * 舊版為 Document/<年>.pdf(Schedule.aspx);新版由編輯者上傳 PDF 到 giga-file-service 後登記年度,畫面依年度切換。
 * 個人 / 部門行程不做(PCalendar 自 2021 未使用)。
 */
import type { FastifyInstance } from 'fastify';
import { AppError } from '../errors.js';
import { employeeOf } from '../identity.js';
import { MAX_YEAR, MIN_YEAR, type ContentService } from '../modules/home/content.js';

const calendarSchema = {
  type: 'object',
  required: ['year', 'fileId', 'fileName', 'updatedAt'],
  properties: { year: { type: 'integer' }, fileId: { type: 'string' }, fileName: { type: 'string' }, updatedAt: { type: 'string' } },
} as const;
const yearParam = { type: 'object', required: ['year'], properties: { year: { type: 'integer', minimum: MIN_YEAR, maximum: MAX_YEAR } } } as const;

export function calendarRoutes(content: ContentService | null) {
  const need = () => {
    if (!content) throw new AppError(503, 'PORTAL_SOURCE_UNAVAILABLE', '資料來源未設定');
    return content;
  };
  return async (app: FastifyInstance): Promise<void> => {
    app.get(
      '/v1/calendar',
      {
        schema: {
          operationId: 'portal.calendar.list',
          summary: '年度行事曆:清單',
          description: '已上傳的年度行事曆 PDF(年度遞增);PDF 以 file-service 檔案編號開啟。',
          'x-permission': 'portal.api.calendar.read',
          'x-gherkin':
            '場景: 依年度切換行事曆\n  假如 已上傳 2026、2027 年度行事曆\n  當 呼叫 GET /api/portal/calendar\n  那麼 回應兩個年度與各自的 PDF 檔案編號',
          response: { 200: { type: 'object', required: ['items'], properties: { items: { type: 'array', items: calendarSchema } } } },
        },
      },
      async (req) => {
        employeeOf(req);
        return { items: await need().calendars() };
      },
    );

    app.put<{ Params: { year: number }; Body: { fileId: string; fileName: string } }>(
      '/v1/calendar/:year',
      {
        schema: {
          operationId: 'portal.calendar.upsert',
          summary: '年度行事曆:上傳 / 取代',
          description: '登記某年度的行事曆 PDF(前端先上傳到 file-service,refType portal-calendar);同年度已有則取代。只接受 .pdf 檔名。',
          'x-permission': 'portal.api.calendar.edit',
          'x-audit-level': 'body',
          'x-gherkin':
            '場景: 上傳年度行事曆\n  當 具 portal.calendar.edit 者呼叫 PUT /api/portal/calendar/2027,PDF 檔案編號\n  那麼 回應 200,行事曆可選 2027 年度',
          params: yearParam,
          body: {
            type: 'object',
            required: ['fileId', 'fileName'],
            additionalProperties: false,
            properties: { fileId: { type: 'string', maxLength: 36 }, fileName: { type: 'string', minLength: 1, maxLength: 200 } },
          },
          response: { 200: calendarSchema },
        },
      },
      async (req) => need().upsertCalendar(req.params.year, req.body.fileId, req.body.fileName, employeeOf(req).empNo),
    );

    app.delete<{ Params: { year: number } }>(
      '/v1/calendar/:year',
      {
        schema: {
          operationId: 'portal.calendar.delete',
          summary: '年度行事曆:刪除',
          description: '移除某年度的行事曆登記;不存在回 404 PORTAL_CALENDAR_NOT_FOUND。',
          'x-permission': 'portal.api.calendar.edit',
          'x-gherkin': '場景: 刪除年度行事曆\n  當 呼叫 DELETE /api/portal/calendar/2027\n  那麼 回應 204',
          params: yearParam,
        },
      },
      async (req, reply) => {
        employeeOf(req);
        await need().deleteCalendar(req.params.year);
        return reply.status(204).send();
      },
    );
  };
}
