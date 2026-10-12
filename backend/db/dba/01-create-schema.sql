/*
  入口網 schema 與帳號(docs/PORTAL-API-PLAN.md §2)— SQL Server 2012(10.10.130.220)
  由使用者以 sa 在 master 執行一次;AI 不以 sa 連線、不經手密碼(比照 giga-file-service file-api/db/dba/01-create-schema.sql)。

  建立(不另建資料庫,放在 Gateway 既有的資料庫):
    - giganexus_gw_test      開發 + 測試區共用:schema portal(入口網新表)+ src_*(舊庫複本,由 02-refresh-test-data.sql 建立)
    - giganexus_gw_poc_test  整合測試專用(npm run test:int 會清空並重建 portal 的資料表,不可指向前者)
    - 登入 portal_app(讀寫 portal 與 src_*)/ portal_migrate(portal 建表、migration)
  正式庫 giganexus_gw(帳號 portal_prod_app / portal_prod_migrate)與舊庫(PortalSolar 等)的正式區授權隨正式區(2026-12)另建,不在本檔。

  權限(不碰 gw.*、file_svc.*):
    - portal_migrate:資料庫層 CREATE TABLE + schema portal CONTROL;不加入 db_ddladmin
    - portal_app:經 portal_app_role 讀寫 schema portal;src_* 的授權由 02-refresh-test-data.sql 建 schema 時一併給 portal_app_role
  執行前把兩個 <請自訂強密碼> 換成實際密碼;執行後把帳密放進 giga-Portal/backend/.env(不進版控)與主機 2 機密。
  執行後驗證(以 portal_app 登入 giganexus_gw_test):SELECT TOP 1 * FROM gw.api_route 應回「SELECT permission was denied」。
*/

USE [master];
GO
CREATE LOGIN [portal_app]     WITH PASSWORD = N'<請自訂強密碼>', DEFAULT_DATABASE = [master], CHECK_POLICY = ON;
CREATE LOGIN [portal_migrate] WITH PASSWORD = N'<請自訂強密碼>', DEFAULT_DATABASE = [master], CHECK_POLICY = ON;
GO

-- ---------- giganexus_gw_test ----------
USE [giganexus_gw_test];
GO
CREATE SCHEMA [portal] AUTHORIZATION [dbo];
GO
CREATE USER [portal_migrate] FOR LOGIN [portal_migrate] WITH DEFAULT_SCHEMA = [portal];
GRANT CREATE TABLE TO [portal_migrate];
GRANT CONTROL ON SCHEMA::[portal] TO [portal_migrate];
GO
CREATE ROLE [portal_app_role];
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[portal] TO [portal_app_role];
CREATE USER [portal_app] FOR LOGIN [portal_app] WITH DEFAULT_SCHEMA = [portal];
EXEC sp_addrolemember N'portal_app_role', N'portal_app';
GO

-- ---------- giganexus_gw_poc_test(權限同上) ----------
USE [giganexus_gw_poc_test];
GO
CREATE SCHEMA [portal] AUTHORIZATION [dbo];
GO
CREATE USER [portal_migrate] FOR LOGIN [portal_migrate] WITH DEFAULT_SCHEMA = [portal];
GRANT CREATE TABLE TO [portal_migrate];
GRANT CONTROL ON SCHEMA::[portal] TO [portal_migrate];
GO
CREATE ROLE [portal_app_role];
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[portal] TO [portal_app_role];
CREATE USER [portal_app] FOR LOGIN [portal_app] WITH DEFAULT_SCHEMA = [portal];
EXEC sp_addrolemember N'portal_app_role', N'portal_app';
GO
