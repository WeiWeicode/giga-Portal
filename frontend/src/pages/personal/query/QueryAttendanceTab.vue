<script setup lang="ts">
/**
 * 自助查詢 - 出勤記錄 Tab
 * 對應 old_PortalSolar/Fixgridviewaspx.aspx (Tab2)
 * GridView1: 班別、日期、上/下班、遲到/早退/忘刷卡、加班上/下班、加班一、二丶三類、假日/外勞加班
 */
import { ref } from 'vue';
import type { Column } from '@/ui/components/GTable.vue';
import QueryFilterBar from './QueryFilterBar.vue';

const columns: Column[] = [
  { key: 'shift', label: '班別', width: '100px' },
  { key: 'date', label: '日期', width: '130px', mono: true },
  { key: 'workTimes', label: '上/下班', width: '150px', mono: true },
  { key: 'abnormal', label: '遲到/早退/忘刷卡', width: '160px' },
  { key: 'otTimes', label: '加班上/下班', width: '140px', mono: true },
  { key: 'otClasses', label: '加班一、二丶三類', width: '160px' },
  { key: 'holidayOt', label: '假日/外勞加班', width: '130px' },
];

const rows = ref([
  {
    id: '1',
    shift: '常日班',
    date: '2026/10/01 (四)',
    workTimes: '08:24 / 17:35',
    abnormal: '正常',
    otTimes: '—',
    otClasses: '0.0 / 0.0 / 0.0',
    holidayOt: '否',
  },
  {
    id: '2',
    shift: '常日班',
    date: '2026/10/02 (五)',
    workTimes: '08:28 / 18:02',
    abnormal: '正常',
    otTimes: '—',
    otClasses: '0.0 / 0.0 / 0.0',
    holidayOt: '否',
  },
  {
    id: '3',
    shift: '休假日',
    date: '2026/10/03 (六)',
    workTimes: '—',
    abnormal: '—',
    otTimes: '—',
    otClasses: '0.0 / 0.0 / 0.0',
    holidayOt: '否',
  },
  {
    id: '4',
    shift: '例假日',
    date: '2026/10/04 (日)',
    workTimes: '—',
    abnormal: '—',
    otTimes: '—',
    otClasses: '0.0 / 0.0 / 0.0',
    holidayOt: '否',
  },
]);
</script>

<template>
  <div class="stack query-tab">
    <QueryFilterBar />

    <GCard title="員工出勤明細記錄" subtitle="當月刷卡記錄彙整與遲到、早退、加班統計" icon="calendar">
      <GTable :columns="columns" :rows="rows" row-key="id" :page-size="10">
        <template #cell-abnormal="{ value }">
          <GBadge :tone="value === '正常' ? 'success' : value === '—' ? 'neutral' : 'warning'" dot>
            {{ value }}
          </GBadge>
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
