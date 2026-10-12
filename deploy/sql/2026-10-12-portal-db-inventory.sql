-- 唯讀盤點:portal-api 規劃用(giga-Portal docs/PORTAL-API-PLAN.md §2、§3,2026-10-12)
-- 目的:決定哪些舊庫 / 資料表要複製到 giganexus_gw_test(大小、筆數、最後寫入、敏感欄位、連結伺服器)
-- 內容:只讀系統目錄(sys.*),不讀業務資料、不寫入任何東西;可重複執行。
-- 執行:在 10.10.130.220 以可讀取下列資料庫的帳號(DBA)於 SSMS 執行,把 ①–⑥ 的結果貼回(不含密碼,可直接貼)。
--       ③ 的「最後寫入」需要 VIEW SERVER STATE;沒有權限時該欄為 NULL,其餘照常。
SET NOCOUNT ON;

DECLARE @dbs TABLE (name sysname PRIMARY KEY);
INSERT INTO @dbs (name) VALUES
  (N'PortalSolar'), (N'LOS'), (N'Budget'), (N'MBO'),            -- DATABASE-MAP 已列(220)
  (N'LearnDB'), (N'NaNa'),                                       -- DATABASE-MAP 列在 174 / 190,確認 220 是否也有
  (N'Safety'), (N'WPORTALZ'), (N'ReleasemailDB'), (N'welfare_s'), -- 舊程式以三段式名稱引用、DATABASE-MAP 未列
  (N'MisDb'), (N'HEALTH'), (N'Notes'), (N'GscSystem'), (N'NotesAppDb'), (N'EF_DB');

-- ① 資料庫是否在本主機、大小
SELECT d.name AS db,
       CASE WHEN s.database_id IS NULL THEN N'不在本主機' ELSE N'存在' END AS status,
       s.compatibility_level, s.collation_name, s.recovery_model_desc,
       (SELECT CAST(SUM(CAST(f.size AS bigint)) * 8 / 1024.0 AS decimal(12, 1))
          FROM sys.master_files f WHERE f.database_id = s.database_id AND f.type = 0) AS data_mb,
       (SELECT CAST(SUM(CAST(f.size AS bigint)) * 8 / 1024.0 AS decimal(12, 1))
          FROM sys.master_files f WHERE f.database_id = s.database_id AND f.type = 1) AS log_mb
FROM @dbs d LEFT JOIN sys.databases s ON s.name = d.name
ORDER BY status DESC, d.name;

-- 收集各庫物件
CREATE TABLE #tbl (db sysname, sch sysname, tbl sysname, row_count bigint, mb decimal(12, 2),
                   has_pk bit, has_identity bit, trigger_count int, last_write datetime NULL);
CREATE TABLE #obj (db sysname, type_desc nvarchar(60), cnt int);
CREATE TABLE #ref (db sysname, sch sysname, name sysname, type_desc nvarchar(60), refers nvarchar(200));
CREATE TABLE #col (db sysname, sch sysname, tbl sysname, col sysname, data_type sysname);

DECLARE @db sysname, @sql nvarchar(max);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR
  SELECT d.name FROM @dbs d JOIN sys.databases s ON s.name = d.name WHERE s.state = 0 AND HAS_DBACCESS(d.name) = 1;
