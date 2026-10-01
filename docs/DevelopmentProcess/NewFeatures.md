# 新增功能紀錄

> 新紀錄加在最上方;格式見 `AGENT.md` §11。

## 2026-10-01 移除本機 Gateway 用的權限檔;前端開發改 proxy 到測試區
- 內容:需求方決定不再使用家中開發環境(配合 giga-api-gateway-bff `0c9b5b8`)。刪除 `deploy/gateway-dev-rbac.yaml`、`deploy/apply-gateway-dev-rbac.sh`;`frontend/vite.config.ts` 的 `/api` proxy 預設改為測試區 `https://giganexus-test.gigasolar.com.tw`(公司憑證,改回驗證憑證;`GATEWAY_TARGET` 可改);AGENT.md、README、ARCHITECTURE、PROJECT-MAP、UI-GUIDE、PRD、Gherkin README 的本機 Gateway 說明改為測試區(測試帳號改為假工號自行註冊的本機帳號)。修正紀錄與 PRD 修訂紀錄為歷史,不修改
- 檔案:`deploy/gateway-dev-rbac.yaml`、`deploy/apply-gateway-dev-rbac.sh`(刪除)、`deploy/gateway-rbac.yaml`、`deploy/apply-gateway-rbac.sh`、`frontend/vite.config.ts`、`frontend/Dockerfile`、`AGENT.md`、`README.md`、`docs/ARCHITECTURE.md`、`docs/PROJECT-MAP.md`、`docs/UI-GUIDE.md`、`docs/PRD.md`、`docs/Gherkin/README.md`
- 驗證:`npm run dev` 後 `curl http://localhost:5179/api/auth/me` 經 proxy 取得測試區 401 JSON(憑證驗證通過);`npm run typecheck`、`npm test`(29 項)通過

## 2026-10-01 註冊頁無 Email 者一併設定密碼、權限分類 kind / parent / sort
- 內容:配合 giga-api-gateway-bff `e2a1326`(W3-5.8a 自行註冊、P2-3a 權限分類)。① 註冊頁填了到職日時顯示「設定密碼 / 確認密碼」,與 `hireDate` 一起送出 `password`(Gateway 比對 LOS 到職日後直接啟用;有 Email 者仍寄驗證連結),密碼政策錯誤逐條顯示。② `deploy/gateway-rbac.yaml`(及本機版)25 個權限補上 `kind` / `parent` / `sort`(依 `router.ts` 選單順序:`portal.app.access` → 14 個選單 → Tab / 按鈕;`bpm.approval.*` 掛在入口網的簽核選單下;`it.app.access` 為另一個應用),GigaItApp 的權限樹以 `portal.app.access` 為根
- 檔案:`frontend/src/pages/auth/Register.vue`、`frontend/src/api/gateway.ts`、`deploy/gateway-rbac.yaml`、`deploy/gateway-dev-rbac.yaml`、`docs/API.md`
- 驗證:`npm run typecheck`、`npm test`(29 項)、`npm run build` 通過;`gateway-rbac.yaml` 已在測試區 bff-1 容器以 CLI `apply` 套用(roles 4、pvBumped),`gw.permission` 統計 app 2 / menu 15 / tab 1 / button 7,除兩個 app 外皆有 parent。註冊頁畫面未以瀏覽器操作驗證(需部署後以無 Email 的真實員工測試)

## 2026-09-26 公司測試區部署準備(權限範本、env 範本)
- 內容:公司 CI 與憑證未就緒,先以手動架設為主(流程在 Gateway `docs/TEST-DEPLOY-RUNBOOK.md`,本專案為步驟 7)。新增 `deploy/gateway-rbac.yaml`:與本機版相同的 25 個權限代碼與 `employee` 角色,需要 AD 群組的角色(`it-app-user`、`portal-approver`、`portal-editor`)留 DN 註解待 IT 填入(Gateway CLI 沒有個別指派角色的指令);`deploy/apply-gateway-rbac.sh <test|prod> <Gateway env>` 以 Gateway 正式 compose 的 `migrate` 服務映像執行 CLI `apply`(Git Bash:`pwd -W`、`MSYS_NO_PATHCONV=1`);`deploy/test.env.example`(公司 volume `giganexus-gw_gw_www`)。沒套用權限時測試區所有人都會看到無權限頁;沒部署入口網時公司環境沒有登入頁。註冊 / 忘記密碼連結依需求方決定保留(Gateway API 未實作,會顯示錯誤)。
- 檔案:`deploy/gateway-rbac.yaml`、`deploy/apply-gateway-rbac.sh`、`deploy/test.env.example`(新增)、`AGENT.md`、`README.md`、`docs/ARCHITECTURE.md`、`docs/PROJECT-MAP.md`
- 驗證:`gateway-rbac.yaml` 以 yaml 解析(25 個權限、4 個角色,皆無 adGroups);`docker compose --env-file deploy/test.env.example -f deploy/docker-compose.yml --profile publish config` 解析為 `giganexus-gw_gw_www`;套用腳本的 compose 指令以假 env 執行 `config` 解析正確。**未對真實測試區執行**。

