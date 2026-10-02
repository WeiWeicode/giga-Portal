<script setup lang="ts">
/**
 * 自助查詢 - 特休 Tab
 * 對應 old_PortalSolar/Fixgridviewaspx.aspx (Tab7)
 * GridView5: 特休年度、當年度特休天數、當年度總時數、上年度剩餘時數、當年度可用時數、
 * 當年度已休時數、結算點已休時數、結算點未休時數、當年度剩餘時數、結算日期、結算剩餘時數、薪資、預計未休假獎金
 */
import { ref } from 'vue';
import type { Column } from '@/ui/components/GTable.vue';
import QueryFilterBar from './QueryFilterBar.vue';

const columns: Column[] = [
  { key: 'year', label: '特休年度', width: '90px', mono: true },
  { key: 'annualDays', label: '當年度特休天數', width: '120px', align: 'right' },
  { key: 'totalHours', label: '當年度總時數', width: '110px', align: 'right', mono: true },
  { key: 'lastRemain', label: '上年度剩餘時數', width: '120px', align: 'right', mono: true },
  { key: 'usableHours', label: '當年度可用時數', width: '120px', align: 'right', mono: true },
  { key: 'usedHours', label: '當年度已休時數', width: '120px', align: 'right', mono: true },
  { key: 'settleUsed', label: '結算點已休時數', width: '120px', align: 'right', mono: true },
  { key: 'settleUnused', label: '結算點未休時數', width: '120px', align: 'right', mono: true },
  { key: 'remainHours', label: '當年度剩餘時數', width: '120px', align: 'right', mono: true },
  { key: 'settleDate', label: '結算日期', width: '120px', mono: true },
  { key: 'settleRemain', label: '結算剩餘時數', width: '120px', align: 'right', mono: true },
  { key: 'salary', label: '薪資', width: '90px', align: 'right', mono: true },
  { key: 'estimatedBonus', label: '預計未休假獎金', width: '130px', align: 'right', mono: true },
];

const rows = ref([
  {
    id: '1',
    year: '2026',
    annualDays: '15 天',
    totalHours: '120.0',
    lastRemain: '16.0',
    usableHours: '136.0',
    usedHours: '40.0',
    settleUsed: '40.0',
    settleUnused: '96.0',
    remainHours: '96.0',
    settleDate: '2026/12/31',
    settleRemain: '96.0',
    salary: '—',
    estimatedBonus: '—',
  },
  {
    id: '2',
    year: '2025',
    annualDays: '14 天',
    totalHours: '112.0',
    lastRemain: '8.0',
    usableHours: '120.0',
    usedHours: '104.0',
    settleUsed: '104.0',
    settleUnused: '16.0',
    remainHours: '16.0',
    settleDate: '2025/12/31',
    settleRemain: '16.0',
    salary: '55,000',
    estimatedBonus: '29,333',
  },
]);
</script>

<template>
  <div class="stack query-tab">
    <QueryFilterBar />

    <GCard title="特別休假明細" subtitle="特別休假天數、可用時數、已休與結算獎金統計" icon="sun">
      <GTable :columns="columns" :rows="rows" row-key="id" :page-size="10" />
    </GCard>
  </div>
</template>

<style scoped>
.query-tab {
  --gap: 16px;
}
</style>
