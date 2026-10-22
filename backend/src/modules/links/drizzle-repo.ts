/** 集團系統 / 個人常用連結的 SQL Server 存取(Drizzle;schema portal) */
import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { PortalDatabase } from '../../db/client.js';
import { personalLink, systemLink, utcNow } from '../../db/schema.js';
import type { LinkRepo, OpenMode, PersonalLink, PersonalLinkInput, SystemLink, SystemLinkInput } from './links.js';

const toSystem = (r: typeof systemLink.$inferSelect): SystemLink => ({
  id: r.id,
  name: r.name,
  description: r.description,
  category: r.category,
  url: r.legacyDes ? null : r.url,
  openMode: (r.openMode === 'same' ? 'same' : 'new') as OpenMode,
  legacyDes: r.legacyDes,
  sort: r.sort,
  active: r.active,
});

/** 只取可寫欄位(呼叫端多帶 id 等欄位時不寫入識別欄) */
const systemFields = (i: SystemLinkInput): SystemLinkInput => ({
  name: i.name,
  description: i.description,
  category: i.category,
  url: i.url,
  openMode: i.openMode,
  legacyDes: i.legacyDes,
  sort: i.sort,
  active: i.active,
});

const toPersonal = (r: typeof personalLink.$inferSelect): PersonalLink => ({ id: r.id, name: r.name, url: r.url, sort: r.sort });

export class DrizzleLinkRepo implements LinkRepo {
  constructor(private readonly db: PortalDatabase) {}

  async systemLinks(all: boolean): Promise<SystemLink[]> {
    const q = this.db.select().from(systemLink);
    const rows = await (all ? q : q.where(eq(systemLink.active, true))).orderBy(asc(systemLink.sort), asc(systemLink.id));
    return rows.map(toSystem);
  }

  async createSystemLink(input: SystemLinkInput, byEmp: string): Promise<SystemLink> {
    const [r] = await this.db
      .insert(systemLink)
      .output()
      .values({ ...systemFields(input), updatedBy: byEmp });
    return toSystem(r!);
  }

  async updateSystemLink(id: number, input: SystemLinkInput, byEmp: string): Promise<SystemLink | null> {
    const [r] = await this.db
      .update(systemLink)
      .set({ ...systemFields(input), updatedBy: byEmp, updatedAt: utcNow })
      .output()
      .where(eq(systemLink.id, id));
    return r ? toSystem(r) : null;
  }

  async deleteSystemLink(id: number): Promise<boolean> {
    const r = await this.db.delete(systemLink).output({ id: systemLink.id }).where(eq(systemLink.id, id));
    return r.length > 0;
  }

  async personalLinks(empNo: string): Promise<PersonalLink[]> {
    const rows = await this.db.select().from(personalLink).where(eq(personalLink.empNo, empNo)).orderBy(asc(personalLink.sort), asc(personalLink.id));
    return rows.map(toPersonal);
  }

  async createPersonalLink(empNo: string, input: PersonalLinkInput, sort: number): Promise<PersonalLink> {
    const [r] = await this.db.insert(personalLink).output().values({ empNo, name: input.name, url: input.url, sort });
    return toPersonal(r!);
  }

  async updatePersonalLink(empNo: string, id: number, input: PersonalLinkInput): Promise<PersonalLink | null> {
    const [r] = await this.db
      .update(personalLink)
      .set({ name: input.name, url: input.url })
      .output()
      .where(and(eq(personalLink.id, id), eq(personalLink.empNo, empNo)));
    return r ? toPersonal(r) : null;
  }

  async deletePersonalLink(empNo: string, id: number): Promise<boolean> {
    const r = await this.db
      .delete(personalLink)
      .output({ id: personalLink.id })
      .where(and(eq(personalLink.id, id), eq(personalLink.empNo, empNo)));
    return r.length > 0;
  }

  async reorderPersonalLinks(empNo: string, ids: readonly number[]): Promise<void> {
    if (!ids.length) return;
    // 單一 UPDATE(CASE)一次重設,不需交易;只動本人的
    const cases: SQL[] = ids.map((id, i) => sql`WHEN ${id} THEN ${(i + 1) * 10}`);
    await this.db
      .update(personalLink)
      .set({ sort: sql`CASE ${personalLink.id} ${sql.join(cases, sql` `)} ELSE ${personalLink.sort} END` })
      .where(and(eq(personalLink.empNo, empNo), inArray(personalLink.id, [...ids])));
  }
}
