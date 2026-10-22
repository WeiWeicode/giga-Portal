/** 表單下載的 SQL Server 存取(Drizzle;schema portal 的 form_category、form_doc) */
import { and, asc, eq, ne } from 'drizzle-orm';
import type { PortalDatabase } from '../../db/client.js';
import { formCategory, formDoc, utcNow } from '../../db/schema.js';
import type { FormCategory, FormCategoryInput, FormDoc, FormDocInput, FormRepo } from './forms.js';

const toCategory = (r: typeof formCategory.$inferSelect): FormCategory => ({ id: r.id, name: r.name, sort: r.sort });
const toForm = (r: typeof formDoc.$inferSelect): FormDoc => ({
  id: r.id,
  categoryId: r.categoryId,
  name: r.name,
  description: r.description,
  fileId: r.fileId,
  fileName: r.fileName,
  sort: r.sort,
  active: r.active,
  updatedAt: r.updatedAt.toISOString(),
});
/** 只取可寫欄位(呼叫端多帶 id 等欄位時不寫入識別欄) */
const formFields = (i: FormDocInput): FormDocInput => ({
  categoryId: i.categoryId,
  name: i.name,
  description: i.description,
  fileId: i.fileId,
  fileName: i.fileName,
  sort: i.sort,
  active: i.active,
});

export class DrizzleFormRepo implements FormRepo {
  constructor(private readonly db: PortalDatabase) {}

  async categories(): Promise<FormCategory[]> {
    const rows = await this.db.select().from(formCategory).orderBy(asc(formCategory.sort), asc(formCategory.id));
    return rows.map(toCategory);
  }

  async createCategory(input: FormCategoryInput, byEmp: string): Promise<FormCategory> {
    const [r] = await this.db.insert(formCategory).output().values({ name: input.name, sort: input.sort, updatedBy: byEmp });
    return toCategory(r!);
  }

  async updateCategory(id: number, input: FormCategoryInput, byEmp: string): Promise<FormCategory | null> {
    const [r] = await this.db
      .update(formCategory)
      .set({ name: input.name, sort: input.sort, updatedBy: byEmp, updatedAt: utcNow })
      .output()
      .where(eq(formCategory.id, id));
    return r ? toCategory(r) : null;
  }

  async deleteCategory(id: number): Promise<'ok' | 'not-found' | 'in-use'> {
    const used = await this.db.select({ id: formDoc.id }).from(formDoc).where(eq(formDoc.categoryId, id));
    if (used.length) return 'in-use';
    const r = await this.db.delete(formCategory).output({ id: formCategory.id }).where(eq(formCategory.id, id));
    return r.length ? 'ok' : 'not-found';
  }

  async categoryExists(id: number): Promise<boolean> {
    return (await this.db.select({ id: formCategory.id }).from(formCategory).where(eq(formCategory.id, id))).length > 0;
  }

  async categoryNameTaken(name: string, exceptId?: number): Promise<boolean> {
    const cond = exceptId === undefined ? eq(formCategory.name, name) : and(eq(formCategory.name, name), ne(formCategory.id, exceptId));
    return (await this.db.select({ id: formCategory.id }).from(formCategory).where(cond)).length > 0;
  }

  async forms(all: boolean): Promise<FormDoc[]> {
    const q = this.db.select().from(formDoc);
    const rows = await (all ? q : q.where(eq(formDoc.active, true))).orderBy(asc(formDoc.categoryId), asc(formDoc.sort), asc(formDoc.id));
    return rows.map(toForm);
  }

  async createForm(input: FormDocInput, byEmp: string): Promise<FormDoc> {
    const [r] = await this.db
      .insert(formDoc)
      .output()
      .values({ ...formFields(input), updatedBy: byEmp });
    return toForm(r!);
  }

  async updateForm(id: number, input: FormDocInput, byEmp: string): Promise<FormDoc | null> {
    const [r] = await this.db
      .update(formDoc)
      .set({ ...formFields(input), updatedBy: byEmp, updatedAt: utcNow })
      .output()
      .where(eq(formDoc.id, id));
    return r ? toForm(r) : null;
  }

  async deleteForm(id: number): Promise<boolean> {
    const r = await this.db.delete(formDoc).output({ id: formDoc.id }).where(eq(formDoc.id, id));
    return r.length > 0;
  }
}
