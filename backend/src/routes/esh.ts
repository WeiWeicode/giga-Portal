/**
 * ESH 證照管理 /v1/esh/*(P6;FEATURE-PLAN §8;docs/Gherkin/esh/*.feature;邏輯在 modules/esh/*)。
 *   證照(儀表板 / 項目 / 需求 / 人員 / 管理員 / 複訓通知):須具 portal-esh-admin,公司範圍 = 本人在 LicenseManagerInfo 的公司(license.ts)
 *   危害性化學品:所有員工可查;由 BPM 同步、SDS 上傳須具 portal-esh-admin(chemical.ts)
 * 權限由 BFF 依 x-permission 檢查;資料範圍由本服務依 Token 檢查,違反回 403 PORTAL_DATA_ACCESS_DENIED。
 */
import type { FastifyInstance } from 'fastify';
import { AppError } from '../errors.js';
import { employeeOf } from '../identity.js';
import { RESTRICT, type EshChemicalService, type Restrict } from '../modules/esh/chemical.js';
import type { EshLicenseService, HolderInput, HolderListView, LicenseItemInput } from '../modules/esh/license.js';
import type { EshNotifyService } from '../modules/esh/notify.js';
import { MAX_MONTHS, MAX_NOTIFY_DAYS } from '../modules/esh/rules.js';
import type { FileRef } from '../modules/esh/types.js';

export interface EshServices {
  license: EshLicenseService;
  notify: EshNotifyService;
  chemical: EshChemicalService;
}

const COMPANY = { type: 'string', minLength: 1, maxLength: 20 } as const;
const DATE = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } as const;
const nullableDate = { type: ['string', 'null'], pattern: '^(\\d{4}-\\d{2}-\\d{2})?$' } as const;
const ID = { type: 'integer', minimum: 1, maximum: 2147483647 } as const;
const EF_ID = { type: 'string', pattern: '^[A-Za-z0-9_]{1,40}$' } as const;
const idParam = { type: 'object', required: ['id'], properties: { id: ID } } as const;
const companyQuery = { type: 'object', additionalProperties: false, properties: { company: COMPANY } } as const;
const fileBody = {
  type: 'object',
  required: ['fileId', 'fileName'],
  additionalProperties: false,
  properties: { fileId: { type: 'string', maxLength: 36 }, fileName: { type: 'string', minLength: 1, maxLength: 200 } },
} as const;
const itemBody = {
  type: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 50 },
    months: { type: ['integer', 'null'], minimum: 1, maximum: MAX_MONTHS },
    permanent: { type: 'boolean' },
    description: { type: ['string', 'null'], maxLength: 20000 },
  },
} as const;
const needBody = {
  type: 'object',
  required: ['company', 'required'],
  additionalProperties: false,
  properties: {
    company: COMPANY,
    licenseId: ID,
    required: { type: 'integer', minimum: 0, maximum: 100000 },
    notes: { type: ['string', 'null'], maxLength: 350 },
  },
} as const;
const holderProps = {
  company: COMPANY,
  trainingDate: nullableDate,
  gatDate: nullableDate,
  retrainDate: nullableDate,
  notifyDays: { type: 'integer', minimum: 0, maximum: MAX_NOTIFY_DAYS },
} as const;
const holderBody = { type: 'object', required: ['company', 'notifyDays'], additionalProperties: false, properties: holderProps } as const;
const holderCreateBody = {
  type: 'object',
  required: ['empNo', 'licenseId', 'company', 'notifyDays'],
  additionalProperties: false,
  properties: { ...holderProps, empNo: { type: 'string', minLength: 1, maxLength: 20 }, licenseId: ID },
} as const;
const managerBody = {
  type: 'object',
  required: ['company', 'empNo', 'sendMail'],
  additionalProperties: false,
  properties: { company: COMPANY, empNo: { type: 'string', minLength: 1, maxLength: 20 }, sendMail: { type: 'boolean' } },
} as const;

type NeedBody = { company: string; licenseId?: number; required: number; notes?: string | null };
type ManagerBody = { company: string; empNo: string; sendMail: boolean };

const gherkin = (s: string) => s;

