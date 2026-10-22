/** 首頁輪播與年度行事曆的 SQL Server 存取(Drizzle;schema portal) */
import { asc, eq } from 'drizzle-orm';
import type { PortalDatabase } from '../../db/client.js';
import { calendarPdf, homeSlide, utcNow } from '../../db/schema.js';
import type { CalendarPdf, ContentRepo, Slide, SlideInput, SlideKind } from './content.js';

const toSlide = (r: typeof homeSlide.$inferSelect): Slide => ({
  id: r.id,
  kind: r.kind as SlideKind,
  title: r.title,
  fileId: r.fileId,
  linkUrl: r.linkUrl,
  startDate: r.startDate,
  endDate: r.endDate,
  sort: r.sort,
  active: r.active,
});

/** 只取可寫欄位(呼叫端多帶 id 等欄位時不寫入識別欄) */
const slideFields = (i: SlideInput): SlideInput => ({
  kind: i.kind,
  title: i.title,
  fileId: i.fileId,
  linkUrl: i.linkUrl,
  startDate: i.startDate,
  endDate: i.endDate,
  sort: i.sort,
  active: i.active,
});

const toCalendar = (r: typeof calendarPdf.$inferSelect): CalendarPdf => ({
  year: r.year,
  fileId: r.fileId,
  fileName: r.fileName,
  updatedAt: r.updatedAt.toISOString(),
});

export class DrizzleContentRepo implements ContentRepo {
  constructor(private readonly db: PortalDatabase) {}

  async slides(all: boolean): Promise<Slide[]> {
    const q = this.db.select().from(homeSlide);
    const rows = await (all ? q : q.where(eq(homeSlide.active, true))).orderBy(asc(homeSlide.kind), asc(homeSlide.sort), asc(homeSlide.id));
    return rows.map(toSlide);
  }

  async createSlide(input: SlideInput, byEmp: string): Promise<Slide> {
    const [r] = await this.db
      .insert(homeSlide)
      .output()
      .values({ ...slideFields(input), createdBy: byEmp, updatedBy: byEmp });
    return toSlide(r!);
  }

  async updateSlide(id: number, input: SlideInput, byEmp: string): Promise<Slide | null> {
    const [r] = await this.db
      .update(homeSlide)
      .set({ ...slideFields(input), updatedBy: byEmp, updatedAt: utcNow })
      .output()
      .where(eq(homeSlide.id, id));
    return r ? toSlide(r) : null;
  }

  async deleteSlide(id: number): Promise<boolean> {
    const r = await this.db.delete(homeSlide).output({ id: homeSlide.id }).where(eq(homeSlide.id, id));
    return r.length > 0;
  }

  async calendars(): Promise<CalendarPdf[]> {
    const rows = await this.db.select().from(calendarPdf).orderBy(asc(calendarPdf.year));
    return rows.map(toCalendar);
  }

  async upsertCalendar(year: number, fileId: string, fileName: string, byEmp: string): Promise<CalendarPdf> {
    // 先更新,沒有才新增(同年度同時上傳時第二筆 INSERT 會撞主鍵而失敗,可接受:重新上傳即可)
    const [u] = await this.db.update(calendarPdf).set({ fileId, fileName, updatedBy: byEmp, updatedAt: utcNow }).output().where(eq(calendarPdf.year, year));
    if (u) return toCalendar(u);
    const [r] = await this.db.insert(calendarPdf).output().values({ year, fileId, fileName, updatedBy: byEmp });
    return toCalendar(r!);
  }

  async deleteCalendar(year: number): Promise<boolean> {
    const r = await this.db.delete(calendarPdf).output({ year: calendarPdf.year }).where(eq(calendarPdf.year, year));
    return r.length > 0;
  }
}
