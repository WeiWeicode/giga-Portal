/**
 * 主管專區:部屬(部門必上課程、部門資產明細;docs/Gherkin/manager/manager.feature)。
 *   部屬 = LOS EmployeeInfo.EFDept 在範圍內的同仁(D-5:Token 決定範圍,LOS 只用來對照部門與人)
 *   課程規則沿用個人版 modules/courses/rules.ts(D-9),一次查整批人再逐人計算
 *   資產備註沿用 PortalSolar PersonalPropertyInfo(D-12),主管修改寫到**保管人**那一筆(舊版寫主管工號,讀不到)
 */
import sql from 'mssql';
import type { Sources } from '../../db/sources.js';
import { COURSES, ELIGIBLE_COMPANIES, evaluate, type CompletionRecord, type CourseResult, type EmployeeRow, type Membership } from '../courses/rules.js';
import { AppError, dataAccessDenied } from '../../errors.js';
import { chunks, inList, normDept, type ScopeService } from './scope.js';
import { UNSAFE_MESSAGE, unsafeText } from './text.js';
import type { Employee } from '../../identity.js';

const CI = 'COLLATE Chinese_Taiwan_Stroke_CI_AS';
const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const normEmp = (e: string | null | undefined) => (e ?? '').trim().toUpperCase();

export interface StaffRow extends EmployeeRow {
  empNo: string;
  name: string | null;
  deptName: string | null;
}

export interface PropertyNote {
  empNo: string;
  name: string | null;
  dept: string | null;
  deptName: string | null;
  compDb: string | null;
  assetNo: string;
  assetSub: string | null;
  note: string | null;
  hasPhoto: boolean;
}

export interface NoteKey {
  empNo: string;
  compDb: string | null;
  assetNo: string;
  assetSub: string | null;
}

export interface StaffRepo {
  /** 年度必上課程的對象:有任一筆合格紀錄的 EFDept 在 depts 內,回傳這些人所有合格紀錄 */
  courseStaff(depts: string[], year: number): Promise<StaffRow[]>;
  memberships(emps: string[]): Promise<Map<string, Set<Membership>>>;
  completions(emps: string[], year: number): Promise<Map<string, CompletionRecord[]>>;
  /** 在職同仁(LeaveDate 為空)的資產備註,EFDept 在 depts 內 */
  propertyNotes(depts: string[]): Promise<PropertyNote[]>;
  /** 在職同仁目前的部門(多筆時全部列出) */
  currentDepts(empNo: string): Promise<string[]>;
  /** 只更新既有紀錄的 Note(照片欄不動);回傳更新筆數 */
  updateNote(key: NoteKey, note: string): Promise<number>;
}

export class MssqlStaffRepo implements StaffRepo {
  constructor(
    private readonly pool: sql.ConnectionPool,
    private readonly src: Sources,
  ) {}

  async courseStaff(depts: string[], year: number): Promise<StaffRow[]> {
    if (!depts.length) return [];
    const emp = this.src.table('LOS', 'EmployeeInfo');
    const out: StaffRow[] = [];
    for (const part of chunks(depts, 800)) {
      const req = this.pool.request().input('leaveCut', sql.Date, `${year}-11-30`);
      const companies = inList(req, 'c', [...ELIGIBLE_COMPANIES], () => sql.NVarChar(5));
      const d = inList(req, 'd', part);
      const r = await req.query<{
        UserID: string;
        UserName: string | null;
        CompDB: string;
        EFDept: string | null;
        EFDeptName: string | null;
        JobName: string | null;
        JobDate: Date | null;
        inScope: number;
      }>(
        `SELECT E.UserID, E.UserName, E.CompDB, E.EFDept, E.EFDeptName, E.JobName, E.JobDate,
                CASE WHEN UPPER(LTRIM(RTRIM(E.EFDept))) IN (${d}) THEN 1 ELSE 0 END AS inScope
         FROM ${emp} AS E
         WHERE E.CompDB IN (${companies}) AND (E.LeaveDate IS NULL OR E.LeaveDate >= @leaveCut)
           AND E.UserID IN (SELECT S.UserID FROM ${emp} AS S WHERE UPPER(LTRIM(RTRIM(S.EFDept))) IN (${d})
                              AND S.CompDB IN (${companies}) AND (S.LeaveDate IS NULL OR S.LeaveDate >= @leaveCut))
         ORDER BY E.UserID, inScope DESC`,
      );
      for (const x of r.recordset)
        out.push({
          empNo: normEmp(x.UserID),
          name: x.UserName,
          deptName: x.inScope ? x.EFDeptName : null,
          compDb: x.CompDB,
          dept: x.EFDept,
          jobName: x.JobName,
          jobDate: isoDate(x.JobDate),
        });
    }
    return out;
  }