## 2026-09-26 GigaItApp 同步應用切換(FR-2.3,跨 repo)
- 內容:需求方要求 GigaItApp 也提供右上角應用切換並上架。在 `../GigaItApp` 加入與本專案同一版本的 `GAppSwitcher`(資料取自使用者的 Gateway 登入 `/api/auth/me`,暫時推導規則相同),發佈到本機 Nginx `/it/`;紀錄見 GigaItApp `docs/DevelopmentProcess/FrontendCorrection.md` 同日。GigaItApp 仍為自有登入,單一入口與應用層守衛(I1、I3 其餘)仍屬 M3。
- 檔案:`docs/Gherkin/auth/app-switch.feature`(「GigaItApp 也提供相同的應用切換」改 `@e2e`);程式在 GigaItApp
- 驗證:headless Chrome 經 `https://localhost` 來回切換入口網 ↔ IT 管理系統,回入口網不需重新登入;詳見 GigaItApp 紀錄

## 2026-09-26 前端發佈到本機 Nginx(spa-portal)
- 內容:新增 SPA 映像檔與發佈流程,把入口網發佈到本機 Gateway 的 `gw_www/portal`,取代範例入口網(Nginx `/` 已指向 `/srv/www/portal/current`,設定不需改)。`frontend/Dockerfile` 以 compose `additional_contexts` 帶入 Gateway web-kit(`WEB_KIT_DIR`);`frontend/publish.sh` 複製自 GigaItApp(releases + current symlink 原子切換、保留 5 版、可回滾)。版本名稱預設 `portal-<建置時間>`,禁止 `dev`,避免覆蓋 Gateway 範例的 `releases/dev`(回滾可退回範例)。只影響本機;測試區 / 正式區的取代(Gateway G6)仍在 M4。
- 檔案:`frontend/Dockerfile`、`frontend/publish.sh`、`frontend/.dockerignore`、`deploy/docker-compose.yml`、`docs/ARCHITECTURE.md`、`docs/PROJECT-MAP.md`、`docs/Gherkin/auth/app-switch.feature`
- 驗證:`docker compose -f deploy/docker-compose.yml run --rm --build spa-portal` → `portal:current → portal-20260926035424`(`releases/dev` 保留)。curl:`/`、`/login`、`/personal/leave/history` 皆 200 回傳入口網 index.html,`/theme-init.js`、`/favicon.svg` 200,HTML `Cache-Control: no-cache`。headless Chrome(獨立暫存 profile)經 `https://localhost`:未登入導向 `/login?redirect=…`;`theme-init.js` 在 Gateway CSP 下正常套用;S112009 登入回原頁、麵包屑正確、不顯示應用切換,`/resources/admin` → 403;登出 → `/login`;S100001 應用切換列出兩個應用,點「IT 管理系統」整頁導向 `/it/`(目前 GigaItApp 仍為自有登入,顯示 `/it/login`,單一入口待 M3 I1);無 console 錯誤(登入前 `/api/auth/me` 的 401 除外)。內建瀏覽器因不信任 Gateway 開發用自簽憑證無法開啟 `https://localhost`,故改用 headless Chrome。

## 2026-09-26 M1 入口網框架(frontend/)
- 內容:依 PRD §11 M1 建立前端框架。**框架來源**:`../GigaItApp/frontend`(commit `7c43d69f435b15c7c674a165cdc6f5cab9e37f51`),帶過來 `ui/`(G* 元件、tokens、圖表)、`layouts/`、`useAsync` / `usePaged`、路由結構、`v-can`;未帶自有登入、`api/auth|http`、`rbac`、IT 頁面(AGENT §0.2)。登入與權限改用 Gateway web-kit(以 alias 引用兄弟 repo,需求方 2026-09-26 決定)。完成項目:
  - 綠能 token 與玻璃 / 扁平 × 明亮 / 黑暗四組(FR-6.2–6.4;元件內寫死的靛紫色改為 token,GTabs 移除元件內 `data-theme` 判斷);`public/theme-init.js` 防閃爍(Gateway CSP 不允許 inline script);不支援模糊 / 減少透明度時強制扁平。
  - 登入頁(FR-1.1–1.3:錯誤訊息含 requestId、`ACCOUNT_NOT_REGISTERED` 引導註冊、`PASSWORD_CHANGE_REQUIRED` 就地設定新密碼、`redirect` 安全導回,其他應用路徑整頁導向)、註冊 / 啟用連結、忘記 / 重設密碼頁(FR-1.4)、本機帳號變更密碼。
  - 兩層選單 + Tab(PRD §6.5 全部功能頁,內容為「建置中」頁並標示里程碑,不放假資料)、選單依權限過濾、403、無權限頁(FR-2.4)、維護頁、`/resources/admin`(`portal.resource.edit`)。
  - 應用切換 `GAppSwitcher`(FR-2.2):**暫時做法**,`me.apps`(Gateway G3)未提供前依 `*.app.access` 對照 `TEMP_APPS` 推導並在下拉標示(需求方 2026-09-26 決定);`/?denied=<應用>` 提示(參數名為提議,待同步 Gateway FRONTEND-GUIDE §7.4 與 GigaItApp I3)。
  - 首頁 M1 版:問候橫幅 `GHero`(FR-4.1,只用 me)、依權限的快捷按鈕與功能導覽;其餘區塊 M4。
  - 新增全域元件 `GHero`、`GAppSwitcher`、`GStyleToggle`、`GAlert`。
  - 本機 Gateway 權限:需求方決定「登記到 Gateway dev 設定」,但 Gateway 的 `deploy/dev/` 在其 `.gitignore` 內(不納入版控),改由本 repo `deploy/gateway-dev-rbac.yaml` 保存並以 `deploy/apply-gateway-dev-rbac.sh`(Gateway CLI `apply`)套用;**未修改 Gateway repo 任何受版控的檔案**。內容:PRD §6.5 的 25 個權限代碼(含 `it.app.access`、`bpm.approval.*`)、`employee` 基本選單、以模擬 AD 群組指派的 `portal-approver` / `portal-editor` / `it-app-user`。
