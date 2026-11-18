/** 個人提醒 /v1/notes(docs/Gherkin/personal/notes.feature;modules/notes/notes.ts) */
import type { FastifyInstance } from 'fastify';
import { AppError } from '../errors.js';
import { employeeOf } from '../identity.js';
import { CATEGORIES, PRIORITIES, type NoteInput, type NotePatch, type NoteService } from '../modules/notes/notes.js';

const fields = {
  title: { type: 'string', minLength: 1, maxLength: 100, pattern: '\\S' },
  content: { type: ['string', 'null'], maxLength: 1000 },
  category: { type: 'string', enum: [...CATEGORIES] },
  priority: { type: 'string', enum: [...PRIORITIES] },
  dueDate: { anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }] },
} as const;

const noteSchema = {
  type: 'object',
  required: ['id', 'title', 'content', 'category', 'priority', 'dueDate', 'done', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'integer' },
    title: { type: 'string' },
    content: { type: ['string', 'null'] },
    category: { type: 'string' },
    priority: { type: 'string' },
    dueDate: { type: ['string', 'null'] },
    done: { type: 'boolean' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
} as const;

const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } } as const;

export function noteRoutes(service: NoteService | null) {
  const need = () => {
    if (!service) throw new AppError(503, 'PORTAL_SOURCE_UNAVAILABLE', '資料來源未設定');
    return service;
  };
  return async (app: FastifyInstance): Promise<void> => {
    app.get(
      '/v1/notes',
      {
        schema: {
          operationId: 'portal.note.list',
          summary: '個人提醒:清單',
          description: '本人的個人提醒,未完成在前,再依到期日、建立時間排序。',
          'x-permission': 'portal.api.note.read',
          'x-gherkin': '場景: 只看得到自己的提醒\n  假如 同仁 A 與 B 各有提醒\n  當 A 呼叫 GET /api/portal/notes\n  那麼 只回應 A 的提醒',
          response: { 200: { type: 'object', required: ['items'], properties: { items: { type: 'array', items: noteSchema } } } },
        },
      },
      async (req) => ({ items: await need().list(employeeOf(req).empNo) }),
    );

    app.post<{ Body: NoteInput }>(
      '/v1/notes',
      {
        schema: {
          operationId: 'portal.note.create',
          summary: '個人提醒:新增',
          description: '新增一筆本人的提醒;每人最多 500 筆。',
          'x-permission': 'portal.api.note.write',
          'x-gherkin': '場景: 新增提醒\n  當 呼叫 POST /api/portal/notes,標題「繳交報告」、到期日 2026-10-31\n  那麼 回應 201 與新提醒',
          body: { type: 'object', required: ['title', 'category', 'priority'], additionalProperties: false, properties: fields },
          response: { 201: noteSchema },
        },
      },
      async (req, reply) => reply.status(201).send(await need().create(employeeOf(req).empNo, req.body)),
    );

    app.patch<{ Params: { id: number }; Body: NotePatch }>(
      '/v1/notes/:id',
      {
        schema: {
          operationId: 'portal.note.update',
          summary: '個人提醒:修改或標記完成',
          description: '修改本人的提醒內容,或以 done 標記完成 / 未完成;別人的提醒回 404。',
          'x-permission': 'portal.api.note.write',
          'x-gherkin': '場景: 標記完成\n  當 呼叫 PATCH /api/portal/notes/1,done 為 true\n  那麼 回應 200,該提醒移到清單後段',
          params: idParam,
          body: { type: 'object', minProperties: 1, additionalProperties: false, properties: { ...fields, done: { type: 'boolean' } } },
          response: { 200: noteSchema },
        },
      },
      async (req) => need().update(employeeOf(req).empNo, req.params.id, req.body),
    );

    app.delete<{ Params: { id: number } }>(
      '/v1/notes/:id',
      {
        schema: {
          operationId: 'portal.note.delete',
          summary: '個人提醒:刪除',
          description: '刪除本人的提醒;別人的提醒回 404。',
          'x-permission': 'portal.api.note.write',
          'x-gherkin': '場景: 刪除提醒\n  當 呼叫 DELETE /api/portal/notes/1\n  那麼 回應 204',
          params: idParam,
        },
      },
      async (req, reply) => {
        await need().remove(employeeOf(req).empNo, req.params.id);
        return reply.status(204).send();
      },
    );
  };
}
