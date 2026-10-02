<script setup lang="ts">
/**
 * 集團系統快速入口 (對齊 old_PortalSolar 集團系統 17 個外部系統)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GSelect } from '@/ui';

interface SystemLink {
  id: string;
  name: string;
  category: '行政與流程' | '差勤與人資' | '工安與文管' | '資訊與郵件' | '員工福利';
  desc: string;
  url: string;
  ssoSupported: boolean;
  intranetOnly: boolean;
}

const systems = ref<SystemLink[]>([
  {
    id: 'SYS-01',
    name: 'BPM 電子簽核系統 (EasyFlow)',
    category: '行政與流程',
    desc: '集團表單簽核中心，涵蓋請假、加班、公務用車、修繕與各項請購單據簽核流程。',
    url: 'http://10.10.130.190:9090/NaNaWeb/',
    ssoSupported: true,
    intranetOnly: true,
  },
  {
    id: 'SYS-02',
    name: 'ISO2Web 知識文管系統',
    category: '工安與文管',
    desc: 'ISO 國際標準作業程序書 (SOP)、工程規格書、表單範本與法規知識庫檢索。',
    url: '/iso-info',
    ssoSupported: true,
    intranetOnly: true,
  },
  {
    id: 'SYS-03',
    name: '員工健康管理系統 (Health System)',
    category: '差勤與人資',
    desc: '年度員工健康檢查報告查詢、生理數值追蹤、健康諮詢及醫護衛教指導。',
    url: '/health-system',
    ssoSupported: true,
    intranetOnly: false,
  },
  {
    id: 'SYS-04',
    name: '訂便當系統 (DinBenDon - Win7相容版)',
    category: '行政與流程',
    desc: '各廠區常日班與值班同仁午晚餐團體供餐登記與扣款查詢。',
    url: '/dinbendon-legacy',
    ssoSupported: true,
    intranetOnly: true,
  },
  {
    id: 'SYS-05',
    name: '新版行動訂便當系統 (DinBenDon New)',
    category: '行政與流程',
    desc: '支援行動裝置之新一代員工餐廳供餐預約與菜單評價反饋平台。',
    url: '/dinbendon-new',
    ssoSupported: true,
    intranetOnly: false,
  },
  {
    id: 'SYS-06',
    name: '危害性化學品清單管理 (SDS Database)',
    category: '工安與文管',
    desc: '全廠化學物質安全資料表 (SDS)、急救處置規範、毒化物與關注化學品列管申報。',
    url: '/ehs-chemicals',
    ssoSupported: true,
    intranetOnly: true,
  },
  {
    id: 'SYS-07',
    name: '年考核與考績評定系統 (Annual Performance)',
    category: '差勤與人資',
    desc: '年度績效自評、各級主管考績評核、職能指標評分及面談紀錄提報。',
    url: '/annual-performance',
    ssoSupported: true,
    intranetOnly: true,
  },
  {
    id: 'SYS-08',
    name: '環安衛資料庫管理系統 (ESH Safety)',
    category: '工安與文管',
    desc: '工安巡檢紀錄、虛驚事故回報、外包商施工安全管制及作業環境監測。',
    url: '/safety-db',
    ssoSupported: true,
    intranetOnly: true,
  },
  {
    id: 'SYS-09',
    name: '好書分享與知識典藏平台 (Book Share GBS)',
    category: '員工福利',
    desc: '集團圖書借閱、讀書會好書推薦、心得分享與個人閱讀點數累積。',
    url: '/book-share',
    ssoSupported: true,
    intranetOnly: false,
  },
  {
    id: 'SYS-10',
    name: 'E-Learning 數位學習平台',
    category: '差勤與人資',
    desc: '年度工安必修課、資安宣導、ESG 永續與專業技術線上數位影音課程。',
    url: '/elearning',
    ssoSupported: true,
    intranetOnly: false,
  },
  {
    id: 'SYS-11',
    name: '資源預約系統 (ERMS)',
    category: '行政與流程',
    desc: '會議室排程、簡報投影設備、視訊會議帳號及外賓接待室線上預約借用。',
    url: '/erms',
    ssoSupported: true,
    intranetOnly: true,
  },
  {
    id: 'SYS-12',
    name: '新版智慧資源預約平台 (ERMS New)',
    category: '行政與流程',
    desc: '跨廠區智慧會議室整合系統，支援 Outlook 行事曆同步與電子門牌排程。',
    url: '/ermsn',
    ssoSupported: true,
    intranetOnly: false,
  },
  {
    id: 'SYS-13',
    name: '職工福利委員會網站 (Welfare Solar)',
    category: '員工福利',
    desc: '員工旅遊補助申請、三節禮品登記、特約廠商折扣代碼及社團文康活動。',
    url: '/welfare',
    ssoSupported: true,
    intranetOnly: false,
  },
  {
    id: 'SYS-14',
    name: 'WebApp 移動應用門戶',
    category: '資訊與郵件',
    desc: '集團專屬行動裝置應用程式發布中心，支援 iOS / Android 內部企業 App 安裝。',
    url: '/webapp',
    ssoSupported: true,
    intranetOnly: true,
  },
  {
    id: 'SYS-15',
    name: 'NotesApp 企業郵件協同辦公',
    category: '資訊與郵件',
    desc: 'Lotus Notes 公務郵件、部門行事曆協同作業及企業通訊錄同步。',
    url: '/notesapp',
    ssoSupported: true,
    intranetOnly: true,
  },
  {
    id: 'SYS-16',
    name: '外寄郵件安全審核系統 (Release Mail)',
    category: '資訊與郵件',
    desc: '外寄郵件 DLP 資料外洩防護審查、機敏附件攔截隔離與放行審批查詢。',
    url: 'http://releasemail.gigasolar.com.tw/Login.aspx',
    ssoSupported: false,
    intranetOnly: true,
  },
  {
    id: 'SYS-17',
    name: '個人垃圾郵件管理系統 (MSW PMM)',
    category: '資訊與郵件',
    desc: '防垃圾郵件閘道隔離清單、黑白名單設定及誤判郵件即時放行與投遞。',
    url: 'http://10.10.10.247/mswpmm/Common/SignIn.aspx',
    ssoSupported: false,
    intranetOnly: true,
  },
]);

const searchKeyword = ref('');
const categoryFilter = ref('');

const filteredSystems = computed(() => {
  return systems.value.filter((s) => {
    const matchCat = !categoryFilter.value || s.category === categoryFilter.value;
    const kw = searchKeyword.value.toLowerCase().trim();
    const matchKw =
      !kw ||
      s.name.toLowerCase().includes(kw) ||
      s.desc.toLowerCase().includes(kw) ||
      s.category.toLowerCase().includes(kw);
    return matchCat && matchKw;
  });
});

function openSystem(sys: SystemLink) {
  if (sys.url.startsWith('http')) {
    window.open(sys.url, '_blank');
  } else {
    alert(`系統跳轉通知：正在以單一簽入 (SSO) 憑證登入「${sys.name}」...`);
  }
}
</script>

<template>
  <div class="links-page stack">
    <!-- 頂部指引 -->
    <GCard class="glass banner-card">
      <div class="banner-top">
        <div>
          <h3 class="banner-title">🌐 碩禾集團整合系統導航 (Single Sign-On SSO)</h3>
          <p class="banner-desc faint">
            本專區整合集團 17 個核心營運與行政外部應用系統。標示「SSO 免登入」之系統將由入口網自動派發認證 Token，無需重複輸入帳號密碼。
          </p>
        </div>
      </div>
    </GCard>

    <!-- 篩選列 -->
    <GCard class="glass filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <label class="filter-label">系統關鍵字搜尋</label>
          <GInput v-model="searchKeyword" placeholder="搜尋系統名稱、功能關鍵字、SOP、訂餐、郵件..." />
        </div>
        <div class="filter-item filter-select">
          <label class="filter-label">系統領域分類</label>
          <GSelect
            v-model="categoryFilter"
            :options="[
              { label: '全部系統 (17)', value: '' },
              { label: '行政與流程', value: '行政與流程' },
              { label: '差勤與人資', value: '差勤與人資' },
              { label: '工安與文管', value: '工安與文管' },
              { label: '資訊與郵件', value: '資訊與郵件' },
              { label: '員工福利', value: '員工福利' },
            ]"
          />
        </div>
      </div>
    </GCard>

    <!-- 系統卡片清單 -->
    <div class="systems-grid">
      <GCard v-for="sys in filteredSystems" :key="sys.id" class="glass sys-card">
        <div class="sys-top">
          <div class="sys-header-row">
            <h4 class="sys-name">{{ sys.name }}</h4>
            <GBadge tone="storage">{{ sys.category }}</GBadge>
          </div>
          <p class="sys-desc faint small">{{ sys.desc }}</p>
        </div>

        <div class="sys-bottom">
          <div class="tags-row">
            <GBadge :tone="sys.ssoSupported ? 'healthy' : 'neutral'">
              {{ sys.ssoSupported ? '⚡ SSO 免登入' : '一般登入' }}
            </GBadge>
            <GBadge v-if="sys.intranetOnly" tone="warning">內網限定</GBadge>
          </div>
          <GButton size="sm" tone="primary" @click="openSystem(sys)">
            前往系統 ↗
          </GButton>
        </div>
      </GCard>
    </div>

    <GAlert tone="neutral" icon="info">
      標示「內網限定」之系統僅能在廠區局域網路內或透過公司 VPN 連線開啟。若於外網環境遇到連線逾時，請先啟動公司 VPN 客戶端。
    </GAlert>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.banner-card {
  padding: 16px 20px;
}
.banner-title {
  margin: 0 0 6px 0;
  font-size: 18px;
}
.banner-desc {
  margin: 0;
  font-size: 14px;
}
.filter-card {
  padding: 12px 16px;
}
.filter-row {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.filter-item {
  flex: 1;
  min-width: 220px;
}
.filter-select {
  max-width: 200px;
}
.filter-label {
  display: block;
  font-size: 13px;
  color: var(--color-faint);
  margin-bottom: 4px;
}
.systems-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}
.sys-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 18px;
}
.sys-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}
.sys-name {
  margin: 0 0 4px 0;
  font-size: 15.5px;
  line-height: 1.4;
}
.sys-desc {
  line-height: 1.5;
  margin: 4px 0 0 0;
}
.sys-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--color-border);
  padding-top: 10px;
}
.tags-row {
  display: flex;
  gap: 6px;
}
</style>
