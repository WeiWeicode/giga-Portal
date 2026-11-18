/*
  init — 由 drizzle-kit generate 產生,人工審查 SQL Server 2012 相容性:未調整。
  - schema portal 由 db/dba/01-create-schema.sql 建立(sa),本檔不建立;不碰 gw.*、file_svc.*、src_*
  已執行 `npm run db:check-2012`:無 2016+ 語法。
*/
CREATE TABLE [portal].[personal_note] (
	[id] bigint IDENTITY(1, 1),
	[emp_no] nvarchar(20) NOT NULL,
	[title] nvarchar(100) NOT NULL,
	[content] nvarchar(1000),
	[category] nvarchar(20) NOT NULL,
	[priority] varchar(10) NOT NULL,
	[due_date] date,
	[done] bit NOT NULL CONSTRAINT [personal_note_done_default] DEFAULT ((0)),
	[created_at] datetime2(3) NOT NULL CONSTRAINT [personal_note_created_at_default] DEFAULT (sysutcdatetime()),
	[updated_at] datetime2(3) NOT NULL CONSTRAINT [personal_note_updated_at_default] DEFAULT (sysutcdatetime()),
	CONSTRAINT [personal_note_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE INDEX [ix_personal_note_emp] ON [portal].[personal_note] ([emp_no],[done]);