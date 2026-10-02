<script setup lang="ts">
/**
 * 部門資產設備盤點清冊 (對齊 old_PortalSolar DeptPropertyInfo.aspx)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GModal, GSelect } from '@/ui';

interface DeptProperty {
  id: string;
  name: string;
  category: 'IT資訊設備' | '分析檢驗儀器' | '生產設備' | '辦公事務設備';
  model: string;
  location: string;
  keeper: string;
  buyDate: string;
  status: '正常使用中' | '委外送修中' | '待報廢';
  cost: number;
}

const list = ref<DeptProperty[]>([
  {
    id: 'FA20220015',
    name: '高效能高階運算伺服器 (Dell PowerEdge R750)',
    category: 'IT資訊設備',
    model: 'Dell PowerEdge R750 (2x Xeon Gold / 128G / RAID5)',
    location: '湖口一廠 3F 核心機房 Rack-03',
    keeper: '王大明 (V112001)',
    buyDate: '2022-04-15',
    status: '正常使用中',
    cost: 320000,
  },
  {
    id: 'FA20230045',
    name: '筆記型電腦 ThinkPad X1 Carbon',
    category: 'IT資訊設備',
    model: 'Lenovo Gen 11 (i7-1365U / 32G / 1TB SSD)',
    location: '湖口一廠 3F 資訊部 S142',
    keeper: '王大明 (V112001)',
    buyDate: '2023-05-10',
    status: '正常使用中',
    cost: 48500,
  },
  {
    id: 'FA20210088',
    name: '數位電錶 / 網路巡檢分析儀',
    category: '分析檢驗儀器',
    model: 'Fluke MicroScanner MS2-100',
    location: '湖口一廠 1F 弱電控制室',
    keeper: '鄭智寬 (S180002)',
    buyDate: '2021-11-20',
    status: '正常使用中',
    cost: 22000,
  },
  {
    id: 'FA20240012',
    name: '48埠 10G 光纖交換機 (Cisco Catalyst 9300)',
    category: 'IT資訊設備',
    model: 'Cisco C9300-48UXM-A',
    location: '湖口一廠 3F 核心機房 Rack-01',
    keeper: '林協理 (V108001)',
    buyDate: '2024-01-10',
    status: '正常使用中',
    cost: 185000,
  },
  {
    id: 'FA20200033',
    name: '精密網印黏度流變測試儀',
    category: '分析檢驗儀器',
    model: 'Brookfield DV2T',
    location: '湖口一廠 2F 實驗室 A',
    keeper: '黃宏達 (V112045)',
    buyDate: '2020-09-18',
    status: '正常使用中',
    cost: 156000,
  },
]);

const searchKeyword = ref('');
const categoryFilter = ref('');

const filteredList = computed(() => {
  return list.value.filter((item) => {
    const kw = searchKeyword.value.toLowerCase().trim();
    const matchKw =
      !kw ||
      item.id.toLowerCase().includes(kw) ||
      item.name.toLowerCase().includes(kw) ||
      item.keeper.toLowerCase().includes(kw) ||
      item.location.toLowerCase().includes(kw);
    const matchCat = !categoryFilter.value || item.category === categoryFilter.value;
    return matchKw && matchCat;
  });
});

const totalItems = computed(() => list.value.length);
const totalCost = computed(() => list.value.reduce((acc, cur) => acc + cur.cost, 0));
</script>

<template>
  <div class="dept-property-page stack">
    <!-- 概況指標卡 -->
    <div class="stats-grid">
      <GCard class="glass stat-card">
        <span class="faint small">部門保管財產總件數</span>
        <strong class="stat-num mono text-primary">{{ totalItems }} 件</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">部門資產購置總原值</span>
        <strong class="stat-num mono text-primary">NT$ {{ totalCost.toLocaleString() }}</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">年度盤點盤查合格率</span>
        <strong class="stat-num mono text-healthy">100%</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">正常運作使用狀態</span>
        <strong class="stat-num mono text-healthy">{{ totalItems }} 件 (無異常)</strong>
      </GCard>
    </div>

    <!-- 篩選列 -->
    <GCard class="glass filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <label class="filter-label">資產搜尋</label>
          <GInput v-model="searchKeyword" placeholder="搜尋財產編號、設備名稱、存放地點、保管人..." />
        </div>
        <div class="filter-item filter-select">
          <label class="filter-label">設備類別</label>
          <GSelect
            v-model="categoryFilter"
            :options="[
              { label: '全部類別', value: '' },
              { label: 'IT資訊設備', value: 'IT資訊設備' },
              { label: '分析檢驗儀器', value: '分析檢驗儀器' },
              { label: '生產設備', value: '生產設備' },
            ]"
          />
        </div>
      </div>
    </GCard>

    <!-- 資產表格 -->
    <GCard class="glass table-wrapper">
      <table class="property-table">
        <thead>
          <tr>
            <th>財產編號</th>
            <th>設備名稱</th>
            <th>類別</th>
            <th>規格與廠牌型號</th>
            <th>存放地點</th>
            <th>保管人</th>
            <th class="text-right">購置原值</th>
            <th class="text-center">狀態</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filteredList" :key="item.id">
            <td class="mono font-bold">{{ item.id }}</td>
            <td class="font-bold">{{ item.name }}</td>
            <td>
              <GBadge tone="storage">{{ item.category }}</GBadge>
            </td>
            <td class="small faint">{{ item.model }}</td>
            <td class="small">{{ item.location }}</td>
            <td class="font-bold text-primary">{{ item.keeper }}</td>
            <td class="mono text-right font-bold">NT$ {{ item.cost.toLocaleString() }}</td>
            <td class="text-center">
              <GBadge :tone="item.status === '正常使用中' ? 'healthy' : 'warning'">
                {{ item.status }}
              </GBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </GCard>

    <GAlert tone="neutral" icon="info">
      總務組每年 11 月配合會計師進行全廠固定資產年度實地抽盤。各部門主管應落實所屬財產設備條碼張貼與同仁異動交接管理。
    </GAlert>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 14px;
}
.stat-card {
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-num {
  font-size: 22px;
}
.text-healthy { color: var(--color-healthy); }
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
  font-size: 13.5px;
}
.property-table th, .property-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}
.property-table th {
  background: var(--color-surface-hover);
  text-align: left;
  font-weight: 600;
}
.text-right { text-align: right; }
.text-center { text-align: center; }
.font-bold { font-weight: 600; }
</style>