OPEN c;
FETCH NEXT FROM c INTO @db;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql = N'USE ' + QUOTENAME(@db) + N';
  INSERT INTO #tbl
  SELECT DB_NAME(), s.name, t.name,
         (SELECT SUM(p.rows) FROM sys.partitions p WHERE p.object_id = t.object_id AND p.index_id IN (0, 1)),
         (SELECT CAST(SUM(a.total_pages) * 8 / 1024.0 AS decimal(12, 2)) FROM sys.partitions p
            JOIN sys.allocation_units a ON a.container_id = p.partition_id WHERE p.object_id = t.object_id),
         CASE WHEN EXISTS (SELECT 1 FROM sys.indexes i WHERE i.object_id = t.object_id AND i.is_primary_key = 1) THEN 1 ELSE 0 END,
         CASE WHEN EXISTS (SELECT 1 FROM sys.identity_columns ic WHERE ic.object_id = t.object_id) THEN 1 ELSE 0 END,
         (SELECT COUNT(*) FROM sys.triggers tr WHERE tr.parent_id = t.object_id),
         (SELECT MAX(u.last_user_update) FROM sys.dm_db_index_usage_stats u
            WHERE u.database_id = DB_ID() AND u.object_id = t.object_id)
  FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id WHERE t.is_ms_shipped = 0;

  INSERT INTO #obj SELECT DB_NAME(), o.type_desc, COUNT(*) FROM sys.objects o
  WHERE o.is_ms_shipped = 0 AND o.type IN (''U'', ''V'', ''P'', ''FN'', ''IF'', ''TF'', ''SN'', ''TR'') GROUP BY o.type_desc;

  -- 檢視 / 預存程序 / 函數 / 同義字 引用其他庫或連結伺服器(複製資料表時不會帶過去,portal-api 要改寫)
  INSERT INTO #ref
  SELECT DB_NAME(), s.name, o.name, o.type_desc,
         CASE WHEN m.definition LIKE ''%OPENQUERY%'' THEN N''OPENQUERY'' ELSE N'''' END
       + CASE WHEN m.definition LIKE ''%OLDERPDB%'' OR m.definition LIKE ''%ERPSOURCE%'' THEN N'' ERP'' ELSE N'''' END
       + CASE WHEN m.definition LIKE ''%NaNa.%'' THEN N'' NaNa'' ELSE N'''' END
       + CASE WHEN m.definition LIKE ''%LearnDB.%'' THEN N'' LearnDB'' ELSE N'''' END
       + CASE WHEN m.definition LIKE ''%LOS.%'' AND DB_NAME() <> ''LOS'' THEN N'' LOS'' ELSE N'''' END
       + CASE WHEN m.definition LIKE ''%PortalSolar.%'' AND DB_NAME() <> ''PortalSolar'' THEN N'' PortalSolar'' ELSE N'''' END
  FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id JOIN sys.schemas s ON s.schema_id = o.schema_id
  WHERE o.is_ms_shipped = 0
    AND (m.definition LIKE ''%OPENQUERY%'' OR m.definition LIKE ''%OLDERPDB%'' OR m.definition LIKE ''%ERPSOURCE%''
         OR m.definition LIKE ''%NaNa.%'' OR m.definition LIKE ''%LearnDB.%''
         OR (m.definition LIKE ''%LOS.%'' AND DB_NAME() <> ''LOS'')
         OR (m.definition LIKE ''%PortalSolar.%'' AND DB_NAME() <> ''PortalSolar''));
  INSERT INTO #ref
  SELECT DB_NAME(), s.name, sn.name, N''SYNONYM'', LEFT(sn.base_object_name, 200)
  FROM sys.synonyms sn JOIN sys.schemas s ON s.schema_id = sn.schema_id;

  -- 可能的敏感欄位(只看欄位名稱)
  INSERT INTO #col
  SELECT DB_NAME(), s.name, t.name, c.name, ty.name
  FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id JOIN sys.schemas s ON s.schema_id = t.schema_id
  JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  WHERE t.is_ms_shipped = 0
    AND (c.name LIKE ''%pass%'' OR c.name LIKE ''%pwd%'' OR c.name LIKE ''%cipher%'' OR c.name LIKE ''%salary%''
         OR c.name LIKE ''%idno%'' OR c.name LIKE ''%ident%'' OR c.name LIKE ''%birth%'' OR c.name LIKE ''%addr%''
         OR c.name LIKE ''%account%'' OR c.name LIKE ''%bank%'' OR c.name LIKE ''%token%''
         OR c.name LIKE N''%身分%'' OR c.name LIKE N''%身份%'' OR c.name LIKE N''%薪%'' OR c.name LIKE N''%密碼%''
         OR c.name LIKE N''%生日%'' OR c.name LIKE N''%地址%'' OR c.name LIKE N''%帳號%'');';
  EXEC sys.sp_executesql @sql;
  FETCH NEXT FROM c INTO @db;
END
CLOSE c;
DEALLOCATE c;

-- ② 各庫物件數
SELECT db, type_desc, cnt FROM #obj ORDER BY db, type_desc;

-- ③ 資料表:筆數、大小、主鍵 / 識別欄 / 觸發程序、最後寫入(複製範圍與方式的依據)
SELECT db, sch, tbl, row_count, mb, has_pk, has_identity, trigger_count, last_write
FROM #tbl ORDER BY db, mb DESC, tbl;

-- ④ 引用其他庫 / ERP / BPM 的檢視、預存程序、同義字
SELECT db, sch, name, type_desc, refers FROM #ref ORDER BY db, type_desc, name;

-- ⑤ 可能的敏感欄位(決定不複製或遮罩)
SELECT db, sch, tbl, col, data_type FROM #col ORDER BY db, tbl, col;

-- ⑥ 連結伺服器(舊程式 OPENQUERY 用 OLDERPDB / OLDERPDB_DS* / ERPSOURCE / RMAILDB;只列名稱與目標,不含帳密)
SELECT name, product, provider, data_source, catalog, is_data_access_enabled
FROM sys.servers WHERE is_linked = 1 ORDER BY name;

DROP TABLE #tbl, #obj, #ref, #col;
