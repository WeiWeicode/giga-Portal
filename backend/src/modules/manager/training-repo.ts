/**
 * 年度教育訓練計畫資料存取(PortalSolar ELClassAnnual / ELPlanDept / ELClassForm / ELClassStatus,與舊入口網共用,D-7;
 * LearnDB TB_COURSE_FORM / TB_COURSE_SESSION 唯讀)。舊表沒有唯一鍵:寫入一律包交易,交易內以 UPDLOCK + HOLDLOCK 重新檢查鎖定與重複。
 * 年度欄位:ELPlanDept.Annual 為 int,ELClassForm / ELClassStatus / ELClassAnnual 為字串(同舊程式)。
 */
import sql from 'mssql';
import type { Sources } from '../../db/sources.js';
import { chunks, inList } from './scope.js';
import { classIdPrefix, nextClassId, type CourseRow, type PlanCourse, type SubmitProblem } from './training-rules.js';

const CI = 'COLLATE Chinese_Taiwan_Stroke_CI_AS';
export const SUBMITTED = '提交';

export interface PlanDept {
  code: string;
  name: string | null;
}

/** 去年 E-Learning 申請紀錄(帶入用;不回傳學員姓名) */
export interface AppliedCourse {
  applyDate: string | null;
  dept: string | null;
  deptName: string | null;
  className: string | null;
  classWhere: string;
  teacherName: string | null;
  hours: string | null;
  /** CLASS_OBJECTS 中的部門代碼(逗號分隔) */
  joinDept: string;
}

export type SubmitResult = { ok: true } | { ok: false; reason: 'locked' } | { ok: false; reason: 'incomplete'; problems: SubmitProblem[] };

export type WriteResult = { ok: true; classId: string } | { ok: false; reason: 'locked' | 'duplicate' | 'not-found' };

export interface TrainingRepo {
  annual(): Promise<number | null>;
  planDepts(empNo: string, year: number): Promise<PlanDept[]>;
  submittedBy(empNo: string, year: number): Promise<boolean>;
  /** 已由任何負責主管提交的部門 */
  submittedDepts(year: number, depts: string[]): Promise<string[]>;
  courses(year: number, depts: string[]): Promise<PlanCourse[]>;
  /** 去年計畫(季別非空,同舊 GridView2) */
  pastCourses(year: number, depts: string[]): Promise<PlanCourse[]>;
  applied(year: number, depts: string[]): Promise<AppliedCourse[]>;
  course(classId: string): Promise<(PlanCourse & { annual: string | null }) | null>;
  insert(empNo: string, year: number, row: CourseRow, now: Date): Promise<WriteResult>;
  update(empNo: string, year: number, classId: string, oldDept: string, row: CourseRow): Promise<WriteResult>;
  remove(empNo: string, year: number, classId: string, dept: string): Promise<WriteResult>;
  /** 交易內重讀課程(UPDLOCK)以 check 檢查,通過才刪除本人該年度狀態後逐部門新增「提交」 */
  submit(empNo: string, year: number, depts: string[], check: (courses: PlanCourse[]) => SubmitProblem[]): Promise<SubmitResult>;
}

interface FormRow {
  ClassID: string;
  Dept: string | null;
  ClassName: string | null;
  ClassAgenda: string | null;
  ClassType: string | null;
  ClassSubType: string | null;
  ClassWhere: string | null;
  ClassOnType: string | null;
  ClassTestType: string | null;
  TeacherName: string | null;
  TeacherUnit: string | null;
  Season: string | null;
  Hour: number | null;
  Cost1: number | null;
  Cost2: number | null;
  Cost3: number | null;
  Cost: number | null;
  JoinDept: string | null;
  Annual: string | null;
}

const FORM_COLS =
  'ClassID, Annual, Dept, ClassName, ClassAgenda, ClassType, ClassSubType, ClassWhere, ClassOnType, ClassTestType, TeacherName, TeacherUnit, Season, Hour, Cost1, Cost2, Cost3, Cost, JoinDept';

