# 員工入口網 — 前端 UI 規範

> **UI 全域套用**:頁面只組合 `src/ui/` 的全域元件與設計 token,不在頁面裡各自刻按鈕、卡片、表格、表單、對話框的樣式。
> 元件與規則沿用 GigaItApp `docs/UI-GUIDE.md`(框架複製來源),本文件只寫**差異**:綠能色盤、玻璃 / 扁平風格、應用切換、首頁版面。
> 對應 [PRD.md](PRD.md) §6.6、§7;AI 協作規則見 [../AGENT.md](../AGENT.md) §8。**狀態:M1 已實作 token、玻璃 / 扁平、版面與應用切換**(首頁區塊元件如 GQuickTile 於 M4 實作)。

---

## 1. 風格定位

- **綠能產業**(太陽能、儲能):主色為科技綠,輔色為太陽能琥珀、儲能青綠;畫面乾淨、明亮、有科技感。
- 參考畫面:左側淺綠漸層側欄、深綠漸層問候橫幅、白色半透明卡片、綠色光暈與淡網格背景。
- 使用者可切換兩個維度,四種組合都必須完整可用:

| | 玻璃 `glass`(預設) | 扁平 `flat` |
| --- | --- | --- |
| **明亮 `light`** | 淡綠網格背景 + 半透明白卡片 + 模糊 + 綠色光暈 | 淡綠純色背景 + 白色實心卡片 + 1px 邊框 |
| **黑暗 `dark`** | 深綠黑背景 + 半透明深綠卡片 + 模糊 + 綠色微光 | 深綠黑背景 + 實心深色卡片 + 1px 邊框 |

## 2. 設計 Token(`ui/styles/tokens.css`)

### 2.1 屬性與切換

- `<html data-theme="light|dark" data-style="glass|flat">`;元件**只讀 token**,不判斷目前風格。
- 頂列與登入頁右上角的 `GStyleToggle`:風格(玻璃 ↔ 扁平,圖示 `layers` / `square`)、明暗(`sun` / `moon`);偏好記在瀏覽器(`portal.theme`、`portal.style`)。
- 不支援 `backdrop-filter` 或 `prefers-reduced-transparency: reduce` 時強制扁平(風格按鈕停用並說明);`prefers-reduced-motion` 時關閉動畫。
- 判斷規則在 `composables/themeRules.ts`;`public/theme-init.js` 在載入 CSS 前先套用一次避免閃爍(Gateway CSP 不允許 inline script,所以是獨立檔案),兩處規則需一致。

### 2.2 色盤(明亮 / 黑暗)

| Token | 明亮 | 黑暗 | 用途 |
| --- | --- | --- | --- |
| `--c-primary` | `#12a150` | `#2fd67a` | 主要按鈕、選中、連結 |
| `--c-primary-deep` | `#0b6b3a` | `#0e3b26` | 問候橫幅漸層深色端 |
| `--c-accent-solar` | `#f5a524` | `#ffc04d` | 強調、提醒、打卡狀態 |
| `--c-accent-storage` | `#12b5a6` | `#3ee0cf` | 圖表第二色、資訊標籤 |
| `--c-info` / `--c-warning` / `--c-danger` | `#2f7de1` / `#e0901a` / `#e0483e` | `#5ea2ff` / `#ffb547` / `#ff6b61` | 語意色 |
| `--bg` | `#f3faf6` | `#08130e` | 頁面底色 |
| `--text` / `--text-2` / `--text-3` | `#0f2a1d` / `#4b6358` / `#5d7569` | `#e3f2ea` / `#9fb8ac` / `#7d978a` | 文字(`--text-3` 已調深 / 調亮以達 4.5:1) |
| `--c-primary-text` | `#0b7a3c` | `#2fd67a` | 淺底上的主色文字(連結、選中 Tab) |
| `--grad-primary` / `--on-primary` | `#0c8443 → #0b7a6e` / 白 | `#2fd67a → #3ee0cf` / `#04170d` | 主要按鈕底色與文字(比品牌漸層深,確保對比) |
| `--grad-brand` | `#12a150 → #12b5a6` | `#2fd67a → #3ee0cf` | 品牌漸層、Logo |
| `--grad-hero` | `#0b6b3a → #12a150` | `#0e3b26 → #1c7a4a` | 問候橫幅 |

