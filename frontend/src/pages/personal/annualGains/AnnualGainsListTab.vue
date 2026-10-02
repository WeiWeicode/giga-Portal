<script setup lang="ts">
/**
 * 年度所得 - 年度薪資表列 (對齊 old_PortalSolar HRPersonalAnnualGains.aspx)
 * 提供年度薪資統計、圖表趨勢、應領薪資、月份明細
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GModal, GSelect, GStatCard } from '@/ui';

const startYear = ref('2023');
const endYear = ref('2026');

const yearOptions = [
  { label: '2026 年 (民國 115 年)', value: '2026' },
  { label: '2025 年 (民國 114 年)', value: '2025' },
  { label: '2024 年 (民國 113 年)', value: '2024' },
  { label: '2023 年 (民國 112 年)', value: '2023' },
  { label: '2022 年 (民國 111 年)', value: '2022' },
];

interface AnnualSummary {
  year: string;
  totalGains: number;
  fixedSalary: number;
  bonus: number;
  taxWithheld: number;
  nhi2Withheld: number;
}

const annualData: AnnualSummary[] = [
  { year: '2025 (114)', totalGains: 1142000, fixedSalary: 936000, bonus: 206000, taxWithheld: 57100, nhi2Withheld: 4347 },
  { year: '2024 (113)', totalGains: 1086000, fixedSalary: 890000, bonus: 196000, taxWithheld: 54300, nhi2Withheld: 4136 },
  { year: '2023 (112)', totalGains: 1012000, fixedSalary: 840000, bonus: 172000, taxWithheld: 50600, nhi2Withheld: 3629 },
];

const selectedDetail = ref<AnnualSummary | null>(null);
const modalOpen = ref(false);

function openDetail(row: AnnualSummary) {
  selectedDetail.value = row;
  modalOpen.value = true;
}
</script>

<template>
  <div class="annual-gains-view stack">
    <!-- 篩選器 -->
    <GCard class="filter-card glass">
      <div class="filter-row">
        <div class="filter-group">
          <label class="filter-label">查詢年度區間</label>
          <GSelect v-model="startYear" :options="yearOptions" style="width: 200px" />
          <span class="faint">~</span>
          <GSelect v-model="endYear" :options="yearOptions" style="width: 200px" />
          <GButton variant="primary" icon="search">查詢所得</GButton>
        </div>
        <GBadge tone="storage" icon="shield">年度薪資給付統計</GBadge>
      </div>
    </GCard>

    <div class="grid-stats">
      <GStatCard label="2025 年度應領薪資總額" value="$ 1,142,000" tone="primary" icon="layers" meta="固定工資 + 獎金" />
      <GStatCard label="2025 年度扣繳稅額" value="$ 57,100" tone="neutral" icon="alert" meta="扣繳憑單記載" />
      <GStatCard label="二代健保補充保費" value="$ 4,347" tone="neutral" icon="shield" meta="健保扣費憑單" />
      <GStatCard label="年薪成長率" value="+ 5.15%" tone="primary" icon="trend-up" meta="較前一年度成長" />
    </div>

    <!-- 年度薪資表列表格 -->
    <GCard title="年度薪資發放彙整清冊" icon="calendar" class="glass">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>年度 (民國)</th>
              <th class="text-right">應領薪資總額</th>
              <th class="text-right">固定工資小計</th>
              <th class="text-right">獎金總額</th>
              <th class="text-right">代扣稅款</th>
              <th class="text-right">二代健保扣繳</th>
              <th class="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in annualData" :key="row.year">
              <td class="mono font-bold">{{ row.year }}</td>
              <td class="text-right mono font-bold text-primary">$ {{ row.totalGains.toLocaleString() }}</td>
              <td class="text-right mono">$ {{ row.fixedSalary.toLocaleString() }}</td>
              <td class="text-right mono">$ {{ row.bonus.toLocaleString() }}</td>
              <td class="text-right mono text-danger">$ {{ row.taxWithheld.toLocaleString() }}</td>
              <td class="text-right mono text-danger">$ {{ row.nhi2Withheld.toLocaleString() }}</td>
              <td class="text-center">
                <GButton variant="ghost" size="small" icon="file-text" @click="openDetail(row)">月明細</GButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>

    <GCard title="說明與備註事項" icon="info" class="glass">
      <ul class="notes-list">
        <li><strong>應領薪資</strong>：當年度應（免）稅薪資、加給與各項獎金合計金額（1月 ~ 12月）。</li>
        <li><strong>年度所得明細</strong>：當年度各月份薪資條給付明細與獎金發放紀錄。</li>
        <li><strong>報稅所得明細</strong>：每年 5 月綜合所得稅申報扣繳明細請切換至「報稅所得與補充保費」分頁列印。</li>
        <li><strong>二代健保補充保費</strong>：次年 1 月由人事管理部彙整申報，扣費證明單於次年 2 月份起提供列印。</li>
      </ul>
    </GCard>

    <!-- 月明細彈窗 -->
    <GModal v-model:open="modalOpen" :title="`${selectedDetail?.year ?? ''} 年度各月薪資發放明細`">
      <div v-if="selectedDetail" class="modal-body stack">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>月份</th>
                <th class="text-right">固定底薪與加給</th>
                <th class="text-right">加班費</th>
                <th class="text-right">當月實發</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in 12" :key="m">
                <td class="mono">{{ selectedDetail.year.slice(0, 4) }}/{{ String(m).padStart(2, '0') }}</td>
                <td class="text-right mono">$ 78,000</td>
                <td class="text-right mono">$ {{ (m % 3 === 0 ? 3980 : 1560).toLocaleString() }}</td>
                <td class="text-right mono font-bold text-primary">$ {{ (78000 + (m % 3 === 0 ? 3980 : 1560) - 5661).toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </GModal>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.filter-group {
  display: flex;
  align-items: center;
  gap: 10px;
}
.filter-label {
  font-weight: 600;
  font-size: var(--fs-sm);
  color: var(--text-2);
}
.grid-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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
.text-center {
  text-align: center;
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
.text-danger {
  color: var(--c-danger);
}
.notes-list {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: var(--fs-sm);
  color: var(--text-2);
}
</style>
