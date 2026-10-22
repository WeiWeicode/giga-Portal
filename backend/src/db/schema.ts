/**
 * 入口網自有資料表(PORTAL-API-PLAN D-4):giganexus_gw[_test|_poc_test] 的獨立 schema portal。
 * schema 由 DBA 建立(db/dba/01-create-schema.sql),migration 不建立;不讀寫 gw.*、file_svc.*、src_*,也不建 FK 到它們。
 * 舊庫(PortalSolar 等)的表不在此定義,以 mssql 參數化查詢存取(db/sources.ts)。
 */
import { sql } from 'drizzle-orm';
import { bigint, bit, date, datetime2, index, int, mssqlSchema, nvarchar, uniqueIndex, varchar } from 'drizzle-orm/mssql-core';

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

// ───────────── P3 首頁聚合與集團公告(FEATURE-PLAN §1、§5;docs/Gherkin/home/*.feature、group/*.feature)─────────────

/** 檔案編號:giga-file-service UUID(36 字元);portal-api 只存編號,檔案本體與下載權限在 file-service */
const fileId = (name: string) => varchar(name, { length: 36 });

/**
 * 首頁圖片輪播(FEATURE-PLAN §1「公告輪播 / 集團動態」):編輯者上傳到 file-service 後登記,依起訖日顯示。
 * kind:policy = 公告輪播(政策宣導)、gallery = 集團動態
 */
export const homeSlide = portal.table(
  'home_slide',
  {
    id: bigint('id', { mode: 'number' }).identity().primaryKey(),
    kind: varchar('kind', { length: 10 }).notNull(),
    title: nvarchar('title', { length: 100 }).notNull(),
    fileId: fileId('file_id').notNull(),
    /** 點圖片另開的連結(https / 站內相對路徑),選填 */
    linkUrl: nvarchar('link_url', { length: 500 }),
    startDate: date('start_date', { mode: 'string' }),
    endDate: date('end_date', { mode: 'string' }),
    sort: int('sort').notNull().default(0),
    active: bit('active').notNull().default(true),
    createdBy: nvarchar('created_by', { length: 20 }).notNull(),
    createdAt: ts('created_at').notNull().default(utcNow),
    updatedBy: nvarchar('updated_by', { length: 20 }).notNull(),
    updatedAt: ts('updated_at').notNull().default(utcNow),
  },
  (t) => [index('ix_home_slide_kind').on(t.kind, t.active)],
);

/** 年度行事曆 PDF(FEATURE-PLAN §5「行事曆」):每年度一份,重新上傳即取代 */
export const calendarPdf = portal.table('calendar_pdf', {
  year: int('year').primaryKey(),
  fileId: fileId('file_id').notNull(),
  fileName: nvarchar('file_name', { length: 200 }).notNull(),
  updatedBy: nvarchar('updated_by', { length: 20 }).notNull(),
  updatedAt: ts('updated_at').notNull().default(utcNow),
});

/**
 * 集團系統連結(FEATURE-PLAN §5「集團系統」、§6.3、D-22):編輯者維護。
 * legacy_des = 1:舊站以 DES 金鑰跳轉的系統,只顯示「DES 跳轉(待重構)」,url 一律 NULL(不產生 token、不帶連結)
 */
export const systemLink = portal.table(
  'system_link',
  {
    id: bigint('id', { mode: 'number' }).identity().primaryKey(),
    name: nvarchar('name', { length: 100 }).notNull(),
    description: nvarchar('description', { length: 300 }),
    category: nvarchar('category', { length: 30 }).notNull(),
    url: nvarchar('url', { length: 500 }),
    /** new = 另開分頁、same = 同頁 */
    openMode: varchar('open_mode', { length: 10 }).notNull().default('new'),
    legacyDes: bit('legacy_des').notNull().default(false),
    sort: int('sort').notNull().default(0),
    active: bit('active').notNull().default(true),
    updatedBy: nvarchar('updated_by', { length: 20 }).notNull(),
    updatedAt: ts('updated_at').notNull().default(utcNow),
  },
  (t) => [index('ix_system_link_active').on(t.active, t.sort)],
);

