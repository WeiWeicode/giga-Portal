/*
  BPM 唯讀帳號 P4 調整(待我簽核;PORTAL-API-PLAN §4 P4、D-13)— BPM 主機 NaNa 資料庫
  由使用者以 sa 在各 BPM 主機執行一次(AI 不以 sa 連線)。可重複執行。
    - 測試區 10.10.130.191:P4 合併前執行
    - 正式區 10.10.130.190:若以新版 03-create-bpm-readonly.sql 建立帳號,已含本檔的欄位,仍建議執行 0) 與 3) 確認沒有繼承來的權限

  背景:2026-10-23 以 portal_bpm_ro 唯讀查詢 191 的 fn_my_permissions,發現它對 Users、LocalToDoWorkItem、WorkItem、ProcessInstance
  有「整張表」的 SELECT(Users 含 password 等欄位),與 03 檔的欄位層級授權不一致(CONFIRM-NEEDED P4)。
    1) 先 REVOKE 直接授給本帳號的表層級 SELECT(會一併移除欄位層級權限),再只 GRANT 用到的欄位
    2) P4 新增欄位:Users.userName(申請人姓名)、WorkItem.performerOID / completedTime(已簽核 = 經辦過)
    3) REVOKE 清不掉「從角色繼承」的權限(db_datareader、自訂角色、public):先看 0) 的結果;另對 Users 敏感欄位 DENY(欄位 DENY 優先於角色給的表層級 GRANT)
*/
USE [NaNa];
GO
-- 0) 權限來源(執行結果請截圖留存;任何一個查詢有資料列都要處理,處理方式見 3))
SELECT r.name AS role_name FROM sys.database_role_members AS m
JOIN sys.database_principals AS r ON r.principal_id = m.role_principal_id
JOIN sys.database_principals AS u ON u.principal_id = m.member_principal_id
WHERE u.name = N'portal_bpm_ro';                                             -- 本帳號所屬角色(不應有 db_datareader / db_owner)
SELECT pr.name AS grantee, OBJECT_NAME(p.major_id) AS table_name, p.permission_name, p.state_desc, p.minor_id AS column_id
FROM sys.database_permissions AS p JOIN sys.database_principals AS pr ON pr.principal_id = p.grantee_principal_id
WHERE p.class = 1 AND p.major_id IN (OBJECT_ID(N'dbo.Users'), OBJECT_ID(N'dbo.LocalToDoWorkItem'), OBJECT_ID(N'dbo.WorkItem'), OBJECT_ID(N'dbo.ProcessInstance'))
  AND pr.name IN (N'public', N'portal_bpm_ro');                              -- public 若有 SELECT,所有帳號都讀得到(需 BPM 管理者評估,不在本檔處理)
GO
-- 1) 直接授權:表層級 → 欄位層級
REVOKE SELECT ON [dbo].[Users] FROM [portal_bpm_ro];
REVOKE SELECT ON [dbo].[LocalToDoWorkItem] FROM [portal_bpm_ro];
REVOKE SELECT ON [dbo].[WorkItem] FROM [portal_bpm_ro];
REVOKE SELECT ON [dbo].[ProcessInstance] FROM [portal_bpm_ro];
GO
-- 2) 只授權程式用到的欄位(modules/bpm/nana-repo.ts)
GRANT SELECT ON [dbo].[Users] ([OID], [id], [userName], [leaveDate]) TO [portal_bpm_ro];
GRANT SELECT ON [dbo].[LocalToDoWorkItem] ([userOID], [workItemOID], [subject], [processInstanceName], [createdTime]) TO [portal_bpm_ro];
GRANT SELECT ON [dbo].[WorkItem] ([OID], [contextOID], [workItemName], [currentState], [performerOID], [completedTime]) TO [portal_bpm_ro];
GRANT SELECT ON [dbo].[ProcessInstance] ([OID], [contextOID], [serialNumber], [processInstanceName], [subject], [currentState], [createdTime], [requesterOID]) TO [portal_bpm_ro];
GO
-- 3) 縱深防禦:Users 的密碼相關欄位明確 DENY(即使日後被加入讀取角色也讀不到)
DENY SELECT ON [dbo].[Users] ([password], [passwordWrongTimes], [lastUptPwdDate]) TO [portal_bpm_ro];
GO
-- 4) 驗證:欄位層級授權生效、敏感欄位與未授權欄位被拒(以 TRY/CATCH 印出結果)
EXECUTE AS LOGIN = 'portal_bpm_ro';
SELECT TOP 1 OID, id, userName FROM [dbo].[Users];                         -- 應成功
SELECT TOP 1 OID, performerOID, completedTime FROM [dbo].[WorkItem];        -- 應成功
SELECT permission_name, subentity_name FROM fn_my_permissions('dbo.Users', 'OBJECT');  -- 應只有 OID、id、userName、leaveDate(沒有 subentity_name 空白的表層級列)
BEGIN TRY SELECT TOP 1 [password] FROM [dbo].[Users]; PRINT N'【錯誤】仍可讀 Users.password,請檢查 0) 的角色 / public 授權'; END TRY
BEGIN CATCH PRINT N'OK:Users.password 被拒(' + ERROR_MESSAGE() + N')'; END CATCH;
BEGIN TRY SELECT TOP 1 * FROM [dbo].[WorkItem]; PRINT N'【錯誤】仍可讀 WorkItem 全部欄位'; END TRY
BEGIN CATCH PRINT N'OK:WorkItem 未授權欄位被拒'; END CATCH;
BEGIN TRY UPDATE [dbo].[Users] SET id = id WHERE 1 = 0; PRINT N'【錯誤】可以寫入 Users'; END TRY
BEGIN CATCH PRINT N'OK:不能寫入'; END CATCH;
REVERT;
GO