  async memberships(emps: string[]): Promise<Map<string, Set<Membership>>> {
    const t = (name: string) => this.src.table('Safety', name);
    const map = new Map<string, Set<Membership>>();
    for (const part of chunks(emps)) {
      const req = this.pool.request();
      const e = inList(req, 'e', part, () => sql.NVarChar(20));
      const r = await req.query<{ UserID: string; k: Membership }>(
        `SELECT UserID, 'exempt' AS k FROM ${t('SafetyClassExUser')} WHERE UserID IN (${e})
         UNION SELECT UserID, 'scba' FROM ${t('SafetyClassSCBAUser')} WHERE UserID IN (${e})
         UNION SELECT UserID, 'project' FROM ${t('SafetyClassProjectUser')} WHERE UserID IN (${e})
         UNION SELECT UserID, 'wbinv' FROM ${t('SafetyClassWBInvUser')} WHERE UserID IN (${e})`,
      );
      for (const x of r.recordset) {
        const k = normEmp(x.UserID);
        map.set(k, (map.get(k) ?? new Set()).add(x.k));
      }
    }
    return map;
  }

  /** 同 MssqlCourseRepo.completions(個人版)的三段 UNION,多帶工號欄位,依工號分組 */
  async completions(emps: string[], year: number): Promise<Map<string, CompletionRecord[]>> {
    const L = (name: string) => this.src.table('LearnDB.learn', name);
    const exam = this.src.table('LearnDB', 'OnlineExam');
    const map = new Map<string, CompletionRecord[]>();
    for (const part of chunks(emps)) {
      const req = this.pool.request().input('year', sql.NVarChar(4), String(year));
      const e = inList(req, 'e', part, () => sql.NVarChar(20));
      const session = `FROM ${L('TB_COURSE_FORM')} AS A
        INNER JOIN ${L('TB_COURSE_SESSION')} AS B ON A.EFLOW_ID = B.EFLOW_ID
        INNER JOIN ${L('TB_COURSE_SESSION_GRADE')} AS C ON A.EFLOW_ID = C.EFLOW_ID AND B.SESSION_ID = C.[SESSION]
        INNER JOIN ${L('TB_COURSE_TYPE')} AS D ON A.COURSE_TYPE_ID = D.COURSE_TYPE_ID
        WHERE C.PASS_COND = 'Y' AND LEFT(B.CLASS_SDATE, 4) = @year`;
      const cols = `B.CLASS_SDATE AS d, A.CLASS_NAME AS className, B.CLASS_HOURS AS hours, D.COURSE_NAME AS courseType, CONVERT(nvarchar(10), A.COURSE_TYPE_ID) AS typeId`;
      const r = await req.query<CompletionRecord & { emp: string }>(
        `SELECT emp, courseType, className, hours FROM (
           SELECT 'E-Learning' AS src, CONVERT(nvarchar(20), C.EMP_ID) ${CI} AS emp, ${cols} ${session} AND C.EMP_ID ${CI} IN (${e})
           UNION
           SELECT 'E-Learning', CONVERT(nvarchar(20), A.TEACHER_ID) ${CI}, ${cols} ${session} AND A.TEACHER_ID ${CI} IN (${e})
           UNION
           SELECT 'Online', CONVERT(nvarchar(20), E.Student_Id) ${CI}, T.APPLY_DATE, T.CLASS_NAME, T.CLASS_HOURS, D.COURSE_NAME, T.COURSE_TYPE_ID
           FROM ${L('TB_ONLINE_COURSE_FORM')} AS T
           INNER JOIN (SELECT Student_Id, RECORD_ID FROM ${exam} WHERE Exam_Pass = N'通過' AND Student_Id ${CI} IN (${e}) GROUP BY Student_Id, RECORD_ID, EFLOW_ID) AS E
             ON T.TCLASS_RECORD_ID = TRY_CONVERT(decimal(18, 0), E.RECORD_ID)
           INNER JOIN ${L('TB_COURSE_TYPE')} AS D ON TRY_CONVERT(decimal(18, 0), T.COURSE_TYPE_ID) = D.COURSE_TYPE_ID
           WHERE LEFT(T.APPLY_DATE, 4) = @year
         ) AS X`,
      );
      for (const x of r.recordset) {
        const k = normEmp(x.emp);
        map.set(k, [...(map.get(k) ?? []), { courseType: x.courseType, className: x.className, hours: x.hours }]);
      }
    }
    return map;
  }

