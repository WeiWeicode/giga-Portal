<script setup lang="ts">
/**
 * 自助查詢 - 刷卡記錄 Tab
 * 對應 old_PortalSolar/Fixgridviewaspx.aspx (Tab1)
 * 包含門禁刷卡記錄 (GridView10) 與 ERP刷卡記錄 (GridView12)
 */
import { ref } from 'vue';
import type { Column } from '@/ui/components/GTable.vue';
import QueryFilterBar from './QueryFilterBar.vue';

// 門禁刷卡記錄 (GridView10)
const accessColumns: Column[] = [
  { key: 'empNo', label: '工號', width: '120px', mono: true },
  { key: 'workDate', label: '上班日期', width: '140px', mono: true },
  { key: 'punchTime', label: '刷卡時間', width: '140px', mono: true },
];

const accessRows = ref([
  { id: '1', empNo: 'S112009', workDate: '2026/10/01', punchTime: '08:24:15' },
  { id: '2', empNo: 'S112009', workDate: '2026/10/01', punchTime: '17:35:42' },
  { id: '3', empNo: 'S112009', workDate: '2026/10/02', punchTime: '08:28:03' },
  { id: '4', empNo: 'S112009', workDate: '2026/10/02', punchTime: '18:02:11' },
]);

// ERP 刷卡記錄 (GridView12)
const erpColumns: Column[] = [
  { key: 'empNo', label: '工號', width: '120px', mono: true },
  { key: 'location', label: '刷卡地點', width: '160px' },
  { key: 'punchTime', label: '刷卡時間', width: '180px', mono: true },
];

const erpRows = ref([
  { id: '1', empNo: 'S112009', location: '一廠大門刷卡機', punchTime: '2026/10/01 08:24:15' },
  { id: '2', empNo: 'S112009', location: '一廠大門刷卡機', punchTime: '2026/10/01 17:35:42' },
  { id: '3', empNo: 'S112009', location: '一廠大門刷卡機', punchTime: '2026/10/02 08:28:03' },
  { id: '4', empNo: 'S112009', location: '一廠大門刷卡機', punchTime: '2026/10/02 18:02:11' },
]);
</script>

<template>
  <div class="stack query-tab">
    <QueryFilterBar />

    <div class="grid grid-2">
      <!-- 門禁刷卡記錄 -->
      <GCard title="門禁刷卡記錄" subtitle="各廠區門禁閘門刷卡流水紀錄" icon="clock">
        <GTable :columns="accessColumns" :rows="accessRows" row-key="id" :page-size="10" />
      </GCard>

      <!-- ERP 刷卡記錄 -->
      <GCard title="ERP 刷卡記錄" subtitle="ERP 差勤系統同步刷卡紀錄" icon="database">
        <GTable :columns="erpColumns" :rows="erpRows" row-key="id" :page-size="10" />
      </GCard>
    </div>
  </div>
</template>

<style scoped>
.query-tab {
  --gap: 16px;
}
</style>
