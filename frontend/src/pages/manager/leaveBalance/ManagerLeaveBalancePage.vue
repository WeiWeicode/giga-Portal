<script setup lang="ts">
/**
 * 員工特補休剩餘時數追蹤 (對齊 old_PortalSolar HRAnalysisChart3_2.aspx)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GSelect } from '@/ui';

interface LeaveEmp {
  empNo: string;
  name: string;
  dept: string;
  onboardDate: string;
  totalAnnualDays: number;
  usedAnnualDays: number;
  remainAnnualDays: number;
  expiringAnnualDays: number; // 60天內即將失效
  remainCompHours: number;
  compExpireDate: string;
  notified: boolean;
}

const list = ref<LeaveEmp[]>([
  {
    empNo: 'V112001',
    name: '王大明',
    dept: '資訊服務部',
    onboardDate: '2023-05-10',
    totalAnnualDays: 14,
    usedAnnualDays: 6,
    remainAnnualDays: 8,
    expiringAnnualDays: 5,
    remainCompHours: 12,
    compExpireDate: '2026-11-30',
    notified: false,
  },
  {
    empNo: 'S180002',
    name: '鄭智寬',
    dept: '資訊服務部',
    onboardDate: '2024-02-15',
    totalAnnualDays: 10,
    usedAnnualDays: 7,
    remainAnnualDays: 3,
    expiringAnnualDays: 0,
    remainCompHours: 4,
    compExpireDate: '2026-12-31',
    notified: false,
  },
  {
    empNo: 'V112045',
    name: '黃宏達',
    dept: '製造一課',
    onboardDate: '2022-08-01',
    totalAnnualDays: 15,
    usedAnnualDays: 5,
    remainAnnualDays: 10,
    expiringAnnualDays: 7,
    remainCompHours: 28,
    compExpireDate: '2026-11-15',
    notified: false,
  },
  {
    empNo: 'V113010',
    name: '陳領班',
    dept: '製造一課',
    onboardDate: '2023-11-01',
    totalAnnualDays: 10,
    usedAnnualDays: 2,
    remainAnnualDays: 8,
    expiringAnnualDays: 6,
    remainCompHours: 16,
    compExpireDate: '2026-10-31',
    notified: false,
  },
]);

const deptFilter = ref('');

const filteredList = computed(() => {
  return list.value.filter((e) => !deptFilter.value || e.dept === deptFilter.value);
});

function notifyEmp(emp: LeaveEmp) {
  emp.notified = true;
}

function notifyAll() {
  list.value.forEach((e) => {
    if (e.expiringAnnualDays > 0 || e.remainCompHours > 0) {
      e.notified = true;
    }
  });
}
</script>

<template>
  <div class="leave-balance-page stack">
    <!-- 頂部概況統計 -->
    <div class="stats-grid">
      <GCard class="glass stat-card">
        <span class="faint small">部屬特休平均剩餘天數</span>
        <strong class="stat-num mono text-primary">7.25 天</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">60 天內即將失效特休</span>
        <strong class="stat-num mono text-danger">18 天 (3 人)</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">加班補休累積未休時數</span>
        <strong class="stat-num mono text-warning">60 小時</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">年度特休平均執行消化率</span>
        <strong class="stat-num mono text-healthy">43.8%</strong>
      </GCard>
    </div>

    <!-- 篩選與批次操作 -->
    <GCard class="glass filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <label class="filter-label">部門篩選</label>
          <GSelect
            v-model="deptFilter"
            :options="[
              { label: '全部部門', value: '' },
              { label: '資訊服務部', value: '資訊服務部' },
              { label: '製造一課', value: '製造一課' },
            ]"
          />
        </div>
        <div class="btn-wrap">
          <GButton tone="primary" @click="notifyAll">📢 一鍵發信提醒即將逾期同仁排休</GButton>
        </div>
      </div>
    </GCard>

    <!-- 特補休清冊表格 -->
    <GCard class="glass table-wrapper">
      <table class="leave-table">
        <thead>
          <tr>
            <th>工號</th>
            <th>姓名</th>
            <th>部門</th>
            <th>到職日期</th>
            <th class="text-right">年度特休總天數</th>
            <th class="text-right">已休特休</th>
            <th class="text-right font-bold">特休剩餘</th>
            <th class="text-right text-danger">60日內即將失效</th>
            <th class="text-right text-warning">補休剩餘時數</th>
            <th>補休最晚期限</th>
            <th class="text-center">排休提醒通知</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="emp in filteredList" :key="emp.empNo">
            <td class="mono font-bold">{{ emp.empNo }}</td>
            <td class="font-bold">{{ emp.name }}</td>
            <td>{{ emp.dept }}</td>
            <td class="mono small faint">{{ emp.onboardDate }}</td>
            <td class="mono text-right">{{ emp.totalAnnualDays }} 天</td>
            <td class="mono text-right small faint">{{ emp.usedAnnualDays }} 天</td>
            <td class="mono text-right font-bold text-primary">{{ emp.remainAnnualDays }} 天</td>
            <td class="mono text-right" :class="{ 'text-danger font-bold': emp.expiringAnnualDays > 0 }">
              {{ emp.expiringAnnualDays }} 天
            </td>
            <td class="mono text-right text-warning font-bold">{{ emp.remainCompHours }} h</td>
            <td class="mono small">{{ emp.compExpireDate }}</td>
            <td class="text-center">
              <GButton
                size="sm"
                :variant="emp.notified ? 'secondary' : 'primary'"
                :disabled="emp.notified || (emp.expiringAnnualDays === 0 && emp.remainCompHours === 0)"
                @click="notifyEmp(emp)"
              >
                {{ emp.notified ? '✓ 已發信提醒' : '發送提醒' }}
              </GButton>
            </td>
          </tr>
        </tbody>
      </table>
    </GCard>

    <GAlert tone="neutral" icon="info">
      依勞動基準法第 38 條規定，年度終結或契約終止時，勞工尚未休畢之特別休假日數，除經勞雇雙方協商遞延至次年度外，雇主應依結餘日數結算發給工資。主管應主動協助部屬排定休假計畫。
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
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
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
.text-healthy { color: var(--color-healthy); }
.filter-card {
  padding: 12px 16px;
}
.filter-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 14px;
}
.filter-item {
  width: 220px;
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
.leave-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.leave-table th, .leave-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}
.leave-table th {
  background: var(--color-surface-hover);
  text-align: left;
  font-weight: 600;
}
.text-right { text-align: right; }
.text-center { text-align: center; }
.font-bold { font-weight: 600; }
</style>
