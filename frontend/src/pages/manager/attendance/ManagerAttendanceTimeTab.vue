<script setup lang="ts">
/**
 * 員工刷卡時間趨勢 (對齊 old_PortalSolar HRAnalysisChart3.aspx Tab1)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GSelect } from '@/ui';

const selectedDept = ref('資訊服務部');
const startDate = ref('2026-09-01');
const endDate = ref('2026-09-30');

const timeRecords = ref([
  { empNo: 'V112001', name: '王大明', date: '2026-09-30', inTime: '08:18', outTime: '17:45', totalHours: '8.5', status: '正常' },
  { empNo: 'S180002', name: '鄭智寬', date: '2026-09-30', inTime: '08:25', outTime: '18:10', totalHours: '8.8', status: '正常' },
  { empNo: 'V112045', name: '黃宏達', date: '2026-09-30', inTime: '08:05', outTime: '19:30', totalHours: '10.5', status: '加班' },
  { empNo: 'V113012', name: '陳建安', date: '2026-09-30', inTime: '08:42', outTime: '17:35', totalHours: '7.9', status: '遲到' },
  { empNo: 'V112089', name: '林雅婷', date: '2026-09-30', inTime: '08:15', outTime: '17:30', totalHours: '8.2', status: '正常' },
]);
</script>

<template>
  <div class="attendance-time-tab stack">
    <!-- 篩選列 -->
    <GCard class="glass filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <label class="filter-label">選擇所屬部門</label>
          <GSelect
            v-model="selectedDept"
            :options="[
              { label: '資訊服務部', value: '資訊服務部' },
              { label: '製造一課', value: '製造一課' },
              { label: '財務會計部', value: '財務會計部' },
              { label: '先進材料研發處', value: '先進材料研發處' },
            ]"
          />
        </div>
        <div class="filter-item">
          <label class="filter-label">查詢起始日期</label>
          <GInput v-model="startDate" type="date" />
        </div>
        <div class="filter-item">
          <label class="filter-label">查詢截止日期</label>
          <GInput v-model="endDate" type="date" />
        </div>
        <div class="btn-wrap">
          <GButton tone="primary">查詢圖表分析</GButton>
        </div>
      </div>
    </GCard>

    <!-- 視覺化趨勢指標 -->
    <div class="stats-grid">
      <GCard class="glass stat-card">
        <span class="faint small">部屬平均上班刷卡時間</span>
        <strong class="stat-num mono text-primary">08:21</strong>
        <span class="faint extra-small">標準彈性工時：08:00 ~ 08:30</span>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">部屬平均下班刷卡時間</span>
        <strong class="stat-num mono">17:48</strong>
        <span class="faint extra-small">標準下班時間：17:30 ~ 18:00</span>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">部門常態工時出勤率</span>
        <strong class="stat-num mono text-healthy">98.2%</strong>
        <span class="faint extra-small">正常準時出勤比率</span>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">當月加班工時總計</span>
        <strong class="stat-num mono">42.5 小時</strong>
        <span class="faint extra-small">均符合 46h 加班上限</span>
      </GCard>
    </div>

    <!-- 每日刷卡清冊表格 -->
    <GCard class="glass table-wrapper">
      <div class="table-header">
        <strong class="font-bold">部屬每日進出廠刷卡時間詳細紀錄</strong>
        <span class="faint small">資料庫同步時間：今日 08:00</span>
      </div>
      <table class="time-table">
        <thead>
          <tr>
            <th>工號</th>
            <th>部屬姓名</th>
            <th>出勤日期</th>
            <th>最早刷進時間 (上班)</th>
            <th>最晚刷出時間 (下班)</th>
            <th class="text-right">當日總工時</th>
            <th class="text-center">出勤狀態判定</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in timeRecords" :key="r.empNo">
            <td class="mono font-bold">{{ r.empNo }}</td>
            <td class="font-bold">{{ r.name }}</td>
            <td class="mono small">{{ r.date }}</td>
            <td class="mono font-bold text-primary">{{ r.inTime }}</td>
            <td class="mono">{{ r.outTime }}</td>
            <td class="mono text-right">{{ r.totalHours }} h</td>
            <td class="text-center">
              <GBadge :tone="r.status === '正常' ? 'healthy' : r.status === '加班' ? 'storage' : 'warning'">
                {{ r.status }}
              </GBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </GCard>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.filter-card {
  padding: 12px 16px;
}
.filter-row {
  display: flex;
  gap: 14px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.filter-item {
  flex: 1;
  min-width: 180px;
}
.filter-label {
  display: block;
  font-size: 13px;
  color: var(--color-faint);
  margin-bottom: 4px;
}
.btn-wrap {
  margin-bottom: 2px;
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
.text-healthy {
  color: var(--color-healthy);
}
.table-wrapper {
  overflow-x: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.time-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.time-table th, .time-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}
.time-table th {
  background: var(--color-surface-hover);
  text-align: left;
  font-weight: 600;
}
.text-right { text-align: right; }
.text-center { text-align: center; }
.font-bold { font-weight: 600; }
.extra-small { font-size: 11.5px; }
</style>
