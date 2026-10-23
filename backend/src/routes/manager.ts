/**
 * 主管專區 /v1/manager/*(FEATURE-PLAN §7;docs/Gherkin/manager/*.feature;邏輯在 modules/manager/*)。
 *   部門清單 / 部門必上課程 / 部門資產明細:範圍 = Token 部門(含下層),portal-manager-all 全公司(scope.ts)
 *   年度教育訓練計畫:ELPlanDept 負責部門 ∩ 範圍(training.ts)
 *   部門預算 / 預算編列:Budget UserInfo(D-26)+ 須具 portal-manager(budget.ts)
 * 權限由 BFF 依 x-permission 檢查;資料範圍由本服務依 Token 過濾,違反回 403 PORTAL_DATA_ACCESS_DENIED。
 */
import type { FastifyInstance } from 'fastify';
import { AppError } from '../errors.js';
import { employeeOf } from '../identity.js';
import type { BudgetService } from '../modules/manager/budget.js';
import type { ScopeService } from '../modules/manager/scope.js';
import { NOTE_MAX, type ManagerStaffService } from '../modules/manager/staff.js';
import { buildTrainingWorkbook, trainingDisposition, trainingFileName } from '../modules/manager/training-export.js';
import { CLASS_ON_TYPES, CLASS_TYPES, CLASS_WHERE, LIMITS, SEASONS, SUB_TYPES, TEST_TYPES, type CourseInput } from '../modules/manager/training-rules.js';
import type { TrainingService } from '../modules/manager/training.js';

export interface ManagerServices {
  scopes: ScopeService;
  staff: ManagerStaffService;
  training: TrainingService;
  budget: BudgetService;
}

const thisYear = () => Number(new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 4));
const unavailable = () => new AppError(503, 'PORTAL_SOURCE_UNAVAILABLE', '資料來源未設定');

const DEPT = { type: 'string', pattern: '^[A-Za-z0-9]{1,20}$' } as const;
const deptQuery = {
  type: 'object',
  properties: { dept: DEPT, includeSub: { type: 'boolean', default: true } },
  additionalProperties: false,
} as const;
const deptOut = { type: 'object', properties: { code: { type: 'string' }, name: { type: ['string', 'null'] }, parent: { type: ['string', 'null'] } } } as const;
const nullable = (type: string) => ({ type: [type, 'null'] });

const courseOut = {
  type: 'object',
  properties: {
    classId: { type: 'string' },
    dept: { type: 'string' },
    className: nullable('string'),
    agenda: nullable('string'),
    classType: nullable('string'),
    subType: nullable('string'),
    classWhere: nullable('string'),
    onType: nullable('string'),
    testType: nullable('string'),
    teacherName: nullable('string'),
    teacherUnit: nullable('string'),
    season: nullable('string'),
    hour: nullable('number'),
    cost1: nullable('number'),
    cost2: nullable('number'),
    cost3: nullable('number'),
    cost: nullable('number'),
    joinDept: nullable('string'),
  },
} as const;

const planDeptOut = { type: 'object', properties: { code: { type: 'string' }, name: nullable('string') } } as const;

const trainingView = {
  type: 'object',
  properties: {
    year: { type: 'integer' },
    depts: { type: 'array', items: planDeptOut },
    outOfScope: { type: 'array', items: planDeptOut },
    canEdit: { type: 'boolean' },
    submitted: { type: 'boolean' },
    lockedDepts: { type: 'array', items: { type: 'string' } },
    courses: { type: 'array', items: courseOut },
    lastYear: { type: 'array', items: courseOut },
    applied: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          applyDate: nullable('string'),
          dept: nullable('string'),
          deptName: nullable('string'),
          className: nullable('string'),
          classWhere: { type: 'string' },
          teacherName: nullable('string'),
          hours: nullable('string'),
          joinDept: { type: 'string' },
        },
      },
    },
    options: {
      type: 'object',
      properties: {
        classTypes: { type: 'array', items: { type: 'string' } },
        subTypes: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } },
        classWhere: { type: 'array', items: { type: 'string' } },
        onTypes: { type: 'array', items: { type: 'string' } },
        testTypes: { type: 'array', items: { type: 'string' } },
        seasons: { type: 'array', items: { type: 'string' } },
      },
    },
  },
} as const;

