<script setup lang="ts">
/**
 * 自助查詢 - 加班紀錄 Tab
 * 對應 old_PortalSolar/Fixgridviewaspx.aspx (Tab3)
 * GridView2: 班別、加班日期、加班單號、加班時間、加班時數、休息分鐘、支援部門、換休否、補伙食費、工作天否
 */
import { ref } from 'vue';
import type { Column } from '@/ui/components/GTable.vue';
import QueryFilterBar from './QueryFilterBar.vue';

const columns: Column[] = [
  { key: 'shift', label: '班別', width: '100px' },
  { key: 'otDate', label: '加班日期', width: '120px', mono: true },
  { key: 'formNo', label: '加班單號', width: '150px', mono: true },
  { key: 'timeRange', label: '加班時間', width: '150px', mono: true },
  { key: 'hours', label: '加班時數', width: '100px', align: 'right', mono: true },
  { key: 'restMinutes', label: '休息分鐘', width: '100px', align: 'right' },
  { key: 'supportDept', label: '支援部門', width: '130px' },
  { key: 'isCompensate', label: '換休否', width: '90px', align: 'center' },
  { key: 'mealSubsidy', label: '補伙食費', width: '90px', align: 'center' },
  { key: 'isWorkday', label: '工作天否', width: '90px', align: 'center' },
];

const rows = ref([
  {
    id: '1',
    shift: '常日班',
    otDate: '2026/09/25',
    formNo: 'OT20260925001',
    timeRange: '18:00 - 20:00',
    hours: '2.0',
    restMinutes: '0',
    supportDept: '資訊處',
    isCompensate: '是',
    mealSubsidy: '否',
    isWorkday: '是',
  },
  {
    id: '2',
    shift: '常日班',
    otDate: '2026/09/12',
    formNo: 'OT20260912003',
    timeRange: '09:00 - 17:00',
    hours: '7.0',
    restMinutes: '60',
    supportDept: '資訊處',
    isCompensate: '是',
    mealSubsidy: '是',
    isWorkday: '否',
  },
]);
</script>

<template>
  <div class="stack query-tab">
    <QueryFilterBar />

    <GCard title="加班紀錄明細" subtitle="個人加班申請單與時數核定紀錄" icon="zap">
      <GTable :columns="columns" :rows="rows" row-key="id" :page-size="10">
        <template #cell-isCompensate="{ value }">
          <GBadge :tone="value === '是' ? 'primary' : 'neutral'">{{ value }}</GBadge>
        </template>
        <template #cell-mealSubsidy="{ value }">
          <GBadge :tone="value === '是' ? 'success' : 'neutral'">{{ value }}</GBadge>
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
