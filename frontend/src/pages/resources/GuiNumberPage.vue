<script setup lang="ts">
/**
 * 集團統編資訊 (對齊 old_PortalSolar GUInumberInfo.aspx)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput } from '@/ui';

interface CompanyTaxInfo {
  name: string;
  guiNumber: string;
  representative: string;
  address: string;
  phone: string;
  category: '主要營運主體' | '綠能投資' | '職工福利' | '關係企業';
  website?: string;
  usageDesc: string;
}

const companies = ref<CompanyTaxInfo[]>([
  {
    name: '碩禾電子材料股份有限公司',
    guiNumber: '80433079',
    representative: '鄧耀中',
    address: '新竹縣湖口鄉中華路 122-18 號',
    phone: '+886-3-5981886',
    category: '主要營運主體',
    website: 'http://www.gigasolar.com.tw',
    usageDesc: '公務報銷、零用金請款、原物料採購、營業發票開立',
  },
  {
    name: '禾迅綠電股份有限公司',
    guiNumber: '53789131',
    representative: '鄧耀中',
    address: '新竹縣湖口鄉中華路 122-18 號',
    phone: '+886-3-5981886',
    category: '綠能投資',
    usageDesc: '太陽能案場建置、電站綠能維運合約請款',
  },
  {
    name: '碩禾電子材料股份有限公司職工福利委員會',
    guiNumber: '26127572',
    representative: '福委會主任委員',
    address: '新竹縣湖口鄉中華路 122-18 號',
    phone: '+886-3-5981886',
    category: '職工福利',
    usageDesc: '員工旅遊補助、三節禮品採購、文康社團活動費用',
  },
  {
    name: '芯和能源股份有限公司',
    guiNumber: '83526102',
    representative: '林佳和',
    address: '新竹縣湖口鄉中華路 122-18 號',
    phone: '+886-3-5981886',
    category: '綠能投資',
    usageDesc: '儲能系統工程、電力輔助服務請款',
  },
  {
    name: '國碩科技工業股份有限公司',
    guiNumber: '84687229',
    representative: '陳繼明',
    address: '新竹縣湖口鄉新竹工業區光復北路 66 號',
    phone: '+886-3-5985888',
    category: '關係企業',
    website: 'https://www.giga-storage.com',
    usageDesc: '集團母公司關聯採購、技術移轉與聯合採購',
  },
  {
    name: '創禾能源股份有限公司',
    guiNumber: '54932085',
    representative: '黃文信',
    address: '新竹縣湖口鄉中華路 122-18 號',
    phone: '+886-3-5981886',
    category: '關係企業',
    usageDesc: '屋頂型與地面型太陽能電廠設備採購',
  },
]);

const searchKeyword = ref('');
const copiedNo = ref<string | null>(null);

const filteredCompanies = computed(() => {
  const kw = searchKeyword.value.toLowerCase().trim();
  if (!kw) return companies.value;
  return companies.value.filter(
    (c) =>
      c.name.toLowerCase().includes(kw) ||
      c.guiNumber.includes(kw) ||
      c.address.toLowerCase().includes(kw) ||
      c.representative.toLowerCase().includes(kw),
  );
});

function copyTaxId(taxId: string) {
  navigator.clipboard?.writeText(taxId);
  copiedNo.value = taxId;
  setTimeout(() => {
    copiedNo.value = null;
  }, 1500);
}
</script>

<template>
  <div class="gui-number-page stack">
    <!-- 統編使用指南卡片 -->
    <div class="usage-grid">
      <GCard class="glass usage-card usage-company">
        <div class="usage-title font-bold">公司統編用途</div>
        <p class="usage-text small">
          適用於各部門日常零用金報銷、公務差旅請款、儀器設備採購、原物料進貨等公司營運相關支出。
        </p>
      </GCard>
      <GCard class="glass usage-card usage-welfare">
        <div class="usage-title font-bold">福委會統編用途</div>
        <p class="usage-text small">
          適用於職工福利會相關補助（如員工個人旅遊補助發票、婚喪喜慶補助單據、特約商店文康活動）。
        </p>
      </GCard>
      <GCard class="glass usage-card usage-none">
        <div class="usage-title font-bold">免開統編項目</div>
        <p class="usage-text small">
          依公司規範，個人專案自費書籍補助、個人技能進修課程等免稅個人憑證，請索取二聯式發票。
        </p>
      </GCard>
    </div>

    <!-- 關鍵字檢索列 -->
    <GCard class="glass search-card">
      <div class="search-row">
        <div class="search-input-wrap">
          <label class="search-label">快速檢索公司統編</label>
          <GInput v-model="searchKeyword" placeholder="搜尋公司名稱、統一編號 8 碼、負責人或地址..." />
        </div>
      </div>
    </GCard>

    <!-- 公司統編卡片清單 -->
    <div class="companies-grid">
      <GCard v-for="c in filteredCompanies" :key="c.guiNumber" class="glass company-card">
        <div class="card-top-row">
          <strong class="company-name">{{ c.name }}</strong>
          <GBadge tone="storage">{{ c.category }}</GBadge>
        </div>

        <div class="tax-id-box">
          <span class="tax-id-label">統一編號</span>
          <span class="tax-id-value mono font-bold text-primary">{{ c.guiNumber }}</span>
          <GButton size="sm" variant="secondary" @click="copyTaxId(c.guiNumber)">
            {{ copiedNo === c.guiNumber ? '✓ 已複製' : '複製統編' }}
          </GButton>
        </div>

        <div class="details-list faint small">
          <div><strong>營業地址：</strong>{{ c.address }}</div>
          <div><strong>公司電話：</strong><span class="mono">{{ c.phone }}</span></div>
          <div><strong>登記負責人：</strong>{{ c.representative }}</div>
          <div><strong>常用情境：</strong>{{ c.usageDesc }}</div>
          <div v-if="c.website">
            <strong>官方網站：</strong>
            <a :href="c.website" target="_blank" rel="noopener noreferrer" class="web-link">
              {{ c.website }} ↗
            </a>
          </div>
        </div>
      </GCard>
    </div>

    <GAlert tone="neutral" icon="info">
      索取三聯式統一發票時，請務必請廠商完整填寫買受人全名（不可手寫簡稱）與正確統一編號 8 碼。若有發票塗改未蓋負責人印章者，將影響會計請款進度。
    </GAlert>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.usage-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}
.usage-card {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.usage-company {
  border-left: 4px solid #3b82f6;
}
.usage-welfare {
  border-left: 4px solid #10b981;
}
.usage-none {
  border-left: 4px solid #f59e0b;
}
.usage-title {
  font-size: 15px;
}
.usage-text {
  line-height: 1.5;
  color: var(--color-foreground);
}
.search-card {
  padding: 12px 16px;
}
.search-row {
  display: flex;
}
.search-input-wrap {
  flex: 1;
}
.search-label {
  display: block;
  font-size: 13px;
  color: var(--color-faint);
  margin-bottom: 4px;
}
.companies-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}
.company-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
}
.card-top-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}
.company-name {
  font-size: 16px;
  line-height: 1.4;
}
.tax-id-box {
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: 8px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tax-id-label {
  font-size: 13px;
  color: var(--color-faint);
}
.tax-id-value {
  font-size: 22px;
  letter-spacing: 1px;
}
.details-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.web-link {
  color: var(--color-primary);
  text-decoration: underline;
}
.font-bold {
  font-weight: 600;
}
</style>