export function eshRoutes(services: EshServices | null) {
  const need = () => {
    if (!services) throw new AppError(503, 'PORTAL_SOURCE_UNAVAILABLE', '資料來源未設定');
    return services;
  };
  return async (app: FastifyInstance): Promise<void> => {
    // ───── 儀表板 ─────
    app.get<{ Querystring: { company?: string } }>(
      '/v1/esh/dashboard',
      {
        schema: {
          operationId: 'portal.esh.dashboard',
          summary: 'ESH 證照:儀表板',
          description: '公司每個證照需求的應有 / 有效張數與符合度;company 省略時取範圍內第一間公司。回應含本人可管理的公司清單。',
          'x-permission': 'portal.api.esh.license.read',
          'x-gherkin': gherkin(
            '場景: 公司證照符合度\n  假如 管理員管理「碩禾」,此公司某證照應有 3 張、有效 2 張\n  當 呼叫 GET /api/portal/esh/dashboard?company=碩禾\n  那麼 該證照 valid = 2、required = 3、ratio = 66、ok = false',
          ),
          querystring: companyQuery,
        },
      },
      async (req) => {
        const emp = employeeOf(req);
        const svc = need().license;
        const scope = await svc.scope(emp);
        const company = req.query.company ?? scope.companies[0];
        if (!company) return { companies: [], company: null, items: [] };
        return { companies: scope.companies, ...(await svc.dashboard(emp, company)) };
      },
    );

    app.get<{ Querystring: { company: string; licenseId: number } }>(
      '/v1/esh/dashboard/holders',
      {
        schema: {
          operationId: 'portal.esh.dashboard-holders',
          summary: 'ESH 證照:有效持證人',
          description: '儀表板「查看」:該公司此證照在職、未刪除、下次複訓日 ≥ 今天的持證人與證照影本。',
          'x-permission': 'portal.api.esh.license.read',
          'x-gherkin': gherkin(
            '場景: 查看某證照的持證人\n  當 呼叫 GET /api/portal/esh/dashboard/holders?company=碩禾&licenseId=7\n  那麼 只回有效持證人;範圍外公司回 403',
          ),
          querystring: {
            type: 'object',
            required: ['company', 'licenseId'],
            additionalProperties: false,
            properties: { company: COMPANY, licenseId: ID },
          },
        },
      },
      async (req) => ({ items: await need().license.validHolders(employeeOf(req), req.query.company, req.query.licenseId) }),
    );

    // ───── 證照項目 ─────
    app.get<{ Querystring: { includeInactive?: boolean } }>(
      '/v1/esh/items',
      {
        schema: {
          operationId: 'portal.esh.items',
          summary: 'ESH 證照:證照項目清單',
          description: '證照項目(各公司共用);描述為白名單清洗後的 HTML;includeInactive 含已刪除。',
          'x-permission': 'portal.api.esh.item.read',
          'x-gherkin': gherkin('場景: 證照項目清單\n  當 證照管理員呼叫 GET /api/portal/esh/items\n  那麼 回應啟用中的證照項目,描述已清洗 <script>'),
          querystring: { type: 'object', additionalProperties: false, properties: { includeInactive: { type: 'boolean' } } },
        },
      },
      async (req) => ({ items: await need().license.items(employeeOf(req), req.query.includeInactive ?? false) }),
    );

    app.post<{ Body: LicenseItemInput }>(
      '/v1/esh/items',
      {
        schema: {
          operationId: 'portal.esh.item-create',
          summary: 'ESH 證照:新增證照項目',
          description: '名稱不可空白、啟用中不可重名(409 PORTAL_ESH_ITEM_DUPLICATE);有效期 1~600 個月或永久;描述 HTML 白名單清洗後寫入。',
          'x-permission': 'portal.api.esh.item.edit',
          'x-audit-level': 'body',
          'x-gherkin': gherkin('場景: 維護證照項目\n  當 呼叫 POST /api/portal/esh/items,名稱「急救人員」、有效期 36\n  那麼 回應 201;再新增同名回 409'),
          body: itemBody,
        },
      },
      async (req, reply) => reply.status(201).send(await need().license.createItem(employeeOf(req), req.body)),
    );

    app.put<{ Params: { id: number }; Body: LicenseItemInput }>(
      '/v1/esh/items/:id',
      {
        schema: {
          operationId: 'portal.esh.item-update',
          summary: 'ESH 證照:修改證照項目',
          description: '同新增的驗證(編輯時也檢查重名,排除自己)。',
          'x-permission': 'portal.api.esh.item.edit',
          'x-audit-level': 'body',
          'x-gherkin': gherkin('場景: 編輯時也檢查重名\n  當 把項目改成另一個啟用中項目的名稱\n  那麼 回應 409 PORTAL_ESH_ITEM_DUPLICATE'),
          params: idParam,
          body: itemBody,
        },
      },
      async (req) => need().license.updateItem(employeeOf(req), req.params.id, req.body),
    );

    app.delete<{ Params: { id: number } }>(
      '/v1/esh/items/:id',
      {
        schema: {
          operationId: 'portal.esh.item-delete',
          summary: 'ESH 證照:刪除證照項目',
          description: '軟刪除(IsActive = 0,同舊版)。',
          'x-permission': 'portal.api.esh.item.edit',
          'x-audit-level': 'meta',
          'x-gherkin': gherkin('場景: 軟刪除證照項目\n  當 呼叫 DELETE /api/portal/esh/items/7\n  那麼 回應 204,LicenseInfo.IsActive = 0'),
          params: idParam,
        },
      },
      async (req, reply) => {
        await need().license.deleteItem(employeeOf(req), req.params.id);
        return reply.status(204).send();
      },
    );

    app.put<{ Params: { id: number }; Body: FileRef }>(
      '/v1/esh/items/:id/logo',
      {
        schema: {
          operationId: 'portal.esh.item-logo',
          summary: 'ESH 證照:設定 Logo',
          description: '前端先上傳到 file-service(sourceApp / refType portal-esh-logo),再登記檔案編號;只接受圖片副檔名。',
          'x-permission': 'portal.api.esh.item.edit',
          'x-audit-level': 'body',
          'x-gherkin': gherkin(
            '場景: 上傳證照 Logo\n  當 呼叫 PUT /api/portal/esh/items/7/logo,檔案編號與 .png 檔名\n  那麼 回應 200,logo 為此檔案;.exe 檔名回 400',
          ),
          params: idParam,
          body: fileBody,
        },
      },
      async (req) => need().license.setLogo(employeeOf(req), req.params.id, req.body),
    );

    app.delete<{ Params: { id: number } }>(
      '/v1/esh/items/:id/logo',
      {
        schema: {
          operationId: 'portal.esh.item-logo-delete',
          summary: 'ESH 證照:移除 Logo',
          description: '移除新站上傳的 Logo(舊站 LogoPath 不動)。',
          'x-permission': 'portal.api.esh.item.edit',
          'x-audit-level': 'meta',
          'x-gherkin': gherkin('場景: 移除 Logo\n  當 呼叫 DELETE /api/portal/esh/items/7/logo\n  那麼 回應 204'),
          params: idParam,
        },
      },
      async (req, reply) => {
        await need().license.deleteLogo(employeeOf(req), req.params.id);
        return reply.status(204).send();
      },
    );

    // ───── 證照需求 ─────
    app.get<{ Querystring: { company?: string } }>(
      '/v1/esh/needs',
      {
        schema: {
          operationId: 'portal.esh.needs',
          summary: 'ESH 證照:證照需求清單',
          description: '公司 × 證照的需求張數與備註;company 省略為全部範圍。',
          'x-permission': 'portal.api.esh.need.read',
          'x-gherkin': gherkin('場景: 證照需求清單\n  當 呼叫 GET /api/portal/esh/needs?company=碩禾\n  那麼 回應此公司的需求;範圍外公司回 403'),
          querystring: companyQuery,
        },
      },
      async (req) => {
        const emp = employeeOf(req);
        const svc = need().license;
        return { companies: (await svc.scope(emp)).companies, items: await svc.needs(emp, req.query.company) };
      },
    );

    app.post<{ Body: NeedBody }>(
      '/v1/esh/needs',
      {
        schema: {
          operationId: 'portal.esh.need-create',
          summary: 'ESH 證照:新增證照需求',
          description: '需求張數為 ≥ 0 的整數;同公司同證照已存在回 409 PORTAL_ESH_NEED_DUPLICATE。',
          'x-permission': 'portal.api.esh.need.edit',
          'x-audit-level': 'body',
          'x-gherkin': gherkin('場景: 維護公司證照需求\n  當 呼叫 POST /api/portal/esh/needs,公司、證照、需求 3\n  那麼 回應 201;重複回 409;範圍外公司回 403'),
          body: { ...needBody, required: ['company', 'licenseId', 'required'] },
        },
      },
      async (req, reply) => reply.status(201).send(await need().license.createNeed(employeeOf(req), { ...req.body, licenseId: req.body.licenseId! })),
    );

    app.put<{ Params: { id: number }; Body: NeedBody }>(
      '/v1/esh/needs/:id',
      {
        schema: {
          operationId: 'portal.esh.need-update',
          summary: 'ESH 證照:修改證照需求',
          description: '修改需求張數與備註(id = 證照項目)。',
          'x-permission': 'portal.api.esh.need.edit',
          'x-audit-level': 'body',
          'x-gherkin': gherkin('場景: 修改需求張數\n  當 呼叫 PUT /api/portal/esh/needs/7,需求 -1\n  那麼 回應 400'),
          params: idParam,
          body: needBody,
        },
      },
      async (req, reply) => {
        await need().license.updateNeed(employeeOf(req), req.params.id, req.body);
        return reply.status(204).send();
      },
    );

    app.delete<{ Params: { id: number }; Querystring: { company: string } }>(
      '/v1/esh/needs/:id',
      {
        schema: {
          operationId: 'portal.esh.need-delete',
          summary: 'ESH 證照:刪除證照需求',
          description: '刪除需求(同舊版硬刪);持證人員資料不受影響,新站人員清單仍列出。',
          'x-permission': 'portal.api.esh.need.edit',
          'x-audit-level': 'meta',
          'x-gherkin': gherkin(
            '場景: 刪除需求不影響持證人員\n  當 呼叫 DELETE /api/portal/esh/needs/7?company=碩禾\n  那麼 回應 204,人員證照清單仍列出此證照的持證人',
          ),
          params: idParam,
          querystring: { type: 'object', required: ['company'], additionalProperties: false, properties: { company: COMPANY } },
        },
      },
      async (req, reply) => {
        await need().license.deleteNeed(employeeOf(req), req.query.company, req.params.id);
        return reply.status(204).send();
      },
    );

    // ───── 證照人員 ─────
    app.get<{ Querystring: { company?: string; licenseId?: number; view?: HolderListView } }>(
      '/v1/esh/holders',
      {
        schema: {
          operationId: 'portal.esh.holders',
          summary: 'ESH 證照:人員證照清單',
          description:
            'view = current(啟用中、在職、需追蹤,預設)/ history(含已刪除、離職)/ untracked(通知天數 = 0);每列含狀態(left / unset / expired / notify / ok)、距下次複訓天數與證照影本。',
          'x-permission': 'portal.api.esh.holder.read',
          'x-gherkin': gherkin(
            '場景: 人員證照清單\n  當 呼叫 GET /api/portal/esh/holders?company=碩禾\n  那麼 預設只列啟用中、在職、通知天數 ≠ 0 的持證資料,含狀態',
          ),
          querystring: {
            type: 'object',
            additionalProperties: false,
            properties: { company: COMPANY, licenseId: ID, view: { type: 'string', enum: ['current', 'history', 'untracked'] } },
          },
        },
      },
      async (req) => {
        const emp = employeeOf(req);
        const svc = need().license;
        return { companies: (await svc.scope(emp)).companies, items: await svc.holders(emp, req.query) };
      },
    );

    app.post<{ Body: HolderInput & { empNo: string; licenseId: number } }>(
      '/v1/esh/holders',
      {
        schema: {
          operationId: 'portal.esh.holder-create',
          summary: 'ESH 證照:新增人員證照',
          description: '工號需在職(LOS RankInfo,否則 400 PORTAL_ESH_EMP_NOT_ACTIVE);同人同證照同公司已有啟用中紀錄回 409;下次複訓日由後端計算。',
          'x-permission': 'portal.api.esh.holder.edit',
          'x-audit-level': 'body',
          'x-gherkin': gherkin(
            '場景: 新增人員證照\n  當 呼叫 POST /api/portal/esh/holders,在職工號、取得日 2026-10-02、有效期 36 個月的證照\n  那麼 回應 201,nextTrainingDate = 2029-10-01',
          ),
          body: holderCreateBody,
        },
      },
      async (req, reply) => reply.status(201).send(await need().license.createHolder(employeeOf(req), req.body)),
    );

    app.put<{ Params: { id: number }; Body: HolderInput }>(
      '/v1/esh/holders/:id',
      {
        schema: {
          operationId: 'portal.esh.holder-update',
          summary: 'ESH 證照:更新人員證照',
          description: '更新公司(須在範圍內)、日期與通知天數;下次複訓日由後端重算(不接受前端送值);已刪除的紀錄不可更新。',
          'x-permission': 'portal.api.esh.holder.edit',
          'x-audit-level': 'body',
          'x-gherkin': gherkin(
            '場景: 更新人員證照與下次複訓日\n  當 呼叫 PUT /api/portal/esh/holders/1082,複訓日 2027-03-20\n  那麼 下次複訓日 = 複訓日 + 有效期 − 1 天',
          ),
          params: idParam,
          body: holderBody,
        },
      },
      async (req) => need().license.updateHolder(employeeOf(req), req.params.id, req.body),
    );

    app.delete<{ Params: { id: number } }>(
      '/v1/esh/holders/:id',
      {
        schema: {
          operationId: 'portal.esh.holder-delete',
          summary: 'ESH 證照:刪除人員證照',
          description: '軟刪除(IsActive = 0)。',
          'x-permission': 'portal.api.esh.holder.edit',
          'x-audit-level': 'meta',
          'x-gherkin': gherkin('場景: 刪除人員證照\n  當 呼叫 DELETE /api/portal/esh/holders/1082\n  那麼 回應 204,LicenseFileA.IsActive = 0'),
          params: idParam,
        },
      },
      async (req, reply) => {
        await need().license.deleteHolder(employeeOf(req), req.params.id);
        return reply.status(204).send();
      },
    );

    app.post<{ Params: { id: number }; Body: FileRef }>(
      '/v1/esh/holders/:id/docs',
      {
        schema: {
          operationId: 'portal.esh.holder-doc-add',
          summary: 'ESH 證照:新增證照影本',
          description: '前端先上傳到 file-service(sourceApp / refType portal-esh-license),再登記檔案編號;只接受 pdf / jpg / png。',
          'x-permission': 'portal.api.esh.holder.edit',
          'x-audit-level': 'body',
          'x-gherkin': gherkin(
            '場景: 證照影本經 file-service\n  當 呼叫 POST /api/portal/esh/holders/1082/docs,檔案編號與 .pdf 檔名\n  那麼 回應 201,不會覆蓋其他人的同名檔案',
          ),
          params: idParam,
          body: fileBody,
        },
      },
      async (req, reply) => reply.status(201).send(await need().license.addDoc(employeeOf(req), req.params.id, req.body)),
    );

    app.delete<{ Params: { id: number; docId: number } }>(
      '/v1/esh/holders/:id/docs/:docId',
      {
        schema: {
          operationId: 'portal.esh.holder-doc-delete',
          summary: 'ESH 證照:刪除證照影本',
          description: '移除新站上傳的影本登記。',
          'x-permission': 'portal.api.esh.holder.edit',
          'x-audit-level': 'meta',
          'x-gherkin': gherkin('場景: 刪除證照影本\n  當 呼叫 DELETE /api/portal/esh/holders/1082/docs/5\n  那麼 回應 204'),
          params: { type: 'object', required: ['id', 'docId'], properties: { id: ID, docId: ID } },
        },
      },
      async (req, reply) => {
        await need().license.deleteDoc(employeeOf(req), req.params.id, req.params.docId);
        return reply.status(204).send();
      },
    );

    app.delete<{ Params: { id: number }; Querystring: { fileName: string } }>(
      '/v1/esh/holders/:id/legacy-docs',
      {
        schema: {
          operationId: 'portal.esh.holder-legacy-doc-delete',
          summary: 'ESH 證照:刪除舊站證照影本',
          description: '刪除舊站 LicenseFileC 的登記(同舊版硬刪;舊站目錄的實體檔不處理)。',
          'x-permission': 'portal.api.esh.holder.edit',
          'x-audit-level': 'meta',
          'x-gherkin': gherkin('場景: 刪除舊站證照影本\n  當 呼叫 DELETE /api/portal/esh/holders/1082/legacy-docs?fileName=a.pdf\n  那麼 回應 204'),
          params: idParam,
          querystring: {
            type: 'object',
            required: ['fileName'],
            additionalProperties: false,
            properties: { fileName: { type: 'string', minLength: 1, maxLength: 100 } },
          },
        },
      },
      async (req, reply) => {
        await need().license.deleteLegacyDoc(employeeOf(req), req.params.id, req.query.fileName);
        return reply.status(204).send();
      },
    );

    // ───── 複訓通知 ─────
    app.post(
      '/v1/esh/notify',
      {
        schema: {
          operationId: 'portal.esh.notify-send',
          summary: 'ESH 證照:立即通知',
          description:
            '手動執行複訓通知(只含本人管理的公司;排程每週一自動執行全部公司);寄送方式依設定(dry-run 只寫紀錄);同公司 10 分鐘內重複回 409 PORTAL_ESH_NOTIFY_TOO_SOON。',
          'x-permission': 'portal.api.esh.notify.send',
          'x-audit-level': 'meta',
          'x-gherkin': gherkin(
            '場景: 手動立即通知\n  當 具 portal.esh.notify.send 的管理員呼叫 POST /api/portal/esh/notify\n  那麼 依規則寄本人、主管與管理員彙整,每封寫寄送紀錄;10 分鐘內再按回 409',
          ),
        },
      },
      async (req) => need().notify.runManual(employeeOf(req)),
    );

    app.get(
      '/v1/esh/notify/runs',
      {
        schema: {
          operationId: 'portal.esh.notify-runs',
          summary: 'ESH 證照:通知紀錄',
          description: '最近的複訓通知執行紀錄(排程與手動;只列與本人管理公司有交集者)與目前寄送方式。',
          'x-permission': 'portal.api.esh.notify.read',
          'x-gherkin': gherkin('場景: 查看通知紀錄\n  當 呼叫 GET /api/portal/esh/notify/runs\n  那麼 回應最近的執行紀錄與寄送方式(mode)'),
        },
      },
      async (req) => {
        const svc = need().notify;
        return { mode: svc.mode, items: await svc.runs(employeeOf(req)) };
      },
    );

    app.get<{ Params: { id: number } }>(
      '/v1/esh/notify/runs/:id',
      {
        schema: {
          operationId: 'portal.esh.notify-run-logs',
          summary: 'ESH 證照:通知寄送明細',
          description: '單次執行的每位收件人寄送結果(只列本人管理公司的紀錄)。',
          'x-permission': 'portal.api.esh.notify.read',
          'x-gherkin': gherkin('場景: 寄送明細\n  當 呼叫 GET /api/portal/esh/notify/runs/3\n  那麼 回應收件人工號、類型、筆數與結果'),
          params: idParam,
        },
      },
      async (req) => ({ items: await need().notify.logs(employeeOf(req), req.params.id) }),
    );

    // ───── 證照管理員 ─────
    app.get<{ Querystring: { company?: string } }>(
      '/v1/esh/managers',
      {
        schema: {
          operationId: 'portal.esh.managers',
          summary: 'ESH 證照:證照管理員清單',
          description: '本人管理公司的證照管理員(姓名、部門、是否在職、是否收通知)。',
          'x-permission': 'portal.api.esh.manager.read',
          'x-gherkin': gherkin('場景: 證照管理員清單\n  當 呼叫 GET /api/portal/esh/managers\n  那麼 只回本人管理公司的管理員'),
          querystring: companyQuery,
        },
      },
      async (req) => {
        const emp = employeeOf(req);
        const svc = need().license;
        return { companies: (await svc.scope(emp)).companies, items: await svc.managers(emp, req.query.company) };
      },
    );

    app.post<{ Body: ManagerBody }>(
      '/v1/esh/managers',
      {
        schema: {
          operationId: 'portal.esh.manager-create',
          summary: 'ESH 證照:新增證照管理員',
          description: '工號需在職、同公司不可重複(409 PORTAL_ESH_MANAGER_DUPLICATE);公司須在本人範圍內。新管理員另需由 IT 指派角色 portal-esh-admin。',
          'x-permission': 'portal.api.esh.manager.edit',
          'x-audit-level': 'body',
          'x-gherkin': gherkin('場景: 新增證照管理員\n  當 呼叫 POST /api/portal/esh/managers,範圍內公司與在職工號\n  那麼 回應 201;重複回 409;離職工號回 400'),
          body: managerBody,
        },
      },
      async (req, reply) => reply.status(201).send(await need().license.createManager(employeeOf(req), req.body)),
    );

    app.put<{ Body: ManagerBody }>(
      '/v1/esh/managers',
      {
        schema: {
          operationId: 'portal.esh.manager-update',
          summary: 'ESH 證照:設定管理員通知',
          description: '設定是否收複訓通知彙整(SendMail)。',
          'x-permission': 'portal.api.esh.manager.edit',
          'x-audit-level': 'body',
          'x-gherkin': gherkin('場景: 通知開關\n  當 呼叫 PUT /api/portal/esh/managers,sendMail = false\n  那麼 回應 204'),
          body: managerBody,
        },
      },
      async (req, reply) => {
        await need().license.updateManager(employeeOf(req), req.body);
        return reply.status(204).send();
      },
    );

    app.delete<{ Querystring: { company: string; empNo: string } }>(
      '/v1/esh/managers',
      {
        schema: {
          operationId: 'portal.esh.manager-delete',
          summary: 'ESH 證照:刪除證照管理員',
          description: '不可刪除公司最後一位管理員(409 PORTAL_ESH_MANAGER_LAST)。',
          'x-permission': 'portal.api.esh.manager.edit',
          'x-audit-level': 'meta',
          'x-gherkin': gherkin(
            '場景: 不可刪除最後一位管理員\n  假如 公司只剩一位管理員\n  當 呼叫 DELETE /api/portal/esh/managers\n  那麼 回應 409 PORTAL_ESH_MANAGER_LAST',
          ),
          querystring: {
            type: 'object',
            required: ['company', 'empNo'],
            additionalProperties: false,
            properties: { company: COMPANY, empNo: { type: 'string', minLength: 1, maxLength: 20 } },
          },
        },
      },
      async (req, reply) => {
        await need().license.deleteManager(employeeOf(req), req.query.company, req.query.empNo);
        return reply.status(204).send();
      },
    );

    // ───── 危害性化學品 ─────
    app.get<{ Querystring: { restrict: Restrict; from?: string; to?: string; keyword?: string; page?: number; pageSize?: number } }>(
      '/v1/esh/chemicals',
      {
        schema: {
          operationId: 'portal.esh.chemicals',
          summary: '危害性化學品:清單',
          description: '列管 / 不列管、申請日期區間(預設去年本月 1 日 ~ 今天)、關鍵字(名稱、流程序號、成份 CAS No.);分頁;成份以化學品 ID 對應。',
          'x-permission': 'portal.api.esh.chemical.read',
          'x-gherkin': gherkin(
            '場景: 查詢化學品\n  當 員工呼叫 GET /api/portal/esh/chemicals?restrict=不列管\n  那麼 回應該分頁的化學品,每筆成份只屬於該化學品',
          ),
          querystring: {
            type: 'object',
            required: ['restrict'],
            additionalProperties: false,
            properties: {
              restrict: { type: 'string', enum: [...RESTRICT] },
              from: DATE,
              to: DATE,
              keyword: { type: 'string', maxLength: 100 },
              page: { type: 'integer', minimum: 1, maximum: 10000, default: 1 },
              pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            },
          },
        },
      },
      async (req) => {
        employeeOf(req);
        return need().chemical.list(req.query);
      },
    );

    app.get<{ Params: { efId: string } }>(
      '/v1/esh/chemicals/:efId',
      {
        schema: {
          operationId: 'portal.esh.chemical',
          summary: '危害性化學品:明細',
          description: '單筆化學品申報明細(申請人、保管人、使用人、成份、SDS)。',
          'x-permission': 'portal.api.esh.chemical.read',
          'x-gherkin': gherkin('場景: 化學品明細\n  當 呼叫 GET /api/portal/esh/chemicals/SHR008_00002234\n  那麼 回應明細;使用人欄位為使用人(修正舊版錯置)'),
          params: { type: 'object', required: ['efId'], properties: { efId: EF_ID } },
        },
      },
      async (req) => {
        employeeOf(req);
        return need().chemical.get(req.params.efId);
      },
    );

    app.post<{ Body: { from?: string; to?: string } }>(
      '/v1/esh/chemicals/sync',
      {
        schema: {
          operationId: 'portal.esh.chemical-sync',
          summary: '危害性化學品:由 BPM 同步',
          description: '唯讀查 NaNa 化學品申報單(已結案、建立日在區間內,最多 36 個月),整批在同一交易內更新 ESHChemicalDataA / B / C;須具 portal-esh-admin。',
          'x-permission': 'portal.api.esh.chemical.edit',
          'x-audit-level': 'body',
          'x-timeout-ms': 120000,
          'x-gherkin': gherkin(
            '場景: 由 BPM 同步\n  當 管理員呼叫 POST /api/portal/esh/chemicals/sync\n  那麼 回應表單數、寫入數與略過清單;任一句寫入失敗全部回復',
          ),
          body: { type: 'object', additionalProperties: false, properties: { from: DATE, to: DATE } },
        },
      },
      async (req) => need().chemical.syncManual(employeeOf(req), req.body ?? {}),
    );

    app.get(
      '/v1/esh/chemicals/sync/runs',
      {
        schema: {
          operationId: 'portal.esh.chemical-sync-runs',
          summary: '危害性化學品:同步紀錄',
          description: '最近的同步執行紀錄(排程與手動)。',
          'x-permission': 'portal.api.esh.chemical.edit',
          'x-gherkin': gherkin('場景: 同步紀錄\n  當 管理員呼叫 GET /api/portal/esh/chemicals/sync/runs\n  那麼 回應最近的同步結果'),
        },
      },
      async (req) => ({ items: await need().chemical.runs(employeeOf(req)) }),
    );

    app.put<{ Params: { efId: string }; Body: FileRef }>(
      '/v1/esh/chemicals/:efId/sds',
      {
        schema: {
          operationId: 'portal.esh.chemical-sds',
          summary: '危害性化學品:上傳 SDS',
          description: '前端先上傳到 file-service(sourceApp / refType portal-esh-sds),再登記;優先於 BPM 附件顯示,同步不覆寫;須具 portal-esh-admin。',
          'x-permission': 'portal.api.esh.chemical.edit',
          'x-audit-level': 'body',
          'x-gherkin': gherkin(
            '場景: 手動上傳 SDS\n  當 管理員呼叫 PUT /api/portal/esh/chemicals/SHR008_00002234/sds\n  那麼 明細的 SDS 為新上傳的檔案;之後同步不覆寫',
          ),
          params: { type: 'object', required: ['efId'], properties: { efId: EF_ID } },
          body: fileBody,
        },
      },
      async (req) => need().chemical.setSds(employeeOf(req), req.params.efId, req.body),
    );

    app.delete<{ Params: { efId: string } }>(
      '/v1/esh/chemicals/:efId/sds',
      {
        schema: {
          operationId: 'portal.esh.chemical-sds-delete',
          summary: '危害性化學品:移除上傳的 SDS',
          description: '移除新站上傳的 SDS,改回顯示 BPM 附件。',
          'x-permission': 'portal.api.esh.chemical.edit',
          'x-audit-level': 'meta',
          'x-gherkin': gherkin('場景: 移除上傳的 SDS\n  當 呼叫 DELETE /api/portal/esh/chemicals/SHR008_00002234/sds\n  那麼 回應 204'),
          params: { type: 'object', required: ['efId'], properties: { efId: EF_ID } },
        },
      },
      async (req, reply) => {
        await need().chemical.deleteSds(employeeOf(req), req.params.efId);
        return reply.status(204).send();
      },
    );
  };
}
