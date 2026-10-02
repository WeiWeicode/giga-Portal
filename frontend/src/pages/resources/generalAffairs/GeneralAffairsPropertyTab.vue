<script setup lang="ts">
/**
 * 總務個人資產明細 (對齊 old_PortalSolar GAffairs.aspx Tab3)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GModal, GSelect } from '@/ui';

interface PropertyItem {
  id: string;
  name: string;
  category: 'IT資訊設備' | '辦公事務設備' | '廠務儀器設備';
  model: string;
  assignedDate: string;
  location: string;
  status: '正常使用中' | '送修中' | '申請報廢中';
  cost: number;
  spec: string;
}

const properties = ref<PropertyItem[]>([
  {
    id: 'FA20230045',
    name: '筆記型電腦 ThinkPad X1 Carbon',
    category: 'IT資訊設備',
    model: 'Lenovo Gen 11 (i7-1365U / 32G / 1TB SSD)',
    assignedDate: '2023-05-10',
    location: '湖口一廠 3F 資訊部 (座號: S142)',
    status: '正常使用中',
    cost: 48500,
    spec: '配發原廠 65W Type-C 電源供應器、防窺保護貼',
  },
  {
    id: 'FA20230092',
    name: '27 吋 2K 護眼專業螢幕',
    category: 'IT資訊設備',
    model: 'Dell UltraSharp U2724D',
    assignedDate: '2023-05-12',
    location: '湖口一廠 3F 資訊部 (座號: S142)',
    status: '正常使用中',
    cost: 13900,
    spec: '含 HDMI 2.0 連接線與人體工學升降旋轉支架',
  },
  {
    id: 'FA20220118',
    name: '人體工學高透氣網椅',
    category: '辦公事務設備',
    model: 'Ergohuman Plus 旗艦版',
    assignedDate: '2022-09-01',
    location: '湖口一廠 3F 資訊部 (座號: S142)',
    status: '正常使用中',
    cost: 15800,
    spec: '黑框黑網，含 3D 調整扶手與腰靠支撐',
  },
  {
    id: 'FA20240031',
    name: '便攜式手持標籤列印機',
    category: '辦公事務設備',
    model: 'Brother PT-P710BT',
    assignedDate: '2024-03-15',
    location: '湖口一廠 3F 伺服器機房資產櫃 A-02',
    status: '正常使用中',
    cost: 4200,
    spec: '支援藍牙與行動 App 列印，含 24mm 標籤帶 2 捲',
  },
  {
    id: 'FA20210088',
    name: '數位電錶 / 網路巡檢分析儀',
    category: '廠務儀器設備',
    model: 'Fluke MicroScanner MS2-100',
    assignedDate: '2021-11-20',
    location: '湖口一廠 1F 弱電控制室',
    status: '正常使用中',
    cost: 22000,
    spec: '定期年度送外校正，校正有效期限至 2026/11',
  },
]);

const searchKeyword = ref('');
const categoryFilter = ref('');

const filteredList = computed(() => {
  return properties.value.filter((item) => {
    const matchKw =
      !searchKeyword.value ||
      item.id.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
      item.name.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
      item.model.toLowerCase().includes(searchKeyword.value.toLowerCase());
    const matchCat = !categoryFilter.value || item.category === categoryFilter.value;
    return matchKw && matchCat;
  });
});

const totalItems = computed(() => properties.value.length);
const totalCost = computed(() => properties.value.reduce((acc, cur) => acc + cur.cost, 0));

const detailModal = ref(false);
const selectedItem = ref<PropertyItem | null>(null);

function viewDetail(item: PropertyItem) {
  selectedItem.value = item;
  detailModal.value = true;
}
</script>

<template>
  <div class="ga-property-tab stack">
    <!-- 統計概況卡片 -->
    <div class="stat-grid">
      <GCard class="stat-box glass">
        <span class="faint small">保管資產總數</span>
        <strong class="stat-value mono">{{ totalItems }} 件</strong>
      </GCard>
      <GCard class="stat-box glass">
        <span class="faint small">IT 資訊設備</span>
        <strong class="stat-value mono">2 件</strong>
      </GCard>
      <GCard class="stat-box glass">
        <span class="faint small">辦公事務設備</span>
        <strong class="stat-value mono">2 件</strong>
      </GCard>
      <GCard class="stat-box glass">
        <span class="faint small">資產總原值</span>
        <strong class="stat-value mono text-primary">NT$ {{ totalCost.toLocaleString() }}</strong>
      </GCard>
    </div>

    <!-- 搜尋與過濾 -->
    <GCard class="glass search-bar">
      <div class="filter-row">
        <div class="filter-item">
          <label class="filter-label">關鍵字搜尋</label>
          <GInput v-model="searchKeyword" placeholder="搜尋財產編號、設備名稱、廠牌型號..." />
        </div>
        <div class="filter-item filter-select">
          <label class="filter-label">資產類別</label>
          <GSelect
            v-model="categoryFilter"
            :options="[
              { label: '全部類別', value: '' },
              { label: 'IT資訊設備', value: 'IT資訊設備' },
              { label: '辦公事務設備', value: '辦公事務設備' },
              { label: '廠務儀器設備', value: '廠務儀器設備' },
            ]"
          />
        </div>
      </div>
    </GCard>

    <!-- 資產列表 -->
    <GCard class="glass table-wrapper">
      <table class="property-table">
        <thead>
          <tr>
            <th>財產編號</th>
            <th>設備名稱</th>
            <th>類別</th>
            <th>廠牌與規格型號</th>
            <th>保管日期</th>
            <th>存放地點</th>
            <th>狀態</th>
            <th class="text-right">原值金額</th>
            <th class="text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filteredList" :key="item.id">
            <td class="mono font-bold">{{ item.id }}</td>
            <td>{{ item.name }}</td>
            <td>
              <GBadge tone="neutral">{{ item.category }}</GBadge>
            </td>
            <td class="faint small">{{ item.model }}</td>
            <td class="mono small">{{ item.assignedDate }}</td>
            <td class="small">{{ item.location }}</td>
            <td>
              <GBadge :tone="item.status === '正常使用中' ? 'healthy' : 'warning'">{{ item.status }}</GBadge>
            </td>
            <td class="mono text-right">NT$ {{ item.cost.toLocaleString() }}</td>
            <td class="text-center">
              <GButton size="sm" variant="ghost" @click="viewDetail(item)">檢視規格</GButton>
            </td>
          </tr>
          <tr v-if="filteredList.length === 0">
            <td colspan="9" class="text-center faint p-4">查無符合條件之保管資產</td>
          </tr>
        </tbody>
      </table>
    </GCard>

    <!-- 提醒說明 -->
    <GAlert tone="neutral" icon="info">
      依公司資產管理辦法，個人保管之各項硬體與設備應善盡保管之責。若有毀損、遺失或調轉部門需辦理資產移交時，請向總務組提出「資產異動/報廢申請單」。
    </GAlert>

    <!-- 詳情 Modal -->
    <GModal v-model="detailModal" title="固定資產詳細資訊" width="600px">
      <div v-if="selectedItem" class="modal-content-stack">
        <div class="info-row">
          <span class="info-label">財產編號：</span>
          <span class="mono font-bold">{{ selectedItem.id }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">設備名稱：</span>
          <span>{{ selectedItem.name }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">廠牌型號：</span>
          <span>{{ selectedItem.model }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">保管人：</span>
          <span>王大明 (工號: V112001) / 資訊服務部</span>
        </div>
        <div class="info-row">
          <span class="info-label">保管起始日：</span>
          <span class="mono">{{ selectedItem.assignedDate }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">存放地點：</span>
          <span>{{ selectedItem.location }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">資產原值：</span>
          <span class="mono font-bold text-primary">NT$ {{ selectedItem.cost.toLocaleString() }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">配件與備註：</span>
          <span>{{ selectedItem.spec }}</span>
        </div>
      </div>
      <template #footer>
        <GButton variant="secondary" @click="detailModal = false">關閉</GButton>
      </template>
    </GModal>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
.stat-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.stat-value {
  font-size: 20px;
}
.search-bar {
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
  min-width: 200px;
}
.filter-select {
  max-width: 220px;
}
.filter-label {
  display: block;
  font-size: 13px;
  color: var(--color-faint);
  margin-bottom: 4px;
}
.table-wrapper {
  overflow-x: auto;
  padding: 0;
}
.property-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.property-table th,
.property-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border);
}
.property-table th {
  background: var(--color-surface-hover);
  text-align: left;
  font-weight: 600;
  font-size: 13px;
}
.text-right {
  text-align: right;
}
.text-center {
  text-align: center;
}
.font-bold {
  font-weight: 600;
}
.modal-content-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.info-row {
  display: flex;
  font-size: 14px;
}
.info-label {
  width: 110px;
  color: var(--color-faint);
  flex-shrink: 0;
}
</style>
