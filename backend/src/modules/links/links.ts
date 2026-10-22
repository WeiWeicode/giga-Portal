/**
 * 集團系統連結與個人常用連結(FEATURE-PLAN §1「個人秘書」、§5「集團系統」、§6.3;PORTAL-API-PLAN D-22;
 * docs/Gherkin/group/links.feature、home/home.feature)。
 *   - 集團系統:portal.system_link,編輯者維護(portal.api.link.edit);legacyDes = 舊站 DES 跳轉的系統,只顯示「DES 跳轉(待重構)」,
 *     url 一律存 NULL、API 不回傳網址(D-22:不產生 token、不帶連結)
 *   - 個人常用連結:portal.personal_link,只有本人看得到、改得到;別人的回 404(不透露是否存在)
 *   - 網址只接受 http(s) 絕對網址或站內相對路徑(/ 開頭、不是 //),拒絕 javascript: 等其他協定
 */
import { AppError } from '../../errors.js';

export const OPEN_MODES = ['new', 'same'] as const;
export type OpenMode = (typeof OPEN_MODES)[number];
/** 每人個人連結上限 */
export const MAX_PERSONAL_LINKS = 20;

/** 安全的連結網址:http(s) 絕對網址(不含帳密)或站內相對路徑 */
export function isSafeUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s || /[\s<>"'`]/.test(s)) return false;
  if (s.startsWith('/')) return !s.startsWith('//') && !s.startsWith('/\\');
  try {
    const u = new URL(s);
    return (u.protocol === 'http:' || u.protocol === 'https:') && !u.username && !u.password;
  } catch {
    return false;
  }
}

const badUrl = (field = 'url') =>
  new AppError(400, 'VALIDATION_FAILED', '網址必須是 http(s):// 開頭或站內路徑(/ 開頭)', [{ field, message: '網址格式不允許' }]);

export interface SystemLink {
  id: number;
  name: string;
  description: string | null;
  category: string;
  /** legacyDes 時一律 null */
  url: string | null;
  openMode: OpenMode;
  legacyDes: boolean;
  sort: number;
  active: boolean;
}
export type SystemLinkInput = Omit<SystemLink, 'id'>;

export interface PersonalLink {
  id: number;
  name: string;
  url: string;
  sort: number;
}
export interface PersonalLinkInput {
  name: string;
  url: string;
}

export interface LinkRepo {
  /** all = false 只列啟用中;依 sort、id */
  systemLinks(all: boolean): Promise<SystemLink[]>;
  createSystemLink(input: SystemLinkInput, byEmp: string): Promise<SystemLink>;
  updateSystemLink(id: number, input: SystemLinkInput, byEmp: string): Promise<SystemLink | null>;
  deleteSystemLink(id: number): Promise<boolean>;

  personalLinks(empNo: string): Promise<PersonalLink[]>;
  createPersonalLink(empNo: string, input: PersonalLinkInput, sort: number): Promise<PersonalLink>;
  updatePersonalLink(empNo: string, id: number, input: PersonalLinkInput): Promise<PersonalLink | null>;
  deletePersonalLink(empNo: string, id: number): Promise<boolean>;
  /** 依 ids 順序重設 sort(只動本人的) */
  reorderPersonalLinks(empNo: string, ids: readonly number[]): Promise<void>;
}

const linkNotFound = () => new AppError(404, 'PORTAL_LINK_NOT_FOUND', '找不到此連結');

export class LinkService {
  constructor(private readonly repo: LinkRepo) {}

  private normalizeSystem(input: SystemLinkInput): SystemLinkInput {
    const url = input.legacyDes ? null : (input.url ?? '').trim() || null;
    if (!input.legacyDes) {
      if (!url) throw new AppError(400, 'VALIDATION_FAILED', '請填寫網址(舊站 DES 跳轉的系統請勾選「DES 跳轉(待重構)」)');
      if (!isSafeUrl(url)) throw badUrl();
    }
    return { ...input, name: input.name.trim(), category: input.category.trim(), description: input.description?.trim() || null, url };
  }

  systemLinks(all: boolean): Promise<SystemLink[]> {
    return this.repo.systemLinks(all);
  }

  createSystemLink(input: SystemLinkInput, byEmp: string): Promise<SystemLink> {
    return this.repo.createSystemLink(this.normalizeSystem(input), byEmp);
  }

  async updateSystemLink(id: number, input: SystemLinkInput, byEmp: string): Promise<SystemLink> {
    return (await this.repo.updateSystemLink(id, this.normalizeSystem(input), byEmp)) ?? Promise.reject(linkNotFound());
  }

  async deleteSystemLink(id: number): Promise<void> {
    if (!(await this.repo.deleteSystemLink(id))) throw linkNotFound();
  }

  personalLinks(empNo: string): Promise<PersonalLink[]> {
    return this.repo.personalLinks(empNo);
  }

  private normalizePersonal(input: PersonalLinkInput): PersonalLinkInput {
    const url = input.url.trim();
    if (!isSafeUrl(url)) throw badUrl();
    return { name: input.name.trim(), url };
  }

  async createPersonalLink(empNo: string, input: PersonalLinkInput): Promise<PersonalLink> {
    const clean = this.normalizePersonal(input);
    const mine = await this.repo.personalLinks(empNo);
    if (mine.length >= MAX_PERSONAL_LINKS) throw new AppError(409, 'PORTAL_LINK_LIMIT', `個人常用連結最多 ${MAX_PERSONAL_LINKS} 筆`);
    const sort = mine.reduce((m, l) => Math.max(m, l.sort), 0) + 10;
    return this.repo.createPersonalLink(empNo, clean, sort);
  }

  async updatePersonalLink(empNo: string, id: number, input: PersonalLinkInput): Promise<PersonalLink> {
    return (await this.repo.updatePersonalLink(empNo, id, this.normalizePersonal(input))) ?? Promise.reject(linkNotFound());
  }

  async deletePersonalLink(empNo: string, id: number): Promise<void> {
    if (!(await this.repo.deletePersonalLink(empNo, id))) throw linkNotFound();
  }

  /** ids 必須剛好是本人全部連結(不多不少、不重複) */
  async reorderPersonalLinks(empNo: string, ids: readonly number[]): Promise<PersonalLink[]> {
    const mine = await this.repo.personalLinks(empNo);
    const set = new Set(ids);
    if (set.size !== ids.length || ids.length !== mine.length || mine.some((l) => !set.has(l.id)))
      throw new AppError(400, 'VALIDATION_FAILED', '排序清單必須包含本人全部連結且不重複');
    await this.repo.reorderPersonalLinks(empNo, ids);
    return this.repo.personalLinks(empNo);
  }
}
