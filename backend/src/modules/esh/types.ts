/**
 * ESH 證照管理的資料型別與存取介面(FEATURE-PLAN §8;舊表 PortalSolar License*、LOS RankInfo,與舊入口網共用,D-7)。
 *   - 舊表沒有唯一鍵:LicenseBInfo 以(LicenseID, Company)、LicenseManagerInfo 以(Company, LgNo)、LicenseFileA 以 ID 識別
 *   - 新站的檔案(Logo、證照影本、SDS)只存在 schema portal(file-service UUID),不寫舊表的檔名欄位(舊站讀不到,同 D-28 原則)
 */

export interface LicenseItemRow {
  id: number;
  name: string;
  /** 有效期(月);null = 未設定 */
  months: number | null;
  /** 原始 HTML(舊站 CKEditor);回傳前一律再清洗 */
  script: string | null;
  /** 舊站 Logo 檔名(EHS/License/<檔名>) */
  logoPath: string | null;
  active: boolean;
}

export interface LicenseItemWrite {
  name: string;
  /** 寫入 LicenseInfo.ActiveYear(月;永久寫 9999999) */
  months: number;
  script: string;
}

export interface NeedRow {
  licenseId: number;
  company: string;
  licenseName: string;
  required: number;
  notes: string | null;
}

export interface DashboardRow {
  licenseId: number;
  licenseName: string;
  script: string | null;
  logoPath: string | null;
  months: number | null;
  required: number;
  notes: string | null;
  /** 有效張數(在職、未刪除、下次複訓日 ≥ 今天) */
  valid: number;
}

export interface HolderRow {
  id: number;
  licenseId: number;
  licenseName: string;
  months: number | null;
  company: string;
  empNo: string;
  name: string | null;
  dept: string | null;
  /** LOS RankInfo.BossID(主管工號,寄主管通知用) */
  bossId: string | null;
  trainingDate: string | null;
  gatDate: string | null;
  retrainDate: string | null;
  nextTrainingDate: string | null;
  notifyDays: number | null;
  active: boolean;
  inService: boolean;
}

export interface HolderWrite {
  company: string;
  trainingDate: string | null;
  gatDate: string | null;
  retrainDate: string | null;
  nextTrainingDate: string | null;
  notifyDays: number;
}

export interface Person {
  empNo: string;
  name: string | null;
  dept: string | null;
  bossId: string | null;
  inService: boolean;
}

export interface ManagerRow {
  company: string;
  empNo: string;
  name: string | null;
  dept: string | null;
  sendMail: boolean;
  inService: boolean;
}

export interface LegacyDoc {
  holderId: number;
  empNo: string;
  fileName: string;
}

export type CreateHolderResult = { ok: true; id: number; reactivated: boolean } | { ok: false; reason: 'duplicate' };

/** 舊表存取(MssqlEshRepo) */
export interface EshRepo {
  /** 本人在 LicenseManagerInfo 的公司(依 LicenseCompanyInfo.ItemIndex) */
  managerCompanies(empNo: string): Promise<string[]>;
  /** 全部證照公司(LicenseCompanyInfo,依 ItemIndex) */
  companies(): Promise<string[]>;

  items(includeInactive: boolean): Promise<LicenseItemRow[]>;
  item(id: number): Promise<LicenseItemRow | null>;
  /** 啟用中是否已有同名(不分前後空白;exceptId 排除自己) */
  itemNameTaken(name: string, exceptId?: number): Promise<boolean>;
  createItem(input: LicenseItemWrite): Promise<number>;
  updateItem(id: number, input: LicenseItemWrite): Promise<boolean>;
  /** 各公司需求筆數與啟用中的持證筆數(刪除前檢查) */
  itemUsage(id: number): Promise<{ needs: number; holders: number }>;
  /** 軟刪除 IsActive = 0 */
  deactivateItem(id: number): Promise<boolean>;

  needs(companies: string[]): Promise<NeedRow[]>;
  /** 交易內檢查重複後新增;重複回 false */
  createNeed(company: string, licenseId: number, required: number, notes: string | null): Promise<boolean>;
  updateNeed(company: string, licenseId: number, required: number, notes: string | null): Promise<boolean>;
  deleteNeed(company: string, licenseId: number): Promise<boolean>;

  dashboard(company: string, today: string): Promise<DashboardRow[]>;

  /** 啟用中證照項目的持證資料(含已刪除、離職;篩選在服務層) */
  holders(companies: string[], licenseId?: number): Promise<HolderRow[]>;
  holder(id: number): Promise<HolderRow | null>;
  /** LOS RankInfo(UserID = VirtualUserID、IsMaster = 1);在職 = LeaveDate 為空 */
  person(empNo: string): Promise<Person | null>;
  /** 同人同證照同公司已有啟用中紀錄回 duplicate;只有已刪除紀錄時復原該筆並更新日期 */
  createHolder(empNo: string, licenseId: number, input: HolderWrite): Promise<CreateHolderResult>;
  /** 只更新啟用中的紀錄(不復活已刪除資料;舊版一律寫 IsActive = 1) */
  updateHolder(id: number, input: HolderWrite): Promise<boolean>;
  deactivateHolder(id: number): Promise<boolean>;
  legacyDocs(holderIds: number[]): Promise<LegacyDoc[]>;
  /** 硬刪 LicenseFileC 列(同舊版;實體檔在舊站目錄,不處理) */
  deleteLegacyDoc(holderId: number, empNo: string, fileName: string): Promise<boolean>;

  managers(companies: string[]): Promise<ManagerRow[]>;
  /** 交易內檢查重複;重複回 false */
  createManager(company: string, empNo: string, sendMail: boolean): Promise<boolean>;
  updateManagerSendMail(company: string, empNo: string, sendMail: boolean): Promise<boolean>;
  /** 交易內:公司只剩這一位時不刪 */
  deleteManager(company: string, empNo: string): Promise<'ok' | 'not-found' | 'last'>;
}

export interface FileRef {
  fileId: string;
  fileName: string;
}

export interface HolderDoc extends FileRef {
  id: number;
  holderId: number;
  createdAt: string;
}

/** schema portal 的檔案登記(DrizzleEshFileRepo) */
export interface EshFileRepo {
  logos(licenseIds: number[]): Promise<Map<number, FileRef>>;
  setLogo(licenseId: number, file: FileRef, byEmp: string): Promise<void>;
  deleteLogo(licenseId: number): Promise<boolean>;
  docs(holderIds: number[]): Promise<HolderDoc[]>;
  addDoc(holderId: number, empNo: string, file: FileRef, byEmp: string): Promise<HolderDoc>;
  deleteDoc(holderId: number, docId: number): Promise<boolean>;
}
