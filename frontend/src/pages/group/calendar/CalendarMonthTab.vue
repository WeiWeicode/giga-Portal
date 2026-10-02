<script setup lang="ts">
/**
 * 行事曆 - 月曆視圖 (對齊 old_PortalSolar Schedule.aspx)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GModal, GSelect } from '@/ui';

const selectedYear = ref('2026');
const selectedMonth = ref(10); // 10 月

interface CalendarEvent {
  date: string; // YYYY-MM-DD
  title: string;
  type: 'holiday' | 'makeup' | 'company' | 'inventory';
  badgeTone: 'danger' | 'warning' | 'healthy' | 'storage';
  desc: string;
}

const events: CalendarEvent[] = [
  { date: '2026-01-01', title: '元旦開國紀念日', type: 'holiday', badgeTone: 'danger', desc: '國定假日放假 1 天' },
  { date: '2026-02-16', title: '農曆春節連假 (除夕前)', type: 'holiday', badgeTone: 'danger', desc: '春節連續假期開始' },
  { date: '2026-02-17', title: '農曆除夕', type: 'holiday', badgeTone: 'danger', desc: '法定放假日' },
  { date: '2026-02-18', title: '春節初一', type: 'holiday', badgeTone: 'danger', desc: '法定放假日' },
  { date: '2026-02-19', title: '春節初二', type: 'holiday', badgeTone: 'danger', desc: '法定放假日' },
  { date: '2026-02-20', title: '春節初三', type: 'holiday', badgeTone: 'danger', desc: '法定放假日' },
  { date: '2026-02-28', title: '和平紀念日', type: 'holiday', badgeTone: 'danger', desc: '放假 1 天' },
  { date: '2026-04-03', title: '兒童節補假', type: 'holiday', badgeTone: 'danger', desc: '兒童節與清明節連假' },
  { date: '2026-04-06', title: '清明節補假', type: 'holiday', badgeTone: 'danger', desc: '清明連假' },
  { date: '2026-05-01', title: '勞動節', type: 'holiday', badgeTone: 'danger', desc: '勞工專屬法定放假 1 天' },
  { date: '2026-06-19', title: '端午節', type: 'holiday', badgeTone: 'danger', desc: '農曆端午佳節連假' },
  { date: '2026-09-25', title: '中秋節', type: 'holiday', badgeTone: 'danger', desc: '農曆中秋節放假' },
  { date: '2026-10-09', title: '國慶日彈性連假', type: 'holiday', badgeTone: 'danger', desc: '雙十國慶連假 3 天' },
  { date: '2026-10-10', title: '國慶日', type: 'holiday', badgeTone: 'danger', desc: '雙十國慶日' },
  { date: '2026-10-16', title: '碩禾集團 18 週年廠慶', type: 'company', badgeTone: 'healthy', desc: '全公司廠慶同樂活動與特別假' },
  { date: '2026-10-24', title: '週六補行上班日', type: 'makeup', badgeTone: 'warning', desc: '配合彈性放假補班 1 天' },
  { date: '2026-10-30', title: '第三季全廠資產盤點日', type: 'inventory', badgeTone: 'storage', desc: '倉儲出入庫暫停，落實全面盤點' },
];

const monthDays = computed(() => {
  const year = parseInt(selectedYear.value, 10);
  const month = selectedMonth.value - 1;
  const firstDay = new Date(year, month, 1).getDay(); // 0: Sun, 1: Mon...
  const totalDays = new Date(year, month + 1, 0).getDate();

  const days: Array<{
    dayNumber: number;
    dateStr: string;
    isCurrentMonth: boolean;
    events: CalendarEvent[];
  }> = [];

  // 前導空白日
  for (let i = 0; i < firstDay; i++) {
    days.push({
      dayNumber: 0,
      dateStr: '',
      isCurrentMonth: false,
      events: [],
    });
  }

  // 本月日曆
  for (let d = 1; d <= totalDays; d++) {
    const mm = String(selectedMonth.value).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const dateStr = `${year}-${mm}-${dd}`;
    const evts = events.filter((e) => e.date === dateStr);
    days.push({
      dayNumber: d,
      dateStr,
      isCurrentMonth: true,
      events: evts,
    });
  }

  return days;
});

const activeModal = ref(false);
const activeDateDetail = ref<{ date: string; events: CalendarEvent[] } | null>(null);

function viewDay(day: { dateStr: string; events: CalendarEvent[] }) {
  if (!day.dateStr) return;
  activeDateDetail.value = {
    date: day.dateStr,
    events: day.events,
  };
  activeModal.value = true;
}

function prevMonth() {
  if (selectedMonth.value > 1) {
    selectedMonth.value--;
  } else {
    selectedMonth.value = 12;
    selectedYear.value = String(parseInt(selectedYear.value, 10) - 1);
  }
}

function nextMonth() {
  if (selectedMonth.value < 12) {
    selectedMonth.value++;
  } else {
    selectedMonth.value = 1;
    selectedYear.value = String(parseInt(selectedYear.value, 10) + 1);
  }
}
</script>

<template>
  <div class="calendar-month-tab stack">
    <!-- 導覽切換列 -->
    <GCard class="glass nav-card">
      <div class="nav-flex">
        <div class="month-controls">
          <GButton size="sm" variant="ghost" @click="prevMonth">◀ 上個月</GButton>
          <strong class="month-title mono font-bold text-primary">
            {{ selectedYear }} 年 {{ selectedMonth }} 月
          </strong>
          <GButton size="sm" variant="ghost" @click="nextMonth">下個月 ▶</GButton>
        </div>

        <div class="legend-row">
          <span class="legend-item"><span class="dot dot-holiday" /> 國定放假</span>
          <span class="legend-item"><span class="dot dot-company" /> 廠慶特假</span>
          <span class="legend-item"><span class="dot dot-makeup" /> 補行上班</span>
          <span class="legend-item"><span class="dot dot-inventory" /> 盤點停工</span>
        </div>
      </div>
    </GCard>

    <!-- 月曆網格 -->
    <GCard class="glass calendar-grid-card">
      <div class="weekdays-header">
        <div class="weekday weekend">週日</div>
        <div class="weekday">週一</div>
        <div class="weekday">週二</div>
        <div class="weekday">週三</div>
        <div class="weekday">週四</div>
        <div class="weekday">週五</div>
        <div class="weekday weekend">週六</div>
      </div>

      <div class="days-grid">
        <div
          v-for="(day, idx) in monthDays"
          :key="idx"
          class="day-cell"
          :class="{
            'empty-cell': !day.isCurrentMonth,
            'has-events': day.events.length > 0,
            'is-today': day.dateStr === '2026-10-02',
          }"
          @click="viewDay(day)"
        >
          <div v-if="day.isCurrentMonth" class="day-top">
            <span class="day-num mono font-bold">{{ day.dayNumber }}</span>
            <span v-if="day.dateStr === '2026-10-02'" class="today-tag">今日</span>
          </div>

          <div v-if="day.events.length > 0" class="events-wrap">
            <div v-for="e in day.events" :key="e.title" class="event-pill" :class="`event-${e.type}`">
              {{ e.title }}
            </div>
          </div>
        </div>
      </div>
    </GCard>

    <!-- 日期事件 Modal -->
    <GModal v-model="activeModal" :title="`${activeDateDetail?.date ?? ''} 行事活動`" width="480px">
      <div v-if="activeDateDetail" class="event-modal-stack">
        <div v-if="activeDateDetail.events.length > 0" class="events-list">
          <div v-for="e in activeDateDetail.events" :key="e.title" class="event-detail-item">
            <div class="detail-top">
              <strong class="font-bold">{{ e.title }}</strong>
              <GBadge :tone="e.badgeTone">{{ e.type }}</GBadge>
            </div>
            <p class="detail-desc faint small">{{ e.desc }}</p>
          </div>
        </div>
        <div v-else class="text-center faint p-4">
          當日為正常上班日，無特殊行事日程。
        </div>
      </div>
      <template #footer>
        <GButton variant="secondary" @click="activeModal = false">關閉</GButton>
      </template>
    </GModal>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.nav-card {
  padding: 12px 18px;
}
.nav-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.month-controls {
  display: flex;
  align-items: center;
  gap: 14px;
}
.month-title {
  font-size: 18px;
}
.legend-row {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 13px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.dot-holiday { background: #ef4444; }
.dot-company { background: #10b981; }
.dot-makeup { background: #f59e0b; }
.dot-inventory { background: #3b82f6; }

.calendar-grid-card {
  padding: 0;
  overflow: hidden;
}
.weekdays-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: var(--color-surface-hover);
  border-bottom: 1px solid var(--color-border);
}
.weekday {
  padding: 10px;
  text-align: center;
  font-weight: 600;
  font-size: 13.5px;
}
.weekend {
  color: var(--color-danger);
}
.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}
.day-cell {
  min-height: 95px;
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  padding: 8px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: background 0.15s;
}
.day-cell:nth-child(7n) {
  border-right: none;
}
.day-cell:hover {
  background: var(--color-surface-hover);
}
.empty-cell {
  background: rgba(0, 0, 0, 0.02);
  cursor: default;
}
.is-today {
  background: rgba(59, 130, 246, 0.06);
}
.day-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.day-num {
  font-size: 14px;
}
.today-tag {
  background: var(--color-primary);
  color: white;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
}
.events-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}
.event-pill {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}
.event-holiday {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
  border-left: 2px solid #dc2626;
}
.event-company {
  background: rgba(16, 185, 129, 0.15);
  color: #059669;
  border-left: 2px solid #059669;
}
.event-makeup {
  background: rgba(245, 158, 11, 0.15);
  color: #d97706;
  border-left: 2px solid #d97706;
}
.event-inventory {
  background: rgba(59, 130, 246, 0.15);
  color: #2563eb;
  border-left: 2px solid #2563eb;
}
.event-modal-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.events-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.event-detail-item {
  padding: 10px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.detail-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.detail-desc {
  margin: 0;
}
.text-center {
  text-align: center;
}
.font-bold {
  font-weight: 600;
}
</style>
