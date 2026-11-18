/** 個人提醒的 SQL Server 存取(Drizzle;schema portal) */
import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import type { PortalDatabase } from '../../db/client.js';
import { personalNote, utcNow } from '../../db/schema.js';
import type { Note, NoteInput, NotePatch, NoteRepo, Priority } from './notes.js';

type Row = typeof personalNote.$inferSelect;

const toNote = (r: Row): Note => ({
  id: r.id,
  title: r.title,
  content: r.content,
  category: r.category,
  priority: r.priority as Priority,
  dueDate: r.dueDate,
  done: r.done,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

export class DrizzleNoteRepo implements NoteRepo {
  constructor(private readonly db: PortalDatabase) {}

  async list(empNo: string): Promise<Note[]> {
    const rows = await this.db
      .select()
      .from(personalNote)
      .where(eq(personalNote.empNo, empNo))
      // 到期日空白的排在後面(2012 沒有 NULLS LAST)
      .orderBy(asc(personalNote.done), sql`CASE WHEN ${personalNote.dueDate} IS NULL THEN 1 ELSE 0 END`, asc(personalNote.dueDate), desc(personalNote.id));
    return rows.map(toNote);
  }

  async count(empNo: string): Promise<number> {
    const [r] = await this.db.select({ n: count() }).from(personalNote).where(eq(personalNote.empNo, empNo));
    return r?.n ?? 0;
  }

  async create(empNo: string, input: NoteInput): Promise<Note> {
    const [r] = await this.db
      .insert(personalNote)
      .output()
      .values({
        empNo,
        title: input.title,
        content: input.content ?? null,
        category: input.category,
        priority: input.priority,
        dueDate: input.dueDate ?? null,
      });
    return toNote(r!);
  }

  async update(empNo: string, id: number, patch: NotePatch): Promise<Note | null> {
    const [r] = await this.db
      .update(personalNote)
      .set({ ...patch, updatedAt: utcNow })
      // output() 不帶參數 = OUTPUT INSERTED.*(更新後的值)
      .output()
      .where(and(eq(personalNote.id, id), eq(personalNote.empNo, empNo)));
    return r ? toNote(r) : null;
  }

  async remove(empNo: string, id: number): Promise<boolean> {
    const r = await this.db
      .delete(personalNote)
      .output({ id: personalNote.id })
      .where(and(eq(personalNote.id, id), eq(personalNote.empNo, empNo)));
    return r.length > 0;
  }
}