- 圖表色(`ui/charts/palette.ts`):綠 → 青綠 → 琥珀 → 藍 → 紫…,以綠能色開頭;明暗各一組。
- 語意色仍以 `tone-*` class 提供(`tone-primary`、`tone-solar`、`tone-storage`、`tone-info`…)。

### 2.3 風格 token(玻璃 / 扁平)

沿用 GigaItApp 的 token 名稱(元件不需改),扁平只在 `tokens.css` 以 `[data-style='flat']` 覆寫:

| Token | 玻璃 | 扁平 |
| --- | --- | --- |
| `--glass` / `--glass-strong` / `--glass-soft` / `--glass-hover` | 半透明白 / 深綠(明亮 `rgb(255 255 255 / 0.62)`;黑暗 `rgb(16 34 26 / 0.58)`) | 實色(明亮 `#ffffff`;黑暗 `#10221a`) |
| `--glass-blur` | `blur(16px) saturate(160%)` | `none` |
| `--glass-highlight`(`.glass-edge` 漸層細邊) | 白 → 綠漸層 | `none`,改由 `--glass-border` 1px 實線 |
| `--shadow-sm` / `--shadow-md` / `--shadow-glow` | 柔和陰影 + 綠色光暈 | `none`(浮層 `--shadow-pop`、`--shadow-lg` 保留) |
| `--bg-glow-1..3`、`--bg-grid` | 三個光點(綠、青綠、琥珀)+ 網格 | 透明 + 極淡網格 |
| `--card-glow-opacity` | `1` | `0`(GCard `glow`、GHero / 品牌面板光點不顯示) |
| `--radius-lg` / `--radius-xl` | `16px` / `22px` | `12px` / `14px` |

- 問候橫幅與品牌面板固定深綠底,文字用 `--on-hero`,光點用 `--hero-glow-1/2`(明暗相同)。

- **對比**:四種組合的文字對背景至少 4.5:1(大字 3:1);新增 token 時以瀏覽器實際檢查。

## 3. 全域元件

沿用 GigaItApp 的 G* 元件(GButton、GCard、GStatCard、GTable、GTabs、GInput、GSelect、GModal、GBadge、GProgress、GRing、GDonut、GLazy…,用法見 GigaItApp `docs/UI-GUIDE.md` §3),調整:

| 元件 | 差異 |
| --- | --- |
| `GCard` | 背景、邊框、陰影、模糊只讀風格 token;`glow` 在扁平時無作用 |
| `GHero`(新增,M1) | 問候橫幅:`eyebrow`(日期)、`title`、`meta`(身分資訊)、`actions` slot(快捷按鈕)、`aside` slot(右側資訊卡);背景 `--grad-hero` |
| `GQuickTile`(規劃,M4) | 常用功能圖示格:圖示底色取 tone、標題、英文副標;鍵盤可聚焦 |
| `GAppSwitcher`(新增,M1) | 應用切換:`apps`(`{ code, name, basePath, icon }`)、`current`、`derived`(暫時推導時在下拉底部標示);一個以下不顯示;整頁導向;**GigaItApp 同步同一版本** |
| `GStyleToggle`(新增,M1) | 風格(玻璃 / 扁平)與明暗兩個切換按鈕 |
| `GAlert`(新增,M1) | 區塊提示 `tone="info|success|warning|danger"`:表單錯誤(含 requestId)、說明文字 |
| `GBadge` | 文字色與 `--text` 混合(明亮加深、黑暗提亮),小字也達 4.5:1 |
| `GButton` | `primary` 用 `--grad-primary` / `--on-primary`;`danger` 用 `--grad-danger` |

## 4. 版面

```
┌──────────────┬────────────────────────────────────────────────────────────┐
│ Logo 碩禾集團 │ 頁面標題 / 麵包屑      [搜尋功能、表單、同仁…] [風格][明暗][🔔][應用切換][帳號▾] │
│ 單一入口      ├────────────────────────────────────────────────────────────┤
│ ─ 首頁        │  內容區(GCard 格線;頁首動作按鈕 Teleport 到 #page-actions)             │
│ ─ 個人服務 ▸  │                                                            │
│ ─ 表單與簽核 ▸│                                                            │
│ ─ 行政資源 ▸  │                                                            │
│ ─ 集團與公告 ▸│                                                            │
│ …            │                                                            │
│ 使用者卡片     │                                                            │
│ 登出          │                                                            │
└──────────────┴────────────────────────────────────────────────────────────┘
```

