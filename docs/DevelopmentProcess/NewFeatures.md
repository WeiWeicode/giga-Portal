# 新增功能紀錄

> 新紀錄加在最上方;格式見 `AGENT.md` §11。

## 2026-09-26 建立專案:PRD、AGENT 與文件組
- 內容:新建員工入口網專案(giga-Portal,子路徑 `/`)。需求方確認:入口網與 GigaItApp 都使用 Gateway 單一入口;應用 / 選單 / Tab / 按鈕權限以 Gateway BFF 為唯一來源,由 GigaItApp 設定;角色依部門(**含下層**)、**職級為主**(職稱選配)自動指派;按鈕權限 = API 權限;右上角應用切換依權限顯示,GigaItApp 無權限時導回入口網;風格為淺綠 / 科技綠,可切換玻璃 / 扁平;`portal-api` port 51271;緊急管理帳號用 Gateway 本機帳號(PRD §1.2、Q1、Q2、Q4、Q7)。建立 PRD v0.1.1、AGENT.md(含從 GigaItApp 複製框架的規則)、ARCHITECTURE、API(草案)、UI-GUIDE(綠能 token、玻璃 / 扁平)、PROJECT-MAP(規劃)、Gherkin 12 個 feature(皆 `@wip`)。Gateway 規格同步改版 v0.7(見 `../giga-api-gateway-bff/docs/DevelopmentProcess/NewFeatures.md` 同日紀錄)。
- 檔案:`README.md`、`AGENT.md`、`docs/PRD.md`、`docs/ARCHITECTURE.md`、`docs/API.md`、`docs/UI-GUIDE.md`、`docs/PROJECT-MAP.md`、`docs/Gherkin/`、`docs/DevelopmentProcess/`
- 驗證:文件;PRD 兩張 Mermaid 圖以 mermaid-cli 轉檔成功;14 個 feature(本 repo 12 個、Gateway 2 個)以 `@cucumber/gherkin`(zh-TW)解析通過。尚無程式碼
