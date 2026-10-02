<script setup lang="ts">
/**
 * 薪資異動紀錄 (對齊 old_PortalSolar SalaryAdjustmentSite.aspx)
 * 呈現同仁自到職以來的歷年調薪、職級異動、加給調整等紀錄。
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GStatCard } from '@/ui';

const employee = {
  no: 'V112001',
  name: '蔣佳緯',
  dept: 'V1420 資訊服務部',
  title: '資深全端工程師 (Level 4)',
  hireDate: '2021/04/12',
  welfare: '自選福利彈性方案 B',
};

interface AdjustmentRecord {
  effectiveDate: string;
  code: string;
  reason: string;
  dept: string;
  title: string;
  baseSalary: number;
  attendanceBonus: number;
  foodAllowance: number;
  jobAllowance: number;
  profAllowance: number;
  postAllowance: number;
  total: number;
}

const adjustments: AdjustmentRecord[] = [
  {
    effectiveDate: '2025/07/01',
    code: 'ADJ-2025-07',
    reason: '年度績效晉升調薪',
    dept: '資訊服務部',
    title: '資深全端工程師',
    baseSalary: 62000,
    attendanceBonus: 0,
    foodAllowance: 3000,
    jobAllowance: 8000,
    profAllowance: 5000,
    postAllowance: 0,
    total: 78000,
  },
  {
    effectiveDate: '2024/07/01',
    code: 'ADJ-2024-07',
    reason: '集團年度例行調薪 (3.8%)',
    dept: '資訊服務部',
    title: '全端工程師',
    baseSalary: 56000,
    attendanceBonus: 0,
    foodAllowance: 3000,
    jobAllowance: 6000,
    profAllowance: 4000,
    postAllowance: 0,
    total: 69000,
  },
  {
    effectiveDate: '2023/07/01',
    code: 'ADJ-2023-07',
    reason: '集團年度例行調薪 (3.2%)',
    dept: '資訊服務部',
    title: '全端工程師',
    baseSalary: 52000,
    attendanceBonus: 0,
    foodAllowance: 2400,
    jobAllowance: 5000,
    profAllowance: 3000,
    postAllowance: 0,
    total: 62400,
  },
  {
    effectiveDate: '2021/07/12',
    code: 'ADJ-2021-07',
    reason: '新進試用期滿考評調薪',
    dept: '資訊服務部',
    title: '全端工程師',
    baseSalary: 48000,
    attendanceBonus: 0,
    foodAllowance: 2400,
    jobAllowance: 4000,
    profAllowance: 2000,
    postAllowance: 0,
    total: 56400,
  },
];
</script>

<template>
  <div class="salary-adj-page stack">
    <!-- 員工基礎資訊 -->
    <GCard title="員工職涯概況" icon="user" class="glass">
      <div class="profile-grid">
        <div class="grid-cell"><span class="k">員工代號</span><span class="v mono font-bold">{{ employee.no }}</span></div>
        <div class="grid-cell"><span class="k">員工姓名</span><span class="v font-bold">{{ employee.name }}</span></div>
        <div class="grid-cell"><span class="k">所屬部門</span><span class="v">{{ employee.dept }}</span></div>
        <div class="grid-cell"><span class="k">目前職稱</span><span class="v font-bold text-primary">{{ employee.title }}</span></div>
        <div class="grid-cell"><span class="k">到職日期</span><span class="v mono">{{ employee.hireDate }}</span></div>
        <div class="grid-cell"><span class="k">福利制度</span><span class="v"><GBadge tone="storage">{{ employee.welfare }}</GBadge></span></div>
      </div>
    </GCard>

    <!-- 歷年異動統計卡片 -->
    <div class="grid-stats">
      <GStatCard label="目前每月核定總薪" value="$ 78,000" tone="primary" icon="layers" meta="最近一次生效 2025/07/01" />
      <GStatCard label="累計調薪次數" value="4 次" tone="neutral" icon="trend-up" meta="到職以來歷次調整" />
      <GStatCard label="累計薪資成長率" value="+ 38.3%" tone="primary" icon="zap" meta="起薪 $56,400 → 現職 $78,000" />
    </div>

    <!-- 異動清冊 -->
    <GCard title="歷次薪資與職級異動清冊" icon="history" class="glass">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>生效日期</th>
              <th>異動代碼</th>
              <th>異動原因</th>
              <th>職稱名稱</th>
              <th class="text-right">底薪</th>
              <th class="text-right">職務加給</th>
              <th class="text-right">專業加給</th>
              <th class="text-right">伙食津貼</th>
              <th class="text-right">調整後總薪資</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="adj in adjustments" :key="adj.code">
              <td class="mono font-bold">{{ adj.effectiveDate }}</td>
              <td class="mono small faint">{{ adj.code }}</td>
              <td><GBadge tone="primary">{{ adj.reason }}</GBadge></td>
              <td><strong>{{ adj.title }}</strong></td>
              <td class="text-right mono">$ {{ adj.baseSalary.toLocaleString() }}</td>
              <td class="text-right mono">$ {{ adj.jobAllowance.toLocaleString() }}</td>
              <td class="text-right mono">$ {{ adj.profAllowance.toLocaleString() }}</td>
              <td class="text-right mono">$ {{ adj.foodAllowance.toLocaleString() }}</td>
              <td class="text-right mono font-bold text-primary">$ {{ adj.total.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>

    <GAlert tone="neutral" icon="info">
      本資料庫紀錄同仁人事考核與晉升調薪生效歷程。歷次調整皆經事業部主管與總經理室核定，並連線登載於集團 ERP 人事薪資系統。
    </GAlert>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.profile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
.grid-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--glass-soft);
}
.grid-cell .k {
  font-size: var(--fs-xs);
  color: var(--text-3);
}
.grid-cell .v {
  font-size: var(--fs-sm);
  color: var(--text);
}
.grid-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
}
.table-wrap {
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-sm);
}
.data-table th,
.data-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
}
.data-table th {
  font-weight: 600;
  color: var(--text-2);
  background: var(--glass-soft);
  text-align: left;
}
.text-right {
  text-align: right;
}
.mono {
  font-family: var(--font-mono, monospace);
}
.font-bold {
  font-weight: 700;
}
.text-primary {
  color: var(--c-primary);
}
</style>