const OPTIONS = {
  classTypes: [...CLASS_TYPES],
  subTypes: SUB_TYPES,
  classWhere: [...CLASS_WHERE],
  onTypes: [...CLASS_ON_TYPES],
  testTypes: [...TEST_TYPES],
  seasons: [...SEASONS],
};

const str = (max: number) => ({ type: 'string', maxLength: max }) as const;
const courseBody = {
  type: 'object',
  required: [
    'dept',
    'className',
    'agenda',
    'classType',
    'subType',
    'classWhere',
    'onType',
    'testType',
    'seasons',
    'hour',
    'cost1',
    'cost2',
    'cost3',
    'joinDept',
  ],
  additionalProperties: false,
  properties: {
    dept: DEPT,
    className: str(LIMITS.className + 20),
    agenda: str(LIMITS.agenda + 20),
    classType: str(10),
    subType: str(20),
    classWhere: str(10),
    onType: str(10),
    testType: str(LIMITS.testType + 10),
    teacherName: str(LIMITS.teacherName + 10),
    teacherUnit: str(LIMITS.teacherUnit + 10),
    seasons: { type: 'array', maxItems: 5, items: str(5) },
    hour: { type: 'number' },
    cost1: { type: 'integer' },
    cost2: { type: 'integer' },
    cost3: { type: 'integer' },
    joinDept: str(LIMITS.joinDept + 20),
  },
} as const;
const classIdParam = { type: 'object', required: ['classId'], properties: { classId: { type: 'string', pattern: '^[A-Za-z0-9]{1,20}$' } } } as const;

const versionOut = {
  type: 'object',
  properties: {
    flag: { type: 'integer' },
    year: { type: 'integer' },
    ver: { type: 'integer' },
    standard: { type: 'string' },
    isFinal: { type: 'boolean' },
    label: { type: 'string' },
  },
} as const;
const budgetDeptOut = { type: 'object', properties: { id: { type: 'string' }, name: nullable('string') } } as const;
const companyOut = { type: 'object', properties: { id: { type: 'string' }, name: nullable('string') } } as const;
const flagDept = {
  type: 'object',
  required: ['flag', 'dept'],
  properties: { flag: { type: 'integer', minimum: 1, maximum: 2147483647 }, dept: DEPT },
} as const;
const applyView = {
  type: 'object',
  properties: {
    version: versionOut,
    dept: { type: 'string' },
    status: nullable('integer'),
    locked: { type: 'boolean' },
    remark: nullable('string'),
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          name: nullable('string'),
          isSum: { type: 'boolean' },
          editable: { type: 'boolean' },
          months: {
            type: 'array',
            items: { anyOf: [{ type: 'null' }, { type: 'object', properties: { amount: { type: 'number' }, mark: nullable('string') } }] },
          },
          total: { type: 'number' },
        },
      },
    },
    lastYearActual: { type: 'null' },
    unavailable: { type: 'array', items: { type: 'string' } },
  },
} as const;

