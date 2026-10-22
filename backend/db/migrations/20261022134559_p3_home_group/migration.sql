/*
  p3_home_group — 由 drizzle-kit generate 產生,人工審查 SQL Server 2012 相容性:未調整產生的 DDL;檔尾人工加入集團系統初始資料。
  - P3 首頁聚合與集團公告(FEATURE-PLAN §1、§5;PORTAL-API-PLAN §4 P3):首頁輪播、年度行事曆 PDF、集團系統、個人常用連結、3691 作者密文與稽核
  - schema portal 由 db/dba/01-create-schema.sql 建立(sa),本檔不建立;不碰 gw.*、file_svc.*、src_*、舊庫
  已執行 `npm run db:check-2012`:無 2016+ 語法。
*/
CREATE TABLE [portal].[calendar_pdf] (
	[year] int,
	[file_id] varchar(36) NOT NULL,
	[file_name] nvarchar(200) NOT NULL,
	[updated_by] nvarchar(20) NOT NULL,
	[updated_at] datetime2(3) NOT NULL CONSTRAINT [calendar_pdf_updated_at_default] DEFAULT (sysutcdatetime()),
	CONSTRAINT [calendar_pdf_pkey] PRIMARY KEY([year])
);
--> statement-breakpoint
CREATE TABLE [portal].[home_slide] (
	[id] bigint IDENTITY(1, 1),
	[kind] varchar(10) NOT NULL,
	[title] nvarchar(100) NOT NULL,
	[file_id] varchar(36) NOT NULL,
	[link_url] nvarchar(500),
	[start_date] date,
	[end_date] date,
	[sort] int NOT NULL CONSTRAINT [home_slide_sort_default] DEFAULT ((0)),
	[active] bit NOT NULL CONSTRAINT [home_slide_active_default] DEFAULT ((1)),
	[created_by] nvarchar(20) NOT NULL,
	[created_at] datetime2(3) NOT NULL CONSTRAINT [home_slide_created_at_default] DEFAULT (sysutcdatetime()),
	[updated_by] nvarchar(20) NOT NULL,
	[updated_at] datetime2(3) NOT NULL CONSTRAINT [home_slide_updated_at_default] DEFAULT (sysutcdatetime()),
	CONSTRAINT [home_slide_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [portal].[personal_link] (
	[id] bigint IDENTITY(1, 1),
	[emp_no] nvarchar(20) NOT NULL,
	[name] nvarchar(50) NOT NULL,
	[url] nvarchar(500) NOT NULL,
	[sort] int NOT NULL CONSTRAINT [personal_link_sort_default] DEFAULT ((0)),
	[created_at] datetime2(3) NOT NULL CONSTRAINT [personal_link_created_at_default] DEFAULT (sysutcdatetime()),
	CONSTRAINT [personal_link_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [portal].[system_link] (
	[id] bigint IDENTITY(1, 1),
	[name] nvarchar(100) NOT NULL,
	[description] nvarchar(300),
	[category] nvarchar(30) NOT NULL,
	[url] nvarchar(500),
	[open_mode] varchar(10) NOT NULL CONSTRAINT [system_link_open_mode_default] DEFAULT ('new'),
	[legacy_des] bit NOT NULL CONSTRAINT [system_link_legacy_des_default] DEFAULT ((0)),
	[sort] int NOT NULL CONSTRAINT [system_link_sort_default] DEFAULT ((0)),
	[active] bit NOT NULL CONSTRAINT [system_link_active_default] DEFAULT ((1)),
	[updated_by] nvarchar(20) NOT NULL,
	[updated_at] datetime2(3) NOT NULL CONSTRAINT [system_link_updated_at_default] DEFAULT (sysutcdatetime()),
	CONSTRAINT [system_link_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [portal].[talk_audit] (
	[id] bigint IDENTITY(1, 1),
	[sn] int NOT NULL,
	[action] varchar(10) NOT NULL,
	[result] varchar(10),
	[emp_no] nvarchar(20) NOT NULL,
	[approval_no] nvarchar(50),
	[reason] nvarchar(200),
	[created_at] datetime2(3) NOT NULL CONSTRAINT [talk_audit_created_at_default] DEFAULT (sysutcdatetime()),
	CONSTRAINT [talk_audit_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [portal].[talk_author] (
	[sn] int,
	[cipher] varchar(200) NOT NULL,
	[key_id] varchar(20) NOT NULL,
	[created_at] datetime2(3) NOT NULL CONSTRAINT [talk_author_created_at_default] DEFAULT (sysutcdatetime()),
	CONSTRAINT [talk_author_pkey] PRIMARY KEY([sn])
);
--> statement-breakpoint
CREATE INDEX [ix_home_slide_kind] ON [portal].[home_slide] ([kind],[active]);--> statement-breakpoint
CREATE INDEX [ix_personal_link_emp] ON [portal].[personal_link] ([emp_no],[sort]);--> statement-breakpoint
CREATE INDEX [ix_system_link_active] ON [portal].[system_link] ([active],[sort]);--> statement-breakpoint
CREATE INDEX [ix_talk_audit_sn] ON [portal].[talk_audit] ([sn]);--> statement-breakpoint
/* 集團系統初始資料:舊站以 DES 金鑰 / 同步碼 / Base64 工號跳轉的系統(D-22:只顯示「DES 跳轉(待重構)」,不帶網址) */
INSERT INTO [portal].[system_link] ([name], [description], [category], [url], [legacy_des], [sort], [updated_by]) VALUES
	(N'訂便當', N'舊站以 DES / 同步碼跳轉(Win7 版與新版)', N'行政與流程', NULL, 1, 100, N'migration'),
	(N'E-Learning', N'舊站以 DES 跳轉', N'人資與學習', NULL, 1, 110, N'migration'),
	(N'資源預約(ERMS)', N'舊站以 DES / 同步碼跳轉(舊版與新版)', N'行政與流程', NULL, 1, 120, N'migration'),
	(N'福委會', N'舊站以 DES 跳轉', N'員工福利', NULL, 1, 130, N'migration'),
	(N'WebApp', N'舊站以 DES 跳轉', N'資訊與郵件', NULL, 1, 140, N'migration'),
	(N'NotesApp', N'舊站以同步碼跳轉', N'資訊與郵件', NULL, 1, 150, N'migration'),
	(N'年考核', N'舊站以 DES 跳轉', N'人資與學習', NULL, 1, 160, N'migration'),
	(N'環安衛資料庫', N'舊站以 DES 跳轉', N'工安與文管', NULL, 1, 170, N'migration'),
	(N'好書分享', N'舊站以 DES 跳轉', N'員工福利', NULL, 1, 180, N'migration'),
	(N'健康系統', N'舊站以 Base64 工號跳轉', N'人資與學習', NULL, 1, 190, N'migration');
