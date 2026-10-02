<script setup lang="ts">
/**
 * 薪資條查詢分頁 (對齊 old_PortalSolar HRPersonalSalary.aspx)
 * 包含員工考勤概況、各週期、加班請假工時、固定/非固定給付項目、法定代扣項目及實發總額計算。
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GSelect, GStatCard, GTable } from '@/ui';

const selectedYear = ref('2026');
const selectedMonth = ref('08');

const yearOptions = [
  { label: '2026 年', value: '2026' },
  { label: '2025 年', value: '2025' },
  { label: '2024 年', value: '2024' },
];

const monthOptions = Array.from({ length: 12 }, (_, i) => {
  const m = String(i + 1).padStart(2, '0');
  return { label: `${m} 月`, value: m };
});

// 固定工資項目
const fixedAddItems = [
  { item: '本薪 (底薪)', amount: 62000 },
  { item: '職務加給', amount: 8000 },
  { item: '主管加給', amount: 5000 },
  { item: '伙食津貼', amount: 3000 },
];
const fixedSubItems = [
  { item: '事假扣款', amount: 0 },
  { item: '病假扣款', amount: 0 },
];

// 非固定工資項目
const unfixAddItems = [
  { item: '平日加班費 (1.34)', amount: 2450 },
  { item: '平日加班費 (1.67)', amount: 1530 },
  { item: '休假日加班費', amount: 0 },
  { item: '特殊專案津貼', amount: 3000 },
];
const unfixSubItems = [
  { item: '遲到扣款', amount: 0 },
];

// 法定所得扣繳項目
const deductionItems = [
  { item: '勞保費 (自付)', amount: 1285 },
  { item: '健保費 (自付)', amount: 1876 },
  { item: '健保眷屬扣款', amount: 0 },
  { item: '所得稅預扣款', amount: 2150 },
  { item: '職工福利金', amount: 350 },
];

const overtimeStats = [
  { type: '平日 1.34 加班', hours: '6.5 小時' },
  { type: '平日 1.67 加班', hours: '3.0 小時' },
  { type: '休假日 1.34 加班', hours: '0.0 小時' },
  { type: '休假日 1.67 加班', hours: '0.0 小時' },
  { type: '國定假日加班', hours: '0.0 小時' },
  { type: '特殊節日加班', hours: '0.0 小時' },
];

const leaveRecords = [
  { type: '特休假', hours: '8.0 小時' },
  { type: '全勤', hours: '達成' },
];
</script>

<template>
  <div class="salary-slip-view stack">
    <!-- 篩選列 -->
    <GCard class="filter-card glass">
      <div class="filter-row">
        <div class="filter-group">
          <label class="filter-label">計薪年月</label>
          <GSelect v-model="selectedYear" :options="yearOptions" style="width: 130px" />
          <GSelect v-model="selectedMonth" :options="monthOptions" style="width: 110px" />
          <GButton variant="primary" icon="search">查詢薪資條</GButton>
        </div>
        <div class="security-badge">
          <GBadge tone="storage" icon="shield">機密薪資資料 · 個人專屬保護</GBadge>
        </div>
      </div>
    </GCard>

    <!-- 摘要總覽指標 -->
    <div class="grid-stats">
      <GStatCard label="固定給付合計 (A)" value="$ 78,000" tone="primary" icon="layers" meta="本薪、加給與伙食津貼" />
      <GStatCard label="非固定工資合計 (B)" value="$ 6,980" tone="neutral" icon="zap" meta="平日與假日加班費" />
      <GStatCard label="各類所得扣繳 (C)" value="$ 5,661" tone="neutral" icon="alert" meta="勞健保、福利金與預扣稅" />
      <GStatCard label="本期實發金額 (A+B-C)" value="$ 79,319" tone="primary" icon="audit" meta="應稅薪資: $ 75,000" />
    </div>

    <!-- 員工考勤與計薪週期概況 -->
    <GCard title="考勤概況與計薪週期" icon="calendar" class="glass">
      <div class="grid-profile">
        <div class="info-cell"><span class="k">員工代號</span><span class="v mono font-bold">V112001</span></div>
        <div class="info-cell"><span class="k">員工姓名</span><span class="v font-bold">蔣佳緯</span></div>
        <div class="info-cell"><span class="k">所屬部門</span><span class="v">資訊服務部</span></div>
        <div class="info-cell"><span class="k">到職日期</span><span class="v mono">2021/04/12</span></div>
        <div class="info-cell"><span class="k">出勤天數</span><span class="v mono">22 天</span></div>
        <div class="info-cell"><span class="k">遲到次數</span><span class="v mono text-success">0 次</span></div>
        <div class="info-cell"><span class="k">基本薪資週期</span><span class="v mono">2026/08/01 ~ 2026/08/31</span></div>
        <div class="info-cell"><span class="k">加班請假週期</span><span class="v mono">2026/07/26 ~ 2026/08/25</span></div>
        <div class="info-cell"><span class="k">雇主提繳退休金</span><span class="v mono font-bold">$ 4,680 (6%)</span></div>
      </div>
    </GCard>

    <!-- 工時與請假摘要 -->
    <div class="grid-two-col">
      <GCard title="加班工時統計" icon="clock" class="glass">
        <div class="stats-table">
          <div v-for="ot in overtimeStats" :key="ot.type" class="stats-row">
            <span class="ot-k">{{ ot.type }}</span>
            <span class="ot-v mono">{{ ot.hours }}</span>
          </div>
        </div>
      </GCard>

      <GCard title="請假時數明細" icon="palm" class="glass">
        <div class="stats-table">
          <div v-for="lr in leaveRecords" :key="lr.type" class="stats-row">
            <span class="ot-k">{{ lr.type }}</span>
            <span class="ot-v mono">{{ lr.hours }}</span>
          </div>
          <div class="stats-notice">
            <small class="faint">※ 請假資料彙整自 BPM 簽核完成之請假單</small>
          </div>
        </div>
      </GCard>
    </div>

    <!-- 薪資加減項明細清單 -->
    <div class="grid-two-col">
      <!-- 固定給付項目 -->
      <GCard title="固定工資給付項目 (A)" icon="layers" class="glass">
        <div class="table-wrap">
          <table class="item-table">
            <thead>
              <tr>
                <th>給付項目 (加項)</th>
                <th class="text-right">金額</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in fixedAddItems" :key="it.item">
                <td>{{ it.item }}</td>
                <td class="text-right mono">$ {{ it.amount.toLocaleString() }}</td>
              </tr>
              <tr class="subtotal-row">
                <td><strong>固定給付合計 (A)</strong></td>
                <td class="text-right mono font-bold text-primary">$ 78,000</td>
              </tr>
            </tbody>
          </table>
        </div>
      </GCard>

      <!-- 非固定給付項目 -->
      <GCard title="非固定工資給付項目 (B)" icon="zap" class="glass">
        <div class="table-wrap">
          <table class="item-table">
            <thead>
              <tr>
                <th>給付項目 (加項/減項)</th>
                <th class="text-right">金額</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in unfixAddItems" :key="it.item">
                <td>{{ it.item }}</td>
                <td class="text-right mono">$ {{ it.amount.toLocaleString() }}</td>
              </tr>
              <tr class="subtotal-row">
                <td><strong>非固定工資合計 (B)</strong></td>
                <td class="text-right mono font-bold text-primary">$ 6,980</td>
              </tr>
            </tbody>
          </table>
        </div>
      </GCard>
    </div>

    <!-- 代扣與所得稅項目 -->
    <GCard title="各類所得代扣項目 (C)" icon="alert" class="glass">
      <div class="table-wrap">
        <table class="item-table">
          <thead>
            <tr>
              <th>法定與代扣項目</th>
              <th class="text-right">扣除金額</th>
              <th>備註說明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in deductionItems" :key="it.item">
              <td>{{ it.item }}</td>
              <td class="text-right mono text-danger">- $ {{ it.amount.toLocaleString() }}</td>
              <td class="faint small">依法代扣薪資所得與員工自付額</td>
            </tr>
            <tr class="subtotal-row">
              <td><strong>代扣合計 (C)</strong></td>
              <td class="text-right mono font-bold text-danger">- $ 5,661</td>
              <td>應扣總款項</td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>

    <GAlert tone="neutral" icon="info">
      本薪資明細僅供個人查詢與報稅核對，請妥善保管個人帳號密碼，嚴禁向無關第三者洩漏。如有薪資疑問請洽人事管理部薪資專員。
    </GAlert>
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
.grid-profile {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
.info-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--glass-soft);
}
.info-cell .k {
  font-size: var(--fs-xs);
  color: var(--text-3);
}
.info-cell .v {
  font-size: var(--fs-sm);
  color: var(--text);
}
.grid-two-col {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}
.stats-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.stats-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--glass-soft);
  font-size: var(--fs-sm);
}
.stats-notice {
  margin-top: 8px;
  padding-left: 4px;
}
.table-wrap {
  overflow-x: auto;
}
.item-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-sm);
}
.item-table th,
.item-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
}
.item-table th {
  text-align: left;
  font-weight: 600;
  color: var(--text-2);
  background: var(--glass-soft);
}
.text-right {
  text-align: right;
}
.subtotal-row {
  background: var(--glass-soft);
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
.text-success {
  color: #10b981;
}
</style>
