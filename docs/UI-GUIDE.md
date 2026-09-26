# 員工入口網 — 前端 UI 規範

> **UI 全域套用**:頁面只組合 `src/ui/` 的全域元件與設計 token,不在頁面裡各自刻按鈕、卡片、表格、表單、對話框的樣式。
> 元件與規則沿用 GigaItApp `docs/UI-GUIDE.md`(框架複製來源),本文件只寫**差異**:綠能色盤、玻璃 / 扁平風格、應用切換、首頁版面。
> 對應 [PRD.md](PRD.md) §6.6、§7;AI 協作規則見 [../AGENT.md](../AGENT.md) §8。**狀態:規劃中**。

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
- 頂列兩個切換按鈕:風格(玻璃 ↔ 扁平,圖示 `layers`)、明暗(`sun` / `moon`);偏好記在瀏覽器。
- `@supports not (backdrop-filter: blur(1px))` 或 `prefers-reduced-transparency: reduce` 時強制扁平;`prefers-reduced-motion` 時關閉光暈動畫。

### 2.2 色盤(明亮 / 黑暗)

| Token | 明亮 | 黑暗 | 用途 |
| --- | --- | --- | --- |
| `--c-primary` | `#12a150` | `#2fd67a` | 主要按鈕、選中、連結 |
| `--c-primary-deep` | `#0b6b3a` | `#0e3b26` | 問候橫幅漸層深色端 |
| `--c-accent-solar` | `#f5a524` | `#ffc04d` | 強調、提醒、打卡狀態 |
| `--c-accent-storage` | `#12b5a6` | `#3ee0cf` | 圖表第二色、資訊標籤 |
| `--c-info` / `--c-warning` / `--c-danger` | `#2f7de1` / `#e0901a` / `#e0483e` | `#5ea2ff` / `#ffb547` / `#ff6b61` | 語意色 |
| `--bg` | `#f3faf6` | `#08130e` | 頁面底色 |
| `--text` / `--text-2` / `--text-3` | `#0f2a1d` / `#4b6358` / `#8aa196` | `#e3f2ea` / `#9fb8ac` / `#5f7a6d` | 文字 |
| `--grad-brand` | `#12a150 → #12b5a6` | `#2fd67a → #3ee0cf` | 品牌漸層、Logo |
| `--grad-hero` | `#0b6b3a → #12a150` | `#0e3b26 → #1c7a4a` | 問候橫幅 |

- 圖表色(`ui/charts/palette.ts`):綠 → 青綠 → 琥珀 → 藍 → 紫…,以綠能色開頭;明暗各一組。
- 語意色仍以 `tone-*` class 提供(`tone-primary`、`tone-solar`、`tone-storage`、`tone-info`…)。

### 2.3 風格 token(玻璃 / 扁平)

| Token | 玻璃 | 扁平 |
| --- | --- | --- |
| `--surface` | 明亮 `rgb(255 255 255 / 0.62)`;黑暗 `rgb(16 34 26 / 0.55)` | 明亮 `#ffffff`;黑暗 `#10221a` |
| `--surface-blur` | `16px` | `0` |
| `--surface-border` | 漸層細邊(`.glass-edge`) | `1px solid var(--line)` |
| `--shadow-card` | 柔和陰影 + 綠色光暈 | `none`(浮層 `--shadow-pop` 保留) |
| `--bg-decor` | 網格 + 三個光點(綠、青綠、琥珀) | 極淡網格 |
| `--radius-card` | `16px` | `12px` |

- **對比**:四種組合的文字對背景至少 4.5:1(大字 3:1);新增 token 時以瀏覽器實際檢查。

## 3. 全域元件

沿用 GigaItApp 的 G* 元件(GButton、GCard、GStatCard、GTable、GTabs、GInput、GSelect、GModal、GBadge、GProgress、GRing、GDonut、GLazy…,用法見 GigaItApp `docs/UI-GUIDE.md` §3),調整:

| 元件 | 差異 |
| --- | --- |
| `GCard` | 背景、邊框、陰影、模糊只讀風格 token;`glow` 在扁平時無作用 |
| `GHero`(新增) | 問候橫幅:日期、問候語、身分資訊、快捷按鈕 slot、右側資訊卡 slot;背景 `--grad-hero` |
| `GQuickTile`(新增) | 常用功能圖示格:圖示底色取 tone、標題、英文副標;鍵盤可聚焦 |
| `GAppSwitcher`(新增) | 應用切換:圖示按鈕 + 下拉,項目 `{ code, name, basePath, icon }`,標示目前應用;**GigaItApp 同步同一版本** |
| `GStyleToggle`(新增) | 玻璃 / 扁平切換按鈕(與明暗切換並列) |

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
- **應用切換**:頂列帳號左側;`me.apps` 只有一個時不顯示。
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

1. 在 PRD §6.5 登記功能、Tab、按鈕與權限代碼;在 `backend/src/openapi.ts` 的 `x-permissions` 宣告(`kind`、`parent`、`sort`)。
2. `router.ts`:功能頁用 `TabbedPage`,`meta` 填 `permission`、`title`、`subtitle`(英文副標)、`icon`、`tabs`。
3. 資料:單筆 `useAsync`、清單 `usePaged`、首屏以外 `<GLazy>`;錯誤 `<GEmpty tone="danger">` + 重試。
4. **四種風格組合** × 1440px / 375px 都用瀏覽器看過;更新 Gherkin 與修正紀錄。

## 7. 禁止事項

- 頁面內寫按鈕 / 卡片 / 表格基本樣式,或寫死色碼、陰影、圓角、模糊數值
- 元件內判斷 `data-style` 或 `data-theme`(差異一律放在 token)
- 直接 import `lucide-vue-next`、直接呼叫 `fetch`、前端寫死應用清單或權限
- Token、密碼存入 localStorage / sessionStorage(明暗與風格偏好可以)
- 引用外部 CDN 字型或腳本(CSP 會擋)
