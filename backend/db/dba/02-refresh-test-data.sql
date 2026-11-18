/*
  測試資料複製 / 重置:220 舊庫 → giganexus_gw_test 的 src_* schema(docs/PORTAL-API-PLAN.md §2,決議 2026-10-12)
  - 一個來源 schema 一個目標 schema:dbo → src_<庫名小寫>(例 PortalSolar.dbo → src_portalsolar);
    非 dbo → src_<庫名>_<schema>(例 LearnDB.learn → src_learndb_learn)。
  - 每張表:刪除舊複本 → SELECT * INTO 複製結構與資料 → 重建主鍵 / 唯一 / 索引、預設值、CHECK;識別欄重新校正。
    不複製:外部索引鍵、觸發程序、檢視、預存程序、函數(portal-api 需要的邏輯在程式中改寫;結果 ④ 列出有這些的表)。
  - 全部原樣複製(含個資與登入表,使用者 2026-10-12 決議);giganexus_gw_test 開發與測試共用帳密,勿把複本匯出到其他地方。
  - 可重複執行:重跑 = 以正式資料覆蓋測試區(測試區寫入會消失)。不影響 gw / drizzle / file_svc / portal schema。
  執行:使用者以 sa(或可讀來源庫、可寫 giganexus_gw_test 的 DBA 帳號)在 SSMS 執行。
    1. 先以 @dry_run = 1 執行,看 ①–③ 的計畫(會複製哪些表、大小、略過原因),貼回給 AI 確認範圍。
    2. 確認後改 @dry_run = 0 再執行;看 ④ 的結果,失敗的表貼回。
  前提:01-create-schema.sql 已執行(portal_app_role 存在時,新建的 src_* schema 會授權給它讀寫)。
  注意:giganexus_gw_test 若為 FULL 復原模式,複製會大量寫交易記錄;① 的合計大小請先確認磁碟與記錄檔空間。
*/
USE [giganexus_gw_test];
SET NOCOUNT ON;
SET XACT_ABORT OFF;

-- ===== 參數 =====
DECLARE @dry_run bit = 1;            -- 1 = 只列計畫;0 = 實際複製
DECLARE @max_table_mb int = 1024;    -- 單表超過此大小略過(列在 ③);仍要複製的表加入 @force
DECLARE @only_db sysname = NULL;     -- 只處理某個來源庫(NULL = 全部)

DECLARE @src TABLE (db sysname PRIMARY KEY);   -- 來源庫:不在本主機的會在 ① 標示並略過
INSERT INTO @src (db) VALUES
  (N'PortalSolar'), (N'LOS'), (N'Budget'), (N'MBO'),
  (N'LearnDB'), (N'Safety'), (N'WPORTALZ'), (N'ReleasemailDB'), (N'welfare_s'),
  (N'MisDb'), (N'HEALTH'), (N'Notes'), (N'GscSystem'), (N'NotesAppDb'), (N'EF_DB');

DECLARE @skip TABLE (db sysname, sch sysname, tbl sysname);    -- 不複製的表
-- INSERT INTO @skip VALUES (N'PortalSolar', N'dbo', N'LogInfo');
DECLARE @force TABLE (db sysname, sch sysname, tbl sysname);   -- 超過 @max_table_mb 仍要複製的表
-- INSERT INTO @force VALUES (N'PortalSolar', N'dbo', N'ContentX');

IF DB_NAME() <> N'giganexus_gw_test'
  THROW 50001, N'只能在 giganexus_gw_test 執行', 1;

-- ===== 收集來源結構 =====
IF OBJECT_ID('tempdb..#plan') IS NOT NULL DROP TABLE #plan;
IF OBJECT_ID('tempdb..#ddl') IS NOT NULL DROP TABLE #ddl;
IF OBJECT_ID('tempdb..#obj') IS NOT NULL DROP TABLE #obj;
CREATE TABLE #plan (
  db sysname, sch sysname, tbl sysname, tgt_sch sysname NULL,
  row_count bigint, mb decimal(12, 2), has_identity bit,
  fk_count int, trigger_count int, computed_count int,
  action nvarchar(20) NULL, status nvarchar(20) NULL, err nvarchar(2000) NULL);
CREATE TABLE #ddl (db sysname, sch sysname, tbl sysname, seq int, sql nvarchar(max));
CREATE TABLE #obj (db sysname, views int, procs int, funcs int, synonyms int);

DECLARE @db sysname, @sql nvarchar(max);
DECLARE c_db CURSOR LOCAL FAST_FORWARD FOR
  SELECT s.db FROM @src s JOIN sys.databases d ON d.name = s.db
  WHERE d.state = 0 AND HAS_DBACCESS(s.db) = 1 AND (@only_db IS NULL OR s.db = @only_db);
