/**
 * ESH 證照管理(P6;FEATURE-PLAN §8;docs/Gherkin/esh/license.feature;舊程式 EHS/EHManagement、EHItemEdit、EHLicenseNeed、EHLicense、EHManagerSetup)。
 *   - 須具角色 portal-esh-admin(成員來源 = LicenseManagerInfo,由 IT 指派);**管理範圍 = 本人在 LicenseManagerInfo 的公司**,
 *     每支 API 由後端檢查送出的公司(舊版只限制下拉選單,後端不驗證)
 *   - 證照項目是各公司共用的:具角色且至少管理一間公司者可維護
 *   - 描述 HTML 以白名單清洗後才寫入(並行期舊站原樣輸出,D-7);讀出時再清洗一次
 *   - 下次複訓日由後端計算(rules.ts);持證人工號需在職(LOS RankInfo)
 *   - Logo、證照影本經 giga-file-service(UUID),只登記在 schema portal;舊站檔名(LogoPath、LicenseFileC)以舊入口網網址唯讀顯示
 */
import { AppError, dataAccessDenied } from '../../errors.js';
import type { Employee } from '../../identity.js';
import { UUID_RE } from '../home/content.js';
import { UNSAFE_MESSAGE, unsafeText } from '../manager/text.js';
import { sanitizeQaHtml } from '../qa/html.js';
import {
  complianceRatio,
  DOC_EXTENSIONS,
  daysLeft,
  EMP_RE,
  hasExtension,
  holderStatus,
  isDate,
  isPermanent,
  isValidHolder,
  LEGACY_PERMANENT_VALUE,
  legacyFileUrl,
  LOGO_EXTENSIONS,
  MAX_MONTHS,
  MAX_NOTIFY_DAYS,
  nextTrainingDate,
  normEmp,
  taipeiToday,
  type HolderStatus,
} from './rules.js';
import type { EshFileRepo, EshRepo, FileRef, HolderRow, HolderWrite, LicenseItemRow, ManagerRow, NeedRow } from './types.js';