export function managerRoutes(svc: ManagerServices | null) {
  return async (app: FastifyInstance): Promise<void> => {
    const need = () => {
      if (!svc) throw unavailable();
      return svc;
    };

    // ───────── 共通:可選部門 ─────────
    app.get(
      '/v1/manager/depts',
      {
        schema: {
          operationId: 'portal.manager.depts',
          summary: '主管專區:可選部門',
          description: '內部 Token 部門與其全部下層(LOS DeptInfo.ParentDept);portal-manager-all 為全公司。',
          'x-permission': 'portal.api.mgr.dept.read',
          'x-gherkin':
            '場景: 主管可選的部門\n  假如 主管的 Token 部門為 S1800\n  當 呼叫 GET /api/portal/manager/depts\n  那麼 回應 S1800 與其下層部門,不含上層',
          response: { 200: { type: 'object', properties: { all: { type: 'boolean' }, items: { type: 'array', items: deptOut } } } },
        },
      },
      async (req) => {
        const scope = await need().scopes.of(employeeOf(req));
        return { all: scope.all, items: scope.depts };
      },
    );

    // ───────── 部門年度必上課程 ─────────
    app.get<{ Querystring: { dept?: string; includeSub?: boolean; year?: number } }>(
      '/v1/manager/courses',
      {
        schema: {
          operationId: 'portal.manager.courses',
          summary: '主管專區:部屬年度必上課程',
          description: '範圍內部屬(LOS EmployeeInfo)每人 12 門必上課程狀態與工安扣分;規則同個人版(D-9)。全公司角色須指定 dept。',
          'x-permission': 'portal.api.mgr.course.read',
          'x-gherkin':
            '場景: 部屬年度必上課程\n  假如 S1810 有 1 位同仁工安課程未完成\n  當 呼叫 GET /api/portal/manager/courses?dept=S1800\n  那麼 列出 S1800 與下層同仁的課程狀態,未完成者 deduction 為 -2',
          querystring: { ...deptQuery, properties: { ...deptQuery.properties, year: { type: 'integer', minimum: 2000, maximum: 2100 } } },
          response: {
            200: {
              type: 'object',
              properties: {
                year: { type: 'integer' },
                courses: {
                  type: 'array',
                  items: { type: 'object', properties: { key: { type: 'string' }, name: { type: 'string' }, category: { type: 'string' } } },
                },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      empNo: { type: 'string' },
                      name: nullable('string'),
                      dept: nullable('string'),
                      deptName: nullable('string'),
                      inYear: { type: 'boolean' },
                      deduction: { type: 'integer' },
                      courses: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: { key: { type: 'string' }, status: { type: 'string' }, hours: { type: 'number' }, minHours: { type: 'number' } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      async (req) => need().staff.courses(employeeOf(req), req.query.year ?? thisYear(), req.query.dept, req.query.includeSub ?? true),
    );

    // ───────── 部門資產明細 ─────────
    app.get<{ Querystring: { dept?: string; includeSub?: boolean } }>(
      '/v1/manager/property',
      {
        schema: {
          operationId: 'portal.manager.property',
          summary: '主管專區:部門資產備註',
          description: '範圍內在職同仁在 PortalSolar PersonalPropertyInfo 的資產備註(資產清單本身在 TIPTOP,轉移中;D-12)。',
          'x-permission': 'portal.api.mgr.property.read',
          'x-gherkin':
            '場景: 部門資產備註\n  假如 S1810 同仁 B 為資產 A001 填了備註\n  當 呼叫 GET /api/portal/manager/property?dept=S1800\n  那麼 列出 B 的資產 A001 與備註',
          querystring: deptQuery,
          response: {
            200: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      empNo: { type: 'string' },
                      name: nullable('string'),
                      dept: nullable('string'),
                      deptName: nullable('string'),
                      compDb: nullable('string'),
                      assetNo: { type: 'string' },
                      assetSub: nullable('string'),
                      note: nullable('string'),
                      hasPhoto: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      async (req) => need().staff.property(employeeOf(req), req.query.dept, req.query.includeSub ?? true),
    );

    app.put<{ Body: { empNo: string; compDb: string | null; assetNo: string; assetSub: string | null; note: string } }>(
      '/v1/manager/property/note',
      {
        schema: {
          operationId: 'portal.manager.property-note',
          summary: '主管專區:修改部屬資產備註',
          description: '備註歸屬保管人(更新 UserID = 保管人的紀錄,照片不變);保管人須在範圍內。按鈕 portal.mgr.property.edit。',
          'x-permission': 'portal.api.mgr.property.edit',
          'x-gherkin':
            '場景: 主管修改部屬資產備註\n  假如 主管具按鈕 portal.mgr.property.edit\n  當 PUT /api/portal/manager/property/note 修改保管人 B 的資產 A001 備註\n  那麼 PersonalPropertyInfo 中 UserID = B 的備註更新',
          body: {
            type: 'object',
            required: ['empNo', 'compDb', 'assetNo', 'assetSub', 'note'],
            additionalProperties: false,
            properties: {
              empNo: { type: 'string', pattern: '^[A-Za-z0-9]{1,20}$' },
              compDb: { type: ['string', 'null'], maxLength: 10 },
              assetNo: { type: 'string', minLength: 1, maxLength: 40 },
              assetSub: { type: ['string', 'null'], maxLength: 40 },
              note: { type: 'string', maxLength: NOTE_MAX },
            },
          },
          response: { 204: { type: 'null' } },
        },
      },
      async (req, reply) => {
        await need().staff.updateNote(employeeOf(req), req.body, req.body.note);
        return reply.status(204).send();
      },
    );

    // ───────── 年度教育訓練計畫 ─────────
    app.get(
      '/v1/manager/training',
      {
        schema: {
          operationId: 'portal.manager.training',
          summary: '主管專區:年度教育訓練計畫',
          description: '目前編列年度(ELClassAnnual)本人負責部門(ELPlanDept ∩ 範圍)的課程、提交狀態、去年計畫與 E-Learning 申請紀錄(帶入用)與選項。',
          'x-permission': 'portal.api.mgr.training.read',
          'x-gherkin':
            '場景: 開啟訓練計畫\n  假如 ELPlanDept 2026 年度主管 A 負責 S1800\n  當 呼叫 GET /api/portal/manager/training\n  那麼 回應年度 2026、可編部門、課程與是否已提交',
          response: { 200: trainingView },
        },
      },
      async (req) => ({ ...(await need().training.view(employeeOf(req))), options: OPTIONS }),
    );

    app.post<{ Body: CourseInput }>(
      '/v1/manager/training/courses',
      {
        schema: {
          operationId: 'portal.manager.training-create',
          summary: '主管專區:新增訓練課程',
          description:
            '寫入 PortalSolar ELClassForm(ClassID = N + yyMM + 流水;與舊系統同格式);驗證必填、時數 ≥ 0.5、費用整數;同部門同名不可重複;已提交則鎖定。',
          'x-permission': 'portal.api.mgr.training.write',
          'x-gherkin':
            '場景: 新增課程與驗證\n  當 主管 POST /api/portal/manager/training/courses 填齊必填欄位\n  那麼 回應 201,ELClassForm 新增一筆\n  而且 同部門同名課程回 409 PORTAL_MGR_TRAINING_DUPLICATE',
          body: courseBody,
          response: { 201: courseOut },
        },
      },
      async (req, reply) => reply.status(201).send(await need().training.create(employeeOf(req), req.body)),
    );

    app.put<{ Params: { classId: string }; Body: CourseInput }>(
      '/v1/manager/training/courses/:classId',
      {
        schema: {
          operationId: 'portal.manager.training-update',
          summary: '主管專區:修改訓練課程',
          description: '只能修改本年度、本人負責部門的課程;驗證同新增;已提交則鎖定。',
          'x-permission': 'portal.api.mgr.training.write',
          'x-gherkin':
            '場景: 修改課程\n  當 主管 PUT 本年度負責部門的課程\n  那麼 回應 200\n  而且 不屬於本人負責部門的課程回 404 PORTAL_MGR_TRAINING_NOT_FOUND',
          params: classIdParam,
          body: courseBody,
          response: { 200: courseOut },
        },
      },
      async (req) => need().training.update(employeeOf(req), req.params.classId, req.body),
    );

    app.delete<{ Params: { classId: string } }>(
      '/v1/manager/training/courses/:classId',
      {
        schema: {
          operationId: 'portal.manager.training-delete',
          summary: '主管專區:刪除訓練課程',
          description: '只能刪除本年度、本人負責部門的課程;已提交則鎖定。',
          'x-permission': 'portal.api.mgr.training.write',
          'x-gherkin': '場景: 刪除課程\n  當 主管 DELETE 本年度負責部門的課程\n  那麼 回應 204',
          params: classIdParam,
          response: { 204: { type: 'null' } },
        },
      },
      async (req, reply) => {
        await need().training.remove(employeeOf(req), req.params.classId);
        return reply.status(204).send();
      },
    );

    app.post(
      '/v1/manager/training/submit',
      {
        schema: {
          operationId: 'portal.manager.training-submit',
          summary: '主管專區:提交訓練計畫',
          description: '每個負責部門至少 2 門「在職訓練課程」且必填齊全;同一交易內刪除本人該年度 ELClassStatus 後逐部門新增「提交」;提交後鎖定。',
          'x-permission': 'portal.api.mgr.training.write',
          'x-gherkin':
            '場景: 提交訓練計畫\n  假如 某部門只有 1 門在職訓練課程\n  當 POST /api/portal/manager/training/submit\n  那麼 回應 422 PORTAL_MGR_TRAINING_INCOMPLETE\n  當 補齊後再提交\n  那麼 回應 submitted = true',
          response: { 200: trainingView },
        },
      },
      async (req) => ({ ...(await need().training.submit(employeeOf(req))), options: OPTIONS }),
    );

    app.get<{ Querystring: { dept: string } }>(
      '/v1/manager/training/export',
      {
        schema: {
          operationId: 'portal.manager.training-export',
          summary: '主管專區:匯出訓練計畫',
          description: '下載部門年度教育訓練計畫 Excel(標題年度取自 ELClassAnnual,不依賴舊 2024 範本);部門須為本人負責部門。',
          'x-permission': 'portal.api.mgr.training.read',
          'x-gherkin': '場景: 匯出訓練計畫\n  當 GET /api/portal/manager/training/export?dept=S1800\n  那麼 下載 S1800_115年度教育訓練計劃.xlsx',
          querystring: { type: 'object', required: ['dept'], properties: { dept: DEPT }, additionalProperties: false },
        },
      },
      async (req, reply) => {
        const { year, dept, courses } = await need().training.exportData(employeeOf(req), req.query.dept);
        const buf = await buildTrainingWorkbook(year, dept, courses);
        return reply
          .header('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
          .header('content-disposition', trainingDisposition(trainingFileName(year, dept.code)))
          .header('cache-control', 'no-store')
          .send(buf);
      },
    );

    // ───────── 部門預算(唯讀)─────────
    app.get(
      '/v1/manager/budget/options',
      {
        schema: {
          operationId: 'portal.manager.budget-options',
          summary: '主管專區:部門預算選項',
          description: '公司(LOS 公司別對應)、CurrentFlag 年度的版本清單、可看部門(Budget UserInfo 管理者 / 部門主管,D-26;須具 portal-manager)。',
          'x-permission': 'portal.api.mgr.budget.read',
          'x-gherkin':
            '場景: 可看部門\n  假如 主管在 Budget UserInfo 為 S1800 的部門主管\n  當 GET /api/portal/manager/budget/options\n  那麼 回應版本清單與部門 S1800',
          response: {
            200: {
              type: 'object',
              properties: {
                company: companyOut,
                year: nullable('integer'),
                versions: { type: 'array', items: versionOut },
                depts: { type: 'array', items: budgetDeptOut },
              },
            },
          },
        },
      },
      async (req) => need().budget.viewOptions(employeeOf(req)),
    );

    app.get<{ Querystring: { flag: number; dept: string; includeZero?: boolean } }>(
      '/v1/manager/budget',
      {
        schema: {
          operationId: 'portal.manager.budget',
          summary: '主管專區:部門預算執行',
          description: '各會計科目 1~12 月預算與合計(DeptBudgetList);實際金額來自 TIPTOP 傳票,系統轉移中(actual = null)。',
          'x-permission': 'portal.api.mgr.budget.read',
          'x-gherkin':
            '場景: 預算執行\n  當 GET /api/portal/manager/budget?flag=153&dept=S1800\n  那麼 列出各科目 1~12 月預算,actual 為 null 且 unavailable 含 actual',
          querystring: { ...flagDept, properties: { ...flagDept.properties, includeZero: { type: 'boolean', default: false } }, additionalProperties: false },
          response: {
            200: {
              type: 'object',
              properties: {
                version: versionOut,
                dept: { type: 'string' },
                rows: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      code: { type: 'string' },
                      name: nullable('string'),
                      months: { type: 'array', items: { type: 'number' } },
                      total: { type: 'number' },
                    },
                  },
                },
                monthTotals: { type: 'array', items: { type: 'number' } },
                total: { type: 'number' },
                actual: { type: 'null' },
                unavailable: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
      async (req) => need().budget.view(employeeOf(req), req.query.flag, req.query.dept, req.query.includeZero ?? false),
    );

    // ───────── 部門預算編列 ─────────
    app.get(
      '/v1/manager/budget-apply/options',
      {
        schema: {
          operationId: 'portal.manager.budget-apply-options',
          summary: '主管專區:預算編列選項',
          description: '未結案(IsFinal = 0)的版本與可編部門(同部門預算,D-26)。',
          'x-permission': 'portal.api.mgr.budget-apply.read',
          'x-gherkin': '場景: 預算編列清單\n  當 GET /api/portal/manager/budget-apply/options\n  那麼 只列未結案的版本',
          response: {
            200: {
              type: 'object',
              properties: { company: companyOut, versions: { type: 'array', items: versionOut }, depts: { type: 'array', items: budgetDeptOut } },
            },
          },
        },
      },
      async (req) => need().budget.applyOptions(employeeOf(req)),
    );

    app.get<{ Querystring: { flag: number; dept: string } }>(
      '/v1/manager/budget-apply',
      {
        schema: {
          operationId: 'portal.manager.budget-apply',
          summary: '主管專區:部門預算編列資料',
          description: '科目、1~12 月金額與備註、部門備註、部門狀態與是否鎖定;合計 / 禁填科目標示不可填;去年實際金額系統轉移中。',
          'x-permission': 'portal.api.mgr.budget-apply.read',
          'x-gherkin':
            '場景: 預算編列資料\n  當 GET /api/portal/manager/budget-apply?flag=154&dept=S1800\n  那麼 回應科目與每月金額,合計科目 editable 為 false',
          querystring: { ...flagDept, additionalProperties: false },
          response: { 200: applyView },
        },
      },
      async (req) => need().budget.apply(employeeOf(req), req.query.flag, req.query.dept),
    );

    app.put<{ Body: { flag: number; dept: string; remark?: string; cells: { code: string; month: number; amount: number; mark?: string }[] } }>(
      '/v1/manager/budget-apply',
      {
        schema: {
          operationId: 'portal.manager.budget-apply-save',
          summary: '主管專區:更新部門預算',
          description:
            '同一交易內更新 DeptBudgetList / BudgetData 金額、DeptBudgetMark 備註與部門備註;已送出或已結案回 409(後端鎖定檢查)。按鈕 portal.mgr.budget-apply.edit。',
          'x-permission': 'portal.api.mgr.budget-apply.write',
          'x-gherkin':
            '場景: 更新預算\n  當 PUT /api/portal/manager/budget-apply 修改 6211 科目 3 月金額\n  那麼 DeptBudgetList 與 BudgetData 同時更新\n  而且 部門已送出回 409 PORTAL_MGR_BUDGET_LOCKED',
          body: {
            type: 'object',
            required: ['flag', 'dept', 'cells'],
            additionalProperties: false,
            properties: {
              flag: { type: 'integer', minimum: 1, maximum: 2147483647 },
              dept: DEPT,
              remark: { type: 'string', maxLength: 1000 },
              cells: {
                type: 'array',
                maxItems: 1200,
                items: {
                  type: 'object',
                  required: ['code', 'month', 'amount'],
                  additionalProperties: false,
                  properties: {
                    code: { type: 'string', pattern: '^[A-Za-z0-9]{1,10}$' },
                    month: { type: 'integer', minimum: 1, maximum: 12 },
                    amount: { type: 'number' },
                    mark: { type: 'string', maxLength: 300 },
                  },
                },
              },
            },
          },
          response: { 200: applyView },
        },
      },
      async (req) => need().budget.save(employeeOf(req), req.body.flag, req.body.dept, { remark: req.body.remark, cells: req.body.cells }),
    );

    app.post<{ Body: { flag: number; dept: string } }>(
      '/v1/manager/budget-apply/submit',
      {
        schema: {
          operationId: 'portal.manager.budget-apply-submit',
          summary: '主管專區:送出部門預算',
          description: '部門狀態改為已送出(刪除後新增 部門狀態 Status = 1);已送出或已結案回 409。畫面上有未儲存修改時前端不送出。',
          'x-permission': 'portal.api.mgr.budget-apply.write',
          'x-gherkin': '場景: 送出部門預算\n  當 POST /api/portal/manager/budget-apply/submit\n  那麼 部門狀態為 1,回應 locked = true',
          body: { ...flagDept, additionalProperties: false },
          response: { 200: applyView },
        },
      },
      async (req) => need().budget.submit(employeeOf(req), req.body.flag, req.body.dept),
    );
  };
}