- 側欄:兩層選單,項目含中文名稱與英文副標(參考畫面);收合、浮出、≤ 960px 抽屜同 GigaItApp。
- **應用切換**:頂列帳號左側;`me.apps` 只有一個時不顯示。Gateway 尚未提供 `apps`(G3)時暫以權限推導(`composables/apps.ts` 的 `TEMP_APPS`)。
- 選單的名稱、英文副標、圖示、路徑與權限都定義在 `router.ts`(`MENU_GROUPS` + 路由 meta `group`);只有一個同名功能的群組(首頁)直接顯示為連結。
- 使用者卡片:頭像、姓名、工號 · 分機,點擊到個人資料。

### 4.1 首頁區塊(PRD §6.4)

| 列 | 區塊 | 桌機欄寬 | 手機 |
| --- | --- | --- | --- |
| 1 | `GHero`:問候 + 快捷按鈕;右側今日出勤卡 | 12 | 堆疊 |
| 2 | `GStatCard` ×4:本月出勤、加班、待簽核、教育訓練 | 3+3+3+3 | 2×2 |
| 3 | 常用功能 `GQuickTile` ×8 | 12 | 4 欄 → 2 欄 |
| 4 | 待我簽核(`GTable` + 核准 / 退回)、我的假期(`GRing` + `GProgress`) | 8+4 | 堆疊 |
| 5 | 最新公告、近期行程 | 8+4 | 堆疊 |

- 首屏(列 1–3)由聚合路由一次取得;列 4、5 以 `<GLazy>` 捲動到才顯示(資料已在聚合回應中,不另外請求)。
- 模擬資料的區塊右上角顯示 `GBadge tone="warning"`「模擬」。

## 5. 權限在畫面上的用法

| 情境 | 寫法 |
| --- | --- |
| 應用 | 全域守衛:`me.apps` 不含 `portal` → `NoAccess` 頁 |
| 選單 / 頁面 | 路由 `meta.permission`(`kind=menu` 代碼);側欄只顯示有權限的功能 |
| Tab | `GTabs` item 的 `permission`(`kind=tab` 代碼) |
| 按鈕 | `<GButton v-can="'portal.news.publish'">`(`kind=button`,= 寫入 API 權限) |

前端權限只是體驗,BFF 一定檢查(Gateway FRONTEND-GUIDE §7.2)。

## 6. 新增一個頁面

1. 在 PRD §6.5 登記功能、Tab、按鈕與權限代碼;portal-api 上線前登記到 `deploy/gateway-rbac.yaml` 並以 `sh deploy/apply-gateway-rbac.sh test <Gateway test.env>` 套用,上線後改在 `backend/src/openapi.ts` 的 `x-permissions` 宣告(`kind`、`parent`、`sort`)。
2. `router.ts`:功能頁用 `page()`(TabbedPage),`meta` 填 `group`、`permission`、`title`、`subtitle`(英文副標)、`icon`、`milestone`,Tab 的 `permission` 填 tab 代碼。
3. 資料:單筆 `useAsync`、清單 `usePaged`、首屏以外 `<GLazy>`;錯誤 `<GEmpty tone="danger">` + 重試。
4. **四種風格組合** × 1440px / 375px 都用瀏覽器看過;更新 Gherkin 與修正紀錄。

## 7. 禁止事項

- 頁面內寫按鈕 / 卡片 / 表格基本樣式,或寫死色碼、陰影、圓角、模糊數值
- 元件內判斷 `data-style` 或 `data-theme`(差異一律放在 token)
- 直接 import `lucide-vue-next`、直接呼叫 `fetch`、前端寫死應用清單或權限
- Token、密碼存入 localStorage / sessionStorage(明暗與風格偏好可以)
- 引用外部 CDN 字型或腳本(CSP 會擋)
