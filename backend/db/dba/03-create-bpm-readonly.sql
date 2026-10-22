/*
  BPM 簽核資訊唯讀帳號(P1-3;PORTAL-API-PLAN §3.3、D-13)— BPM 主機 NaNa 資料庫
  由使用者以 sa 在各 BPM 主機執行一次;AI 不以 sa 連線、不經手密碼(比照 giga-file-service file-api/db/dba/02-create-bpm-readonly.sql)。
    - 測試區 10.10.130.191:P1-3 開始時建立
    - 正式區 10.10.130.190:正式區(2026-12)建立,密碼與測試區不同

  權限:只給待簽核 / 未結案查詢用到的 4 張表、且只到欄位層級的 SELECT(modules/bpm/nana-repo.ts),不加入 db_datareader;
  Users 只給 OID、id、userName、leaveDate(不讀密碼雜湊等欄位)。查詢新增欄位時要同步補授權。
  P4 待我簽核(2026-10-23)加了 Users.userName(申請人姓名)、WorkItem.performerOID / completedTime(已簽核);
  已依舊版執行過本檔的主機改執行 04-bpm-readonly-p4.sql。
  執行前把 <請自訂強密碼> 換成實際密碼;執行後密碼放進主機 2 機密(deploy/host2-set-api-secrets.sh 的 bpm_db_password)
  與開發機 backend/.env 的 BPM_DB_PASSWORD(不進版控)。
*/

-- 1) 登入(master)
USE [master];
CREATE LOGIN [portal_bpm_ro] WITH PASSWORD = N'<請自訂強密碼>',
    DEFAULT_DATABASE = [NaNa], CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;
GO

-- 2) NaNa 使用者與唯讀權限
USE [NaNa];
CREATE USER [portal_bpm_ro] FOR LOGIN [portal_bpm_ro] WITH DEFAULT_SCHEMA = [dbo];
GRANT SELECT ON [dbo].[Users] ([OID], [id], [userName], [leaveDate]) TO [portal_bpm_ro];  -- 工號(id)→ OID;同工號多帳號時以離職日挑在職的一個;申請人姓名
GRANT SELECT ON [dbo].[LocalToDoWorkItem] ([userOID], [workItemOID], [subject], [processInstanceName], [createdTime]) TO [portal_bpm_ro];  -- 待辦收件匣
GRANT SELECT ON [dbo].[WorkItem] ([OID], [contextOID], [workItemName], [currentState], [performerOID], [completedTime]) TO [portal_bpm_ro];  -- 關卡狀態與名稱;經辦人與完成時間(已簽核)
GRANT SELECT ON [dbo].[ProcessInstance] ([OID], [contextOID], [serialNumber], [processInstanceName], [subject], [currentState], [createdTime], [requesterOID]) TO [portal_bpm_ro];  -- 單號、申請人、流程狀態
DENY SELECT ON [dbo].[Users] ([password], [passwordWrongTimes], [lastUptPwdDate]) TO [portal_bpm_ro];  -- 縱深防禦:即使日後被加入讀取角色也讀不到密碼欄位(P4)
GO

-- 3) 驗證:可以查,不能寫入
EXECUTE AS LOGIN = 'portal_bpm_ro';
SELECT TOP 1 OID, id FROM [NaNa].[dbo].[Users];                       -- 應成功
-- SELECT TOP 1 * FROM [NaNa].[dbo].[Users];                         -- 應被拒(欄位未授權)
-- SELECT TOP 1 OID FROM [NaNa].[dbo].[FormInstance];                -- 應被拒(未授權)
-- UPDATE [NaNa].[dbo].[Users] SET id = id WHERE 1 = 0;              -- 應被拒(權限不足)
REVERT;
GO
