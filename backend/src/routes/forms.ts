/**
 * 表單下載 /v1/forms(P4;FEATURE-PLAN §4、D-25;docs/Gherkin/approval/forms.feature;modules/forms/forms.ts)。
 * 讀取:所有員工(portal.api.form.read);維護:按鈕 portal.forms.edit(includes portal.api.form.edit,portal-editor)。
 * 檔案本體在 giga-file-service,這裡只登記 UUID;下載由前端呼叫 file-service(file.object.read)。
 */
import type { FastifyInstance } from 'fastify';
import { AppError } from '../errors.js';
import { employeeOf } from '../identity.js';
import type { FormCategoryInput, FormDocInput, FormService } from '../modules/forms/forms.js';

const categorySchema = {
  type: 'object',
  required: ['id', 'name', 'sort'],
  properties: { id: { type: 'integer' }, name: { type: 'string' }, sort: { type: 'integer' } },
} as const;
const formSchema = {
  type: 'object',
  required: ['id', 'categoryId', 'name', 'description', 'fileId', 'fileName', 'sort', 'active', 'updatedAt'],
  properties: {
    id: { type: 'integer' },
    categoryId: { type: 'integer' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    fileId: { type: 'string' },
    fileName: { type: 'string' },
    sort: { type: 'integer' },
    active: { type: 'boolean' },
    updatedAt: { type: 'string' },
  },
} as const;
const catalogSchema = {
  200: {
    type: 'object',
    required: ['categories', 'items'],
    properties: { categories: { type: 'array', items: categorySchema }, items: { type: 'array', items: formSchema } },
  },
} as const;
const sort = { type: 'integer', minimum: 0, maximum: 100000 } as const;
const categoryBody = {
  type: 'object',
  required: ['name', 'sort'],
  additionalProperties: false,
  properties: { name: { type: 'string', minLength: 1, maxLength: 30, pattern: '\\S' }, sort },
} as const;
const formBody = {
  type: 'object',
  required: ['categoryId', 'name', 'fileId', 'fileName', 'sort', 'active'],
  additionalProperties: false,
  properties: {
    categoryId: { type: 'integer', minimum: 1 },
    name: { type: 'string', minLength: 1, maxLength: 100, pattern: '\\S' },
    description: { type: ['string', 'null'], maxLength: 300 },
    fileId: { type: 'string', maxLength: 36 },
    fileName: { type: 'string', minLength: 1, maxLength: 200 },
    sort,
    active: { type: 'boolean' },
  },
} as const;
const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } } as const;
type FormBody = Omit<FormDocInput, 'description'> & { description?: string | null };

