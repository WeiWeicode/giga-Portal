<script setup lang="ts">
/**
 * 自助查詢 - 二代健保 Tab
 * 對應 old_PortalSolar/Fixgridviewaspx.aspx (Tab9)
 * GridView11: 計薪指標、投保金額、應稅薪資、累計金額、16倍投保薪資、保費計算金額、獎金已扣、薪資已扣
 */
import { ref } from 'vue';
import type { Column } from '@/ui/components/GTable.vue';
import QueryFilterBar from './QueryFilterBar.vue';

const columns: Column[] = [
  { key: 'target', label: '計薪指標', width: '160px' },
  { key: 'insuredAmount', label: '投保金額', width: '120px', align: 'right', mono: true },
  { key: 'taxableSalary', label: '應稅薪資', width: '120px', align: 'right', mono: true },
  { key: 'accumulated', label: '累計金額', width: '120px', align: 'right', mono: true },
  { key: 'sixteenTimes', label: '16倍投保薪資', width: '130px', align: 'right', mono: true },
  { key: 'calcAmount', label: '保費計算金額', width: '130px', align: 'right', mono: true },
  { key: 'bonusDeducted', label: '獎金已扣', width: '110px', align: 'right', mono: true },
  { key: 'salaryDeducted', label: '薪資已扣', width: '110px', align: 'right', mono: true },
];

const rows = ref([
  {
    id: '1',
    target: '2026/09 經常性薪資',
    insuredAmount: '45,800',
    taxableSalary: '55,000',
    accumulated: '55,000',
    sixteenTimes: '732,800',
    calcAmount: '0',
    bonusDeducted: '0',
    salaryDeducted: '0',
  },
  {
    id: '2',
    target: '2026/08 端午節獎金',
    insuredAmount: '45,800',
    taxableSalary: '10,000',
    accumulated: '10,000',
    sixteenTimes: '732,800',
    calcAmount: '0',
    bonusDeducted: '0',
    salaryDeducted: '0',
  },
  {
    id: '3',
    target: '2026/01 年終獎金',
    insuredAmount: '45,800',
    taxableSalary: '120,000',
    accumulated: '120,000',
    sixteenTimes: '732,800',
    calcAmount: '0',
    bonusDeducted: '0',
    salaryDeducted: '0',
  },
]);
</script>

<template>
  <div class="stack query-tab">
    <QueryFilterBar />

    <GCard title="二代健保補充保險費明細" subtitle="獎金與經常性薪資之二代健保補充保費累計與扣繳紀錄" icon="file-check">
      <GTable :columns="columns" :rows="rows" row-key="id" :page-size="10" />
    </GCard>
  </div>
</template>

<style scoped>
.query-tab {
  --gap: 16px;
}
</style>