const toCourse = (x: FormRow): PlanCourse => ({
  classId: x.ClassID,
  dept: (x.Dept ?? '').trim().toUpperCase(),
  className: x.ClassName,
  agenda: x.ClassAgenda,
  classType: x.ClassType,
  subType: x.ClassSubType,
  classWhere: x.ClassWhere,
  onType: x.ClassOnType,
  testType: x.ClassTestType,
  teacherName: x.TeacherName,
  teacherUnit: x.TeacherUnit,
  season: x.Season,
  hour: x.Hour,
  cost1: x.Cost1,
  cost2: x.Cost2,
  cost3: x.Cost3,
  cost: x.Cost,
  joinDept: x.JoinDept,
});

/** CLASS_OBJECTS(例「S4120_特用膠材開發專案;CS091002_黃文瑞;」)只取部門代碼 */
export function deptsOfObjects(objects: string | null): string {
  const out = new Set<string>();
  for (const part of (objects ?? '').split(/[;\n]/)) {
    const m = /^\s*([A-Za-z]\d{4})_/.exec(part);
    if (m) out.add(m[1]!.toUpperCase());
  }
  return [...out].join(',');
}

export class MssqlTrainingRepo implements TrainingRepo {
  constructor(
    private readonly pool: sql.ConnectionPool,
    private readonly src: Sources,
  ) {}

  private t = (name: string) => this.src.table('PortalSolar', name);

  async annual(): Promise<number | null> {
    const r = await this.pool.request().query<{ Annual: string | null }>(`SELECT TOP 1 Annual FROM ${this.t('ELClassAnnual')}`);
    const n = Number.parseInt(r.recordset[0]?.Annual ?? '', 10);
    return Number.isInteger(n) ? n : null;
  }

