/*
  BPM 唯讀帳號 P6 授權(危害性化學品「由 BPM 同步」;PORTAL-API-PLAN §4 P6、D-13)— BPM 主機 NaNa 資料庫
  由使用者以 sa 在各 BPM 主機執行一次(AI 不以 sa 連線)。可重複執行。須先執行 03 / 04。
    - 測試區 10.10.130.191:P6 合併前執行
    - 正式區 10.10.130.190:正式區建立帳號時一併執行
  **會在 NaNa 建立一個檢視 dbo.portal_esh_chemical_forms**(唯讀;不改 BPM 既有表),請先知會 BPM 管理者(CONFIRM-NEEDED P6)。

  用途:modules/esh/chemical-repo.ts NanaChemicalSource 唯讀查「化學品申報單」(processDefinitionId = SHR008_、已結案)。
  資安審查 M2:若直接 GRANT FormInstance(fieldValues)/ NoCmDocument,欄位層級授權仍可讀到**所有流程**的表單內容(請假、人事、採購…),
  所以改為檢視只回 SHR008_ 已結案的資料,只 GRANT 這個檢視(擁有者同為 dbo,所有權鏈結,不需授權底層表)。
  2026-10-23 以 portal_bpm_ro 查 191 的 fn_my_permissions:LocalRelevantData、FormInstance、NoCmDocument 沒有任何權限(P6 SQL 尚未在 191 實測)。
*/
USE [NaNa];
GO
IF OBJECT_ID(N'dbo.portal_esh_chemical_forms', N'V') IS NOT NULL DROP VIEW dbo.portal_esh_chemical_forms;
GO
CREATE VIEW dbo.portal_esh_chemical_forms
AS
SELECT RTRIM(P.serialNumber) AS sn,
       P.createdTime,
       CAST(A.fieldValues AS nvarchar(max)) AS fv,
       CAST(D.logicalName AS nvarchar(200)) AS logicalName,
       RTRIM(D.physicalName) AS physicalName,
       RTRIM(D.extentionName) AS ext
FROM dbo.ProcessInstance AS P
JOIN dbo.LocalRelevantData AS B ON B.containerOID = P.contextOID
JOIN dbo.FormInstance AS A ON A.OID = B.valueOID
OUTER APPLY (SELECT TOP 1 N.logicalName, N.physicalName, N.extentionName FROM dbo.NoCmDocument AS N WHERE N.formInstanceOID = A.OID ORDER BY N.OID DESC) AS D
WHERE P.processDefinitionId = 'SHR008_' AND P.processInstanceName = N'化學品申報單' AND P.currentState = 3;
GO
-- 1) 只授權檢視
GRANT SELECT ON [dbo].[portal_esh_chemical_forms] TO [portal_bpm_ro];
GO
-- 2) 驗證(以 TRY/CATCH 印出結果)
EXECUTE AS LOGIN = 'portal_bpm_ro';
BEGIN TRY
  SELECT TOP 1 sn, createdTime, LEFT(fv, 100) AS fv, logicalName, physicalName, ext FROM dbo.portal_esh_chemical_forms ORDER BY createdTime DESC;
  PRINT N'OK:化學品申報單檢視可查詢';
END TRY
BEGIN CATCH PRINT N'【錯誤】化學品申報單檢視查詢失敗:' + ERROR_MESSAGE(); END CATCH;
BEGIN TRY SELECT TOP 1 OID FROM [dbo].[FormInstance]; PRINT N'【錯誤】可直接讀 FormInstance(請檢查角色 / public 授權)'; END TRY
BEGIN CATCH PRINT N'OK:FormInstance 不可直接讀'; END CATCH;
BEGIN TRY SELECT TOP 1 OID FROM [dbo].[NoCmDocument]; PRINT N'【錯誤】可直接讀 NoCmDocument'; END TRY
BEGIN CATCH PRINT N'OK:NoCmDocument 不可直接讀'; END CATCH;
REVERT;
GO
