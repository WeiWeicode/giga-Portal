/*
  p6_esh — 由 drizzle-kit generate 產生,人工審查 SQL Server 2012 相容性:未調整產生的 DDL。
  - P6 ESH 證照管理(FEATURE-PLAN §8;PORTAL-API-PLAN §4 P6):證照 Logo、人員證照影本、化學品 SDS(file-service UUID)、
    排程 / 手動工作執行紀錄(run_key 唯一,排程同一週 / 同一天只執行一次)、複訓通知寄送紀錄
  - 舊表(PortalSolar License*、ESHChemicalData*)不做 DDL;本檔的表不建 FK 到舊表
  - schema portal 由 db/dba/01-create-schema.sql 建立(sa),本檔不建立;不碰 gw.*、file_svc.*、src_*、舊庫
  已執行 `npm run db:check-2012`:無 2016+ 語法。
*/
CREATE TABLE [portal].[esh_chemical_sds] (
	[ef_id] nvarchar(40),
	[file_id] varchar(36) NOT NULL,
	[file_name] nvarchar(200) NOT NULL,
	[updated_by] nvarchar(20) NOT NULL,
	[updated_at] datetime2(3) NOT NULL CONSTRAINT [esh_chemical_sds_updated_at_default] DEFAULT (sysutcdatetime()),
	CONSTRAINT [esh_chemical_sds_pkey] PRIMARY KEY([ef_id])
);
--> statement-breakpoint
CREATE TABLE [portal].[esh_job_run] (
	[id] bigint IDENTITY(1, 1),
	[job] varchar(20) NOT NULL,
	[trigger] varchar(10) NOT NULL,
	[run_key] varchar(100) NOT NULL,
	[requested_by] nvarchar(20),
	[scope] nvarchar(500) NOT NULL,
	[status] varchar(10) NOT NULL,
	[summary] nvarchar(500),
	[started_at] datetime2(3) NOT NULL CONSTRAINT [esh_job_run_started_at_default] DEFAULT (sysutcdatetime()),
	[finished_at] datetime2(3),
	CONSTRAINT [esh_job_run_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [portal].[esh_license_doc] (
	[id] bigint IDENTITY(1, 1),
	[holder_id] int NOT NULL,
	[emp_no] nvarchar(20) NOT NULL,
	[file_id] varchar(36) NOT NULL,
	[file_name] nvarchar(200) NOT NULL,
	[created_by] nvarchar(20) NOT NULL,
	[created_at] datetime2(3) NOT NULL CONSTRAINT [esh_license_doc_created_at_default] DEFAULT (sysutcdatetime()),
	CONSTRAINT [esh_license_doc_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [portal].[esh_license_logo] (
	[license_id] int,
	[file_id] varchar(36) NOT NULL,
	[file_name] nvarchar(200) NOT NULL,
	[updated_by] nvarchar(20) NOT NULL,
	[updated_at] datetime2(3) NOT NULL CONSTRAINT [esh_license_logo_updated_at_default] DEFAULT (sysutcdatetime()),
	CONSTRAINT [esh_license_logo_pkey] PRIMARY KEY([license_id])
);
--> statement-breakpoint
CREATE TABLE [portal].[esh_notify_log] (
	[id] bigint IDENTITY(1, 1),
	[run_id] bigint NOT NULL,
	[kind] varchar(10) NOT NULL,
	[emp_no] nvarchar(20) NOT NULL,
	[company] nvarchar(20),
	[item_count] int NOT NULL,
	[status] varchar(10) NOT NULL,
	[message] nvarchar(200),
	[created_at] datetime2(3) NOT NULL CONSTRAINT [esh_notify_log_created_at_default] DEFAULT (sysutcdatetime()),
	CONSTRAINT [esh_notify_log_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
ALTER TABLE [portal].[esh_notify_log] ADD CONSTRAINT [esh_notify_log_run_id_esh_job_run_id_fk] FOREIGN KEY ([run_id]) REFERENCES [portal].[esh_job_run]([id]);--> statement-breakpoint
CREATE UNIQUE INDEX [ux_esh_job_run_key] ON [portal].[esh_job_run] ([run_key]);--> statement-breakpoint
CREATE INDEX [ix_esh_job_run_job] ON [portal].[esh_job_run] ([job],[started_at]);--> statement-breakpoint
CREATE INDEX [ix_esh_license_doc_holder] ON [portal].[esh_license_doc] ([holder_id]);--> statement-breakpoint
CREATE INDEX [ix_esh_notify_log_run] ON [portal].[esh_notify_log] ([run_id]);