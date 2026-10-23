/**
 * 年度教育訓練計畫(FEATURE-PLAN §7.1;docs/Gherkin/manager/training.feature;舊程式 ELlessionplan.aspx)。
 *   可編部門 = ELPlanDept 中本人、目前編列年度(ELClassAnnual)的部門,且在 Token 部門範圍內(scope.ts)
 *   鎖定 = 本人該年度已提交,或部門已由其他負責主管提交(舊版只停用按鈕,新版每次寫入在交易內檢查)
 *   課程清單只列可編部門本身(舊版以部門代碼去尾 0 的前綴比對,會列到其他主管負責的下層部門)
 *   帶入來源(去年計畫、去年 E-Learning 申請)= 可編部門及其下層(限縮在範圍內)
 */
import { AppError, dataAccessDenied } from '../../errors.js';
import type { Employee } from '../../identity.js';
import type { ManagerScope, ScopeService } from './scope.js';
import type { AppliedCourse, PlanDept, TrainingRepo } from './training-repo.js';
import { submitProblems, validateCourse, type CourseInput, type PlanCourse } from './training-rules.js';

export interface TrainingView {
  year: number;
  depts: PlanDept[];
  /** ELPlanDept 有指定、但不在 Token 範圍內的部門(不能編輯) */
  outOfScope: PlanDept[];
  canEdit: boolean;
  /** 本人該年度已提交 */
  submitted: boolean;
  /** 已提交(任一負責主管)的部門 */
  lockedDepts: string[];
  courses: PlanCourse[];
  lastYear: PlanCourse[];
  applied: AppliedCourse[];
}

const notFound = () => new AppError(404, 'PORTAL_MGR_TRAINING_NOT_FOUND', '找不到此課程');
const lockedErr = () => new AppError(409, 'PORTAL_MGR_TRAINING_LOCKED', '訓練計畫已提交,不能再修改');

export class TrainingService {
  constructor(
    private readonly repo: TrainingRepo,
    private readonly scopes: ScopeService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async year(): Promise<number> {
    const y = await this.repo.annual();
    if (!y) throw new AppError(503, 'PORTAL_MGR_TRAINING_YEAR_UNSET', '尚未設定編列年度(ELClassAnnual)');
    return y;
  }

  /** 本人可編部門(與範圍外的部門) */
  private async plan(emp: Employee, year: number): Promise<{ depts: PlanDept[]; outOfScope: PlanDept[]; scope: ManagerScope }> {
    const [all, scope] = await Promise.all([this.repo.planDepts(emp.empNo, year), this.scopes.of(emp)]);
    return { depts: all.filter((d) => scope.has(d.code)), outOfScope: all.filter((d) => !scope.has(d.code)), scope };
  }

  async view(emp: Employee): Promise<TrainingView> {
    const year = await this.year();
    const { depts, outOfScope, scope } = await this.plan(emp, year);
    const codes = depts.map((d) => d.code);
    const tree = await this.scopes.tree();
    const wide = [...new Set(codes.flatMap((c) => tree.subtree(c)).filter((c) => scope.has(c)))];
    const [submitted, lockedDepts, courses, lastYear, applied] = await Promise.all([
      this.repo.submittedBy(emp.empNo, year),
      this.repo.submittedDepts(year, codes),
      this.repo.courses(year, codes),
      this.repo.pastCourses(year - 1, wide),
      this.repo.applied(year - 1, wide),
    ]);
    return { year, depts, outOfScope, canEdit: codes.length > 0 && !submitted, submitted, lockedDepts, courses, lastYear, applied };
  }

  private async editable(emp: Employee, year: number, dept: string): Promise<void> {
    const { depts } = await this.plan(emp, year);
    if (!depts.some((d) => d.code === dept.trim().toUpperCase())) throw dataAccessDenied('此部門不是您負責的訓練計畫部門');
  }

  private validate(input: CourseInput) {
    const { row, errors } = validateCourse(input);
    if (errors.length) throw new AppError(400, 'VALIDATION_FAILED', '參數驗證失敗', errors);
    return row;
  }

  private check(r: Awaited<ReturnType<TrainingRepo['insert']>>): string {
    if (r.ok) return r.classId;
    if (r.reason === 'locked') throw lockedErr();
    if (r.reason === 'duplicate') throw new AppError(409, 'PORTAL_MGR_TRAINING_DUPLICATE', '已有重複課程(同部門同年度同名)');
    throw notFound();
  }

  async create(emp: Employee, input: CourseInput): Promise<PlanCourse> {
    const year = await this.year();
    const row = this.validate(input);
    await this.editable(emp, year, row.dept);
    const classId = this.check(await this.repo.insert(emp.empNo, year, row, this.now()));
    return (await this.repo.course(classId))!;
  }

  /** 課程必須屬於本年度、本人可編部門(否則一律 404,不透露其他部門的課程) */
  private async own(emp: Employee, year: number, classId: string) {
    const c = await this.repo.course(classId);
    if (!c || c.annual?.trim() !== String(year)) throw notFound();
    const { depts } = await this.plan(emp, year);
    if (!depts.some((d) => d.code === c.dept)) throw notFound();
    return c;
  }

  async update(emp: Employee, classId: string, input: CourseInput): Promise<PlanCourse> {
    const year = await this.year();
    const row = this.validate(input);
    const c = await this.own(emp, year, classId);
    if (row.dept !== c.dept) await this.editable(emp, year, row.dept);
    this.check(await this.repo.update(emp.empNo, year, classId, c.dept, row));
    return (await this.repo.course(classId))!;
  }

  async remove(emp: Employee, classId: string): Promise<void> {
    const year = await this.year();
    const c = await this.own(emp, year, classId);
    this.check(await this.repo.remove(emp.empNo, year, classId, c.dept));
  }

  async submit(emp: Employee): Promise<TrainingView> {
    const year = await this.year();
    const { depts } = await this.plan(emp, year);
    const codes = depts.map((d) => d.code);
    if (!codes.length) throw dataAccessDenied('您沒有負責的訓練計畫部門');
    const r = await this.repo.submit(emp.empNo, year, codes, (courses) => submitProblems(codes, courses, year));
    if (!r.ok && r.reason === 'incomplete')
      throw new AppError(422, 'PORTAL_MGR_TRAINING_INCOMPLETE', `尚有資料未補齊,未能提交 ${year} 年度教育計劃`, r.problems);
    if (!r.ok) throw lockedErr();
    return this.view(emp);
  }

  /** 匯出:部門須為本人可編部門 */
  async exportData(emp: Employee, dept: string): Promise<{ year: number; dept: PlanDept; courses: PlanCourse[] }> {
    const year = await this.year();
    const { depts } = await this.plan(emp, year);
    const d = depts.find((x) => x.code === dept.trim().toUpperCase());
    if (!d) throw dataAccessDenied('此部門不是您負責的訓練計畫部門');
    return { year, dept: d, courses: await this.repo.courses(year, [d.code]) };
  }
}
