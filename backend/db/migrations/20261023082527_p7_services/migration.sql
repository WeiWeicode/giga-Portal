/*
  p7_services — 由 drizzle-kit generate 產生,人工審查 SQL Server 2012 相容性:未調整產生的 DDL;最後加一筆種子資料。
  - P7 臨時服務(FEATURE-PLAN §9;PORTAL-API-PLAN §4 P7、D-8):編號版同意書的期間與型式、同意書線上簽名(file-service UUID)、
    電視看板新站圖片(file-service UUID)
  - 舊表(PortalSolar Consent* / EmployeeStock* / ContentX* / TV*、MisDb SendMailLog)不做 DDL;本檔的表不建 FK 到舊表
  - schema portal 由 db/dba/01-create-schema.sql 建立(sa),本檔不建立;不碰 gw.*、file_svc.*、src_*、舊庫
  已執行 `npm run db:check-2012`:無 2016+ 語法。
*/
CREATE TABLE [portal].[consent_def] (
	[consent_id] int,
	[kind] varchar(20) NOT NULL,
	[title] nvarchar(200) NOT NULL,
	[start_date] date,
	[end_date] date,
	[require_sign] bit NOT NULL CONSTRAINT [consent_def_require_sign_default] DEFAULT ((0)),
	[active] bit NOT NULL CONSTRAINT [consent_def_active_default] DEFAULT ((1)),
	[updated_by] nvarchar(20) NOT NULL,
	[updated_at] datetime2(3) NOT NULL CONSTRAINT [consent_def_updated_at_default] DEFAULT (sysutcdatetime()),
	CONSTRAINT [consent_def_pkey] PRIMARY KEY([consent_id])
);
--> statement-breakpoint
CREATE TABLE [portal].[consent_sign] (
	[id] bigint IDENTITY(1, 1),
	[source] varchar(1) NOT NULL,
	[ref] varchar(50) NOT NULL,
	[emp_no] nvarchar(20) NOT NULL,
	[file_id] varchar(36) NOT NULL,
	[signed_at] datetime2(3) NOT NULL CONSTRAINT [consent_sign_signed_at_default] DEFAULT (sysutcdatetime()),
	CONSTRAINT [consent_sign_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [portal].[tv_image] (
	[id] bigint IDENTITY(1, 1),
	[file_id] varchar(36) NOT NULL,
	[file_name] nvarchar(200) NOT NULL,
	[sort] int NOT NULL CONSTRAINT [tv_image_sort_default] DEFAULT ((99)),
	[active] bit NOT NULL CONSTRAINT [tv_image_active_default] DEFAULT ((1)),
	[created_by] nvarchar(20) NOT NULL,
	[created_at] datetime2(3) NOT NULL CONSTRAINT [tv_image_created_at_default] DEFAULT (sysutcdatetime()),
	[updated_by] nvarchar(20) NOT NULL,
	[updated_at] datetime2(3) NOT NULL CONSTRAINT [tv_image_updated_at_default] DEFAULT (sysutcdatetime()),
	CONSTRAINT [tv_image_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE UNIQUE INDEX [ux_consent_sign] ON [portal].[consent_sign] ([source],[ref],[emp_no]);--> statement-breakpoint
-- 舊站唯一仍在首頁連結的編號版同意書(MainFormX.aspx.cs:518 GSMCConsent20260814);舊站沒有結束日,end_date 待人資確認(CONFIRM-NEEDED P7)
INSERT INTO [portal].[consent_def] ([consent_id], [kind], [title], [start_date], [end_date], [require_sign], [active], [updated_by]) VALUES
	(20260814, 'account-survey', N'2026年禾迅現金增資集保帳號調查', '2026-08-14', NULL, 0, 1, N'migration');
