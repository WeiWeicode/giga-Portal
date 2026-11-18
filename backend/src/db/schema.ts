/**
 * 入口網自有資料表(PORTAL-API-PLAN D-4):giganexus_gw[_test|_poc_test] 的獨立 schema portal。
 * schema 由 DBA 建立(db/dba/01-create-schema.sql),migration 不建立;不讀寫 gw.*、file_svc.*、src_*,也不建 FK 到它們。
 * 舊庫(PortalSolar 等)的表不在此定義,以 mssql 參數化查詢存取(db/sources.ts)。
 */
import { sql } from 'drizzle-orm';
import { bigint, bit, date, datetime2, index, mssqlSchema, nvarchar, varchar } from 'drizzle-orm/mssql-core';

export const portal = mssqlSchema('portal').existing();

/** 時間一律以 UTC 儲存 */
export const utcNow = sql`sysutcdatetime()`;
const ts = (name: string) => datetime2(name, { precision: 3 });

/** 個人提醒(P1-2;docs/Gherkin/personal/notes.feature):只有本人看得到 */
export const personalNote = portal.table(
  'personal_note',
  {
    id: bigint('id', { mode: 'number' }).identity().primaryKey(),
    /** 工號(內部 Token emp) */
    empNo: nvarchar('emp_no', { length: 20 }).notNull(),
    title: nvarchar('title', { length: 100 }).notNull(),
    content: nvarchar('content', { length: 1000 }),
    category: nvarchar('category', { length: 20 }).notNull(),
    /** high / medium / low */
    priority: varchar('priority', { length: 10 }).notNull(),
    dueDate: date('due_date', { mode: 'string' }),
    done: bit('done').notNull().default(false),
    createdAt: ts('created_at').notNull().default(utcNow),
    updatedAt: ts('updated_at').notNull().default(utcNow),
  },
  (t) => [index('ix_personal_note_emp').on(t.empNo, t.done)],
);
