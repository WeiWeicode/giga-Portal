<script setup lang="ts">
/**
 * 理級以上出勤時數追蹤 (對齊 old_PortalSolar HRBossTrace.aspx)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GSelect } from '@/ui';

interface BossTrace {
  empNo: string;
  name: string;
  dept: string;
  title: string;
  level: '理級' | '處級' | '副總級';
  totalHours: number;
  normalHours: number;
  otHours: number;
  travelDays: number;
  leaveDays: number;
  missingCards: number;
  healthStatus: '工時正常' | '高工時警示' | '差勤異常';
}

const bossList = ref<BossTrace[]>([
  {
    empNo: 'V108001',
    name: '林協理',
    dept: '資訊服務部',
    title: '資訊技術協理',
    level: '處級',
    totalHours: 184,
    normalHours: 168,
    otHours: 16,
    travelDays: 3,
    leaveDays: 1,
    missingCards: 0,
    healthStatus: '工時正常',
  },
  {
    empNo: 'V110008',
    name: '陳課長',
    dept: '人力資源部',
    title: '人資課長',
    level: '理級',
    totalHours: 176,
    normalHours: 168,
    otHours: 8,
    travelDays: 1,
    leaveDays: 0,
    missingCards: 0,
    healthStatus: '工時正常',
  },
  {
    empNo: 'V111005',
    name: '李美華',
    dept: '財務會計部',
    title: '會計副理',
    level: '理級',
    totalHours: 202,
    normalHours: 168,
    otHours: 34,
    travelDays: 0,
    leaveDays: 0,
    missingCards: 1,
    healthStatus: '高工時警示',
  },
  {
    empNo: 'V105003',
    name: '張協理',
    dept: '業務營業處',
    title: '業務處協理',
    level: '處級',
    totalHours: 192,
    normalHours: 168,
    otHours: 24,
    travelDays: 8,
    leaveDays: 2,
    missingCards: 0,
    healthStatus: '工時正常',
  },
  {
    empNo: 'V101002',
    name: '黃副總',
    dept: '先進材料研發處',
    title: '研發技術副總經理',
    level: '副總級',
    totalHours: 218,
    normalHours: 168,
    otHours: 50,
    travelDays: 5,
    leaveDays: 0,
    missingCards: 2,
    healthStatus: '高工時警示',
  },
]);

const selectedLevel = ref('');
const selectedMonth = ref('2026-09');

const filteredList = computed(() => {
  return bossList.value.filter((b) => {
    return !selectedLevel.value || b.level === selectedLevel.value;
  });
});
</script>

<template>
  <div class="boss-trace-page stack">
    <!-- 指標統計卡 -->
    <div class="stats-grid">
      <GCard class="glass stat-card">
        <span class="faint small">理級以上主管人數</span>
        <strong class="stat-num mono text-primary">5 位</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">平均月出勤工時</span>
        <strong class="stat-num mono">194.4 小時</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">國內外公差累計</span>
        <strong class="stat-num mono">17 天</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">高工時關懷名單</span>
        <strong class="stat-num mono text-danger">2 位 (超過 200h)</strong>
      </GCard>
    </div>

    <!-- 篩選列 -->
    <GCard class="glass filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <label class="filter-label">主管職級</label>
          <GSelect
            v-model="selectedLevel"
            :options="[
              { label: '全部階層主管', value: '' },
              { label: '理級主管 (經理/副理)', value: '理級' },
              { label: '處級主管 (協理/處長)', value: '處級' },
              { label: '副總級以上高階主管', value: '副總級' },
            ]"
          />
        </div>
        <div class="filter-item">
          <label class="filter-label">追蹤統計月份</label>
          <GInput v-model="selectedMonth" type="month" />
        </div>
      </div>
    </GCard>

    <!-- 主管工時表格 -->
    <GCard class="glass table-wrapper">
      <table class="trace-table">
        <thead>
          <tr>
            <th>工號</th>
            <th>主管姓名</th>
            <th>部門名稱</th>
            <th>職稱</th>
            <th class="text-center">階層</th>
            <th class="text-right">總出勤工時</th>
            <th class="text-right">正常工時</th>
            <th class="text-right">核准加班</th>
            <th class="text-center">公差天數</th>
            <th class="text-center">請假天數</th>
            <th class="text-center">缺卡次數</th>
            <th class="text-center">工時健康指標</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in filteredList" :key="b.empNo">
            <td class="mono font-bold">{{ b.empNo }}</td>
            <td class="font-bold">{{ b.name }}</td>
            <td>{{ b.dept }}</td>
            <td class="small">{{ b.title }}</td>
            <td class="text-center">
              <GBadge tone="storage">{{ b.level }}</GBadge>
            </td>
            <td class="mono font-bold text-right text-primary">{{ b.totalHours }} h</td>
            <td class="mono text-right small faint">{{ b.normalHours }} h</td>
            <td class="mono text-right small">{{ b.otHours }} h</td>
            <td class="mono text-center">{{ b.travelDays }} 天</td>
            <td class="mono text-center">{{ b.leaveDays }} 天</td>
            <td class="mono text-center" :class="{ 'text-danger': b.missingCards > 0 }">{{ b.missingCards }} 次</td>
            <td class="text-center">
              <GBadge :tone="b.healthStatus === '工時正常' ? 'healthy' : 'warning'">
                {{ b.healthStatus }}
              </GBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </GCard>

    <GAlert tone="neutral" icon="info">
      依職業安全衛生法與勞基法「過勞預防指引」，單月延長工時超過 45 小時或總工時超過 200 小時之高階主管，系統將自動通知廠護中心進行過勞風險評估與安排駐廠醫師健康面談。
    </GAlert>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.stats-grid {
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
.filter-card {
  padding: 12px 16px;
}
.filter-row {
  display: flex;
  gap: 16px;
  align-items: flex-end;
}
.filter-item {
  flex: 1;
  max-width: 260px;
}
.filter-label {
  display: block;
  font-size: 13px;
  color: var(--color-faint);
  margin-bottom: 4px;
}
.table-wrapper {
  overflow-x: auto;
  padding: 0;
}
.trace-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.trace-table th, .trace-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}
.trace-table th {
  background: var(--color-surface-hover);
  text-align: left;
  font-weight: 600;
}
.text-right { text-align: right; }
.text-center { text-align: center; }
.font-bold { font-weight: 600; }
</style>
