/**
 * 分機表(old_PortalSolar ExtensionTable.aspx、ExtansionUp.aspx;docs/Gherkin/resources/directory.feature)。
 * 資料 PortalSolar.dbo.NotesPhone(與舊系統共用)。
 *   - 查詢:關鍵字(最多 2 個,逗號或空白分隔)都要出現在「部門、工號、英文名、姓名、職稱、分機、職稱代碼」的任一欄;
 *     同舊程式不列工號 2 碼以下、或以 F / G / A 開頭的帳號;最多 200 筆
 *   - 修改本人分機:同舊程式先寫一筆 NotesPhoneTemp(異動紀錄),再更新 NotesPhone;分機未變不寫入。
 *     舊程式另寄「人員分機異動通知」給總機,新版不寄(D-17,總機可查 NotesPhoneTemp)
 *   - 不回傳 Email(舊頁也未顯示),避免整理出全公司名錄
 */
import sql from 'mssql';
import type { FastifyInstance } from 'fastify';
import type { Sources } from '../db/sources.js';
import { AppError } from '../errors.js';
import { employeeOf } from '../identity.js';

export interface DirectoryEntry {
  empNo: string;
  name: string | null;
  englishName: string | null;
  dept: string | null;
  deptName: string | null;
  title: string | null;
  phone: string | null;
}

export interface DirectoryRepo {
  search(terms: string[], limit: number): Promise<DirectoryEntry[]>;
  /** 更新本人分機;本人不在分機表回 false */
  updatePhone(empNo: string, phone: string): Promise<boolean>;
}

export const MAX_RESULTS = 200;

/** 舊程式隱藏的帳號:工號 2 碼以下,或以 F / G / A 開頭 */
export const hiddenEmp = (empNo: string) => empNo.length <= 2 || /^[FGA]/i.test(empNo);

/** 關鍵字:逗號或空白分隔,最多 2 個(同舊程式) */
export const parseTerms = (q: string) =>
  q
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 2);

