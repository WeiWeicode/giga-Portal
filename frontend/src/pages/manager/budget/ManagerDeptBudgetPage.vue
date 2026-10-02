<script setup lang="ts">
/**
 * 部門年度預算執行率查詢 (對齊 old_PortalSolar Budget_DeptInfoV2.aspx)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GProgress, GSelect } from '@/ui';

interface BudgetItem {
  accountCode: string;
  accountName: string;
  approved: number;
  spent: number;
  reserved: number;
  available: number;
  rate: number;
  status: '正常' | '即將用罄' | '超支警示';
}

const budgetItems = ref<BudgetItem[]>([
  {
    accountCode: '6101',
    accountName: '軟體授權與雲端系統維護費',
    approved: 3500000,
    spent: 2450000,
    reserved: 350000,
    available: 700000,
    rate: 70.0,
    status: '正常',
  },
  {
    accountCode: '6102',
    accountName: '核心硬體維修保固與汰換支出 (CAPEX)',
    approved: 4200000,
    spent: 3100000,
    reserved: 600000,
    available: 500000,
    rate: 73.8,
    status: '正常',
  },
  {
    accountCode: '6105',
    accountName: '國內外出差與交通旅費',
    approved: 800000,
    spent: 680000,
    reserved: 80000,
    available: 40000,
    rate: 85.0,
    status: '即將用罄',
  },
  {
    accountCode: '6108',
    accountName: '專業教育訓練與外部認證費',
    approved: 500000,
    spent: 280000,
    reserved: 50000,
    available: 170000,
    rate: 56.0,
    status: '正常',
  },
  {
    accountCode: '6112',
    accountName: '部門辦公事務耗材與雜支',
    approved: 300000,
    spent: 210000,
    reserved: 20000,
    available: 70000,
    rate: 70.0,
    status: '正常',
  },
]);

const selectedYear = ref('2026');

const totalApproved = computed(() => budgetItems.value.reduce((acc, cur) => acc + cur.approved, 0));
const totalSpent = computed(() => budgetItems.value.reduce((acc, cur) => acc + cur.spent, 0));
const totalReserved = computed(() => budgetItems.value.reduce((acc, cur) => acc + cur.reserved, 0));
const totalAvailable = computed(() => budgetItems.value.reduce((acc, cur) => acc + cur.available, 0));
const overallRate = computed(() => Math.round(((totalSpent.value + totalReserved.value) / totalApproved.value) * 100));
</script>

<template>
  <div class="dept-budget-page stack">
    <!-- 總覽指標卡 -->
    <div class="stats-grid">
      <GCard class="glass stat-card">
        <span class="faint small">年度核定總預算</span>
        <strong class="stat-num mono text-primary">NT$ {{ totalApproved.toLocaleString() }}</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">已動支實際支出</span>
        <strong class="stat-num mono">NT$ {{ totalSpent.toLocaleString() }}</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">採購合約請購保留款</span>
        <strong class="stat-num mono text-warning">NT$ {{ totalReserved.toLocaleString() }}</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">剩餘可用額度 (執行率: {{ overallRate }}%)</span>
        <strong class="stat-num mono text-healthy">NT$ {{ totalAvailable.toLocaleString() }}</strong>
      </GCard>
    </div>

    <!-- 篩選列 -->
    <GCard class="glass filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <label class="filter-label">預算年度</label>
          <GSelect
            v-model="selectedYear"
            :options="[
              { label: '2026 年度', value: '2026' },
              { label: '2025 年度', value: '2025' },
            ]"
          />
        </div>
      </div>
    </GCard>

    <!-- 預算科目明細表格 -->
    <GCard class="glass table-wrapper">
      <div class="table-header">
        <strong class="font-bold">2026 年度資訊服務部會計科目預算執行明細</strong>
        <span class="faint small">幣別：新台幣 (TWD) ｜ 資料時間：當季累計</span>
      </div>
      <table class="budget-table">
        <thead>
          <tr>
            <th>會計科目</th>
            <th>科目名稱</th>
            <th class="text-right">核定預算</th>
            <th class="text-right">已動支實績</th>
            <th class="text-right text-warning">保留款</th>
            <th class="text-right text-healthy font-bold">剩餘額度</th>
            <th style="width: 140px;">執行率進度</th>
            <th class="text-center">狀態</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in budgetItems" :key="b.accountCode">
            <td class="mono font-bold">{{ b.accountCode }}</td>
            <td class="font-bold">{{ b.accountName }}</td>
            <td class="mono text-right font-bold">NT$ {{ b.approved.toLocaleString() }}</td>
            <td class="mono text-right">NT$ {{ b.spent.toLocaleString() }}</td>
            <td class="mono text-right text-warning">NT$ {{ b.reserved.toLocaleString() }}</td>
            <td class="mono text-right text-healthy font-bold">NT$ {{ b.available.toLocaleString() }}</td>
            <td>
              <div class="progress-wrap">
                <GProgress :value="b.rate" :tone="b.rate > 80 ? 'warning' : 'healthy'" />
                <span class="mono extra-small">{{ b.rate }}%</span>
              </div>
            </td>
            <td class="text-center">
              <GBadge :tone="b.status === '正常' ? 'healthy' : 'warning'">
                {{ b.status }}
              </GBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </GCard>

    <GAlert tone="neutral" icon="info">
      各科目可用額度低於核定預算 15% 時，請主管提早進行費用調度或辦理預算科目流用申請，避免影響後續日常請款與設備維修進行。
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
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}
.stat-card {
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-num {
  font-size: 20px;
}
.text-healthy { color: var(--color-healthy); }
.filter-card {
  padding: 12px 16px;
}
.filter-row {
  display: flex;
}
.filter-item {
  width: 200px;
}
.filter-label {
  display: block;
  font-size: 13px;
  color: var(--color-faint);
  margin-bottom: 4px;
}
.table-wrapper {
  overflow-x: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.budget-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.budget-table th, .budget-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}
.budget-table th {
  background: var(--color-surface-hover);
  text-align: left;
  font-weight: 600;
}
.text-right { text-align: right; }
.text-center { text-align: center; }
.font-bold { font-weight: 600; }
.progress-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.extra-small { font-size: 11px; }
</style>
