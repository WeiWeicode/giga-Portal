/**
 * 問卷調查資料存取(PortalSolar QAAnnual / QAAnnualB / QAAnnualC / QAAnnualD,與舊入口網共用,D-7;LOS DeptInfo / EmployeeInfo 唯讀)。
 *   - 一律參數化;表名以 db/sources.ts 白名單組成
 *   - 多步寫入包交易;填答與編輯在交易內以 UPDLOCK + HOLDLOCK 鎖定後重新讀取再檢查(舊表沒有唯一鍵,避免連按兩次寫入兩份)
 *   - 日期:QAStartDate / QAEndDate 為 datetime(只用日期);QATimes 寫台灣時間(同舊程式 DateTime.Now)
 */
import sql from 'mssql';
import type { Sources } from '../../db/sources.js';
import type { Dept, ExportRow, ListFilter, QaRepo, Survey, SurveyHeader, SurveyListRow, SurveyWrite, UpdateMode } from './qa.js';
import {
  buildQuestions,
  imageKey,
  LEGACY_TYPE,
  serializeOptions,
  type AnswerCount,
  type AnswerRow,
  type ImageRow,
  type NormalizedQuestion,
  type QuestionRow,
} from './rules.js';

interface HeaderRow {
  QANo: string;
  QAName: string | null;
  QADept: string | null;
  QAFcontent: string | null;
  QAEcontent: string | null;
  startDate: string | null;
  endDate: string | null;
  Kdept: string | null;
  Kpep: string | null;
  CLgNo: string | null;
  IsActive: boolean | null;
}

const HEADER_COLS = `QANo, QAName, QADept, QAFcontent, QAEcontent, CONVERT(char(10), QAStartDate, 23) AS startDate, CONVERT(char(10), QAEndDate, 23) AS endDate,
  Kdept, Kpep, CLgNo, IsActive`;

const header = (r: HeaderRow): SurveyHeader => ({
  qaNo: r.QANo.trim(),
  title: (r.QAName ?? '').trim(),
  dept: r.QADept?.trim() || null,
  intro: r.QAFcontent,
  outro: r.QAEcontent,
  startDate: r.startDate,
  endDate: r.endDate,
  kdept: r.Kdept,
  kpep: r.Kpep,
  creator: r.CLgNo?.trim() || null,
  active: r.IsActive === true,
});

type Req = sql.Request;

/** YYYY-MM-DD → yyyyMMdd:以 style 112 轉換,不受伺服器 DATEFORMAT / 語系影響 */
const ymd = (iso: string) => iso.replace(/-/g, '');

export class MssqlQaRepo implements QaRepo {
  constructor(
    private readonly pool: sql.ConnectionPool,
    private readonly src: Sources,
  ) {}

  private get a() {
    return this.src.table('PortalSolar', 'QAAnnual');
  }
  private get b() {
    return this.src.table('PortalSolar', 'QAAnnualB');
  }
  private get c() {
    return this.src.table('PortalSolar', 'QAAnnualC');
  }
  private get d() {
    return this.src.table('PortalSolar', 'QAAnnualD');
  }

  async openSurveys(today: string) {
    const r = await this.pool
      .request()
      .input('today', sql.Char(8), ymd(today))
      .query<HeaderRow & { questionCount: number }>(
        `SELECT ${HEADER_COLS}, (SELECT COUNT(*) FROM ${this.b} b WHERE b.QANo = a.QANo) AS questionCount
         FROM ${this.a} a
         WHERE a.IsActive = 1 AND CAST(a.QAStartDate AS date) <= CONVERT(date, @today, 112) AND CAST(a.QAEndDate AS date) >= CONVERT(date, @today, 112)`,
      );
    return r.recordset.map((x) => ({ ...header(x), questionCount: x.questionCount }));
  }

