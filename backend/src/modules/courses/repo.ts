/**
 * 年度必上課程的資料讀取(唯讀;舊庫以 db/sources.ts 的前綴存取,值一律參數化)。
 *   LOS EmployeeInfo、Safety 名單(SafetyClass*User)、LearnDB 完訓紀錄(learn.TB_COURSE_* + dbo.OnlineExam)
 * 工號比對沿用舊程式的不分大小寫(舊 COLLATE SQL_Latin1_General_CP1_CI_AS);LearnDB 欄位為 _BIN 定序,比對時轉 CI。
 */
import sql from 'mssql';
import type { Sources } from '../../db/sources.js';
import { ELIGIBLE_COMPANIES, type CompletionRecord, type EmployeeRow, type Membership } from './rules.js';

export interface CourseRepo {
  employee(empNo: string, year: number): Promise<EmployeeRow[]>;
  memberships(empNo: string): Promise<Set<Membership>>;
  completions(empNo: string, year: number): Promise<CompletionRecord[]>;
}

const CI = 'COLLATE Chinese_Taiwan_Stroke_CI_AS';
const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export class MssqlCourseRepo implements CourseRepo {
  constructor(
    private readonly pool: sql.ConnectionPool,
    private readonly src: Sources,
  ) {}

  async employee(empNo: string, year: number): Promise<EmployeeRow[]> {
    const companies = ELIGIBLE_COMPANIES.map((_, i) => `@c${i}`).join(', ');
    const req = this.pool.request().input('emp', sql.NVarChar(10), empNo).input('leaveCut', sql.Date, `${year}-11-30`);
    ELIGIBLE_COMPANIES.forEach((c, i) => req.input(`c${i}`, sql.NVarChar(5), c));
    const r = await req.query<{ CompDB: string; EFDept: string | null; JobName: string | null; JobDate: Date | null }>(
      `SELECT CompDB, EFDept, JobName, JobDate FROM ${this.src.table('LOS', 'EmployeeInfo')}
       WHERE UserID = @emp AND CompDB IN (${companies}) AND (LeaveDate IS NULL OR LeaveDate >= @leaveCut)`,
    );
    return r.recordset.map((x) => ({ compDb: x.CompDB, dept: x.EFDept, jobName: x.JobName, jobDate: isoDate(x.JobDate) }));
  }

  async memberships(empNo: string): Promise<Set<Membership>> {
    const t = (name: string) => this.src.table('Safety', name);
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(10), empNo)
      .query<{ k: Membership }>(
        `SELECT 'exempt' AS k FROM ${t('SafetyClassExUser')} WHERE UserID = @emp
         UNION SELECT 'scba' FROM ${t('SafetyClassSCBAUser')} WHERE UserID = @emp
         UNION SELECT 'project' FROM ${t('SafetyClassProjectUser')} WHERE UserID = @emp
         UNION SELECT 'wbinv' FROM ${t('SafetyClassWBInvUser')} WHERE UserID = @emp`,
      );
    return new Set(r.recordset.map((x) => x.k));
  }

  /**
   * 舊程式子查詢的三段 UNION(E-Learning 學員通過、E-Learning 講師、線上測驗通過),去重欄位相同:
   * 來源、日期、班名、時數、課程類別名稱、類別代碼(時數加總依此去重,與舊系統一致)
   */
  async completions(empNo: string, year: number): Promise<CompletionRecord[]> {
    const L = (name: string) => this.src.table('LearnDB.learn', name);
    const exam = this.src.table('LearnDB', 'OnlineExam');
    const session = `FROM ${L('TB_COURSE_FORM')} AS A
      INNER JOIN ${L('TB_COURSE_SESSION')} AS B ON A.EFLOW_ID = B.EFLOW_ID
      INNER JOIN ${L('TB_COURSE_SESSION_GRADE')} AS C ON A.EFLOW_ID = C.EFLOW_ID AND B.SESSION_ID = C.[SESSION]
      INNER JOIN ${L('TB_COURSE_TYPE')} AS D ON A.COURSE_TYPE_ID = D.COURSE_TYPE_ID
      WHERE C.PASS_COND = 'Y' AND LEFT(B.CLASS_SDATE, 4) = @year`;
    const cols = `B.CLASS_SDATE AS d, A.CLASS_NAME AS className, B.CLASS_HOURS AS hours, D.COURSE_NAME AS courseType, CONVERT(nvarchar(10), A.COURSE_TYPE_ID) AS typeId`;
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(10), empNo)
      .input('year', sql.NVarChar(4), String(year))
      .query<CompletionRecord>(
        `SELECT courseType, className, hours FROM (
           SELECT 'E-Learning' AS src, ${cols} ${session} AND C.EMP_ID ${CI} = @emp
           UNION
           SELECT 'E-Learning', ${cols} ${session} AND A.TEACHER_ID ${CI} = @emp
           UNION
           SELECT 'Online', T.APPLY_DATE, T.CLASS_NAME, T.CLASS_HOURS, D.COURSE_NAME, T.COURSE_TYPE_ID
           FROM ${L('TB_ONLINE_COURSE_FORM')} AS T
           INNER JOIN (SELECT Student_Id, RECORD_ID FROM ${exam} WHERE Exam_Pass = N'通過' AND Student_Id ${CI} = @emp GROUP BY Student_Id, RECORD_ID, EFLOW_ID) AS E
             ON T.TCLASS_RECORD_ID = TRY_CONVERT(decimal(18, 0), E.RECORD_ID)
           INNER JOIN ${L('TB_COURSE_TYPE')} AS D ON TRY_CONVERT(decimal(18, 0), T.COURSE_TYPE_ID) = D.COURSE_TYPE_ID
           WHERE LEFT(T.APPLY_DATE, 4) = @year
         ) AS X`,
      );
    return r.recordset;
  }
}
