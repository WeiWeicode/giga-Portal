<script setup lang="ts">
/**
 * 自助查詢 - 補休/榮譽假 Tab
 * 對應 old_PortalSolar/Fixgridviewaspx.aspx (Tab6)
 * 包含補休紀錄 (GridView4) 與榮譽假紀錄 (GridView13)
 */
import { ref } from 'vue';
import type { Column } from '@/ui/components/GTable.vue';
import QueryFilterBar from './QueryFilterBar.vue';

// 補休紀錄 (GridView4)
const compColumns: Column[] = [
  { key: 'year', label: '年度', width: '90px', mono: true },
  { key: 'month', label: '月份', width: '90px', mono: true },
  { key: 'newHours', label: '本月新增', width: '120px', align: 'right', mono: true },
  { key: 'usedHours', label: '本月耗用', width: '120px', align: 'right', mono: true },
  { key: 'lastBalance', label: '上月結餘', width: '120px', align: 'right', mono: true },
  { key: 'currentBalance', label: '本月結餘', width: '120px', align: 'right', mono: true },
  { key: 'validHours', label: '有效時數', width: '120px', align: 'right', mono: true },
];

const compRows = ref([
  { id: '1', year: '2026', month: '09', newHours: '4.0', usedHours: '0.0', lastBalance: '8.0', currentBalance: '12.0', validHours: '12.0' },
  { id: '2', year: '2026', month: '08', newHours: '0.0', usedHours: '4.0', lastBalance: '12.0', currentBalance: '8.0', validHours: '8.0' },
  { id: '3', year: '2026', month: '07', newHours: '6.0', usedHours: '2.0', lastBalance: '8.0', currentBalance: '12.0', validHours: '12.0' },
]);

// 榮譽假紀錄 (GridView13)
const honorColumns: Column[] = [
  { key: 'totalHours', label: '總時數', width: '120px', align: 'right', mono: true },
  { key: 'totalDays', label: '總天數', width: '120px', align: 'right', mono: true },
  { key: 'usedHours', label: '已休總時數', width: '130px', align: 'right', mono: true },
  { key: 'usedDays', label: '已休總天數', width: '130px', align: 'right', mono: true },
  { key: 'remainHours', label: '剩餘總時數', width: '130px', align: 'right', mono: true },
  { key: 'remainDays', label: '剩餘總天數', width: '130px', align: 'right', mono: true },
];

const honorRows = ref([
  { id: '1', totalHours: '16.0', totalDays: '2.0', usedHours: '8.0', usedDays: '1.0', remainHours: '8.0', remainDays: '1.0' },
]);
</script>

<template>
  <div class="stack query-tab">
    <QueryFilterBar />

    <!-- 補休紀錄 -->
    <GCard title="補休紀錄" subtitle="2018 年 3 月份以後加班換補休及結餘明細" icon="clock">
      <GTable :columns="compColumns" :rows="compRows" row-key="id" :page-size="10" />
    </GCard>

    <!-- 榮譽假紀錄 -->
    <GCard title="榮譽假紀錄" subtitle="公假、榮譽假核發與休假剩餘統計" icon="check-circle">
      <GTable :columns="honorColumns" :rows="honorRows" row-key="id" :page-size="5" />
    </GCard>
  </div>
</template>

<style scoped>
.query-tab {
  --gap: 16px;
}
</style>