  async propertyNotes(depts: string[]): Promise<PropertyNote[]> {
    if (!depts.length) return [];
    const out: PropertyNote[] = [];
    for (const part of chunks(depts, 800)) {
      const req = this.pool.request();
      const d = inList(req, 'd', part);
      // 同一人多筆在職紀錄時取一筆部門(MIN),避免資產重複列出
      const r = await req.query<{
        UserID: string;
        UserName: string | null;
        Dept: string | null;
        DeptName: string | null;
        CompDB: string | null;
        FAJ02: string;
        FAJ022: string | null;
        Note: string | null;
        PicFile: string | null;
      }>(
        `SELECT TOP 5000 P.UserID, E.UserName, E.Dept, E.DeptName, P.CompDB, P.FAJ02, P.FAJ022, P.Note, P.PicFile
         FROM ${this.src.table('PortalSolar', 'PersonalPropertyInfo')} AS P
         INNER JOIN (SELECT UserID ${CI} AS UserID, MAX(UserName) AS UserName, MIN(LTRIM(RTRIM(EFDept))) AS Dept, MIN(EFDeptName) AS DeptName
                     FROM ${this.src.table('LOS', 'EmployeeInfo')}
                     WHERE LeaveDate IS NULL AND UPPER(LTRIM(RTRIM(EFDept))) IN (${d})
                     GROUP BY UserID ${CI}) AS E ON P.UserID ${CI} = E.UserID
         ORDER BY E.Dept, P.UserID, P.FAJ02, P.FAJ022`,
      );
      for (const x of r.recordset)
        out.push({
          empNo: x.UserID.trim(),
          name: x.UserName,
          dept: x.Dept,
          deptName: x.DeptName,
          compDb: x.CompDB,
          assetNo: x.FAJ02,
          assetSub: x.FAJ022,
          note: x.Note,
          hasPhoto: !!x.PicFile?.trim(),
        });
    }
    return out;
  }

  async currentDepts(empNo: string): Promise<string[]> {
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(20), empNo)
      .query<{ d: string | null }>(`SELECT EFDept AS d FROM ${this.src.table('LOS', 'EmployeeInfo')} WHERE UserID = @emp AND LeaveDate IS NULL`);
    return r.recordset.map((x) => normDept(x.d)).filter(Boolean);
  }

  async updateNote(key: NoteKey, note: string): Promise<number> {
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(20), key.empNo)
      .input('comp', sql.NVarChar(20), key.compDb ?? '')
      .input('no', sql.NVarChar(80), key.assetNo)
      .input('sub', sql.NVarChar(80), key.assetSub ?? '')
      .input('note', sql.NVarChar(150), note)
      .query(
        `UPDATE ${this.src.table('PortalSolar', 'PersonalPropertyInfo')} SET Note = @note
         WHERE UserID = @emp AND ISNULL(CompDB, N'') = @comp AND FAJ02 = @no AND ISNULL(FAJ022, N'') = @sub`,
      );
    return r.rowsAffected[0] ?? 0;
  }
}

