/**
 * 內部職缺(old_PortalSolar JobOpening.aspx;PORTAL-API-PLAN D-15;docs/Gherkin/resources/jobs.feature)。
 * 資料 PortalSolar.dbo.EnlistTB(與舊系統共用;日期欄位為 'yyyy/MM/dd' 字串,照舊格式寫入)。
 *   - 同仁:看開放中的職缺(截止日 > 今天);all=true 看全部(舊系統同仁看得到全部)
 *   - 維護(新增 / 修改 / 刪除):舊系統寫死兩個工號,改為按鈕權限 portal.job.edit(includes portal.api.job.write,角色 portal-editor)
 *   - 應徵 / 推薦不寄信(D-15),由同仁自行聯絡人資
 */
import sql from 'mssql';
import type { FastifyInstance } from 'fastify';
import type { Sources } from '../db/sources.js';
import { AppError } from '../errors.js';
import { employeeOf } from '../identity.js';

export interface Job {
  no: number;
  title: string | null;
  content: string | null;
  /** 刊登日 yyyy/MM/dd */
  postedAt: string | null;
  /** 截止日 yyyy/MM/dd */
  closeAt: string | null;
  open: boolean;
}

export interface JobInput {
  title: string;
  content: string;
  /** YYYY-MM-DD */
  closeAt: string;
}

export interface JobRepo {
  list(all: boolean): Promise<Job[]>;
  create(input: JobInput): Promise<number>;
  update(no: number, input: JobInput): Promise<boolean>;
  remove(no: number): Promise<boolean>;
}

/** YYYY-MM-DD → 舊表格式 yyyy/MM/dd */
export const legacyDate = (iso: string) => iso.replace(/-/g, '/');
/** 台灣時間的今天(yyyy/MM/dd) */
export const todayTw = () => legacyDate(new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10));

interface Row {
  No: number;
  EnlistMpoint: string | null;
  EnlistContent: string | null;
  MDate: string | null;
  CurDate: string | null;
  isOpen: number;
}

export class MssqlJobRepo implements JobRepo {
  constructor(
    private readonly pool: sql.ConnectionPool,
    private readonly src: Sources,
  ) {}

  private get table() {
    return this.src.table('PortalSolar', 'EnlistTB');
  }

  async list(all: boolean): Promise<Job[]> {
    // 日期為字串;TRY_CONVERT 避免舊資料格式錯誤讓整個查詢失敗(無法轉換的視為已截止、排最後)
    const r = await this.pool.request().query<Row>(
      `SELECT TOP 500 No, EnlistMpoint, EnlistContent, MDate, CurDate,
              CASE WHEN TRY_CONVERT(datetime, CurDate) > GETDATE() THEN 1 ELSE 0 END AS isOpen
       FROM ${this.table}
       ${all ? '' : 'WHERE TRY_CONVERT(datetime, CurDate) > GETDATE()'}
       ORDER BY TRY_CONVERT(datetime, MDate) DESC, EnlistMpoint, No DESC`,
    );
    return r.recordset.map((x) => ({ no: x.No, title: x.EnlistMpoint, content: x.EnlistContent, postedAt: x.MDate, closeAt: x.CurDate, open: x.isOpen === 1 }));
  }

  async create(input: JobInput): Promise<number> {
    const r = await this.pool
      .request()
      .input('t', sql.NVarChar(50), input.title)
      .input('c', sql.NVarChar(sql.MAX), input.content)
      .input('m', sql.NVarChar(50), todayTw())
      .input('cur', sql.NVarChar(50), legacyDate(input.closeAt))
      .query<{ no: number }>(
        `INSERT INTO ${this.table} (EnlistMpoint, EnlistContent, MDate, CurDate) VALUES (@t, @c, @m, @cur); SELECT CAST(SCOPE_IDENTITY() AS int) AS no;`,
      );
    return r.recordset[0]!.no;
  }

  async update(no: number, input: JobInput): Promise<boolean> {
    const r = await this.pool
      .request()
      .input('no', sql.Int, no)
      .input('t', sql.NVarChar(50), input.title)
      .input('c', sql.NVarChar(sql.MAX), input.content)
      .input('cur', sql.NVarChar(50), legacyDate(input.closeAt))
      .query(`UPDATE ${this.table} SET EnlistMpoint = @t, EnlistContent = @c, CurDate = @cur WHERE No = @no`);
    return r.rowsAffected[0] === 1;
  }

  async remove(no: number): Promise<boolean> {
    const r = await this.pool.request().input('no', sql.Int, no).query(`DELETE FROM ${this.table} WHERE No = @no`);
    return r.rowsAffected[0] === 1;
  }
}

