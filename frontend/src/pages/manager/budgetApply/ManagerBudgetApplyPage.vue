<script setup lang="ts">
/**
 * 部門預算編列(old_PortalSolar Budget_DeptData.aspx;FEATURE-PLAN §7.2、D-26;docs/Gherkin/manager/budget.feature)。
 * 只列未結案版本;合計 / 禁填科目不可填;「更新預算」包交易、後端檢查鎖定;「送出」前有未儲存修改時擋下(舊「預算資料未上傳更新」)。
 * 寫入按鈕 portal.mgr.budget-apply.edit。舊頁 Excel 上傳 / 貼上解析、去年實際金額(TIPTOP)不在本版(CONFIRM-NEEDED P5)。
 */
import { computed, ref } from 'vue';
import { budgetApply, budgetApplyOptions, saveBudgetApply, submitBudgetApply, type BudgetApplyView } from '@/api/portal';
import { can, describeError } from '@/api/gateway';
import { BUDGET_STATUS, budgetChanges, budgetTotals, cellKey, fmtMoney, initialEdits, type BudgetEdits } from '@/composables/manager';
import { useAsync } from '@/composables/useAsync';
import { confirm, toast } from '@/ui/feedback';

const flag = ref('');
const dept = ref('');
const opts = useAsync(async () => {
  const o = await budgetApplyOptions();
  if (!flag.value && o.versions.length) flag.value = String(o.versions[0]!.flag);
  if (!dept.value && o.depts.length) dept.value = o.depts[0]!.id;
  return o;
});
const versionOptions = computed(() => (opts.data.value?.versions ?? []).map((v) => ({ label: v.label, value: String(v.flag) })));
const deptOptions = computed(() => (opts.data.value?.depts ?? []).map((d) => ({ label: `${d.id} ${d.name ?? ''}`.trim(), value: d.id })));

const view = ref<BudgetApplyView | null>(null);
const edits = ref<BudgetEdits>({});
const remark = ref('');
const loading = ref(false);
const error = ref<Error | null>(null);
const busy = ref(false);
const markCell = ref<{ code: string; month: number; name: string } | null>(null);

function show(v: BudgetApplyView) {
  view.value = v;
  edits.value = initialEdits(v.rows);
  remark.value = v.remark ?? '';
}
async function load() {
  if (!flag.value || !dept.value) return;
  if (dirty.value && !(await confirm({ title: '放棄修改', message: '有尚未更新的修改,確定重新載入?', confirmText: '重新載入', tone: 'danger' }))) return;
  loading.value = true;
  error.value = null;
  try {
    show(await budgetApply(Number(flag.value), dept.value));
  } catch (e) {
    error.value = e as Error;
    view.value = null;
  } finally {
    loading.value = false;
  }
}

const changes = computed(() => (view.value ? budgetChanges(view.value.rows, edits.value) : { cells: [], invalid: [] }));
const remarkChanged = computed(() => !!view.value && remark.value !== (view.value.remark ?? ''));
const dirty = computed(() => changes.value.cells.length > 0 || changes.value.invalid.length > 0 || remarkChanged.value);
const totals = computed(() => (view.value ? budgetTotals(view.value.rows, edits.value) : { row: {}, month: [] as number[] }));
const writable = computed(() => !!view.value && !view.value.locked && can('portal.mgr.budget-apply.edit'));
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

async function save() {
  if (!view.value) return;
  if (changes.value.invalid.length) return toast.error(`請確認底下資料:${changes.value.invalid.join('、')} 金額格式錯誤`);
  busy.value = true;
  try {
    show(
      await saveBudgetApply({
        flag: view.value.version.flag,
        dept: view.value.dept,
        ...(remarkChanged.value ? { remark: remark.value } : {}),
        cells: changes.value.cells,
      }),
    );
    toast.success('已更新預算資料');
  } catch (e) {
    toast.fromError(e, '更新預算失敗');
  } finally {
    busy.value = false;
  }
}
async function submit() {
  if (!view.value) return;
  if (dirty.value) return toast.error('預算資料未上傳更新:請先按「更新預算」再送出');
  if (!(await confirm({ title: '送出部門預算', message: `送出 ${view.value.dept} 的預算後即不能再修改,確定送出?`, confirmText: '送出' }))) return;
  busy.value = true;
  try {
    show(await submitBudgetApply(view.value.version.flag, view.value.dept));
    toast.success('部門預算已送出');
  } catch (e) {
    toast.fromError(e, '送出失敗');
  } finally {
    busy.value = false;
  }
}
const statusText = computed(() => {
  const v = view.value;
  if (!v) return '';
  if (v.version.isFinal) return '預算已結案';
  return v.status === null ? '未提交' : (BUDGET_STATUS[v.status] ?? `狀態 ${v.status}`);
});
</script>