export function formRoutes(service: FormService | null) {
  const need = () => {
    if (!service) throw new AppError(503, 'PORTAL_SOURCE_UNAVAILABLE', '資料來源未設定');
    return service;
  };
  const input = (b: FormBody): FormDocInput => ({ ...b, description: b.description ?? null });
  return async (app: FastifyInstance): Promise<void> => {
    app.get(
      '/v1/forms',
      {
        schema: {
          operationId: 'portal.forms.list',
          summary: '表單下載:清單',
          description: '表單分類與啟用中的表單(依分類、排序);檔案以 file-service 檔案編號下載。',
          'x-permission': 'portal.api.form.read',
          'x-gherkin':
            '場景: 依分類下載表單\n  假如 「人事」分類有 2 份啟用中、1 份停用的表單\n  當 呼叫 GET /api/portal/forms\n  那麼 回應分類清單與 2 份表單的檔案編號',
          response: catalogSchema,
        },
      },
      async (req) => {
        employeeOf(req);
        return need().catalog();
      },
    );

    app.get(
      '/v1/forms/admin',
      {
        schema: {
          operationId: 'portal.forms.admin-list',
          summary: '表單下載:維護清單',
          description: '含停用的表單,供編輯者維護。',
          'x-permission': 'portal.api.form.edit',
          'x-gherkin': '場景: 維護清單含停用表單\n  當 具 portal.forms.edit 者呼叫 GET /api/portal/forms/admin\n  那麼 回應包含停用的表單',
          response: catalogSchema,
        },
      },
      async (req) => {
        employeeOf(req);
        return need().adminCatalog();
      },
    );

    app.post<{ Body: FormBody }>(
      '/v1/forms',
      {
        schema: {
          operationId: 'portal.forms.create',
          summary: '表單下載:新增表單',
          description: '登記表單(前端先上傳到 file-service,sourceApp portal-forms;建立後以 refNo = 表單 id 綁定)。檔名只接受 pdf / Office / ODF 文件。',
          'x-permission': 'portal.api.form.edit',
          'x-audit-level': 'body',
          'x-gherkin':
            '場景: 上傳表單\n  當 具 portal.forms.edit 者呼叫 POST /api/portal/forms,分類、名稱、檔案編號與 .docx 檔名\n  那麼 回應 201,員工清單出現此表單',
          body: formBody,
          response: { 201: formSchema },
        },
      },
      async (req, reply) => reply.status(201).send(await need().createForm(input(req.body), employeeOf(req).empNo)),
    );

    app.put<{ Params: { id: number }; Body: FormBody }>(
      '/v1/forms/:id',
      {
        schema: {
          operationId: 'portal.forms.update',
          summary: '表單下載:修改表單',
          description: '修改名稱、分類、排序、啟用或改換檔案(重新上傳後帶新檔案編號);不存在回 404 PORTAL_FORM_NOT_FOUND。',
          'x-permission': 'portal.api.form.edit',
          'x-audit-level': 'body',
          'x-gherkin': '場景: 停用表單\n  當 呼叫 PUT /api/portal/forms/1,active = false\n  那麼 員工清單不再列出此表單',
          params: idParam,
          body: formBody,
          response: { 200: formSchema },
        },
      },
      async (req) => need().updateForm(req.params.id, input(req.body), employeeOf(req).empNo),
    );

    app.delete<{ Params: { id: number } }>(
      '/v1/forms/:id',
      {
        schema: {
          operationId: 'portal.forms.delete',
          summary: '表單下載:刪除表單',
          description: '移除表單登記(file-service 的檔案不刪,依其保存規則處理)。',
          'x-permission': 'portal.api.form.edit',
          'x-audit-level': 'meta',
          'x-gherkin': '場景: 刪除表單\n  當 呼叫 DELETE /api/portal/forms/1\n  那麼 回應 204',
          params: idParam,
        },
      },
      async (req, reply) => {
        employeeOf(req);
        await need().deleteForm(req.params.id);
        return reply.status(204).send();
      },
    );

    app.post<{ Body: FormCategoryInput }>(
      '/v1/forms/categories',
      {
        schema: {
          operationId: 'portal.forms.category-create',
          summary: '表單下載:新增分類',
          description: '新增表單分類;同名回 409 PORTAL_FORM_CATEGORY_DUPLICATE。',
          'x-permission': 'portal.api.form.edit',
          'x-audit-level': 'body',
          'x-gherkin': '場景: 維護表單分類\n  當 呼叫 POST /api/portal/forms/categories,名稱「人事」\n  那麼 回應 201;再新增同名分類回 409',
          body: categoryBody,
          response: { 201: categorySchema },
        },
      },
      async (req, reply) => reply.status(201).send(await need().createCategory(req.body, employeeOf(req).empNo)),
    );

    app.put<{ Params: { id: number }; Body: FormCategoryInput }>(
      '/v1/forms/categories/:id',
      {
        schema: {
          operationId: 'portal.forms.category-update',
          summary: '表單下載:修改分類',
          description: '修改分類名稱與排序。',
          'x-permission': 'portal.api.form.edit',
          'x-audit-level': 'body',
          'x-gherkin': '場景: 修改分類名稱\n  當 呼叫 PUT /api/portal/forms/categories/1\n  那麼 回應 200',
          params: idParam,
          body: categoryBody,
          response: { 200: categorySchema },
        },
      },
      async (req) => need().updateCategory(req.params.id, req.body, employeeOf(req).empNo),
    );

    app.delete<{ Params: { id: number } }>(
      '/v1/forms/categories/:id',
      {
        schema: {
          operationId: 'portal.forms.category-delete',
          summary: '表單下載:刪除分類',
          description: '刪除分類;分類下還有表單(含停用)時回 409 PORTAL_FORM_CATEGORY_IN_USE。',
          'x-permission': 'portal.api.form.edit',
          'x-audit-level': 'meta',
          'x-gherkin':
            '場景: 有表單的分類不能刪\n  假如 分類下還有表單\n  當 呼叫 DELETE /api/portal/forms/categories/1\n  那麼 回應 409 PORTAL_FORM_CATEGORY_IN_USE',
          params: idParam,
        },
      },
      async (req, reply) => {
        employeeOf(req);
        await need().deleteCategory(req.params.id);
        return reply.status(204).send();
      },
    );
  };
}