/** 個人常用連結(FEATURE-PLAN §1「個人秘書」):本人新增 / 刪除 / 排序;舊 PersonalSystemLink 是管理者指派的舊頁連結,不沿用 */
export const personalLink = portal.table(
  'personal_link',
  {
    id: bigint('id', { mode: 'number' }).identity().primaryKey(),
    empNo: nvarchar('emp_no', { length: 20 }).notNull(),
    name: nvarchar('name', { length: 50 }).notNull(),
    url: nvarchar('url', { length: 500 }).notNull(),
    sort: int('sort').notNull().default(0),
    createdAt: ts('created_at').notNull().default(utcNow),
  },
  (t) => [index('ix_personal_link_emp').on(t.empNo, t.sort)],
);

/**
 * 3691 作者(D-23):舊表 Talk3691Data.SN 對應的作者工號密文(AES-256-GCM,金鑰在 secret,AAD 綁定 SN)。
 * 新站發文時 Talk3691Data.mark 留 NULL(舊站「解碼」顯示「未有解碼資訊」),作者只存在這裡。
 */
export const talkAuthor = portal.table('talk_author', {
  sn: int('sn').primaryKey(),
  /** base64(iv 12 bytes || 密文 || tag 16 bytes) */
  cipher: varchar('cipher', { length: 200 }).notNull(),
  keyId: varchar('key_id', { length: 20 }).notNull(),
  createdAt: ts('created_at').notNull().default(utcNow),
});

/** 3691 稽核紀錄(D-23):屏蔽 / 取消屏蔽 / 解碼作者;解碼必填核准文號 */
export const talkAudit = portal.table(
  'talk_audit',
  {
    id: bigint('id', { mode: 'number' }).identity().primaryKey(),
    sn: int('sn').notNull(),
    /** block / unblock / reveal */
    action: varchar('action', { length: 10 }).notNull(),
    /** reveal:ok / legacy(舊站發文,新站不解碼)/ none(沒有作者資料)/ error(解不開) */
    result: varchar('result', { length: 10 }),
    empNo: nvarchar('emp_no', { length: 20 }).notNull(),
    approvalNo: nvarchar('approval_no', { length: 50 }),
    reason: nvarchar('reason', { length: 200 }),
    createdAt: ts('created_at').notNull().default(utcNow),
  },
  (t) => [index('ix_talk_audit_sn').on(t.sn)],
);

// ───────────── P4 表單下載(FEATURE-PLAN §4「表單下載」、D-25;docs/Gherkin/approval/forms.feature)─────────────

/** 表單分類:編輯者維護(portal.forms.edit);名稱不重複 */
export const formCategory = portal.table(
  'form_category',
  {
    id: bigint('id', { mode: 'number' }).identity().primaryKey(),
    name: nvarchar('name', { length: 30 }).notNull(),
    sort: int('sort').notNull().default(0),
    updatedBy: nvarchar('updated_by', { length: 20 }).notNull(),
    updatedAt: ts('updated_at').notNull().default(utcNow),
  },
  (t) => [uniqueIndex('ux_form_category_name').on(t.name)],
);

/**
 * 表單檔案:檔案本體由編輯者上傳到 giga-file-service(sourceApp / refType portal-forms、refNo = 表單 id),這裡只存 UUID 與顯示資訊;
 * 所有員工可下載(file-service 下載權限 file.object.read)。停用(active = 0)的只在維護清單看得到。
 */
export const formDoc = portal.table(
  'form_doc',
  {
    id: bigint('id', { mode: 'number' }).identity().primaryKey(),
    categoryId: bigint('category_id', { mode: 'number' })
      .notNull()
      .references(() => formCategory.id),
    name: nvarchar('name', { length: 100 }).notNull(),
    description: nvarchar('description', { length: 300 }),
    fileId: fileId('file_id').notNull(),
    fileName: nvarchar('file_name', { length: 200 }).notNull(),
    sort: int('sort').notNull().default(0),
    active: bit('active').notNull().default(true),
    updatedBy: nvarchar('updated_by', { length: 20 }).notNull(),
    updatedAt: ts('updated_at').notNull().default(utcNow),
  },
  (t) => [index('ix_form_doc_category').on(t.categoryId, t.active, t.sort)],
);