  async planDepts(empNo: string, year: number): Promise<PlanDept[]> {
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(100), empNo)
      .input('year', sql.Int, year)
      .query<{ code: string; name: string | null }>(
        `SELECT DISTINCT UPPER(LTRIM(RTRIM(A.XDept))) AS code, B.DeptName AS name
         FROM ${this.t('ELPlanDept')} AS A
         LEFT OUTER JOIN ${this.src.table('LOS', 'DeptInfo')} AS B ON LTRIM(RTRIM(A.XDept)) ${CI} = LTRIM(RTRIM(B.Dept)) ${CI}
         WHERE A.XLgNo = @emp AND A.Annual = @year AND A.XDept IS NOT NULL AND LTRIM(RTRIM(A.XDept)) <> N''
         ORDER BY code`,
      );
    return r.recordset;
  }

  async submittedBy(empNo: string, year: number): Promise<boolean> {
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(20), empNo)
      .input('year', sql.NVarChar(8), String(year))
      .query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${this.t('ELClassStatus')} WHERE Annual = @year AND BossID = @emp AND Status = N'${SUBMITTED}'`);
    return (r.recordset[0]?.n ?? 0) > 0;
  }

  async submittedDepts(year: number, depts: string[]): Promise<string[]> {
    if (!depts.length) return [];
    const req = this.pool.request().input('year', sql.NVarChar(8), String(year));
    const d = inList(req, 'd', depts, () => sql.NVarChar(20));
    const r = await req.query<{ d: string }>(
      `SELECT DISTINCT UPPER(LTRIM(RTRIM(Dept))) AS d FROM ${this.t('ELClassStatus')} WHERE Annual = @year AND Status = N'${SUBMITTED}' AND UPPER(LTRIM(RTRIM(Dept))) IN (${d})`,
    );
    return r.recordset.map((x) => x.d);
  }

  private async formRows(year: number, depts: string[], extra = ''): Promise<PlanCourse[]> {
    const out: PlanCourse[] = [];
    for (const part of chunks(depts, 800)) {
      const req = this.pool.request().input('year', sql.NVarChar(8), String(year));
      const d = inList(req, 'd', part, () => sql.NVarChar(20));
      const r = await req.query<FormRow>(
        `SELECT TOP 2000 ${FORM_COLS} FROM ${this.t('ELClassForm')} WHERE Annual = @year AND UPPER(LTRIM(RTRIM(Dept))) IN (${d}) ${extra} ORDER BY Dept, ClassName`,
      );
      out.push(...r.recordset.map(toCourse));
    }
    return out;
  }

  courses(year: number, depts: string[]) {
    return depts.length ? this.formRows(year, depts) : Promise.resolve([]);
  }

  pastCourses(year: number, depts: string[]) {
    return depts.length ? this.formRows(year, depts, `AND Season IS NOT NULL AND Season <> N''`) : Promise.resolve([]);
  }

  async applied(year: number, depts: string[]): Promise<AppliedCourse[]> {
    if (!depts.length) return [];
    const L = (n: string) => this.src.table('LearnDB.learn', n);
    const out: AppliedCourse[] = [];
    for (const part of chunks(depts, 800)) {
      const req = this.pool.request().input('like', sql.NVarChar(10), `${year}%`);
      const d = inList(req, 'd', part, () => sql.NVarChar(20));
      const r = await req.query<{
        APPLY_DATE: string | null;
        EFLOW_ID: string | null;
        CLASS_NAME: string | null;
        ORGANIZER_ID: string | null;
        ORGANIZER_NAME: string | null;
        TEACHER_NAME: string | null;
        CLASS_HOURS: string | null;
        CLASS_OBJECTS: string | null;
      }>(
        `SELECT DISTINCT TOP 1000 A.APPLY_DATE, A.EFLOW_ID, A.CLASS_NAME, A.ORGANIZER_ID, A.ORGANIZER_NAME, A.TEACHER_NAME, B.CLASS_HOURS,
                CONVERT(nvarchar(4000), A.CLASS_OBJECTS) AS CLASS_OBJECTS
         FROM ${L('TB_COURSE_FORM')} AS A INNER JOIN ${L('TB_COURSE_SESSION')} AS B ON A.EFLOW_ID = B.EFLOW_ID
         WHERE A.APPLY_DATE LIKE @like AND UPPER(LTRIM(RTRIM(A.ORGANIZER_ID))) ${CI} IN (${d})
         ORDER BY A.ORGANIZER_ID, A.CLASS_NAME, A.APPLY_DATE DESC`,
      );
      for (const x of r.recordset)
        out.push({
          applyDate: x.APPLY_DATE,
          dept: x.ORGANIZER_ID?.trim().toUpperCase() ?? null,
          deptName: x.ORGANIZER_NAME,
          className: x.CLASS_NAME,
          // 舊程式:EFLOW_ID 第 2~6 碼為 HR015 是內訓,其他外訓
          classWhere: (x.EFLOW_ID ?? '').substring(1, 6) === 'HR015' ? '內訓' : '外訓',
          teacherName: x.TEACHER_NAME,
          hours: x.CLASS_HOURS,
          joinDept: deptsOfObjects(x.CLASS_OBJECTS),
        });
    }
    return out;
  }

  async course(classId: string) {
    const r = await this.pool
      .request()
      .input('id', sql.NVarChar(20), classId)
      .query<FormRow>(`SELECT ${FORM_COLS} FROM ${this.t('ELClassForm')} WHERE ClassID = @id ORDER BY Annual DESC`);
    const x = r.recordset[0];
    return x ? { ...toCourse(x), annual: x.Annual } : null;
  }

  /** 交易內:本人已提交或部門已被提交 → locked */
  private async locked(tx: sql.Transaction, empNo: string, year: number, depts: string[]): Promise<boolean> {
    const req = new sql.Request(tx).input('emp', sql.NVarChar(20), empNo).input('year', sql.NVarChar(8), String(year));
    const d = inList(req, 'd', depts, () => sql.NVarChar(20));
    const r = await req.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${this.t('ELClassStatus')} WITH (UPDLOCK, HOLDLOCK)
       WHERE Annual = @year AND Status = N'${SUBMITTED}' AND (BossID = @emp OR UPPER(LTRIM(RTRIM(Dept))) IN (${d}))`,
    );
    return (r.recordset[0]?.n ?? 0) > 0;
  }

  private async duplicate(tx: sql.Transaction, year: number, row: CourseRow, exceptId: string): Promise<boolean> {
    const r = await new sql.Request(tx)
      .input('year', sql.NVarChar(8), String(year))
      .input('dept', sql.NVarChar(20), row.dept)
      .input('name', sql.NVarChar(100), row.className)
      .input('id', sql.NVarChar(20), exceptId)
      .query<{ n: number }>(
        `SELECT COUNT(*) AS n FROM ${this.t('ELClassForm')} WITH (UPDLOCK, HOLDLOCK)
         WHERE Annual = @year AND UPPER(LTRIM(RTRIM(Dept))) = @dept AND LTRIM(RTRIM(ClassName)) = @name AND ClassID <> @id`,
      );
    return (r.recordset[0]?.n ?? 0) > 0;
  }

  private bindRow(req: sql.Request, year: number, row: CourseRow): sql.Request {
    return req
      .input('year', sql.NVarChar(8), String(year))
      .input('dept', sql.NVarChar(20), row.dept)
      .input('name', sql.NVarChar(100), row.className)
      .input('agenda', sql.NVarChar(200), row.agenda)
      .input('type', sql.NVarChar(10), row.classType)
      .input('sub', sql.NVarChar(10), row.subType)
      .input('onType', sql.NVarChar(5), row.onType)
      .input('testType', sql.NVarChar(10), row.testType)
      .input('where', sql.NVarChar(10), row.classWhere)
      .input('teacher', sql.NVarChar(30), row.teacherName)
      .input('unit', sql.NVarChar(30), row.teacherUnit)
      .input('season', sql.NVarChar(20), row.season)
      .input('hour', sql.Float, row.hour)
      .input('cost', sql.Int, row.cost)
      .input('cost1', sql.Int, row.cost1)
      .input('cost2', sql.Int, row.cost2)
      .input('cost3', sql.Int, row.cost3)
      .input('join', sql.NVarChar(50), row.joinDept);
  }

  private async inTx<T>(fn: (tx: sql.Transaction) => Promise<T>): Promise<T> {
    const tx = new sql.Transaction(this.pool);
    await tx.begin();
    try {
      const out = await fn(tx);
      await tx.commit();
      return out;
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }

  insert(empNo: string, year: number, row: CourseRow, now: Date): Promise<WriteResult> {
    return this.inTx(async (tx) => {
      if (await this.locked(tx, empNo, year, [row.dept])) return { ok: false, reason: 'locked' };
      if (await this.duplicate(tx, year, row, '')) return { ok: false, reason: 'duplicate' };
      const prefix = classIdPrefix(now);
      const max = await new sql.Request(tx)
        .input('p', sql.NVarChar(10), `${prefix}%`)
        .query<{ id: string | null }>(
          `SELECT TOP 1 ClassID AS id FROM ${this.t('ELClassForm')} WITH (UPDLOCK, HOLDLOCK) WHERE ClassID LIKE @p ORDER BY LEN(ClassID) DESC, ClassID DESC`,
        );
      const last = max.recordset[0]?.id;
      const suffix = last ? Number.parseInt(last.slice(prefix.length), 10) : null;
      const classId = nextClassId(now, Number.isInteger(suffix) ? suffix : null);
      await this.bindRow(new sql.Request(tx), year, row)
        .input('id', sql.NVarChar(20), classId)
        .query(
          `INSERT INTO ${this.t('ELClassForm')} (ClassID, Annual, Dept, ClassName, ClassAgenda, ClassType, ClassSubType, ClassOnType, ClassTestType, ClassWhere,
             TeacherName, TeacherUnit, Season, Hour, Cost, Cost1, Cost2, Cost3, JoinDept)
           VALUES (@id, @year, @dept, @name, @agenda, @type, @sub, @onType, @testType, @where, @teacher, @unit, @season, @hour, @cost, @cost1, @cost2, @cost3, @join)`,
        );
      return { ok: true, classId };
    });
  }

  update(empNo: string, year: number, classId: string, oldDept: string, row: CourseRow): Promise<WriteResult> {
    return this.inTx(async (tx) => {
      if (await this.locked(tx, empNo, year, [oldDept, row.dept])) return { ok: false, reason: 'locked' };
      if (await this.duplicate(tx, year, row, classId)) return { ok: false, reason: 'duplicate' };
      const r = await this.bindRow(new sql.Request(tx), year, row)
        .input('id', sql.NVarChar(20), classId)
        .input('oldDept', sql.NVarChar(20), oldDept)
        .query(
          `UPDATE ${this.t('ELClassForm')} SET Dept = @dept, ClassName = @name, ClassAgenda = @agenda, ClassType = @type, ClassSubType = @sub,
             ClassTestType = @testType, ClassOnType = @onType, ClassWhere = @where, TeacherUnit = @unit, TeacherName = @teacher, Season = @season,
             Hour = @hour, Cost = @cost, Cost1 = @cost1, Cost2 = @cost2, Cost3 = @cost3, JoinDept = @join
           WHERE ClassID = @id AND Annual = @year AND UPPER(LTRIM(RTRIM(Dept))) = @oldDept`,
        );
      return (r.rowsAffected[0] ?? 0) > 0 ? { ok: true, classId } : { ok: false, reason: 'not-found' };
    });
  }

  remove(empNo: string, year: number, classId: string, dept: string): Promise<WriteResult> {
    return this.inTx(async (tx) => {
      if (await this.locked(tx, empNo, year, [dept])) return { ok: false, reason: 'locked' };
      const r = await new sql.Request(tx)
        .input('id', sql.NVarChar(20), classId)
        .input('year', sql.NVarChar(8), String(year))
        .input('dept', sql.NVarChar(20), dept)
        .query(`DELETE FROM ${this.t('ELClassForm')} WHERE ClassID = @id AND Annual = @year AND UPPER(LTRIM(RTRIM(Dept))) = @dept`);
      return (r.rowsAffected[0] ?? 0) > 0 ? { ok: true, classId } : { ok: false, reason: 'not-found' };
    });
  }

  submit(empNo: string, year: number, depts: string[], check: (courses: PlanCourse[]) => SubmitProblem[]): Promise<SubmitResult> {
    return this.inTx<SubmitResult>(async (tx) => {
      if (await this.locked(tx, empNo, year, depts)) return { ok: false, reason: 'locked' };
      // 完整性檢查與提交同一交易(資安審查 L-2:避免檢查後被其他負責主管 / 舊站刪課)
      const req = new sql.Request(tx).input('year', sql.NVarChar(8), String(year));
      const d = inList(req, 'd', depts, () => sql.NVarChar(20));
      const r = await req.query<FormRow>(
        `SELECT ${FORM_COLS} FROM ${this.t('ELClassForm')} WITH (UPDLOCK, HOLDLOCK) WHERE Annual = @year AND UPPER(LTRIM(RTRIM(Dept))) IN (${d})`,
      );
      const problems = check(r.recordset.map(toCourse));
      if (problems.length) return { ok: false, reason: 'incomplete', problems };
      await new sql.Request(tx)
        .input('emp', sql.NVarChar(20), empNo)
        .input('year', sql.NVarChar(8), String(year))
        .query(`DELETE FROM ${this.t('ELClassStatus')} WHERE Annual = @year AND BossID = @emp`);
      for (const d of depts)
        await new sql.Request(tx)
          .input('emp', sql.NVarChar(20), empNo)
          .input('year', sql.NVarChar(8), String(year))
          .input('dept', sql.NVarChar(20), d)
          .query(`INSERT INTO ${this.t('ELClassStatus')} (Annual, BossID, Dept, Status) VALUES (@year, @emp, @dept, N'${SUBMITTED}')`);
      return { ok: true };
    });
  }
}