  async answered(empNo: string, qaNos: readonly string[]): Promise<Set<string>> {
    if (!qaNos.length) return new Set();
    const req = this.pool.request().input('emp', sql.NVarChar(20), empNo);
    qaNos.forEach((q, i) => req.input(`q${i}`, sql.NVarChar(50), q));
    const r = await req.query<{ QANo: string }>(
      `SELECT DISTINCT QANo FROM ${this.c} WHERE LgNo = @emp AND QANo IN (${qaNos.map((_, i) => `@q${i}`).join(', ')})`,
    );
    return new Set(r.recordset.map((x) => x.QANo.trim()));
  }

  /** 讀取主檔 + 題目 + 圖片;lock = 交易內加 UPDLOCK, HOLDLOCK */
  private async load(req: Req, qaNo: string, lock: boolean): Promise<Survey | null> {
    const hint = lock ? 'WITH (UPDLOCK, HOLDLOCK)' : '';
    const r = await req.input('qa', sql.NVarChar(50), qaNo).query(
      `SELECT TOP 1 ${HEADER_COLS} FROM ${this.a} ${hint} WHERE QANo = @qa;
       SELECT No, Type, LimNo, Item, SubItem, IsWrite FROM ${this.b} ${hint} WHERE QANo = @qa;
       SELECT Item, FileName, Position, Width, Height FROM ${this.d} WHERE QANo = @qa;`,
    );
    const sets = r.recordsets as unknown as [HeaderRow[], QuestionRow[], ImageRow[]];
    const h = sets[0][0];
    if (!h) return null;
    return { ...header(h), questions: buildQuestions(sets[1], sets[2]) };
  }

  get(qaNo: string) {
    return this.load(this.pool.request(), qaNo, false);
  }