export const ESH_ROLE = 'portal-esh-admin';
/** LicenseInfo.Script 為 nvarchar(4000) */
export const MAX_SCRIPT_CHARS = 4000;
/** 清洗後的 HTML 若含這些內容,舊站 Server.HtmlDecode 或 title='…' 輸出時會變成標籤 / 跳出屬性 */
export const LEGACY_UNSAFE_HTML = /&(lt|gt|quot|apos|#\d+|#x[0-9a-f]+);|'/i;

const invalid = (field: string, message: string) => new AppError(400, 'VALIDATION_FAILED', message, [{ field, message }]);
const notFound = (code: string, message: string) => new AppError(404, code, message);

/** 一位 ESH 管理員的公司範圍 */
export class EshScope {
  constructor(readonly companies: readonly string[]) {}
  has(company: string | null | undefined): boolean {
    return !!company && this.companies.includes(company.trim());
  }
  /** 不在範圍回 403 PORTAL_DATA_ACCESS_DENIED */
  assert(company: string | null | undefined): string {
    if (!this.has(company)) throw dataAccessDenied('此公司不在您的證照管理範圍內');
    return company!.trim();
  }
  /** 指定公司 = 該公司;未指定 = 全部範圍 */
  resolve(company: string | undefined): string[] {
    return company === undefined || company.trim() === '' ? [...this.companies] : [this.assert(company)];
  }
}

export function requireEshRole(emp: Employee): void {
  if (!(emp.roles ?? []).includes(ESH_ROLE)) throw dataAccessDenied('ESH 證照管理需具 portal-esh-admin 角色');
}

export interface LicenseItemView {
  id: number;
  name: string;
  months: number | null;
  permanent: boolean;
  /** 清洗後的 HTML */
  description: string;
  logo: FileRef | null;
  legacyLogoUrl: string | null;
  active: boolean;
}

export interface LicenseItemInput {
  name: string;
  /** 有效期(月);permanent 時忽略 */
  months?: number | null;
  permanent?: boolean;
  description?: string | null;
}

export type HolderDocView = { kind: 'file'; id: number; fileId: string; fileName: string } | { kind: 'legacy'; fileName: string; url: string | null };

export interface HolderView extends Omit<HolderRow, 'bossId'> {
  permanent: boolean;
  daysLeft: number | null;
  status: HolderStatus;
  docs: HolderDocView[];
}

export interface HolderInput {
  company: string;
  trainingDate?: string | null;
  gatDate?: string | null;
  retrainDate?: string | null;
  notifyDays: number;
}

export type HolderListView = 'current' | 'history' | 'untracked';

export interface DashboardItem {
  licenseId: number;
  name: string;
  months: number | null;
  permanent: boolean;
  description: string;
  logo: FileRef | null;
  legacyLogoUrl: string | null;
  required: number;
  valid: number;
  ratio: number;
  /** 有效 ≥ 應有 */
  ok: boolean;
  notes: string | null;
}

/** 檔名(只當純文字顯示):不可空白、不含路徑與 < > 控制字元 */
function checkFileName(field: string, name: string, allowed: readonly string[]): string {
  const n = name.trim();
  if (!n || n.length > 200 || unsafeText(n) || /[\\/]/.test(n) || !hasExtension(n, allowed)) throw invalid(field, `檔案只接受 ${allowed.join(' / ')}`);
  return n;
}

export function checkFile(file: FileRef, allowed: readonly string[]): FileRef {
  if (!UUID_RE.test(file.fileId)) throw invalid('fileId', '檔案編號格式錯誤');
  return { fileId: file.fileId.toLowerCase(), fileName: checkFileName('fileName', file.fileName, allowed) };
}

const optDate = (field: string, v: string | null | undefined) => {
  if (v === null || v === undefined || v === '') return null;
  if (!isDate(v)) throw invalid(field, '日期格式錯誤(YYYY-MM-DD)');
  return v;
};

export class EshLicenseService {
  constructor(
    private readonly repo: EshRepo,
    private readonly files: EshFileRepo,
    /** 舊入口網根網址(舊站 Logo / 證照影本連結);null = 不帶連結 */
    private readonly legacyPortalUrl: string | null,
    private readonly today: () => string = () => taipeiToday(),
  ) {}

  /** 須具 portal-esh-admin;範圍 = LicenseManagerInfo 的公司(可能為空) */
  async scope(emp: Employee): Promise<EshScope> {
    requireEshRole(emp);
    return new EshScope(await this.repo.managerCompanies(normEmp(emp.empNo)));
  }

  /** 證照項目維護:具角色且至少管理一間公司 */
  private async requireAnyCompany(emp: Employee): Promise<EshScope> {
    const s = await this.scope(emp);
    if (!s.companies.length) throw dataAccessDenied('您不是任何公司的證照管理員(LicenseManagerInfo)');
    return s;
  }

  private description(script: string | null): string {
    return sanitizeQaHtml(script);
  }

  private async itemViews(rows: LicenseItemRow[]): Promise<LicenseItemView[]> {
    const logos = await this.files.logos(rows.map((r) => r.id));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      months: isPermanent(r.months) ? null : r.months,
      permanent: isPermanent(r.months),
      description: this.description(r.script),
      logo: logos.get(r.id) ?? null,
      legacyLogoUrl: legacyFileUrl(this.legacyPortalUrl, 'License', r.logoPath),
      active: r.active,
    }));
  }

  // ───── 儀表板 ─────
  async dashboard(emp: Employee, company: string): Promise<{ company: string; items: DashboardItem[] }> {
    const c = (await this.scope(emp)).assert(company);
    const rows = await this.repo.dashboard(c, this.today());
    const logos = await this.files.logos(rows.map((r) => r.licenseId));
    return {
      company: c,
      items: rows.map((r) => ({
        licenseId: r.licenseId,
        name: r.licenseName,
        months: isPermanent(r.months) ? null : r.months,
        permanent: isPermanent(r.months),
        description: this.description(r.script),
        logo: logos.get(r.licenseId) ?? null,
        legacyLogoUrl: legacyFileUrl(this.legacyPortalUrl, 'License', r.logoPath),
        required: r.required,
        valid: r.valid,
        ratio: complianceRatio(r.valid, r.required),
        ok: r.valid >= r.required,
        notes: r.notes,
      })),
    };
  }

  /** 儀表板「查看」:該公司此證照的有效持證人 */
  async validHolders(emp: Employee, company: string, licenseId: number): Promise<HolderView[]> {
    const c = (await this.scope(emp)).assert(company);
    const today = this.today();
    const rows = (await this.repo.holders([c], licenseId)).filter((h) => isValidHolder(h, today));
    return this.holderViews(rows);
  }

  // ───── 證照項目 ─────
  async items(emp: Employee, includeInactive = false): Promise<LicenseItemView[]> {
    await this.requireAnyCompany(emp);
    return this.itemViews(await this.repo.items(includeInactive));
  }

  private async normalizeItem(input: LicenseItemInput, exceptId?: number) {
    const name = input.name.trim();
    if (!name || name.length > 50) throw invalid('name', '證照名稱不可空白,最多 50 字');
    if (unsafeText(name)) throw invalid('name', `證照名稱${UNSAFE_MESSAGE}`);
    let months: number;
    if (input.permanent) months = LEGACY_PERMANENT_VALUE;
    else {
      const m = input.months;
      if (typeof m !== 'number' || !Number.isInteger(m) || m < 1 || m > MAX_MONTHS) throw invalid('months', `有效期須為 1~${MAX_MONTHS} 的整數(月),或勾選永久`);
      months = m;
    }
    const script = this.description(input.description ?? '');
    if (script.length > MAX_SCRIPT_CHARS) throw invalid('description', `描述過長(清洗後最多 ${MAX_SCRIPT_CHARS} 字元)`);
    // 舊站相容(資安審查 H1):舊站 HtmlDecode 後原樣輸出、也放進單引號屬性,清洗後仍含會被解碼成 < > " ' 的實體或單引號時拒收
    if (LEGACY_UNSAFE_HTML.test(script)) throw invalid('description', '描述不可含單引號,或以文字表示的 < > " 符號(舊入口網會把它們還原成 HTML)');
    // 啟用中不可重名(含編輯時;舊版編輯不檢查)
    if (await this.repo.itemNameTaken(name, exceptId)) throw new AppError(409, 'PORTAL_ESH_ITEM_DUPLICATE', '已有重複的證照名稱');
    return { name, months, script };
  }

  private async itemView(id: number): Promise<LicenseItemView> {
    const row = await this.repo.item(id);
    if (!row) throw notFound('PORTAL_ESH_ITEM_NOT_FOUND', '找不到此證照項目');
    return (await this.itemViews([row]))[0]!;
  }

  async createItem(emp: Employee, input: LicenseItemInput): Promise<LicenseItemView> {
    await this.requireAnyCompany(emp);
    const id = await this.repo.createItem(await this.normalizeItem(input));
    return this.itemView(id);
  }

  async updateItem(emp: Employee, id: number, input: LicenseItemInput): Promise<LicenseItemView> {
    await this.requireAnyCompany(emp);
    if (!(await this.repo.updateItem(id, await this.normalizeItem(input, id)))) throw notFound('PORTAL_ESH_ITEM_NOT_FOUND', '找不到此證照項目(或已刪除)');
    return this.itemView(id);
  }

  /** 仍有公司需求或啟用中的持證人時不能刪(項目各公司共用,避免一間公司的管理員讓其他公司的資料消失;資安審查 M3) */
  async deleteItem(emp: Employee, id: number): Promise<void> {
    await this.requireAnyCompany(emp);
    const used = await this.repo.itemUsage(id);
    if (used.needs > 0 || used.holders > 0)
      throw new AppError(409, 'PORTAL_ESH_ITEM_IN_USE', `此證照仍有 ${used.needs} 筆公司需求、${used.holders} 位啟用中的持證人,請先移除`);
    if (!(await this.repo.deactivateItem(id))) throw notFound('PORTAL_ESH_ITEM_NOT_FOUND', '找不到此證照項目(或已刪除)');
  }

  async setLogo(emp: Employee, id: number, file: FileRef): Promise<LicenseItemView> {
    await this.requireAnyCompany(emp);
    const row = await this.repo.item(id);
    if (!row?.active) throw notFound('PORTAL_ESH_ITEM_NOT_FOUND', '找不到此證照項目');
    await this.files.setLogo(id, checkFile(file, LOGO_EXTENSIONS), normEmp(emp.empNo));
    return this.itemView(id);
  }

  async deleteLogo(emp: Employee, id: number): Promise<void> {
    await this.requireAnyCompany(emp);
    if (!(await this.files.deleteLogo(id))) throw notFound('PORTAL_ESH_ITEM_NOT_FOUND', '此證照沒有新站上傳的 Logo');
  }

  // ───── 證照需求 ─────
  async needs(emp: Employee, company?: string): Promise<NeedRow[]> {
    return this.repo.needs((await this.scope(emp)).resolve(company));
  }

  private checkNeed(required: number, notes: string | null | undefined) {
    if (!Number.isInteger(required) || required < 0 || required > 100000) throw invalid('required', '需求張數須為 ≥ 0 的整數');
    const n = notes?.trim() || null;
    if (n && (n.length > 350 || unsafeText(n, true))) throw invalid('notes', `備註最多 350 字,${UNSAFE_MESSAGE}`);
    return n;
  }

  async createNeed(emp: Employee, input: { company: string; licenseId: number; required: number; notes?: string | null }): Promise<NeedRow> {
    const c = (await this.scope(emp)).assert(input.company);
    const notes = this.checkNeed(input.required, input.notes);
    const item = await this.repo.item(input.licenseId);
    if (!item?.active) throw notFound('PORTAL_ESH_ITEM_NOT_FOUND', '找不到此證照項目');
    if (!(await this.repo.createNeed(c, input.licenseId, input.required, notes))) throw new AppError(409, 'PORTAL_ESH_NEED_DUPLICATE', '已有重複的證照設定');
    return { licenseId: input.licenseId, company: c, licenseName: item.name, required: input.required, notes };
  }

  async updateNeed(emp: Employee, licenseId: number, input: { company: string; required: number; notes?: string | null }): Promise<void> {
    const c = (await this.scope(emp)).assert(input.company);
    const notes = this.checkNeed(input.required, input.notes);
    if (!(await this.repo.updateNeed(c, licenseId, input.required, notes))) throw notFound('PORTAL_ESH_NEED_NOT_FOUND', '找不到此證照需求');
  }

  /** 硬刪(同舊版,並行期舊站一致);新站人員清單不以需求表篩選,持證資料不會消失 */
  async deleteNeed(emp: Employee, company: string, licenseId: number): Promise<void> {
    const c = (await this.scope(emp)).assert(company);
    if (!(await this.repo.deleteNeed(c, licenseId))) throw notFound('PORTAL_ESH_NEED_NOT_FOUND', '找不到此證照需求');
  }

  // ───── 證照人員 ─────
  private async holderViews(rows: HolderRow[]): Promise<HolderView[]> {
    const ids = rows.map((r) => r.id);
    const [legacy, docs] = await Promise.all([this.repo.legacyDocs(ids), this.files.docs(ids)]);
    const today = this.today();
    return rows.map(({ bossId: _boss, ...r }) => ({
      ...r,
      permanent: isPermanent(r.months),
      daysLeft: daysLeft(r.nextTrainingDate, today),
      status: holderStatus(r, today),
      docs: [
        ...docs.filter((d) => d.holderId === r.id).map((d): HolderDocView => ({ kind: 'file', id: d.id, fileId: d.fileId, fileName: d.fileName })),
        ...legacy
          .filter((d) => d.holderId === r.id && d.empNo === r.empNo)
          .map((d): HolderDocView => ({ kind: 'legacy', fileName: d.fileName, url: legacyFileUrl(this.legacyPortalUrl, 'License', d.fileName) })),
      ],
    }));
  }

  /** current:啟用中、在職、需追蹤(通知天數 ≠ 0);history:全部(含已刪除、離職);untracked:啟用中、在職、通知天數 = 0(同舊版勾選項) */
  async holders(emp: Employee, q: { company?: string; licenseId?: number; view?: HolderListView }): Promise<HolderView[]> {
    const companies = (await this.scope(emp)).resolve(q.company);
    const view = q.view ?? 'current';
    const rows = (await this.repo.holders(companies, q.licenseId)).filter((h) =>
      view === 'history' ? true : view === 'untracked' ? h.active && h.inService && h.notifyDays === 0 : h.active && h.inService && h.notifyDays !== 0,
    );
    return this.holderViews(rows);
  }

  private async scopedHolder(emp: Employee, id: number): Promise<{ row: HolderRow; scope: EshScope }> {
    const scope = await this.scope(emp);
    const row = await this.repo.holder(id);
    if (!row) throw notFound('PORTAL_ESH_HOLDER_NOT_FOUND', '找不到此人員證照');
    scope.assert(row.company);
    return { row, scope };
  }

  private holderWrite(input: HolderInput, months: number | null, scope: EshScope): HolderWrite {
    const company = scope.assert(input.company);
    const dates = {
      trainingDate: optDate('trainingDate', input.trainingDate),
      gatDate: optDate('gatDate', input.gatDate),
      retrainDate: optDate('retrainDate', input.retrainDate),
    };
    if (!Number.isInteger(input.notifyDays) || input.notifyDays < 0 || input.notifyDays > MAX_NOTIFY_DAYS)
      throw invalid('notifyDays', `通知天數須為 0~${MAX_NOTIFY_DAYS} 的整數(0 = 不追蹤)`);
    return { company, ...dates, nextTrainingDate: nextTrainingDate(dates, months), notifyDays: input.notifyDays };
  }

  async createHolder(emp: Employee, input: HolderInput & { empNo: string; licenseId: number }): Promise<HolderView> {
    const scope = await this.scope(emp);
    const empNo = normEmp(input.empNo);
    if (!EMP_RE.test(empNo)) throw invalid('empNo', '工號格式錯誤');
    const item = await this.repo.item(input.licenseId);
    if (!item?.active) throw notFound('PORTAL_ESH_ITEM_NOT_FOUND', '找不到此證照項目');
    const write = this.holderWrite(input, item.months, scope);
    const person = await this.repo.person(empNo);
    // 舊版只查 EmployeeInfo、不檢查離職
    if (!person?.inService) throw new AppError(400, 'PORTAL_ESH_EMP_NOT_ACTIVE', '查無此在職員工(LOS 人事資料)');
    const r = await this.repo.createHolder(person.empNo, input.licenseId, write);
    if (!r.ok) throw new AppError(409, 'PORTAL_ESH_HOLDER_DUPLICATE', '該員工已設定相同證照,請勿重複填入');
    return this.holderView(r.id);
  }

  private async holderView(id: number): Promise<HolderView> {
    const row = await this.repo.holder(id);
    if (!row) throw notFound('PORTAL_ESH_HOLDER_NOT_FOUND', '找不到此人員證照');
    return (await this.holderViews([row]))[0]!;
  }

  async updateHolder(emp: Employee, id: number, input: HolderInput): Promise<HolderView> {
    const { row, scope } = await this.scopedHolder(emp, id);
    const write = this.holderWrite(input, row.months, scope);
    if (!(await this.repo.updateHolder(id, write))) throw notFound('PORTAL_ESH_HOLDER_NOT_FOUND', '找不到此人員證照(或已刪除)');
    return this.holderView(id);
  }

  async deleteHolder(emp: Employee, id: number): Promise<void> {
    await this.scopedHolder(emp, id);
    if (!(await this.repo.deactivateHolder(id))) throw notFound('PORTAL_ESH_HOLDER_NOT_FOUND', '找不到此人員證照(或已刪除)');
  }

  async addDoc(emp: Employee, id: number, file: FileRef): Promise<HolderView> {
    const { row } = await this.scopedHolder(emp, id);
    if (!row.active) throw notFound('PORTAL_ESH_HOLDER_NOT_FOUND', '此人員證照已刪除');
    await this.files.addDoc(id, row.empNo, checkFile(file, DOC_EXTENSIONS), normEmp(emp.empNo));
    return this.holderView(id);
  }

  async deleteDoc(emp: Employee, id: number, docId: number): Promise<void> {
    await this.scopedHolder(emp, id);
    if (!(await this.files.deleteDoc(id, docId))) throw notFound('PORTAL_ESH_DOC_NOT_FOUND', '找不到此證照影本');
  }

  async deleteLegacyDoc(emp: Employee, id: number, fileName: string): Promise<void> {
    const { row } = await this.scopedHolder(emp, id);
    if (!(await this.repo.deleteLegacyDoc(id, row.empNo, fileName.trim()))) throw notFound('PORTAL_ESH_DOC_NOT_FOUND', '找不到此證照影本');
  }

  // ───── 證照管理員 ─────
  async managers(emp: Employee, company?: string): Promise<ManagerRow[]> {
    return this.repo.managers((await this.scope(emp)).resolve(company));
  }

  async createManager(emp: Employee, input: { company: string; empNo: string; sendMail: boolean }): Promise<ManagerRow> {
    const c = (await this.scope(emp)).assert(input.company);
    const empNo = normEmp(input.empNo);
    if (!EMP_RE.test(empNo)) throw invalid('empNo', '工號格式錯誤');
    const person = await this.repo.person(empNo);
    if (!person?.inService) throw new AppError(400, 'PORTAL_ESH_EMP_NOT_ACTIVE', '查無此在職員工(LOS 人事資料)');
    if (!(await this.repo.createManager(c, person.empNo, input.sendMail)))
      throw new AppError(409, 'PORTAL_ESH_MANAGER_DUPLICATE', '此員工已是該公司的證照管理員');
    return { company: c, empNo: person.empNo, name: person.name, dept: person.dept, sendMail: input.sendMail, inService: true };
  }

  async updateManager(emp: Employee, input: { company: string; empNo: string; sendMail: boolean }): Promise<void> {
    const c = (await this.scope(emp)).assert(input.company);
    if (!(await this.repo.updateManagerSendMail(c, normEmp(input.empNo), input.sendMail))) throw notFound('PORTAL_ESH_MANAGER_NOT_FOUND', '找不到此證照管理員');
  }

  /** 不可刪除公司最後一位管理員(舊版可刪) */
  async deleteManager(emp: Employee, company: string, empNo: string): Promise<void> {
    const c = (await this.scope(emp)).assert(company);
    const r = await this.repo.deleteManager(c, normEmp(empNo));
    if (r === 'not-found') throw notFound('PORTAL_ESH_MANAGER_NOT_FOUND', '找不到此證照管理員');
    if (r === 'last') throw new AppError(409, 'PORTAL_ESH_MANAGER_LAST', '不可刪除公司最後一位證照管理員');
  }
}
