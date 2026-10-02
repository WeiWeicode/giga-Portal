<script setup lang="ts">
/**
 * 行事曆 - 年度放假清單 (對齊 old_PortalSolar Schedule.aspx)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard } from '@/ui';

interface HolidayRow {
  name: string;
  period: string;
  days: number;
  weekday: string;
  makeupNote: string;
  type: '國定假日' | '連續假期' | '補行上班' | '公司廠慶';
  badgeTone: 'danger' | 'warning' | 'healthy' | 'storage';
  note: string;
}

const holidays = ref<HolidayRow[]>([
  {
    name: '開國紀念日 (元旦)',
    period: '2026/01/01',
    days: 1,
    weekday: '週四',
    makeupNote: '無須補班',
    type: '國定假日',
    badgeTone: 'danger',
    note: '1 月 1 日放假 1 天。',
  },
  {
    name: '農曆春節連續假期',
    period: '2026/02/14 ~ 2026/02/22',
    days: 9,
    weekday: '週六 ~ 週日',
    makeupNote: '2/07 (六) 補行上班 1 天',
    type: '連續假期',
    badgeTone: 'warning',
    note: '含除夕前一日、除夕及初一至初五，共連休 9 天。',
  },
  {
    name: '和平紀念日 (二二八)',
    period: '2026/02/27 ~ 2026/03/01',
    days: 3,
    weekday: '週五 ~ 週日',
    makeupNote: '逢週六於 2/27 (五) 補假',
    type: '連續假期',
    badgeTone: 'danger',
    note: '連續放假 3 天。',
  },
  {
    name: '兒童節及民族掃墓節 (清明連假)',
    period: '2026/04/03 ~ 2026/04/06',
    days: 4,
    weekday: '週五 ~ 週一',
    makeupNote: '兒童節補假 4/3，清明補假 4/6',
    type: '連續假期',
    badgeTone: 'warning',
    note: '連續放假 4 天。',
  },
  {
    name: '勞動節 (五一)',
    period: '2026/05/01 ~ 2026/05/03',
    days: 3,
    weekday: '週五 ~ 週日',
    makeupNote: '無須補班',
    type: '國定假日',
    badgeTone: 'danger',
    note: '勞工專屬法定連假 3 天。',
  },
  {
    name: '端午節連續假期',
    period: '2026/06/19 ~ 2026/06/21',
    days: 3,
    weekday: '週五 ~ 週日',
    makeupNote: '農曆五月初五放假',
    type: '連續假期',
    badgeTone: 'warning',
    note: '連續放假 3 天。',
  },
  {
    name: '中秋節連續假期',
    period: '2026/09/25 ~ 2026/09/27',
    days: 3,
    weekday: '週五 ~ 週日',
    makeupNote: '農曆八月十五放假',
    type: '連續假期',
    badgeTone: 'warning',
    note: '連續放假 3 天。',
  },
  {
    name: '國慶日連續假期',
    period: '2026/10/09 ~ 2026/10/11',
    days: 3,
    weekday: '週五 ~ 週日',
    makeupNote: '10/9 (五) 彈性調整放假',
    type: '連續假期',
    badgeTone: 'warning',
    note: '雙十國慶連假 3 天；於 10/24 (六) 補班。',
  },
  {
    name: '碩禾集團 18 週年廠慶',
    period: '2026/10/16',
    days: 1,
    weekday: '週五',
    makeupNote: '公司特別福利假',
    type: '公司廠慶',
    badgeTone: 'healthy',
    note: '全體在職員工放假 1 天，產線人員另行排休。',
  },
  {
    name: '國慶連假補行上班日',
    period: '2026/10/24',
    days: 0,
    weekday: '週六',
    makeupNote: '補 10/9 (五) 彈性放假',
    type: '補行上班',
    badgeTone: 'storage',
    note: '全日正常出勤打卡。',
  },
]);
</script>

<template>
  <div class="calendar-list-tab stack">
    <!-- 概況指標卡 -->
    <div class="stat-grid">
      <GCard class="glass stat-card">
        <span class="faint small">2026 全年總放假日數</span>
        <strong class="stat-num mono text-primary">116 天</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">3 天以上連續假期</span>
        <strong class="stat-num mono">6 次</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">年度補行上班日數</span>
        <strong class="stat-num mono">1 天</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">碩禾特別廠慶假期</span>
        <strong class="stat-num mono text-healthy">1 天 (10/16)</strong>
      </GCard>
    </div>

    <!-- 清單表格 -->
    <GCard class="glass table-wrapper">
      <table class="holiday-table">
        <thead>
          <tr>
            <th>節日 / 放假名稱</th>
            <th>放假起訖期間</th>
            <th class="text-center">天數</th>
            <th>星期</th>
            <th>彈性補班規定</th>
            <th class="text-center">假別類別</th>
            <th>備註說明</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="h in holidays" :key="h.name">
            <td class="font-bold">{{ h.name }}</td>
            <td class="mono font-bold">{{ h.period }}</td>
            <td class="mono text-center">
              <span v-if="h.days > 0" class="days-badge">{{ h.days }} 天</span>
              <span v-else class="faint">-</span>
            </td>
            <td class="small">{{ h.weekday }}</td>
            <td class="small text-danger">{{ h.makeupNote }}</td>
            <td class="text-center">
              <GBadge :tone="h.badgeTone">{{ h.type }}</GBadge>
            </td>
            <td class="small faint">{{ h.note }}</td>
          </tr>
        </tbody>
      </table>
    </GCard>

    <GAlert tone="neutral" icon="info">
      本年度行事曆依行政院人事行政總處核定之「115 年政府行政機關辦公日曆表」與公司經營會議決議排定。輪班人員之休假日排班以各廠區主管核定之排班表為準。
    </GAlert>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
}
.stat-card {
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-num {
  font-size: 22px;
}
.text-healthy {
  color: var(--color-healthy);
}
.table-wrapper {
  overflow-x: auto;
  padding: 0;
}
.holiday-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.holiday-table th,
.holiday-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border);
}
.holiday-table th {
  background: var(--color-surface-hover);
  text-align: left;
  font-weight: 600;
  font-size: 13px;
}
.days-badge {
  background: rgba(59, 130, 246, 0.1);
  color: var(--color-primary);
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 4px;
}
.text-center {
  text-align: center;
}
.font-bold {
  font-weight: 600;
}
</style>