/** LIKE 萬用字元跳脫 */
const likeEscape = (s: string) => s.replace(/[\\%_[]/g, (c) => `\\${c}`);

export class MssqlDirectoryRepo implements DirectoryRepo {
  constructor(
    private readonly pool: sql.ConnectionPool,
    private readonly src: Sources,
  ) {}

  async search(terms: string[], limit: number): Promise<DirectoryEntry[]> {
    const req = this.pool.request().input('limit', sql.Int, limit);
    const conds = terms.map((t, i) => {
      req.input(`t${i}`, sql.NVarChar(60), `%${likeEscape(t)}%`);
      return `total LIKE @t${i} ESCAPE '\\'`;
    });
    const r = await req.query<{
      LgNo: string;
      CName: string | null;
      NotesID: string | null;
      DeptNo: string | null;
      CDeptName: string | null;
      CTitle: string | null;
      PhoneNo: string | null;
    }>(
      `SELECT TOP (@limit) LgNo, CName, NotesID, DeptNo, CDeptName, CTitle, PhoneNo FROM (
         SELECT *, ISNULL(DeptNo, '') + ',' + ISNULL(LgNo, '') + ',' + ISNULL(NotesID, '') + ',' + ISNULL(CName, '') + ',' + ISNULL(CTitle, '')
                   + ',' + ISNULL(PhoneNo, '') + ',' + ISNULL(TilteNo, '') AS total
         FROM ${this.src.table('PortalSolar', 'NotesPhone')}
         WHERE LEN(LgNo) > 2 AND LEFT(LgNo, 1) NOT IN ('F', 'G', 'A')
       ) AS a WHERE ${conds.join(' AND ')} ORDER BY DeptNo, LgNo`,
    );
    return r.recordset.map((x) => ({
      empNo: x.LgNo,
      name: x.CName,
      englishName: x.NotesID,
      dept: x.DeptNo,
      deptName: x.CDeptName,
      title: x.CTitle,
      phone: x.PhoneNo,
    }));
  }

  async updatePhone(empNo: string, phone: string): Promise<boolean> {
    // NotesPhoneTemp.LgNo 只有 nvarchar(10)
    if (empNo.length > 10) return false;
    const tx = new sql.Transaction(this.pool);
    await tx.begin();
    try {
      const r = await tx
        .request()
        .input('emp', sql.NVarChar(10), empNo)
        .input('phone', sql.NVarChar(30), phone)
        .query(
          `IF NOT EXISTS (SELECT 1 FROM ${this.src.table('PortalSolar', 'NotesPhone')} WHERE LgNo = @emp) SELECT 0 AS ok
           ELSE IF EXISTS (SELECT 1 FROM ${this.src.table('PortalSolar', 'NotesPhone')} WHERE LgNo = @emp AND PhoneNo = @phone) SELECT 1 AS ok
           ELSE BEGIN
             INSERT INTO ${this.src.table('PortalSolar', 'NotesPhoneTemp')} (LgNo, PhoneNo, PoDate) VALUES (@emp, @phone, GETDATE());
             UPDATE ${this.src.table('PortalSolar', 'NotesPhone')} SET PhoneNo = @phone WHERE LgNo = @emp;
             SELECT 1 AS ok;
           END`,
        );
      await tx.commit();
      return (r.recordset as { ok: number }[])[0]?.ok === 1;
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }
}

const entrySchema = {
  type: 'object',
  properties: Object.fromEntries(['empNo', 'name', 'englishName', 'dept', 'deptName', 'title', 'phone'].map((k) => [k, { type: ['string', 'null'] }])),
} as const;

export function directoryRoutes(repo: DirectoryRepo | null) {
  const need = () => {
    if (!repo) throw new AppError(503, 'PORTAL_SOURCE_UNAVAILABLE', '資料來源未設定');
    return repo;
  };
  return async (app: FastifyInstance): Promise<void> => {
    app.get<{ Querystring: { q: string } }>(
      '/v1/directory',
      {
        schema: {
          operationId: 'portal.directory.search',
          summary: '分機表:查詢',
          description: '以 1–2 個關鍵字(逗號或空白分隔)查詢同仁的部門、工號、姓名、職稱、分機;最多 200 筆。',
          'x-permission': 'portal.api.directory.read',
          'x-gherkin': '場景: 以關鍵字查分機\n  當 呼叫 GET /api/portal/directory?q=資訊,2109\n  那麼 回應同時符合兩個關鍵字的同仁',
          querystring: { type: 'object', required: ['q'], additionalProperties: false, properties: { q: { type: 'string', minLength: 2, maxLength: 100 } } },
          response: {
            200: {
              type: 'object',
              required: ['items', 'truncated'],
              properties: { items: { type: 'array', items: entrySchema }, truncated: { type: 'boolean' } },
            },
          },
        },
      },
      async (req) => {
        employeeOf(req);
        const terms = parseTerms(req.query.q);
        if (!terms.length) throw new AppError(400, 'VALIDATION_FAILED', '參數驗證失敗', [{ field: 'q', message: '請輸入關鍵字' }]);
        const rows = (await need().search(terms, MAX_RESULTS + 1)).filter((r) => !hiddenEmp(r.empNo));
        return { items: rows.slice(0, MAX_RESULTS), truncated: rows.length > MAX_RESULTS };
      },
    );

    app.put<{ Body: { phone: string } }>(
      '/v1/directory/me/phone',
      {
        schema: {
          operationId: 'portal.directory.update-phone',
          summary: '分機表:更新本人分機',
          description: '更新本人在分機表的分機號碼(先記錄異動 NotesPhoneTemp,再更新 NotesPhone;與舊入口網共用)。本人不在分機表回 404。',
          'x-permission': 'portal.api.directory.write',
          'x-audit-level': 'body',
          'x-gherkin': '場景: 更新本人分機\n  當 呼叫 PUT /api/portal/directory/me/phone,分機 2109\n  那麼 回應 200,分機表顯示新分機',
          body: {
            type: 'object',
            required: ['phone'],
            additionalProperties: false,
            properties: { phone: { type: 'string', minLength: 1, maxLength: 30, pattern: '^[0-9#*+()\\-/,. ]+$' } },
          },
          response: { 200: { type: 'object', required: ['phone'], properties: { phone: { type: 'string' } } } },
        },
      },
      async (req) => {
        const { empNo } = employeeOf(req);
        const phone = req.body.phone.trim();
        if (!(await need().updatePhone(empNo, phone))) throw new AppError(404, 'PORTAL_DIRECTORY_NOT_FOUND', '分機表沒有您的資料,請洽總務');
        return { phone };
      },
    );
  };
}
