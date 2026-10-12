/** GET /v1/courses/required:年度必上課程(docs/Gherkin/personal/courses.feature;規則見 modules/courses/rules.ts) */
import type { FastifyInstance } from 'fastify';
import { AppError } from '../errors.js';
import { employeeOf } from '../identity.js';
import type { CourseRepo } from '../modules/courses/repo.js';
import { evaluate } from '../modules/courses/rules.js';

/** 台灣時間的今年 */
const thisYear = () => Number(new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 4));

const resultSchema = {
  type: 'object',
  required: ['year', 'eligible', 'inYear', 'deduction', 'courses'],
  properties: {
    year: { type: 'integer' },
    eligible: { type: 'boolean', description: '是否為舊規則的對象(公司別 DS11 / DS15 / DS36、未離職)' },
    inYear: { type: 'boolean', description: '當年 9/30 前到職' },
    deduction: { type: 'integer', description: '工安課程未完成扣分(0 或負數)' },
    courses: {
      type: 'array',
      items: {
        type: 'object',
        required: ['key', 'name', 'category', 'status'],
        properties: {
          key: { type: 'string' },
          name: { type: 'string' },
          category: { type: 'string', enum: ['safety', 'general'] },
          status: { type: 'string', enum: ['done', 'missing', 'na'] },
          hours: { type: 'number' },
          minHours: { type: 'number' },
        },
      },
    },
  },
} as const;

export function courseRoutes(repo: CourseRepo | null) {
  return async (app: FastifyInstance): Promise<void> => {
    app.get<{ Querystring: { year?: number } }>(
      '/v1/courses/required',
      {
        schema: {
          operationId: 'portal.course.required',
          summary: '年度必上課程',
          description: '本人當年度 12 門必上課程(工安 5 門、其他 7 門)的適用與完訓狀態及工安扣分;規則同舊入口網 PersonalAnnualCurse。',
          'x-permission': 'portal.api.course.read',
          'x-gherkin':
            '場景: 查詢本人年度必上課程\n  假如 同仁屬公司別 DS11 且當年 9/30 前到職\n  當 呼叫 GET /api/portal/courses/required\n  那麼 回應 12 門課的狀態,未完成的工安課程各扣 2 分',
          querystring: { type: 'object', properties: { year: { type: 'integer', minimum: 2000, maximum: 2100 } }, additionalProperties: false },
          response: { 200: resultSchema },
        },
      },
      async (req) => {
        const { empNo } = employeeOf(req);
        if (!repo) throw new AppError(503, 'PORTAL_SOURCE_UNAVAILABLE', '資料來源未設定');
        const year = req.query.year ?? thisYear();
        const [rows, members, records] = await Promise.all([repo.employee(empNo, year), repo.memberships(empNo), repo.completions(empNo, year)]);
        return evaluate(year, rows, members, records);
      },
    );
  };
}
