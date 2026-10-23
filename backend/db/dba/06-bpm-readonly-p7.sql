/*
  BPM 唯讀帳號 P7 授權(ISO 文件庫;PORTAL-API-PLAN §4 P7、D-13)— BPM 主機 NaNa 資料庫
  由使用者以 sa 在各 BPM 主機執行一次(AI 不以 sa 連線)。可重複執行。須先執行 03 / 04。
    - 測試區 10.10.130.191:P7 合併前執行(**191 是否有 ISO 文件資料待確認**;舊站 ISOInfo.aspx 一律連正式區 190)
    - 正式區 10.10.130.190:正式區建立帳號時一併執行
  不建立任何物件;只授權舊程式 ISOInfo.aspx.cs 用到的檢視與欄位(欄位名稱取自舊程式,**尚未在 191 / 190 實測**,CONFIRM-NEEDED P7)。
  用途:modules/services/iso-repo.ts NanaIsoSource(參數化唯讀查詢)。
*/
USE [NaNa];
GO
-- 0) 先確認物件存在(不存在時只印出,不中斷)
SELECT name, type_desc FROM sys.objects
WHERE name IN (N'v_ISO_Docs_Clause_Solar', N'v_ISO_Docs_Clause_ALL', N'Documents', N'ISOFile', N'ISODocCmItem', N'DocCmItem_RefDoc', N'Doc_Level');
GO
-- 1) 檢視:整個檢視(只含 ISO 文件的條文 / 版本 / 有效期間)
IF OBJECT_ID(N'dbo.v_ISO_Docs_Clause_Solar') IS NOT NULL GRANT SELECT ON [dbo].[v_ISO_Docs_Clause_Solar] TO [portal_bpm_ro];
IF OBJECT_ID(N'dbo.v_ISO_Docs_Clause_ALL') IS NOT NULL GRANT SELECT ON [dbo].[v_ISO_Docs_Clause_ALL] TO [portal_bpm_ro];
GO
-- 2) 表:只授權用到的欄位
GRANT SELECT ON [dbo].[Documents] ([OID], [docNo], [docName], [version], [displayVersion], [containerOID]) TO [portal_bpm_ro];
GRANT SELECT ON [dbo].[ISOFile] ([documentOID], [physicalName], [extensionType]) TO [portal_bpm_ro];
GRANT SELECT ON [dbo].[ISODocCmItem] ([OID]) TO [portal_bpm_ro];
GRANT SELECT ON [dbo].[DocCmItem_RefDoc] ([DocCmItemOID], [RefDocOID]) TO [portal_bpm_ro];
GRANT SELECT ON [dbo].[Doc_Level] ([upperDocOID], [lowerDocOID]) TO [portal_bpm_ro];
GO
-- 3) 驗證(以 portal_bpm_ro 身分;印出結果,失敗請把訊息告訴開發者)
EXECUTE AS LOGIN = 'portal_bpm_ro';
BEGIN TRY
  SELECT TOP 3 docNo, docName, displayVersion, version, clauseName, validFrom, validTo, DocLevelID FROM dbo.v_ISO_Docs_Clause_Solar ORDER BY docNo;
  PRINT N'OK:v_ISO_Docs_Clause_Solar 可查詢';
END TRY
BEGIN CATCH PRINT N'【錯誤】v_ISO_Docs_Clause_Solar 查詢失敗:' + ERROR_MESSAGE(); END CATCH;
BEGIN TRY
  SELECT TOP 3 Doc.docNo, D.physicalName, D.extensionType FROM dbo.Documents AS Doc INNER JOIN dbo.ISOFile AS D ON Doc.OID = D.documentOID
  INNER JOIN dbo.ISODocCmItem AS C ON Doc.containerOID = C.OID;
  PRINT N'OK:ISO 文件檔可查詢';
END TRY
BEGIN CATCH PRINT N'【錯誤】ISO 文件檔查詢失敗:' + ERROR_MESSAGE(); END CATCH;
BEGIN TRY UPDATE dbo.Documents SET docNo = docNo WHERE 1 = 0; PRINT N'【錯誤】可以寫入 Documents'; END TRY
BEGIN CATCH PRINT N'OK:不能寫入'; END CATCH;
REVERT;
GO
