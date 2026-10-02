<script setup lang="ts">
/**
 * 自助查詢 - 請假紀錄 Tab
 * 對應 old_PortalSolar/Fixgridviewaspx.aspx (Tab4)
 * GridView3: 假別、請假時數/天數、借假、請假期間、請假事由
 */
import { ref } from 'vue';
import type { Column } from '@/ui/components/GTable.vue';
import QueryFilterBar from './QueryFilterBar.vue';

const columns: Column[] = [
  { key: 'leaveType', label: '假別', width: '120px' },
  { key: 'duration', label: '請假時數/天數', width: '160px', mono: true },
  { key: 'isBorrow', label: '借假', width: '90px', align: 'center' },
  { key: 'period', label: '請假期間', width: '300px', mono: true },
  { key: 'reason', label: '請假事由' },
];

const rows = ref([
  {
    id: '1',
    leaveType: '特休',
    duration: '8.0 小時 (1.0 天)',
    isBorrow: '否',
    period: '2026/09/18 08:30 ~ 2026/09/18 17:30',
    reason: '家庭照顧事宜',
  },
  {
    id: '2',
    leaveType: '補休',
    duration: '4.0 小時 (0.5 天)',
    isBorrow: '否',
    period: '2026/08/12 13:30 ~ 2026/08/12 17:30',
    reason: '個人事務辦理',
  },
  {
    id: '3',
    leaveType: '病假',
    duration: '8.0 小時 (1.0 天)',
    isBorrow: '否',
    period: '2026/05/20 08:30 ~ 2026/05/20 17:30',
    reason: '身體不適就診',
  },
]);
</script>

<template>
  <div class="stack query-tab">
    <QueryFilterBar />

    <GCard title="請假紀錄明細" subtitle="假單申請與請假期間紀錄" icon="palm">
      <GTable :columns="columns" :rows="rows" row-key="id" :page-size="10">
        <template #cell-leaveType="{ value }">
          <GBadge :tone="value === '特休' ? 'solar' : value === '補休' ? 'primary' : 'warning'">
            {{ value }}
          </GBadge>
        </template>
        <template #cell-isBorrow="{ value }">
          <GBadge :tone="value === '是' ? 'danger' : 'neutral'">{{ value }}</GBadge>
        </template>
      </GTable>
    </GCard>
  </div>
</template>

<style scoped>
.query-tab {
  --gap: 16px;
}
</style>
