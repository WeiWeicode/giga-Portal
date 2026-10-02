<script setup lang="ts">
/**
 * 自助查詢 - 頂部出勤年月查詢列
 * 對應 old_PortalSolar/Fixgridviewaspx.aspx 頂部查詢條件 (出勤年月 / 重新查詢)
 */
import { ref } from 'vue';

const year = ref('2026');
const month = ref('10');

const yearOptions = [
  { label: '2026 年', value: '2026' },
  { label: '2025 年', value: '2025' },
  { label: '2024 年', value: '2024' },
  { label: '2023 年', value: '2023' },
];

const monthOptions = [
  { label: '01 月', value: '01' },
  { label: '02 月', value: '02' },
  { label: '03 月', value: '03' },
  { label: '04 月', value: '04' },
  { label: '05 月', value: '05' },
  { label: '06 月', value: '06' },
  { label: '07 月', value: '07' },
  { label: '08 月', value: '08' },
  { label: '09 月', value: '09' },
  { label: '10 月', value: '10' },
  { label: '11 月', value: '11' },
  { label: '12 月', value: '12' },
];
</script>

<template>
  <GCard padding="sm" class="filter-card">
    <div class="row filter-row">
      <div class="row fields-group">
        <span class="strong filter-title"><GIcon name="calendar" :size="16" />出勤年月</span>
        <div class="select-item">
          <GSelect v-model="year" :options="yearOptions" />
        </div>
        <div class="select-item">
          <GSelect v-model="month" :options="monthOptions" />
        </div>
        <GButton variant="primary" icon="search">重新查詢</GButton>
      </div>
      <div class="spacer" />
      <div class="row badges-group">
        <GBadge tone="primary" dot>工號：S112009 王大明</GBadge>
        <GBadge tone="neutral" mono>查詢區間：{{ year }} / {{ month }}</GBadge>
      </div>
    </div>
  </GCard>
</template>

<style scoped>
.filter-card {
  margin-bottom: 2px;
}
.filter-row {
  width: 100%;
}
.filter-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-2);
  white-space: nowrap;
}
.fields-group {
  gap: 12px;
}
.select-item {
  width: 120px;
}
.badges-group {
  gap: 8px;
}
</style>