OPEN c_db;
FETCH NEXT FROM c_db INTO @db;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql = N'USE ' + QUOTENAME(@db) + N';
  INSERT INTO #plan (db, sch, tbl, row_count, mb, has_identity, fk_count, trigger_count, computed_count)
  SELECT DB_NAME(), s.name, t.name,
    ISNULL((SELECT SUM(p.rows) FROM sys.partitions p WHERE p.object_id = t.object_id AND p.index_id IN (0, 1)), 0),
    ISNULL((SELECT CAST(SUM(a.total_pages) * 8 / 1024.0 AS decimal(12, 2)) FROM sys.partitions p
              JOIN sys.allocation_units a ON a.container_id = p.partition_id WHERE p.object_id = t.object_id), 0),
    CASE WHEN EXISTS (SELECT 1 FROM sys.identity_columns ic WHERE ic.object_id = t.object_id) THEN 1 ELSE 0 END,
    (SELECT COUNT(*) FROM sys.foreign_keys f WHERE f.parent_object_id = t.object_id),
    (SELECT COUNT(*) FROM sys.triggers tr WHERE tr.parent_id = t.object_id),
    (SELECT COUNT(*) FROM sys.computed_columns cc WHERE cc.object_id = t.object_id)
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.is_ms_shipped = 0;

  -- 索引:叢集先建(seq 100),其餘依 index_id;{T} 於執行時換成目標表
  INSERT INTO #ddl (db, sch, tbl, seq, sql)
  SELECT DB_NAME(), s.name, t.name,
    CASE WHEN i.type = 1 THEN 100 ELSE 100 + i.index_id END,
    CASE
      WHEN i.is_primary_key = 1 THEN
        N''ALTER TABLE {T} ADD CONSTRAINT '' + QUOTENAME(i.name COLLATE DATABASE_DEFAULT) + N'' PRIMARY KEY ''
        + CASE WHEN i.type = 1 THEN N''CLUSTERED'' ELSE N''NONCLUSTERED'' END + N'' ('' + k.cols + N'')''
      WHEN i.is_unique_constraint = 1 THEN
        N''ALTER TABLE {T} ADD CONSTRAINT '' + QUOTENAME(i.name COLLATE DATABASE_DEFAULT) + N'' UNIQUE ''
        + CASE WHEN i.type = 1 THEN N''CLUSTERED'' ELSE N''NONCLUSTERED'' END + N'' ('' + k.cols + N'')''
      ELSE
        N''CREATE '' + CASE WHEN i.is_unique = 1 THEN N''UNIQUE '' ELSE N'''' END
        + CASE WHEN i.type = 1 THEN N''CLUSTERED'' ELSE N''NONCLUSTERED'' END
        + N'' INDEX '' + QUOTENAME(i.name COLLATE DATABASE_DEFAULT) + N'' ON {T} ('' + k.cols + N'')''
        + CASE WHEN inc.cols IS NULL THEN N'''' ELSE N'' INCLUDE ('' + inc.cols + N'')'' END
        + CASE WHEN i.has_filter = 1 THEN N'' WHERE '' + i.filter_definition COLLATE DATABASE_DEFAULT ELSE N'''' END
    END
  FROM sys.indexes i
  JOIN sys.tables t ON t.object_id = i.object_id
  JOIN sys.schemas s ON s.schema_id = t.schema_id
  CROSS APPLY (SELECT STUFF((
      SELECT N'', '' + QUOTENAME(c.name COLLATE DATABASE_DEFAULT) + CASE WHEN ic.is_descending_key = 1 THEN N'' DESC'' ELSE N'''' END
      FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
      WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
      ORDER BY ic.key_ordinal
      FOR XML PATH(''''), TYPE).value(''.'', ''nvarchar(max)''), 1, 2, N'''') AS cols) k
  CROSS APPLY (SELECT STUFF((
      SELECT N'', '' + QUOTENAME(c.name COLLATE DATABASE_DEFAULT)
      FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
      WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 1
      ORDER BY ic.index_column_id
      FOR XML PATH(''''), TYPE).value(''.'', ''nvarchar(max)''), 1, 2, N'''') AS cols) inc
  WHERE t.is_ms_shipped = 0 AND i.type IN (1, 2) AND i.is_hypothetical = 0 AND i.is_disabled = 0;

  -- 預設值(新程式 INSERT 省略欄位時與正式區行為一致)
  INSERT INTO #ddl (db, sch, tbl, seq, sql)
  SELECT DB_NAME(), s.name, t.name, 2000 + dc.parent_column_id,
    N''ALTER TABLE {T} ADD CONSTRAINT '' + QUOTENAME(dc.name COLLATE DATABASE_DEFAULT) + N'' DEFAULT ''
    + dc.definition COLLATE DATABASE_DEFAULT + N'' FOR '' + QUOTENAME(c.name COLLATE DATABASE_DEFAULT)
  FROM sys.default_constraints dc
  JOIN sys.tables t ON t.object_id = dc.parent_object_id
  JOIN sys.schemas s ON s.schema_id = t.schema_id
  JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
  WHERE t.is_ms_shipped = 0;

  -- CHECK(以 NOCHECK 建立,不驗證既有資料;停用的不建)
  INSERT INTO #ddl (db, sch, tbl, seq, sql)
  SELECT DB_NAME(), s.name, t.name, 3000 + ROW_NUMBER() OVER (PARTITION BY t.object_id ORDER BY cc.object_id),
    N''ALTER TABLE {T} WITH NOCHECK ADD CONSTRAINT '' + QUOTENAME(cc.name COLLATE DATABASE_DEFAULT) + N'' CHECK ''
    + cc.definition COLLATE DATABASE_DEFAULT
  FROM sys.check_constraints cc
  JOIN sys.tables t ON t.object_id = cc.parent_object_id
  JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.is_ms_shipped = 0 AND cc.is_disabled = 0;

  INSERT INTO #obj (db, views, procs, funcs, synonyms)
  SELECT DB_NAME(),
    (SELECT COUNT(*) FROM sys.views WHERE is_ms_shipped = 0),
    (SELECT COUNT(*) FROM sys.procedures WHERE is_ms_shipped = 0),
    (SELECT COUNT(*) FROM sys.objects WHERE is_ms_shipped = 0 AND type IN (''FN'', ''IF'', ''TF'')),
    (SELECT COUNT(*) FROM sys.synonyms);';
  EXEC sys.sp_executesql @sql;
  FETCH NEXT FROM c_db INTO @db;
END
CLOSE c_db;
DEALLOCATE c_db;

-- ===== 決定動作 =====
UPDATE p SET
  tgt_sch = N'src_' + LOWER(p.db) + CASE WHEN p.sch = N'dbo' THEN N'' ELSE N'_' + LOWER(p.sch) END,
  action = CASE
    WHEN EXISTS (SELECT 1 FROM @skip k WHERE k.db = p.db AND k.sch = p.sch AND k.tbl = p.tbl) THEN N'skip-list'
    WHEN p.mb > @max_table_mb AND NOT EXISTS (SELECT 1 FROM @force f WHERE f.db = p.db AND f.sch = p.sch AND f.tbl = p.tbl) THEN N'skip-size'
    ELSE N'copy' END
FROM #plan p;

-- ① 來源庫
SELECT s.db,
  CASE WHEN d.database_id IS NULL THEN N'不在本主機,略過'
       WHEN HAS_DBACCESS(s.db) = 0 OR d.state <> 0 THEN N'無法存取,略過'
       WHEN @only_db IS NOT NULL AND s.db <> @only_db THEN N'本次未選'
       ELSE N'處理' END AS status,
  (SELECT COUNT(*) FROM #plan p WHERE p.db = s.db) AS tables,
  (SELECT COUNT(*) FROM #plan p WHERE p.db = s.db AND p.action = N'copy') AS to_copy,
  (SELECT SUM(p.row_count) FROM #plan p WHERE p.db = s.db AND p.action = N'copy') AS rows_to_copy,
  (SELECT SUM(p.mb) FROM #plan p WHERE p.db = s.db AND p.action = N'copy') AS mb_to_copy,
  o.views, o.procs, o.funcs, o.synonyms
FROM @src s
LEFT JOIN sys.databases d ON d.name = s.db
LEFT JOIN #obj o ON o.db = s.db
ORDER BY status, s.db;

-- ② 目標 schema 對照
SELECT db, sch, tgt_sch, COUNT(*) AS tables, SUM(mb) AS mb
FROM #plan WHERE action = N'copy' GROUP BY db, sch, tgt_sch ORDER BY db, sch;

-- ③ 明細(大的在前;skip-size 要複製請加入 @force)
SELECT db, sch, tbl, tgt_sch, action, row_count, mb, has_identity, fk_count, trigger_count, computed_count
FROM #plan ORDER BY CASE WHEN action = N'copy' THEN 1 ELSE 0 END, mb DESC, db, tbl;

IF @dry_run = 1
BEGIN
  PRINT N'dry run:未複製任何資料。確認 ①–③ 後把 @dry_run 改 0 再執行。';
  RETURN;
END

-- ===== 建立目標 schema 並授權 =====
DECLARE @tgt_sch sysname;
DECLARE c_sch CURSOR LOCAL FAST_FORWARD FOR SELECT DISTINCT tgt_sch FROM #plan WHERE action = N'copy';
OPEN c_sch;
FETCH NEXT FROM c_sch INTO @tgt_sch;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF SCHEMA_ID(@tgt_sch) IS NULL
  BEGIN
    SET @sql = N'CREATE SCHEMA ' + QUOTENAME(@tgt_sch) + N' AUTHORIZATION [dbo]';
    EXEC sys.sp_executesql @sql;
  END
  IF DATABASE_PRINCIPAL_ID(N'portal_app_role') IS NOT NULL
  BEGIN
    SET @sql = N'GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::' + QUOTENAME(@tgt_sch) + N' TO [portal_app_role]';
    EXEC sys.sp_executesql @sql;
  END
  FETCH NEXT FROM c_sch INTO @tgt_sch;
END
CLOSE c_sch;
DEALLOCATE c_sch;

-- ===== 逐表複製(一表一交易,失敗不影響其他表) =====
DECLARE @sch sysname, @tbl sysname, @has_identity bit, @target nvarchar(600), @ddl nvarchar(max);
DECLARE c_tbl CURSOR LOCAL FAST_FORWARD FOR
  SELECT db, sch, tbl, tgt_sch, has_identity FROM #plan WHERE action = N'copy' ORDER BY db, sch, tbl;
OPEN c_tbl;
FETCH NEXT FROM c_tbl INTO @db, @sch, @tbl, @tgt_sch, @has_identity;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @target = QUOTENAME(@tgt_sch) + N'.' + QUOTENAME(@tbl);
  BEGIN TRY
    BEGIN TRANSACTION;
    IF OBJECT_ID(@target, N'U') IS NOT NULL
    BEGIN
      SET @sql = N'DROP TABLE ' + @target;
      EXEC sys.sp_executesql @sql;
    END
    SET @sql = N'SELECT * INTO ' + @target + N' FROM ' + QUOTENAME(@db) + N'.' + QUOTENAME(@sch) + N'.' + QUOTENAME(@tbl);
    EXEC sys.sp_executesql @sql;

    DECLARE c_ddl CURSOR LOCAL FAST_FORWARD FOR
      SELECT sql FROM #ddl WHERE db = @db AND sch = @sch AND tbl = @tbl ORDER BY seq;
    OPEN c_ddl;
    FETCH NEXT FROM c_ddl INTO @ddl;
    WHILE @@FETCH_STATUS = 0
    BEGIN
      SET @sql = REPLACE(@ddl, N'{T}', @target);
      EXEC sys.sp_executesql @sql;
      FETCH NEXT FROM c_ddl INTO @ddl;
    END
    CLOSE c_ddl;
    DEALLOCATE c_ddl;

    IF @has_identity = 1
    BEGIN
      SET @sql = N'DBCC CHECKIDENT (''' + REPLACE(@target, N'''', N'''''') + N''') WITH NO_INFOMSGS';
      EXEC sys.sp_executesql @sql;
    END
    COMMIT TRANSACTION;
    UPDATE #plan SET status = N'ok' WHERE db = @db AND sch = @sch AND tbl = @tbl;
  END TRY
  BEGIN CATCH
    IF CURSOR_STATUS('local', 'c_ddl') >= -1
    BEGIN
      IF CURSOR_STATUS('local', 'c_ddl') >= 0 CLOSE c_ddl;
      DEALLOCATE c_ddl;
    END
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    UPDATE #plan SET status = N'failed', err = ERROR_MESSAGE() WHERE db = @db AND sch = @sch AND tbl = @tbl;
  END CATCH
  FETCH NEXT FROM c_tbl INTO @db, @sch, @tbl, @tgt_sch, @has_identity;
END
CLOSE c_tbl;
DEALLOCATE c_tbl;

-- ④ 結果:失敗的表,以及有外部索引鍵 / 觸發程序 / 計算欄(複本與正式區行為可能不同)的表
SELECT db, COUNT(*) AS copied_ok,
  SUM(CASE WHEN status = N'failed' THEN 1 ELSE 0 END) AS failed
FROM #plan WHERE action = N'copy' GROUP BY db ORDER BY db;

SELECT db, sch, tbl, tgt_sch, status, err, fk_count, trigger_count, computed_count
FROM #plan
WHERE action = N'copy' AND (status = N'failed' OR fk_count > 0 OR trigger_count > 0 OR computed_count > 0)
ORDER BY CASE WHEN status = N'failed' THEN 0 ELSE 1 END, db, tbl;