  private async tx<T>(fn: (req: () => Req) => Promise<T>): Promise<T> {
    const tx = new sql.Transaction(this.pool);
    await tx.begin();
    try {
      const out = await fn(() => tx.request());
      await tx.commit();
      return out;
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }

  async submit(qaNo: string, empNo: string, answeredAt: string, build: (s: Survey | null, already: boolean) => AnswerRow[]): Promise<void> {
    await this.tx(async (req) => {
      const s = await this.load(req(), qaNo, true);
      const done = await req()
        .input('qa', sql.NVarChar(50), qaNo)
        .input('emp', sql.NVarChar(20), empNo)
        .query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${this.c} WITH (UPDLOCK, HOLDLOCK) WHERE QANo = @qa AND LgNo = @emp`);
      const rows = build(s, done.recordset[0]!.n > 0);
      // 一次寫入(每 200 列一批,避免參數超過 2,100 個)
      for (let i = 0; i < rows.length; i += 200) {
        const part = rows.slice(i, i + 200);
        const r = req().input('qa', sql.NVarChar(50), qaNo).input('emp', sql.NVarChar(20), empNo).input('t', sql.VarChar(19), answeredAt);
        part.forEach((x, j) => r.input(`n${j}`, sql.Int, x.no).input(`v${j}`, sql.NVarChar(300), x.answer));
        await r.query(
          `INSERT INTO ${this.c} (QANo, LgNo, No, Answer, QATimes) VALUES ${part.map((_, j) => `(@qa, @emp, @n${j}, @v${j}, CONVERT(datetime, @t, 120))`).join(', ')}`,
        );
      }
    });
  }

  async list(filter: ListFilter, page: number, pageSize: number): Promise<{ items: SurveyListRow[]; total: number }> {
    const where = ['a.IsActive = 1'];
    const bind = (r: Req) => {
      if (filter.creator !== null) r.input('creator', sql.NVarChar(20), filter.creator);
      if (filter.q) r.input('q', sql.NVarChar(400), `%${filter.q.replace(/[[%_]/g, '[$&]')}%`);
      if (filter.today) r.input('today', sql.Char(8), ymd(filter.today));
      return r;
    };
    if (filter.creator !== null) where.push('LTRIM(RTRIM(a.CLgNo)) = @creator');
    if (filter.q) where.push('a.QAName LIKE @q');
    if (filter.today) where.push('CAST(a.QAStartDate AS date) <= CONVERT(date, @today, 112) AND CAST(a.QAEndDate AS date) >= CONVERT(date, @today, 112)');
    const w = where.join(' AND ');
    const total = await bind(this.pool.request()).query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${this.a} a WHERE ${w}`);
    const r = await bind(this.pool.request())
      .input('off', sql.Int, (page - 1) * pageSize)
      .input('size', sql.Int, pageSize)
      .query<HeaderRow & { questionCount: number; respondents: number }>(
        `SELECT ${HEADER_COLS},
           (SELECT COUNT(*) FROM ${this.b} b WHERE b.QANo = a.QANo) AS questionCount,
           (SELECT COUNT(DISTINCT c.LgNo) FROM ${this.c} c WHERE c.QANo = a.QANo) AS respondents
         FROM ${this.a} a WHERE ${w}
         ORDER BY a.QAStartDate DESC, a.QANo DESC
         OFFSET @off ROWS FETCH NEXT @size ROWS ONLY`,
      );
    return {
      total: total.recordset[0]!.n,
      items: r.recordset.map((x) => {
        const h = header(x);
        return {
          qaNo: h.qaNo,
          title: h.title,
          dept: h.dept,
          startDate: h.startDate,
          endDate: h.endDate,
          creator: h.creator,
          active: h.active,
          questionCount: x.questionCount,
          respondents: x.respondents,
        };
      }),
    };
  }

  private bindHeader(r: Req, w: SurveyWrite): Req {
    return r
      .input('name', sql.NVarChar(400), w.title)
      .input('dept', sql.NVarChar(20), w.dept)
      .input('f', sql.NVarChar(sql.MAX), w.intro)
      .input('e', sql.NVarChar(sql.MAX), w.outro)
      .input('sd', sql.Char(8), ymd(w.startDate))
      .input('ed', sql.Char(8), ymd(w.endDate))
      .input('kd', sql.NVarChar(3000), w.kdept)
      .input('kp', sql.NVarChar(3000), w.kpep);
  }

  private async insertQuestions(req: () => Req, qaNo: string, qs: readonly NormalizedQuestion[]): Promise<void> {
    for (let i = 0; i < qs.length; i += 50) {
      const part = qs.slice(i, i + 50);
      const r = req().input('qa', sql.NVarChar(50), qaNo);
      part.forEach((q, j) =>
        r
          .input(`ty${j}`, sql.NVarChar(20), LEGACY_TYPE[q.type])
          .input(`no${j}`, sql.Int, q.no)
          .input(`lim${j}`, sql.Int, q.type === 'multi' && q.limit !== null ? q.limit : -1)
          .input(`it${j}`, sql.NVarChar(200), q.text)
          .input(`sub${j}`, sql.NVarChar(3000), serializeOptions(q.options))
          .input(`w${j}`, sql.NVarChar(2), q.required ? 'Y' : 'N'),
      );
      await r.query(
        `INSERT INTO ${this.b} (QANo, Type, No, LimNo, Item, SubItem, IsWrite) VALUES ${part
          .map((_, j) => `(@qa, @ty${j}, @no${j}, @lim${j}, @it${j}, @sub${j}, @w${j})`)
          .join(', ')}`,
      );
    }
  }

  /** 新站圖片(Item = #題號)整批重寫;舊站圖片(以題目文字綁定)不動 */
  private async replaceImages(req: () => Req, qaNo: string, qs: readonly NormalizedQuestion[]): Promise<void> {
    await req().input('qa', sql.NVarChar(50), qaNo).query(`DELETE FROM ${this.d} WHERE QANo = @qa AND Item LIKE N'#%'`);
    const withImg = qs.filter((q) => q.image);
    if (!withImg.length) return;
    const r = req().input('qa', sql.NVarChar(50), qaNo);
    withImg.forEach((q, j) =>
      r
        .input(`it${j}`, sql.NVarChar(200), imageKey(q.no))
        .input(`f${j}`, sql.NVarChar(100), q.image!.fileId)
        .input(`p${j}`, sql.TinyInt, q.image!.position === 'before' ? 0 : 1)
        .input(`w${j}`, sql.Int, q.image!.width)
        .input(`h${j}`, sql.Int, q.image!.height),
    );
    await r.query(
      `INSERT INTO ${this.d} (QANo, Item, FileName, Position, Width, Height) VALUES ${withImg.map((_, j) => `(@qa, @it${j}, @f${j}, @p${j}, @w${j}, @h${j})`).join(', ')}`,
    );
  }

  async create(qaNo: string, creator: string, w: SurveyWrite): Promise<boolean> {
    return this.tx(async (req) => {
      const exists = await req()
        .input('qa', sql.NVarChar(50), qaNo)
        .query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${this.a} WITH (UPDLOCK, HOLDLOCK) WHERE QANo = @qa`);
      if (exists.recordset[0]!.n > 0) return false;
      await this.bindHeader(req(), w)
        .input('qa', sql.NVarChar(50), qaNo)
        .input('cl', sql.NVarChar(10), creator)
        .query(
          `INSERT INTO ${this.a} (QANo, QAName, QADept, QAFcontent, QAEcontent, QAStartDate, QAEndDate, Kdept, Kpep, CLgNo, IsActive)
           VALUES (@qa, @name, @dept, @f, @e, CONVERT(datetime, @sd, 112), CONVERT(datetime, @ed, 112), @kd, @kp, @cl, 1)`,
        );
      await this.insertQuestions(req, qaNo, w.questions);
      await this.replaceImages(req, qaNo, w.questions);
      return true;
    });
  }

  async update(qaNo: string, w: SurveyWrite, guard: (s: Survey | null, respondents: number) => UpdateMode): Promise<void> {
    await this.tx(async (req) => {
      const s = await this.load(req(), qaNo, true);
      const n = await req()
        .input('qa', sql.NVarChar(50), qaNo)
        .query<{ n: number }>(`SELECT COUNT(DISTINCT LgNo) AS n FROM ${this.c} WITH (UPDLOCK, HOLDLOCK) WHERE QANo = @qa`);
      const mode = guard(s, n.recordset[0]!.n);
      // 只更新欄位,不改 CLgNo、IsActive(舊版先刪後插會把 CLgNo 改成編輯者)
      await this.bindHeader(req(), w)
        .input('qa', sql.NVarChar(50), qaNo)
        .query(
          `UPDATE ${this.a} SET QAName = @name, QADept = @dept, QAFcontent = @f, QAEcontent = @e,
             QAStartDate = CONVERT(datetime, @sd, 112), QAEndDate = CONVERT(datetime, @ed, 112), Kdept = @kd, Kpep = @kp
           WHERE QANo = @qa`,
        );
      if (mode === 'full') {
        await req().input('qa', sql.NVarChar(50), qaNo).query(`DELETE FROM ${this.b} WHERE QANo = @qa`);
        await this.insertQuestions(req, qaNo, w.questions);
      } else {
        for (const q of w.questions)
          await req()
            .input('qa', sql.NVarChar(50), qaNo)
            .input('no', sql.Int, q.no)
            .input('it', sql.NVarChar(200), q.text)
            .query(`UPDATE ${this.b} SET Item = @it WHERE QANo = @qa AND No = @no`);
      }
      await this.replaceImages(req, qaNo, w.questions);
    });
  }

  async softDelete(qaNo: string): Promise<boolean> {
    const r = await this.pool.request().input('qa', sql.NVarChar(50), qaNo).query(`UPDATE ${this.a} SET IsActive = 0 WHERE QANo = @qa AND IsActive = 1`);
    return (r.rowsAffected[0] ?? 0) > 0;
  }

  async copy(from: string, to: string, creator: string, title: string): Promise<boolean> {
    return this.tx(async (req) => {
      const exists = await req()
        .input('to', sql.NVarChar(50), to)
        .query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${this.a} WITH (UPDLOCK, HOLDLOCK) WHERE QANo = @to`);
      if (exists.recordset[0]!.n > 0) return false;
      await req()
        .input('from', sql.NVarChar(50), from)
        .input('to', sql.NVarChar(50), to)
        .input('cl', sql.NVarChar(10), creator)
        .input('name', sql.NVarChar(400), title)
        .query(
          `INSERT INTO ${this.a} (QANo, QAName, QADept, QAFcontent, QAEcontent, QAStartDate, QAEndDate, Kdept, Kpep, CLgNo, IsActive)
             SELECT TOP 1 @to, @name, QADept, QAFcontent, QAEcontent, QAStartDate, QAEndDate, Kdept, Kpep, @cl, 1 FROM ${this.a} WHERE QANo = @from;
           INSERT INTO ${this.b} (QANo, Type, No, LimNo, Item, SubItem, IsWrite)
             SELECT @to, Type, No, LimNo, Item, SubItem, IsWrite FROM ${this.b} WHERE QANo = @from;
           INSERT INTO ${this.d} (QANo, Item, FileName, Position, Width, Height)
             SELECT @to, Item, FileName, Position, Width, Height FROM ${this.d} WHERE QANo = @from;`,
        );
      return true;
    });
  }

  async respondents(qaNo: string): Promise<number> {
    const r = await this.pool
      .request()
      .input('qa', sql.NVarChar(50), qaNo)
      .query<{ n: number }>(`SELECT COUNT(DISTINCT LgNo) AS n FROM ${this.c} WHERE QANo = @qa`);
    return r.recordset[0]!.n;
  }

  async answerCounts(qaNo: string) {
    const r = await this.pool
      .request()
      .input('qa', sql.NVarChar(50), qaNo)
      .query(
        `SELECT COUNT(DISTINCT LgNo) AS n FROM ${this.c} WHERE QANo = @qa;
       SELECT No AS no, ISNULL(Answer, N'') AS answer, COUNT(*) AS count FROM ${this.c} WHERE QANo = @qa GROUP BY No, ISNULL(Answer, N'');
       SELECT No AS no, COUNT(DISTINCT LgNo) AS n FROM ${this.c} WHERE QANo = @qa AND LTRIM(RTRIM(ISNULL(Answer, N''))) <> N'' GROUP BY No;`,
      );
    const sets = r.recordsets as unknown as [{ n: number }[], AnswerCount[], { no: number; n: number }[]];
    return {
      respondents: sets[0][0]?.n ?? 0,
      counts: sets[1].filter((x) => x.no !== null),
      answeredBy: new Map(sets[2].map((x) => [x.no, x.n])),
    };
  }

  async exportRows(qaNo: string): Promise<ExportRow[]> {
    const emp = this.src.table('LOS', 'EmployeeInfo');
    const r = await this.pool
      .request()
      .input('qa', sql.NVarChar(50), qaNo)
      .query<ExportRow>(
        `SELECT TOP 100000 e.EFDeptName AS dept, c.LgNo AS empNo, e.UserName AS name, c.No AS no, b.Item AS question, c.Answer AS answer,
           CONVERT(varchar(19), c.QATimes, 111) + ' ' + CONVERT(varchar(8), c.QATimes, 108) AS answeredAt
         FROM ${this.c} c
         LEFT JOIN ${this.b} b ON b.QANo = c.QANo AND b.No = c.No
         OUTER APPLY (SELECT TOP 1 EFDeptName, UserName FROM ${emp} x WHERE x.UserID = c.LgNo) e
         WHERE c.QANo = @qa
         ORDER BY c.LgNo, c.No`,
      );
    return r.recordset.map((x) => ({ ...x, empNo: (x.empNo ?? '').trim() }));
  }

  async departments(): Promise<Dept[]> {
    const r = await this.pool.request().query<{ code: string; name: string | null; parent: string | null }>(
      `SELECT LTRIM(RTRIM(Dept)) AS code, DeptName AS name, NULLIF(LTRIM(RTRIM(ParentDept)), N'') AS parent FROM ${this.src.table('LOS', 'DeptInfo')}
         WHERE Dept IS NOT NULL AND LTRIM(RTRIM(Dept)) <> N'' ORDER BY Dept`,
    );
    return r.recordset;
  }
}
