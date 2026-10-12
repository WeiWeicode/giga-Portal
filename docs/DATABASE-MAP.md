# 舊系統 (old_PortalSolar) 資料庫架構與功能對照表

> 本文件彙整舊版 `old_PortalSolar` 所連線之資料庫伺服器、資料庫名稱、負責模組及其存取性質（查詢／寫入）。
> **依安全規範，本文件不記載資料庫連線帳號與密碼。**
> 程式碼參考來源：[GSCLib.cs](file:///d:/檔案分享/程式碼/GigaNexusAI/old_PortalSolar/App_Code/GSCLib.cs#L28-L54) 中的 `DbConnect` 類別。

---

## 1. 資料庫伺服器清冊總覽

| 伺服器 IP | 資料庫類型 | 主要資料庫 (Database / Catalog) | 主要負責系統與功能 |
| :--- | :--- | :--- | :--- |
| **`10.10.130.220`** | MS SQL Server | `PortalSolar` | Portal 入口網核心業務（EHS、人事薪酬、同意書、總務、問卷、公告） |
| | | `LOS` | 員工基本資料、部門組織階層樹、午餐訂餐系統主檔 |
| | | `Budget` | 集團年度預算編列與版本管理 |
| | | `MBO` | 目標管理與績效考核系統 |
| **`10.10.130.190`** | MS SQL Server | `NaNa` | EasyFlowGP 電子簽核流程系統 |
| **`10.10.10.174`** | MS SQL Server | `LearnDB` | E-Learning 數位學習與年度教育訓練計畫 |
| | | *(Default Instance)* | 早期舊伺服器連線（歷史相容保留） |

---

## 2. 各資料庫詳細功能與存取權限

### 2.1 主伺服器：`10.10.130.220`

#### ① `PortalSolar` 資料庫（Portal 核心業務）
舊入口網的主要業務資料儲存處，具備高度的查詢與寫入操作：

| 業務功能模組 | 對應功能說明 | 存取類型 | 主要對應程式頁面 |
| :--- | :--- | :--- | :--- |
| **環安衛管理 (EHS)** | 環安檢查項目維護、危害回報、稽核改善紀錄 | **寫入 / 查詢** | `EHS/EHItemEdit.aspx` |
| **人事與薪酬 (HR / HRM)** | 薪資明細、年度所得資料、眷屬扶養申報、考績獎金、班表維護、職務晉升紀錄 | **寫入 / 查詢** | `HRPDataBase.aspx`, `HRMPersonalSalary.aspx`, `HRPDatabaseUpdate.aspx`, `SalaryAdjustment.aspx`, `HRShiftUp.aspx` |
| **新人報到與同意書 (Consent)** | 新進同仁報到資料、同仁數位切結書/同意書簽名與紀錄 | **寫入 / 查詢** | `GSCConsentX.aspx`, `GSMCConsent20220701.aspx`, `GSMCConsent20260814.aspx`, `HRnewPep01~05.aspx` |
| **總務與資產管理 (GAffairs)** | 個人保管財產清冊、部門公物財產、資產盤點與報廢申請 | **寫入 / 查詢** | `GAffairs.aspx`, `PersonalPropertyInfo.aspx`, `DeptPropertyInfo.aspx` |
| **福委拍賣 (Auction)** | 福委二手拍賣商品上架、同仁出價競標與投標紀錄 | **寫入 / 查詢** | `GSMC_Auction.aspx` |
| **問卷調查 (QA)** | 問卷題目設定、同仁填答問卷、調查結果統計 | **寫入 / 查詢** | `QA/QuestSetting.aspx`, `QA/QuestView.aspx`, `QA/MyQAList.aspx` |
| **入口網公告與看板** | 首頁輪播跑馬燈、公告內容編輯、電視牆/看板輪播設定 | **寫入 / 查詢** | `PublicEdit.aspx`, `PublicContainXEdit.aspx`, `TVDemoSetting.aspx` |
| **帳號與權限管理** | 新人帳號註冊申請、重設密碼紀錄、管理人員權限設定 | **寫入 / 查詢** | `Account/Login.aspx`, `LoginNewAccount.aspx`, `ManagerRightInfo.aspx` |

---

#### ② `LOS` 資料庫（Lunch Order System / 員工組織人事主檔）
舊系統多數組織與員工基本資訊查詢的中樞來源：

| 業務功能模組 | 對應功能說明 | 存取類型 | 主要對應方法／預存程序 |
| :--- | :--- | :--- | :--- |
| **員工基本資料 (UserInfo)** | 查詢同仁工號、姓名、電子郵件、職稱、職等、到職日、離職日、主管工號/姓名 | **查詢** | `GSCLib.cs` -> `UserInfo()`<br>（表：`dbo.EmployeeInfo`, `dbo.genInfo`） |
| **組織與部門階層 (DeptInfo)** | 部門層級關係、子部門展開、母部門、虛擬部門判斷、部門樹狀結構清單 | **查詢** | `GSCLib.cs` -> `DeptInfo()`, `LoadDept()`, `LoadTreeDept()`<br>（SP: `SP_DeptInfo`, `SP_DeptInfoV2`；表: `dbo.DeptInfo`, `dbo.RankInfo`） |
| **訂餐管理主檔** | 員工訂餐身分與權限、部門群組定義 | **查詢** | `Site.master.cs`, `Site_Mobile.master.cs` |

---

#### ③ `Budget` 資料庫（預算系統）

| 業務功能模組 | 對應功能說明 | 存取類型 | 主要對應程式頁面 |
| :--- | :--- | :--- | :--- |
| **部門預算管理** | 各部門年度預算資料編列、預算科目、版本控制（`BudgetVersionInfo`）、最終版本確認 | **寫入 / 查詢** | `Budget_DeptData.aspx`, `Budget_DeptInfo.aspx`, `Budget_DeptInfoV2.aspx` |
| **人資預算管理** | HR 人資各項費用預算彙整與明細審查 | **寫入 / 查詢** | `Budget_DeptDataHR.aspx` |

---

#### ④ `MBO` 資料庫（目標管理系統）

| 業務功能模組 | 對應功能說明 | 存取類型 | 主要對應程式頁面 |
| :--- | :--- | :--- | :--- |
| **目標管理 (MBO)** | 國碩集團目標管理系統 (Management by Objectives) 與績效連動 | **查詢 / 整合** | `MainFormX.aspx`, `GSCLib.cs` |

---

### 2.2 流程伺服器：`10.10.130.190`

#### `NaNa` 資料庫（EasyFlowGP 電子簽核）

| 業務功能模組 | 對應功能說明 | 存取類型 | 主要對應程式頁面 |
| :--- | :--- | :--- | :--- |
| **電子簽核流程 (BPM)** | 查詢 EasyFlowGP 表單簽核流程、表單當前關卡、簽核進度狀態 | **查詢** | `Site.master`, `GSCLib.cs` (`Sql2EFGP`) |

---

### 2.3 學習伺服器：`10.10.10.174`

#### `LearnDB` 資料庫（E-Learning 數位學習系統）

| 業務功能模組 | 對應功能說明 | 存取類型 | 主要對應程式頁面 |
| :--- | :--- | :--- | :--- |
| **線上學習與培訓 (E-Learning)** | 年度教育訓練計畫編列、個人年度修課進度、課程教案教材管理、課程滿意度問卷 | **寫入 / 查詢** | `ELlessionplan.aspx`, `ES_ELearning.aspx`, `PersonalAnnualCurse.aspx`, `AnnualCurse.aspx` |

---

## 3. 周邊基礎整合服務（供架構對照）

除關聯式資料庫外，舊系統另有連線以下基礎服務：

| 服務項目 | 伺服器 IP / Port | 通訊協定 | 用途說明 | 存取類型 |
| :--- | :--- | :--- | :--- | :--- |
| **Windows AD 網域主機** | `10.10.15.236:389` | LDAP | 集團員工 Windows AD 帳號與密碼認證 (`SAMAccountName`) | **查詢 / 驗證** |
| **SMTP 郵件伺服器** | `10.10.128.162:25`<br>`10.10.10.161:25` | SMTP | 寄送重設密碼通知、系統公告郵件、簽核提醒通知 | **發信服務** |
| **舊 ERP 主機 (歷史相容)** | `10.10.10.251:1521` | Oracle TNS (`topdb`) | 舊 ERP 人事與薪資對照（已停用，程式碼中僅保留歷史註解） | **歷史註解** |
