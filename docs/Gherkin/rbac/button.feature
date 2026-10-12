# language: zh-TW
@M2 @wip
功能: 選單、Tab、按鈕依權限顯示
  為了讓每個人只看到自己該用的功能
  身為 IT 權限管理人員
  我要依角色、部門(含下層)、職級控制入口網的選單、Tab、按鈕,且畫面與 API 檢查一致

  # PRD §6.3、§5.2;Gateway PRD §8.3.1–§8.3.2;FRAMEWORK-PLAN §2–§3(代碼見附錄 A)。

  背景:
    假如 角色 "news-editor" 擁有 "portal.news.read"、"portal.news.publish"
    而且 "news-editor" 有指派規則:部門 "HR"、含下層、職級 ["4","5","6"]

  場景: 符合規則的使用者看得到發布按鈕
    假如 使用者部門為 "HR-ADM"(HR 的下層)、職級 "5"
    當 開啟「集團與公告 → 公告」
    那麼 顯示「發布公告」按鈕

  場景: 不符合規則的使用者看不到按鈕,直接呼叫 API 也被擋
    假如 使用者部門為 "IT"、職級 "5"
    當 開啟「集團與公告 → 公告」
    那麼 不顯示「發布公告」按鈕
    當 直接呼叫 POST /api/portal/news
    那麼 回應 403,code 為 "PERMISSION_DENIED"

  場景: 沒有任何可見功能的選單群組不顯示
    假如 使用者沒有「表單與簽核」群組下任何功能的權限
    那麼 側欄不顯示「表單與簽核」

  @auto @manual
  場景: 沒有 Tab 權限時隱藏該 Tab
    假如 使用者有 "portal.approval.read"、"portal.approval.pending"、"portal.approval.done",沒有 "portal.approval.sent"
    當 開啟「待我簽核」
    那麼 只顯示「待簽核」「已簽核」兩個 Tab

  @manual
  場景: 目前 Tab 沒有權限時改到同頁第一個可看的 Tab
    假如 使用者有 "portal.mgr.rights.read"、"portal.mgr.rights.level2",沒有 "portal.mgr.rights.level1"
    當 開啟 "/manager/rights"
    那麼 網址改為 "/manager/rights/level2"

  @auto @manual
  場景: 有選單權限但沒有任何 Tab 權限的功能頁不顯示
    假如 使用者有 "portal.salary.read",沒有 "portal.salary.slip"、"portal.salary.bonus"
    那麼 側欄不顯示「薪資獎金」
    當 開啟 "/personal/salary"
    那麼 顯示 403 頁

  @auto @manual
  場景: 選單名稱、大項與排序以 BFF 為準
    當 IT 在 GigaItApp「選單管理」把「表單下載」改名並移到「個人資訊」
    而且 使用者換頁(5 分鐘內重新取得 /api/auth/me)
    那麼 側欄、頁首與麵包屑顯示新名稱,且「表單下載」列在「個人資訊」下

  @e2e
  場景: IT 管理系統管理員可查看主管專區與 ESH
    假如 使用者擁有角色 "it-admin",沒有 "portal-manager"、"portal-esh-admin"
    當 開啟員工入口網
    那麼 側欄顯示「主管專區」「ESH證照管理」全部功能頁與 Tab
    而且 不顯示任何按鈕權限的按鈕

  場景: 權限調整後重新整理即生效
    當 IT 在 GigaItApp 移除 "news-editor" 的 "portal.news.publish"
    而且 使用者重新整理頁面
    那麼 不再顯示「發布公告」按鈕

  場景: 前端使用的權限代碼都已宣告
    當 執行 portal-api 測試
    那麼 前端路由 meta 與 v-can 用到的權限代碼都存在於 OpenAPI x-permissions,且 kind 正確
