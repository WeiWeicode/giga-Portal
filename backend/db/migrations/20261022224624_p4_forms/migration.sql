/*
  p4_forms — 由 drizzle-kit generate 產生,人工審查 SQL Server 2012 相容性:未調整產生的 DDL。
  - P4 表單下載(FEATURE-PLAN §4、D-25;PORTAL-API-PLAN §4 P4):表單分類、表單檔案(file-service UUID)
  - 分類不預建(舊系統沒有表單下載頁),由編輯者在畫面新增;FK 只在 schema portal 內
  - schema portal 由 db/dba/01-create-schema.sql 建立(sa),本檔不建立;不碰 gw.*、file_svc.*、src_*、舊庫
  已執行 `npm run db:check-2012`:無 2016+ 語法。
*/
CREATE TABLE [portal].[form_category] (
	[id] bigint IDENTITY(1, 1),
	[name] nvarchar(30) NOT NULL,
	[sort] int NOT NULL CONSTRAINT [form_category_sort_default] DEFAULT ((0)),
	[updated_by] nvarchar(20) NOT NULL,
	[updated_at] datetime2(3) NOT NULL CONSTRAINT [form_category_updated_at_default] DEFAULT (sysutcdatetime()),
	CONSTRAINT [form_category_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [portal].[form_doc] (
	[id] bigint IDENTITY(1, 1),
	[category_id] bigint NOT NULL,
	[name] nvarchar(100) NOT NULL,
	[description] nvarchar(300),
	[file_id] varchar(36) NOT NULL,
	[file_name] nvarchar(200) NOT NULL,
	[sort] int NOT NULL CONSTRAINT [form_doc_sort_default] DEFAULT ((0)),
	[active] bit NOT NULL CONSTRAINT [form_doc_active_default] DEFAULT ((1)),
	[updated_by] nvarchar(20) NOT NULL,
	[updated_at] datetime2(3) NOT NULL CONSTRAINT [form_doc_updated_at_default] DEFAULT (sysutcdatetime()),
	CONSTRAINT [form_doc_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
ALTER TABLE [portal].[form_doc] ADD CONSTRAINT [form_doc_category_id_form_category_id_fk] FOREIGN KEY ([category_id]) REFERENCES [portal].[form_category]([id]);--> statement-breakpoint
CREATE UNIQUE INDEX [ux_form_category_name] ON [portal].[form_category] ([name]);--> statement-breakpoint
CREATE INDEX [ix_form_doc_category] ON [portal].[form_doc] ([category_id],[active],[sort]);