- 檔案:`frontend/`(新增)、`deploy/gateway-dev-rbac.yaml`、`deploy/apply-gateway-dev-rbac.sh`、`.claude/launch.json`、`AGENT.md`、`README.md`、`docs/PROJECT-MAP.md`、`docs/ARCHITECTURE.md`、`docs/API.md`、`docs/UI-GUIDE.md`、`docs/Gherkin/`(場景標籤)
- 驗證:
  - `frontend/`:`npm run typecheck` 通過;`npm test` 5 檔 29 項通過;`npm run build` 通過(主程式 JS gzip 約 45 KB + Vue runtime 25 KB,≤ 80 KB)。
  - `sh deploy/apply-gateway-dev-rbac.sh`:permissions 25、roles 4、pvBumped;以 curl 登入本機 Gateway 確認 S112009 只有 employee 權限、S100001 另有 `it.app.access`、`bpm.approval.*`、`portal.*.edit|publish`;`/api/auth/me` 仍無 `apps`(G3 未實作)。
  - 瀏覽器(`npm run dev`,經本機 Gateway):未登入開 `/personal/leave/history` → `/login?redirect=…`;錯誤密碼顯示訊息與 requestId;登入後回原頁,麵包屑「個人服務 / 我的假期 / 請假紀錄」;S112009 開 `/resources/admin` → 403;S112009 不顯示應用切換、不顯示「我的待辦」;S100001 應用切換列出兩個應用並標示目前所在與暫時做法;`/?denied=it` 顯示提示並移除參數;登出 → `/login`,再開 `/` 需重新登入;側欄收合浮出清單;375px 無水平捲動、選單為抽屜。四種風格組合以腳本檢查首頁文字對比(不含漸層底文字)皆 ≥ 4.5:1。
  - **未驗證**:點選應用切換整頁導向 `/it/`(dev server 無 `/it/`,需經 Gateway Nginx);Token 過期自動 Refresh;首次登入設定新密碼(本機無需改密碼的帳號);註冊、忘記 / 重設密碼(本機 Gateway 尚未實作 `/api/auth/register`、`/password/forgot`、`/password/reset`,頁面會顯示 BFF 錯誤);登入錯誤代碼除 `INVALID_CREDENTIALS` 外的訊息(顯示 BFF message,與 Gherkin 例子文字不完全相同)。這些場景維持 `@wip`。

## 2026-09-26 建立專案:PRD、AGENT 與文件組
- 內容:新建員工入口網專案(giga-Portal,子路徑 `/`)。需求方確認:入口網與 GigaItApp 都使用 Gateway 單一入口;應用 / 選單 / Tab / 按鈕權限以 Gateway BFF 為唯一來源,由 GigaItApp 設定;角色依部門(**含下層**)、**職級為主**(職稱選配)自動指派;按鈕權限 = API 權限;右上角應用切換依權限顯示,GigaItApp 無權限時導回入口網;風格為淺綠 / 科技綠,可切換玻璃 / 扁平;`portal-api` port 51271;緊急管理帳號用 Gateway 本機帳號(PRD §1.2、Q1、Q2、Q4、Q7)。建立 PRD v0.1.1、AGENT.md(含從 GigaItApp 複製框架的規則)、ARCHITECTURE、API(草案)、UI-GUIDE(綠能 token、玻璃 / 扁平)、PROJECT-MAP(規劃)、Gherkin 12 個 feature(皆 `@wip`)。Gateway 規格同步改版 v0.7(見 `../giga-api-gateway-bff/docs/DevelopmentProcess/NewFeatures.md` 同日紀錄)。
- 檔案:`README.md`、`AGENT.md`、`docs/PRD.md`、`docs/ARCHITECTURE.md`、`docs/API.md`、`docs/UI-GUIDE.md`、`docs/PROJECT-MAP.md`、`docs/Gherkin/`、`docs/DevelopmentProcess/`
- 驗證:文件;PRD 兩張 Mermaid 圖以 mermaid-cli 轉檔成功;14 個 feature(本 repo 12 個、Gateway 2 個)以 `@cucumber/gherkin`(zh-TW)解析通過。尚無程式碼
