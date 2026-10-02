<script setup lang="ts">
/**
 * 自助查詢 - 班表&訂餐記錄 Tab
 * 對應 old_PortalSolar/Fixgridviewaspx.aspx (Tab5)
 * 月曆呈現個人班表與訂便當紀錄
 */
import QueryFilterBar from './QueryFilterBar.vue';

interface CalendarDay {
  date: number;
  weekday: string;
  isCurrentMonth: boolean;
  shift: string;
  isRest: boolean;
  lunchMeal?: string;
  dinnerMeal?: string;
}

const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

// 模擬 2026 年 10 月份排班 (10/1 為週四)
const days: CalendarDay[] = [
  // 9月填補
  { date: 27, weekday: '週日', isCurrentMonth: false, shift: '例假日', isRest: true },
  { date: 28, weekday: '週一', isCurrentMonth: false, shift: '常日班', isRest: false, lunchMeal: '常態餐' },
  { date: 29, weekday: '週二', isCurrentMonth: false, shift: '常日班', isRest: false, lunchMeal: '常態餐' },
  { date: 30, weekday: '週三', isCurrentMonth: false, shift: '常日班', isRest: false, lunchMeal: '常態餐' },
  // 10月
  { date: 1, weekday: '週四', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態葷食' },
  { date: 2, weekday: '週五', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態葷食', dinnerMeal: '加班便當' },
  { date: 3, weekday: '週六', isCurrentMonth: true, shift: '休假日', isRest: true },
  { date: 4, weekday: '週日', isCurrentMonth: true, shift: '例假日', isRest: true },
  { date: 5, weekday: '週一', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態葷食' },
  { date: 6, weekday: '週二', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態素食' },
  { date: 7, weekday: '週三', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態葷食' },
  { date: 8, weekday: '週四', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態葷食' },
  { date: 9, weekday: '週五', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態葷食' },
  { date: 10, weekday: '週六', isCurrentMonth: true, shift: '國定假日', isRest: true },
  { date: 11, weekday: '週日', isCurrentMonth: true, shift: '例假日', isRest: true },
  { date: 12, weekday: '週一', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態葷食' },
  { date: 13, weekday: '週二', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態葷食' },
  { date: 14, weekday: '週三', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態葷食' },
  { date: 15, weekday: '週四', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態葷食' },
  { date: 16, weekday: '週五', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態葷食' },
  { date: 17, weekday: '週六', isCurrentMonth: true, shift: '休假日', isRest: true },
  { date: 18, weekday: '週日', isCurrentMonth: true, shift: '例假日', isRest: true },
  { date: 19, weekday: '週一', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態葷食' },
  { date: 20, weekday: '週二', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態葷食' },
  { date: 21, weekday: '週三', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態葷食' },
  { date: 22, weekday: '週四', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態葷食' },
  { date: 23, weekday: '週五', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態葷食' },
  { date: 24, weekday: '週六', isCurrentMonth: true, shift: '休假日', isRest: true },
  { date: 25, weekday: '週日', isCurrentMonth: true, shift: '例假日', isRest: true },
  { date: 26, weekday: '週一', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態葷食' },
  { date: 27, weekday: '週二', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態葷食' },
  { date: 28, weekday: '週三', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態葷食' },
  { date: 29, weekday: '週四', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態葷食' },
  { date: 30, weekday: '週五', isCurrentMonth: true, shift: '常日班', isRest: false, lunchMeal: '常態葷食' },
  { date: 31, weekday: '週六', isCurrentMonth: true, shift: '休假日', isRest: true },
];
</script>

<template>
  <div class="stack query-tab">
    <QueryFilterBar />

    <GCard title="班表與訂餐月曆" subtitle="個人出勤班表與午晚餐訂便當狀態" icon="grid">
      <template #actions>
        <div class="row legend-row">
          <GBadge tone="primary">常日班</GBadge>
          <GBadge tone="neutral">休/例假日</GBadge>
          <GBadge tone="success">午餐已訂</GBadge>
          <GBadge tone="warning">晚餐已訂</GBadge>
        </div>
      </template>

      <!-- 月曆主體 -->
      <div class="calendar-wrapper">
        <div class="calendar-header">
          <div v-for="w in weekdays" :key="w" class="header-cell">{{ w }}</div>
        </div>
        <div class="calendar-grid">
          <div
            v-for="(d, idx) in days"
            :key="idx"
            class="day-cell"
            :class="{ 'other-month': !d.isCurrentMonth, 'rest-day': d.isRest }"
          >
            <div class="day-number">{{ d.date }}</div>
            <div class="day-content">
              <span class="shift-tag" :class="d.isRest ? 'shift-rest' : 'shift-work'">
                {{ d.shift }}
              </span>
              <span v-if="d.lunchMeal" class="meal-tag lunch">
                午: {{ d.lunchMeal }}
              </span>
              <span v-if="d.dinnerMeal" class="meal-tag dinner">
                晚: {{ d.dinnerMeal }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </GCard>
  </div>
</template>

<style scoped>
.query-tab {
  --gap: 16px;
}
.legend-row {
  gap: 8px;
}
.calendar-wrapper {
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.calendar-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: var(--glass-soft);
  border-bottom: 1px solid var(--line);
  text-align: center;
  font-weight: 650;
  font-size: var(--fs-sm);
  color: var(--text-2);
}
.header-cell {
  padding: 10px 0;
}
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: var(--line);
  gap: 1px;
}
.day-cell {
  background: var(--bg);
  min-height: 90px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: background var(--dur);
}
.day-cell:hover {
  background: var(--glass-hover);
}
.day-cell.other-month {
  opacity: 0.4;
  background: var(--glass-soft);
}
.day-cell.rest-day {
  background: color-mix(in srgb, var(--bg) 95%, var(--c-primary) 5%);
}
.day-number {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--text-2);
}
.day-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.shift-tag {
  display: inline-block;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  width: fit-content;
  font-weight: 600;
}
.shift-work {
  background: color-mix(in srgb, var(--c-primary) 15%, transparent);
  color: var(--c-primary-text);
}
.shift-rest {
  background: var(--glass-soft);
  color: var(--text-3);
}
.meal-tag {
  display: inline-block;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  width: fit-content;
  white-space: nowrap;
}
.meal-tag.lunch {
  background: color-mix(in srgb, var(--c-success) 15%, transparent);
  color: var(--c-success);
}
.meal-tag.dinner {
  background: color-mix(in srgb, var(--c-warning) 15%, transparent);
  color: var(--c-warning);
}
</style>