export interface StaffCourses {
  empNo: string;
  name: string | null;
  dept: string | null;
  deptName: string | null;
  inYear: boolean;
  deduction: number;
  courses: Pick<CourseResult, 'key' | 'status' | 'hours' | 'minHours'>[];
}

/** 逐人套用個人版規則(D-9);rows 依工號分組,第一筆為範圍內的部門 */
export function evaluateStaff(year: number, rows: StaffRow[], members: Map<string, Set<Membership>>, records: Map<string, CompletionRecord[]>): StaffCourses[] {
  const byEmp = new Map<string, StaffRow[]>();
  for (const r of rows) byEmp.set(r.empNo, [...(byEmp.get(r.empNo) ?? []), r]);
  const out: StaffCourses[] = [];
  for (const [empNo, list] of byEmp) {
    const res = evaluate(year, list, members.get(empNo) ?? new Set(), records.get(empNo) ?? []);
    const first = list[0]!;
    out.push({
      empNo,
      name: first.name,
      dept: first.dept?.trim() ?? null,
      deptName: first.deptName,
      inYear: res.inYear,
      deduction: res.deduction,
      courses: res.courses.map(({ key, status, hours, minHours }) => ({
        key,
        status,
        ...(hours !== undefined ? { hours } : {}),
        ...(minHours !== undefined ? { minHours } : {}),
      })),
    });
  }
  return out.sort((a, b) => (a.dept ?? '').localeCompare(b.dept ?? '') || a.empNo.localeCompare(b.empNo));
}

export const NOTE_MAX = 150;

/** 部門必上課程、部門資產明細(範圍依 scope.ts) */
export class ManagerStaffService {
  constructor(
    private readonly repo: StaffRepo,
    private readonly scopes: ScopeService,
  ) {}

  async courses(emp: Employee, year: number, dept: string | undefined, includeSub: boolean) {
    const scope = await this.scopes.of(emp);
    const depts = scope.resolve(dept, includeSub);
    const rows = await this.repo.courseStaff(depts, year);
    const emps = [...new Set(rows.map((r) => r.empNo))];
    const [members, records] = await Promise.all([this.repo.memberships(emps), this.repo.completions(emps, year)]);
    return { year, courses: COURSES.map(({ key, name, category }) => ({ key, name, category })), items: evaluateStaff(year, rows, members, records) };
  }

  async property(emp: Employee, dept: string | undefined, includeSub: boolean) {
    const scope = await this.scopes.of(emp);
    return { items: await this.repo.propertyNotes(scope.resolve(dept, includeSub)) };
  }

  /** 備註歸屬保管人:保管人目前部門須在範圍內;只更新既有紀錄 */
  async updateNote(emp: Employee, key: NoteKey, note: string): Promise<void> {
    if (unsafeText(note, true)) throw new AppError(400, 'VALIDATION_FAILED', `備註${UNSAFE_MESSAGE}`, [{ field: 'note', message: UNSAFE_MESSAGE }]);
    const scope = await this.scopes.of(emp);
    const custodian = key.empNo.trim();
    const depts = await this.repo.currentDepts(custodian);
    if (!depts.some((d) => scope.has(d))) throw dataAccessDenied('保管人不在您的主管範圍內');
    const n = await this.repo.updateNote({ ...key, empNo: custodian }, note.trim());
    if (n === 0) throw new AppError(404, 'PORTAL_MGR_PROPERTY_NOT_FOUND', '找不到此資產的備註紀錄');
  }
}
