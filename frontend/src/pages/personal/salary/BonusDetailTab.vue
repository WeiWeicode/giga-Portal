<script setup lang="ts">
/**
 * 獎金明細分頁 (對齊 old_PortalSolar HRPersonalSalary.aspx 獎金區塊與 DetailBonusModal)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GModal, GSelect, GStatCard, GTable } from '@/ui';

const selectedYear = ref('2026');
const yearOptions = [
  { label: '2026 年', value: '2026' },
  { label: '2025 年', value: '2025' },
  { label: '2024 年', value: '2024' },
];

interface BonusRecord {
  id: string;
  name: string;
  date: string;
  gross: number;
  tax: number;
  nhi2: number;
  net: number;
  desc: string;
}

const bonusList: BonusRecord[] = [
  {
    id: 'BN-2026-01',
    name: '2025 年終獎金',
    date: '2026/01/25',
    gross: 156000,
    tax: 7800,
    nhi2: 3292,
    net: 144908,
    desc: '年度全體績效評核發放之年終獎金',
  },
  {
    id: 'BN-2026-02',
    name: '2026 端午節節金',
    date: '2026/06/05',
    gross: 12000,
    tax: 0,
    nhi2: 0,
    net: 12000,
    desc: '端午節三節員工禮金',
  },
  {
    id: 'BN-2026-03',
    name: '2026 研發專利提案獎勵金',
    date: '2026/07/15',
    gross: 15000,
    tax: 750,
    nhi2: 317,
    net: 13933,
    desc: '新式太陽能導電漿配方專利提案通過核發',
  },
];

const activeModal = ref(false);
const currentRecord = ref<BonusRecord | null>(null);

function viewDetail(rec: BonusRecord) {
  currentRecord.value = rec;
  activeModal.value = true;
}
</script>

<template>
  <div class="bonus-detail-view stack">
    <GCard class="filter-card glass">
      <div class="filter-row">
        <div class="filter-group">
          <label class="filter-label">年度篩選</label>
          <GSelect v-model="selectedYear" :options="yearOptions" style="width: 140px" />
          <GButton variant="primary" icon="search">查詢獎金紀錄</GButton>
        </div>
        <GBadge tone="storage" icon="shield">法定二代健保代扣已依健保局標準試算</GBadge>
      </div>
    </GCard>

    <div class="grid-stats">
      <GStatCard label="年度獎金應發總額" value="$ 183,000" tone="primary" icon="audit" meta="合計 3 筆獎金發放" />
      <GStatCard label="代扣所得稅累計" value="$ 8,550" tone="neutral" icon="alert" meta="扣繳率 5%" />
      <GStatCard label="二代健保補充保費" value="$ 3,609" tone="neutral" icon="layers" meta="費率 2.11%" />
      <GStatCard label="實發獎金總淨額" value="$ 170,841" tone="primary" icon="check" meta="入帳總金額" />
    </div>

    <GCard title="獎金發放清單" icon="award" class="glass">
      <div class="table-wrap">
        <table class="bonus-table">
          <thead>
            <tr>
              <th>發放日期</th>
              <th>獎金名稱</th>
              <th class="text-right">應發金額</th>
              <th class="text-right">扣繳稅額 (5%)</th>
              <th class="text-right">代扣二代健保 (2.11%)</th>
              <th class="text-right">實發金額</th>
              <th class="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in bonusList" :key="b.id">
              <td class="mono">{{ b.date }}</td>
              <td>
                <strong>{{ b.name }}</strong>
                <div class="small faint">{{ b.desc }}</div>
              </td>
              <td class="text-right mono font-bold">$ {{ b.gross.toLocaleString() }}</td>
              <td class="text-right mono text-danger">- $ {{ b.tax.toLocaleString() }}</td>
              <td class="text-right mono text-danger">- $ {{ b.nhi2.toLocaleString() }}</td>
              <td class="text-right mono font-bold text-primary">$ {{ b.net.toLocaleString() }}</td>
              <td class="text-center">
                <GButton variant="ghost" size="small" icon="file-text" @click="viewDetail(b)">明細</GButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>

    <!-- 獎金明細彈出視窗 -->
    <GModal v-model:open="activeModal" :title="currentRecord?.name ?? '獎金明細'">
      <div v-if="currentRecord" class="modal-body stack">
        <div class="detail-row"><span class="k">獎金項目代碼</span><span class="v mono">{{ currentRecord.id }}</span></div>
        <div class="detail-row"><span class="k">獎金名稱</span><span class="v font-bold">{{ currentRecord.name }}</span></div>
        <div class="detail-row"><span class="k">核定發放日</span><span class="v mono">{{ currentRecord.date }}</span></div>
        <div class="detail-row"><span class="k">應發金額</span><span class="v mono font-bold">$ {{ currentRecord.gross.toLocaleString() }}</span></div>
        <div class="detail-row"><span class="k">代扣所得稅額</span><span class="v mono text-danger">- $ {{ currentRecord.tax.toLocaleString() }}</span></div>
        <div class="detail-row"><span class="k">二代健保補充保費</span><span class="v mono text-danger">- $ {{ currentRecord.nhi2.toLocaleString() }}</span></div>
        <div class="detail-row highlight"><span class="k">實際入帳金額</span><span class="v mono font-bold text-primary">$ {{ currentRecord.net.toLocaleString() }}</span></div>
        <div class="detail-row"><span class="k">發放依據說明</span><span class="v">{{ currentRecord.desc }}</span></div>
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
.bonus-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-sm);
}
.bonus-table th,
.bonus-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
}
.bonus-table th {
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
.modal-body {
  gap: 10px;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--glass-soft);
  font-size: var(--fs-sm);
}
.detail-row.highlight {
  background: var(--glass-hover);
  border: 1px solid var(--line);
}
.detail-row .k {
  color: var(--text-3);
}
</style>
