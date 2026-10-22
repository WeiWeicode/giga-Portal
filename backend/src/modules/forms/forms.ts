/**
 * 表單下載(P4;FEATURE-PLAN §4「表單下載」、PORTAL-API-PLAN D-25;docs/Gherkin/approval/forms.feature)。
 * 舊系統沒有此頁:編輯者(按鈕 portal.forms.edit,角色 portal-editor)把表單檔上傳到 giga-file-service
 * (sourceApp / refType portal-forms、refNo = 表單 id),在這裡登記名稱、分類與檔案 UUID;所有員工可下載。
 *   - portal-api 不經手檔案本體,也不產生下載網址(前端以 file-service 下載 API 取檔,權限 file.object.read)
 *   - 檔名只接受常見文件副檔名(顯示與提示用;檔案內容檢查在 file-service:副檔名白名單 + 檔頭)
 *   - 停用的表單只在維護清單看得到;分類下仍有表單(含停用)時不能刪除
 */
import { AppError } from '../../errors.js';
import { UUID_RE } from '../home/content.js';

/** 允許的表單副檔名(file-service 另有自己的白名單與檔頭檢查) */
export const FORM_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'] as const;

export interface FormCategory {
  id: number;
  name: string;
  sort: number;
}
export type FormCategoryInput = Omit<FormCategory, 'id'>;

export interface FormDoc {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  fileId: string;
  fileName: string;
  sort: number;
  active: boolean;
  updatedAt: string;
}
export type FormDocInput = Omit<FormDoc, 'id' | 'updatedAt'>;

export interface FormRepo {
  categories(): Promise<FormCategory[]>;
  createCategory(input: FormCategoryInput, byEmp: string): Promise<FormCategory>;
  updateCategory(id: number, input: FormCategoryInput, byEmp: string): Promise<FormCategory | null>;
  /** 分類下有表單(含停用)時回 'in-use',不刪 */
  deleteCategory(id: number): Promise<'ok' | 'not-found' | 'in-use'>;
  categoryExists(id: number): Promise<boolean>;
  categoryNameTaken(name: string, exceptId?: number): Promise<boolean>;

  /** all = false 只列啟用中;依分類、sort、id */
  forms(all: boolean): Promise<FormDoc[]>;
  createForm(input: FormDocInput, byEmp: string): Promise<FormDoc>;
  updateForm(id: number, input: FormDocInput, byEmp: string): Promise<FormDoc | null>;
  deleteForm(id: number): Promise<boolean>;
}

const formNotFound = () => new AppError(404, 'PORTAL_FORM_NOT_FOUND', '找不到此表單');
const categoryNotFound = () => new AppError(404, 'PORTAL_FORM_CATEGORY_NOT_FOUND', '找不到此表單分類');
const invalid = (field: string, message: string) => new AppError(400, 'VALIDATION_FAILED', message, [{ field, message }]);

/** Unicode 雙向控制與零寬字元:可讓名稱 / 檔名在畫面上顯示成另一個樣子(視覺欺騙;資安審查 L-3) */
const BIDI = /[​-‏‪-‮⁦-⁩﻿]/;
/** 控制字元、< >、雙向控制字元不收(名稱只當純文字顯示,避免並行期被其他系統原樣輸出) */
const UNSAFE_TEXT = new RegExp(`[\\u0000-\\u001f\\u007f<>]|${BIDI.source}`);

export function isAllowedFormFile(fileName: string): boolean {
  const m = /\.([A-Za-z0-9]+)$/.exec(fileName.trim());
  return !!m && (FORM_EXTENSIONS as readonly string[]).includes(m[1]!.toLowerCase());
}

export class FormService {
  constructor(private readonly repo: FormRepo) {}

  /** 員工下載頁:分類 + 啟用中的表單 */
  async catalog(): Promise<{ categories: FormCategory[]; items: FormDoc[] }> {
    const [categories, items] = await Promise.all([this.repo.categories(), this.repo.forms(false)]);
    return { categories, items };
  }

  /** 維護清單:含停用 */
  async adminCatalog(): Promise<{ categories: FormCategory[]; items: FormDoc[] }> {
    const [categories, items] = await Promise.all([this.repo.categories(), this.repo.forms(true)]);
    return { categories, items };
  }

  private async normalizeCategory(input: FormCategoryInput, exceptId?: number): Promise<FormCategoryInput> {
    const name = input.name.trim();
    if (!name || UNSAFE_TEXT.test(name)) throw invalid('name', '分類名稱不可空白,也不可含 < > 或控制字元');
    if (await this.repo.categoryNameTaken(name, exceptId)) throw new AppError(409, 'PORTAL_FORM_CATEGORY_DUPLICATE', '已有同名的表單分類');
    return { name, sort: input.sort };
  }

  async createCategory(input: FormCategoryInput, byEmp: string): Promise<FormCategory> {
    return this.repo.createCategory(await this.normalizeCategory(input), byEmp);
  }

  async updateCategory(id: number, input: FormCategoryInput, byEmp: string): Promise<FormCategory> {
    return (await this.repo.updateCategory(id, await this.normalizeCategory(input, id), byEmp)) ?? Promise.reject(categoryNotFound());
  }

  async deleteCategory(id: number): Promise<void> {
    const r = await this.repo.deleteCategory(id);
    if (r === 'not-found') throw categoryNotFound();
    if (r === 'in-use') throw new AppError(409, 'PORTAL_FORM_CATEGORY_IN_USE', '此分類下還有表單,請先移除或改分類');
  }

  private async normalizeForm(input: FormDocInput): Promise<FormDocInput> {
    const name = input.name.trim();
    const description = input.description?.trim() || null;
    const fileName = input.fileName.trim();
    if (!name || UNSAFE_TEXT.test(name)) throw invalid('name', '表單名稱不可空白,也不可含 < > 或控制字元');
    if (description && (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/.test(description) || BIDI.test(description)))
      throw invalid('description', '說明不可含 < > 或控制字元');
    if (!UUID_RE.test(input.fileId)) throw invalid('fileId', '檔案編號格式錯誤');
    if (UNSAFE_TEXT.test(fileName) || /[\\/]/.test(fileName) || !isAllowedFormFile(fileName))
      throw invalid('fileName', `表單檔只接受 ${FORM_EXTENSIONS.join(' / ')}`);
    if (!(await this.repo.categoryExists(input.categoryId))) throw categoryNotFound();
    return { categoryId: input.categoryId, name, description, fileId: input.fileId.toLowerCase(), fileName, sort: input.sort, active: input.active };
  }

  async createForm(input: FormDocInput, byEmp: string): Promise<FormDoc> {
    return this.repo.createForm(await this.normalizeForm(input), byEmp);
  }

  async updateForm(id: number, input: FormDocInput, byEmp: string): Promise<FormDoc> {
    return (await this.repo.updateForm(id, await this.normalizeForm(input), byEmp)) ?? Promise.reject(formNotFound());
  }

  async deleteForm(id: number): Promise<void> {
    if (!(await this.repo.deleteForm(id))) throw formNotFound();
  }
}
