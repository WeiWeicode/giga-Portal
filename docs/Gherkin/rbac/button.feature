# language: zh-TW
@M2 @wip
功能: 選單、Tab、按鈕依權限顯示
  為了讓每個人只看到自己該用的功能
  身為 IT 權限管理人員
  我要依角色、部門(含下層)、職級控制入口網的選單、Tab、按鈕,且畫面與 API 檢查一致

  # PRD §6.3、§5.2;Gateway PRD §8.3.1–§8.3.2。

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

  場景: 沒有 Tab 權限時隱藏該 Tab
    假如 使用者有 "bpm.approval.read",沒有「我送出的」Tab 的權限
    當 開啟「待我簽核」
    那麼 只顯示「待簽核」「已簽核」兩個 Tab

  場景: 權限調整後重新整理即生效
    當 IT 在 GigaItApp 移除 "news-editor" 的 "portal.news.publish"
    而且 使用者重新整理頁面
    那麼 不再顯示「發布公告」按鈕

  場景: 前端使用的權限代碼都已宣告
    當 執行 portal-api 測試
    那麼 前端路由 meta 與 v-can 用到的權限代碼都存在於 OpenAPI x-permissions,且 kind 正確