const jobSchema = {
  type: 'object',
  properties: {
    no: { type: 'integer' },
    title: { type: ['string', 'null'] },
    content: { type: ['string', 'null'] },
    postedAt: { type: ['string', 'null'] },
    closeAt: { type: ['string', 'null'] },
    open: { type: 'boolean' },
  },
} as const;
const inputSchema = {
  type: 'object',
  required: ['title', 'content', 'closeAt'],
  additionalProperties: false,
  properties: {
    // 不允許 < >:舊站 JobOpening.aspx 以 asp:Label 輸出不做 HTML 編碼,並行期間新站寫入的內容會在舊站顯示
    title: { type: 'string', minLength: 1, maxLength: 50, pattern: '^[^<>]*\\S[^<>]*$' },
    content: { type: 'string', minLength: 1, maxLength: 4000, pattern: '^[^<>]*$' },
    closeAt: { type: 'string', format: 'date' },
  },
} as const;
const noParam = { type: 'object', required: ['no'], properties: { no: { type: 'integer', minimum: 1 } } } as const;
const notFound = () => new AppError(404, 'PORTAL_JOB_NOT_FOUND', '找不到此職缺');

export function jobRoutes(repo: JobRepo | null) {
  const need = () => {
    if (!repo) throw new AppError(503, 'PORTAL_SOURCE_UNAVAILABLE', '資料來源未設定');
    return repo;
  };
  const clean = (b: JobInput): JobInput => ({ title: b.title.trim(), content: b.content.trim(), closeAt: b.closeAt });
  return async (app: FastifyInstance): Promise<void> => {
    app.get<{ Querystring: { all?: boolean } }>(
      '/v1/jobs',
      {
        schema: {
          operationId: 'portal.job.list',
          summary: '內部職缺:清單',
          description: '開放中的內部職缺(截止日在今天之後);all=true 含已截止。新到舊。',
          'x-permission': 'portal.api.job.read',
          'x-gherkin': '場景: 查看開放中的職缺\n  假如 有 1 筆截止日在明天、1 筆已截止\n  當 呼叫 GET /api/portal/jobs\n  那麼 只回應開放中的 1 筆',
          querystring: { type: 'object', additionalProperties: false, properties: { all: { type: 'boolean', default: false } } },
          response: { 200: { type: 'object', required: ['items'], properties: { items: { type: 'array', items: jobSchema } } } },
        },
      },
      async (req) => {
        employeeOf(req);
        return { items: await need().list(req.query.all ?? false) };
      },
    );

    app.post<{ Body: JobInput }>(
      '/v1/jobs',
      {
        schema: {
          operationId: 'portal.job.create',
          summary: '內部職缺:新增',
          description: '新增職缺(刊登日為今天);限有 portal.job.edit 按鈕的人資。',
          'x-permission': 'portal.api.job.write',
          'x-audit-level': 'body',
          'x-gherkin': '場景: 人資新增職缺\n  當 呼叫 POST /api/portal/jobs,職稱「製程工程師」、截止日 2026-12-31\n  那麼 回應 201 與職缺編號',
          body: inputSchema,
          response: { 201: { type: 'object', required: ['no'], properties: { no: { type: 'integer' } } } },
        },
      },
      async (req, reply) => {
        employeeOf(req);
        return reply.status(201).send({ no: await need().create(clean(req.body)) });
      },
    );

    app.put<{ Params: { no: number }; Body: JobInput }>(
      '/v1/jobs/:no',
      {
        schema: {
          operationId: 'portal.job.update',
          summary: '內部職缺:修改',
          description: '修改職缺的職稱、內容與截止日。',
          'x-permission': 'portal.api.job.write',
          'x-audit-level': 'body',
          'x-gherkin': '場景: 人資修改職缺\n  當 呼叫 PUT /api/portal/jobs/1\n  那麼 回應 204',
          params: noParam,
          body: inputSchema,
        },
      },
      async (req, reply) => {
        employeeOf(req);
        if (!(await need().update(req.params.no, clean(req.body)))) throw notFound();
        return reply.status(204).send();
      },
    );

    app.delete<{ Params: { no: number } }>(
      '/v1/jobs/:no',
      {
        schema: {
          operationId: 'portal.job.delete',
          summary: '內部職缺:刪除',
          description: '刪除職缺。',
          'x-permission': 'portal.api.job.write',
          'x-audit-level': 'meta',
          'x-gherkin': '場景: 人資刪除職缺\n  當 呼叫 DELETE /api/portal/jobs/1\n  那麼 回應 204',
          params: noParam,
        },
      },
      async (req, reply) => {
        employeeOf(req);
        if (!(await need().remove(req.params.no))) throw notFound();
        return reply.status(204).send();
      },
    );
  };
}