<template>
  <div class="stack">
    <GCard v-if="opts.loading.value && !opts.data.value"><GSkeleton :lines="3" /></GCard>
    <GCard v-else-if="opts.error.value">
      <GEmpty tone="danger" icon="alert" title="無法取得預算編列選項" :description="describeError(opts.error.value)">
        <GButton icon="refresh" @click="opts.reload">重試</GButton>
      </GEmpty>
    </GCard>
    <template v-else-if="opts.data.value">
      <GCard>
        <div class="row filter">
          <span class="small">{{ opts.data.value.company.name ?? opts.data.value.company.id }}</span>
          <GSelect v-model="flag" :options="versionOptions" placeholder="預算版本" class="ver" aria-label="預算版本" :disabled="!versionOptions.length" />
          <GSelect v-model="dept" :options="deptOptions" placeholder="部門" class="dept" aria-label="部門" :disabled="!deptOptions.length" />
          <GButton variant="primary" icon="search" :loading="loading" :disabled="!flag || !dept" @click="load">查詢</GButton>
        </div>
      </GCard>
      <GCard v-if="!versionOptions.length || !deptOptions.length">
        <GEmpty
          icon="plus-circle"
          :title="!versionOptions.length ? '目前沒有開放編列的預算版本' : '沒有可編列的部門'"
          description="預算版本與部門權限由財務於預算系統設定。"
        />
      </GCard>

      <GCard v-if="error">
        <GEmpty tone="danger" icon="alert" title="無法取得預算資料" :description="describeError(error)">
          <GButton icon="refresh" @click="load">重試</GButton>
        </GEmpty>
      </GCard>
      <template v-else-if="view">
        <GAlert v-if="view.locked" tone="warning" icon="lock" :title="statusText">
          {{ view.version.isFinal ? `預算版本 ${view.version.label} 預算已結案` : `預算版本 ${view.version.label} 部門 ${view.dept} 預算已送出` }},不能再修改。
        </GAlert>
        <GCard :title="`${view.dept} · ${view.version.label}`" icon="plus-circle">
          <template #actions>
            <GBadge :tone="view.locked ? 'neutral' : 'warning'">{{ statusText }}</GBadge>
            <GBadge v-if="dirty" tone="danger">有未更新的修改</GBadge>
          </template>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="sticky">會計科目</th>
                  <th v-for="m in MONTHS" :key="m" class="num">{{ m }} 月</th>
                  <th class="num">年度合計</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in view.rows" :key="r.code" :class="{ sum: r.isSum }">
                  <td class="sticky">
                    <span class="mono">{{ r.code }}</span> {{ r.name }}
                    <GBadge v-if="r.isSum" tone="neutral">合計</GBadge>
                  </td>
                  <td v-for="m in MONTHS" :key="m" class="num">
                    <template v-if="r.months[m - 1]">
                      <input
                        v-if="writable && r.editable && edits[cellKey(r.code, m)]"
                        v-model="edits[cellKey(r.code, m)]!.amount"
                        class="cell"
                        inputmode="decimal"
                        :aria-label="`${r.name ?? r.code} ${m} 月`"
                      />
                      <span v-else>{{ fmtMoney(r.months[m - 1]!.amount) }}</span>
                      <button
                        v-if="writable && r.editable"
                        type="button"
                        class="mark"
                        :class="{ has: edits[cellKey(r.code, m)]?.mark }"
                        :title="edits[cellKey(r.code, m)]?.mark || '備註'"
                        @click="markCell = { code: r.code, month: m, name: r.name ?? r.code }"
                      >
                        <GIcon name="message" :size="12" />
                      </button>
                      <span v-else-if="r.months[m - 1]!.mark" class="mark has" :title="r.months[m - 1]!.mark ?? ''"><GIcon name="message" :size="12" /></span>
                    </template>
                    <span v-else class="faint">—</span>
                  </td>
                  <td class="num b">{{ fmtMoney(totals.row[r.code]) }}</td>
                </tr>
                <tr class="sum">
                  <td class="sticky">月總計</td>
                  <td v-for="(v, i) in totals.month" :key="i" class="num">{{ fmtMoney(v) }}</td>
                  <td class="num">{{ fmtMoney(totals.month.reduce((s, x) => s + x, 0)) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <GTextarea v-model="remark" label="部門備註" :rows="3" :disabled="!writable" class="remark" />
          <GAlert tone="neutral" icon="info">去年實際金額來自舊 ERP(TIPTOP)傳票,系統轉移中;合計科目與禁填科目由財務設定,不可填寫。</GAlert>
          <div v-if="writable" class="row end">
            <GButton v-can="'portal.mgr.budget-apply.edit'" variant="primary" icon="check" :loading="busy" :disabled="!dirty" @click="save">更新預算</GButton>
            <GButton v-can="'portal.mgr.budget-apply.edit'" variant="secondary" icon="send" :loading="busy" @click="submit">送出(下一步)</GButton>
          </div>
        </GCard>
      </template>
    </template>

    <GModal :open="!!markCell" title="月份備註" icon="message" @update:open="(v: boolean) => !v && (markCell = null)">
      <div v-if="markCell && edits[cellKey(markCell.code, markCell.month)]" class="stack">
        <span class="small">{{ markCell.name }} · {{ markCell.month }} 月(按「更新預算」後才會儲存)</span>
        <GTextarea v-model="edits[cellKey(markCell.code, markCell.month)]!.mark" label="備註(300 字內)" :rows="3" />
        <div class="row end"><GButton variant="primary" @click="markCell = null">完成</GButton></div>
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
.filter {
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.ver {
  width: 220px;
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
  padding: 4px 8px;
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
.cell {
  width: 90px;
  text-align: right;
  font: inherit;
  padding: 3px 6px;
  border: 1px solid var(--field-border);
  border-radius: var(--radius-xs);
  background: var(--field);
  color: inherit;
}
.cell:focus {
  outline: none;
  border-color: var(--field-focus);
}
.mark {
  margin-left: 2px;
  border: none;
  background: none;
  color: var(--text-2);
  opacity: 0.4;
  cursor: pointer;
  padding: 0;
}
.mark.has {
  opacity: 1;
  color: var(--c-primary);
}
.remark {
  margin-top: 12px;
}
.mono {
  font-family: var(--font-mono, monospace);
}
.end {
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
</style>
