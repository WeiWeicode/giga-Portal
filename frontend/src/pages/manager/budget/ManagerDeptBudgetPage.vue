<script setup lang="ts">
/**
 * 部門預算執行(old_PortalSolar Budget_DeptInfoV2.aspx;FEATURE-PLAN §7.2、D-26;docs/Gherkin/manager/budget.feature)。
 * 可看部門 = Budget UserInfo(管理者 / 部門主管)且具 portal-manager;只顯示預算,實際金額(TIPTOP 傳票)系統轉移中。
 */
import { computed, ref } from 'vue';
import { budgetOptions, deptBudget } from '@/api/portal';
import { describeError } from '@/api/gateway';
import { fmtMoney } from '@/composables/manager';
import { useAsync } from '@/composables/useAsync';

const flag = ref('');
const dept = ref('');
const opts = useAsync(async () => {
  const o = await budgetOptions();
  // 預設最新版本(舊頁 ddlVersion 預設最後一筆)、第一個部門
  if (!flag.value && o.versions.length) flag.value = String(Math.max(...o.versions.map((v) => v.flag)));
  if (!dept.value && o.depts.length) dept.value = o.depts[0]!.id;
  return o;
});
const { data, loading, error, reload } = useAsync(() => deptBudget(Number(flag.value), dept.value), { immediate: false });
const search = () => flag.value && dept.value && reload();

const versionOptions = computed(() =>
  (opts.data.value?.versions ?? []).map((v) => ({ label: `V.${v.ver}${v.isFinal ? '(已結案)' : ''}`, value: String(v.flag) })),
);
const deptOptions = computed(() => (opts.data.value?.depts ?? []).map((d) => ({ label: `${d.id} ${d.name ?? ''}`.trim(), value: d.id })));
const MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1} 月`);
</script>

<template>
  <div class="stack">
    <GCard v-if="opts.loading.value && !opts.data.value"><GSkeleton :lines="3" /></GCard>
    <GCard v-else-if="opts.error.value">
      <GEmpty tone="danger" icon="alert" title="無法取得預算選項" :description="describeError(opts.error.value)">
        <GButton icon="refresh" @click="opts.reload">重試</GButton>
      </GEmpty>
    </GCard>
    <template v-else-if="opts.data.value">
      <GCard>
        <div class="row filter">
          <span class="small"> {{ opts.data.value.company.name ?? opts.data.value.company.id }} · {{ opts.data.value.year ?? '—' }} 年度 </span>
          <GSelect v-model="flag" :options="versionOptions" placeholder="版本" class="ver" aria-label="版本" />
          <GSelect v-model="dept" :options="deptOptions" placeholder="部門" class="dept" aria-label="部門" />
          <GButton variant="primary" icon="search" :loading="loading" :disabled="!flag || !dept" @click="search">查詢</GButton>
        </div>
      </GCard>
      <GCard v-if="!opts.data.value.depts.length">
        <GEmpty icon="pie-chart" title="沒有可查看的部門" description="部門預算的查看權限由財務於預算系統(Budget UserInfo:管理者 / 部門主管)設定。" />
      </GCard>
      <GAlert tone="info" icon="info" title="實際金額系統轉移中">實際發生金額來自舊 ERP(TIPTOP)傳票,目前只顯示預算。</GAlert>

      <GCard v-if="error">
        <GEmpty tone="danger" icon="alert" title="無法取得部門預算" :description="describeError(error)">
          <GButton icon="refresh" @click="reload">重試</GButton>
        </GEmpty>
      </GCard>
      <GCard v-else-if="data" :title="`${data.dept} 預算(${data.version.label})`" icon="pie-chart">
        <GEmpty v-if="!data.rows.length" icon="pie-chart" title="此版本沒有該部門的預算資料" />
        <div v-else class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th class="sticky">會計科目</th>
                <th v-for="m in MONTHS" :key="m" class="num">{{ m }}</th>
                <th class="num">年度合計</th>
                <th class="num">實際</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in data.rows" :key="r.code">
                <td class="sticky">
                  <span class="mono">{{ r.code }}</span> {{ r.name }}
                </td>
                <td v-for="(v, i) in r.months" :key="i" class="num">{{ fmtMoney(v) }}</td>
                <td class="num b">{{ fmtMoney(r.total) }}</td>
                <td class="num faint">轉移中</td>
              </tr>
              <tr class="sum">
                <td class="sticky">月總計</td>
                <td v-for="(v, i) in data.monthTotals" :key="i" class="num">{{ fmtMoney(v) }}</td>
                <td class="num">{{ fmtMoney(data.total) }}</td>
                <td class="num faint">轉移中</td>
              </tr>
            </tbody>
          </table>
        </div>
      </GCard>
    </template>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.filter {
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.ver {
  width: 160px;
}
.dept {
  width: 240px;
  max-width: 100%;
}
.table-wrap {
  overflow-x: auto;
}
.data-table {
  border-collapse: collapse;
  font-size: var(--fs-sm);
  min-width: 100%;
}
.data-table th,
.data-table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
  text-align: left;
}
.data-table th {
  font-weight: 600;
  color: var(--text-2);
  background: var(--glass-soft);
}
.num {
  text-align: right !important;
  font-family: var(--font-mono, monospace);
}
.b,
.sum td {
  font-weight: 600;
}
.sticky {
  position: sticky;
  left: 0;
  background: var(--glass-strong);
  z-index: 1;
}
.mono {
  font-family: var(--font-mono, monospace);
}
</style>
