<script setup lang="ts">
/**
 * 年度教育訓練計畫(old_PortalSolar ELlessionplan.aspx;FEATURE-PLAN §7.1;docs/Gherkin/manager/training.feature)。
 * 資料:GET /api/portal/manager/training(ELClassAnnual 年度、ELPlanDept 負責部門 ∩ 範圍、ELClassForm 課程、提交狀態、帶入來源)。
 * 寫入(按鈕 portal.mgr.training.edit):新增 / 修改 / 刪除課程、確定提交(後端檢查每部門 ≥ 2 門在職訓練課程與必填,提交後鎖定)。
 */
import { computed, reactive, ref } from 'vue';
import {
  createTrainingCourse,
  deleteTrainingCourse,
  submitTrainingPlan,
  trainingExportUrl,
  trainingPlan,
  updateTrainingCourse,
  type AppliedCourse,
  type CourseInput,
  type PlanCourse,
  type TrainingView,
} from '@/api/portal';
import { ApiError, can, describeError } from '@/api/gateway';
import { courseFromApplied, courseFromPlan, emptyCourse, MIN_ON_JOB, onJobCount, SEASON_LABEL, seasonText } from '@/composables/manager';
import { useAsync } from '@/composables/useAsync';
import { confirm, toast } from '@/ui/feedback';

const { data, loading, error, reload } = useAsync(() => trainingPlan());
const set = (v: TrainingView) => (data.value = v);
const editable = computed(() => (data.value?.depts ?? []).filter((d) => !data.value!.lockedDepts.includes(d.code)).map((d) => d.code));
const canWrite = computed(() => !!data.value?.canEdit && can('portal.mgr.training.edit'));
const deptName = (code: string) => data.value?.depts.find((d) => d.code === code)?.name ?? '';
const deptOptions = computed(() => (data.value?.depts ?? []).map((d) => ({ label: `${d.code} ${d.name ?? ''}`.trim(), value: d.code })));

// ───── 帶入來源 ─────
const source = ref('last');
const sourceOptions = computed(() => [
  { label: `${(data.value?.year ?? 0) - 1} 年度訓練計畫`, value: 'last' },
  { label: `${(data.value?.year ?? 0) - 1} 年度實際開課(E-Learning 申請)`, value: 'applied' },
]);

// ───── 新增 / 修改 ─────
const modal = ref(false);
const editingId = ref<string | null>(null);
type CourseForm = Omit<CourseInput, 'hour' | 'cost1' | 'cost2' | 'cost3'> & { hour: string; cost1: string; cost2: string; cost3: string; otherTest: string };
const toForm = (c: CourseInput): CourseForm => ({
  ...c,
  hour: c.hour ? String(c.hour) : '',
  cost1: String(c.cost1),
  cost2: String(c.cost2),
  cost3: String(c.cost3),
  otherTest: '',
});
const form = reactive<CourseForm>(toForm(emptyCourse('')));
const saving = ref(false);
const fieldErrors = ref<Record<string, string>>({});
const subTypes = computed(() => data.value?.options.subTypes[form.classType] ?? []);
const total = computed(() => (Number(form.cost1) || 0) + (Number(form.cost2) || 0) + (Number(form.cost3) || 0));
const testIsOther = computed(() => form.testType === '其他');

function fill(input: CourseInput, id: string | null) {
  const known = data.value?.options.testTypes.includes(input.testType) || !input.testType;
  Object.assign(form, { ...toForm(input), testType: known ? input.testType : '其他', otherTest: known ? '' : input.testType });
  editingId.value = id;
  fieldErrors.value = {};
  modal.value = true;
}
const first = () => editable.value[0] ?? data.value?.depts[0]?.code ?? '';
const openNew = () => fill(emptyCourse(first()), null);
const openEdit = (c: PlanCourse) => fill(courseFromPlan(c, editable.value, first()), c.classId);
const importPlan = (c: PlanCourse) => fill(courseFromPlan(c, editable.value, first()), null);
const importApplied = (a: AppliedCourse) => fill(courseFromApplied(a, editable.value, first()), null);

function body(): CourseInput {
  const { otherTest, ...rest } = form;
  return {
    ...rest,
    testType: testIsOther.value ? otherTest.trim() : form.testType,
    hour: Number(form.hour),
    cost1: Number(form.cost1),
    cost2: Number(form.cost2),
    cost3: Number(form.cost3),
  };
}
async function save() {
  saving.value = true;
  fieldErrors.value = {};
  try {
    if (editingId.value) await updateTrainingCourse(editingId.value, body());
    else await createTrainingCourse(body());
    toast.success(editingId.value ? `成功編輯課程『${form.className}』` : `成功新增課程『${form.className}』`);
    modal.value = false;
    await reload();
  } catch (e) {
    if (e instanceof ApiError && Array.isArray(e.details))
      fieldErrors.value = Object.fromEntries((e.details as { field: string; message: string }[]).map((d) => [d.field, d.message]));
    toast.fromError(e, '儲存失敗');
  } finally {
    saving.value = false;
  }
}
async function remove(c: PlanCourse) {
  if (!(await confirm({ title: '刪除課程', message: `確定刪除課程『${c.className ?? ''}』?`, confirmText: '刪除', tone: 'danger' }))) return;
  try {
    await deleteTrainingCourse(c.classId);
    toast.success('已刪除');
    await reload();
  } catch (e) {
    toast.fromError(e, '刪除失敗');
  }
}

// ───── 提交 / 匯出 ─────
const submitting = ref(false);
const problems = ref<{ dept?: string; message: string }[]>([]);
async function submit() {
  if (!data.value) return;
  const ok = await confirm({
    title: '確定提交',
    message: `提交 ${data.value.year} 年度教育訓練計畫後即鎖定,不能再新增、修改或刪除課程。確定提交?`,
    confirmText: '提交',
  });
  if (!ok) return;
  submitting.value = true;
  problems.value = [];
  try {
    set(await submitTrainingPlan());
    toast.success(`已提交 ${data.value.year} 年度教育計劃`);
  } catch (e) {
    if (e instanceof ApiError && e.code === 'PORTAL_MGR_TRAINING_INCOMPLETE' && Array.isArray(e.details)) problems.value = e.details as typeof problems.value;
    toast.fromError(e, '未能提交');
  } finally {
    submitting.value = false;
  }
}
const exportDept = ref('');
const doExport = () => {
  const d = exportDept.value || first();
  if (d) window.open(trainingExportUrl(d), '_blank', 'noopener');
};
const err = (f: string) => fieldErrors.value[f] ?? null;
</script>

<template>
  <div class="stack">
    <GCard v-if="loading && !data"><GSkeleton :lines="5" /></GCard>
    <GCard v-else-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得訓練計畫" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <template v-else-if="data">
      <GCard :title="`${data.year} 年度教育訓練計劃`" icon="book-open">
        <template #actions>
          <GBadge v-if="data.submitted" tone="primary" icon="check">已提交(鎖定)</GBadge>
          <GBadge v-else-if="data.depts.length" tone="warning">編輯中</GBadge>
        </template>
        <GEmpty
          v-if="!data.depts.length"
          icon="book-open"
          title="您沒有負責的訓練計畫部門"
          :description="data.outOfScope.length ? '人資指定的部門不在您的主管範圍內,請洽人資。' : '負責部門由人資於年度訓練計畫設定(ELPlanDept)。'"
        />
        <div v-else class="stack">
          <p class="small m-0">
            您負責 <b>{{ data.depts.length }}</b> 個部門,每個部門至少要有 <b>{{ MIN_ON_JOB }}</b> 門「專業職能 › 在職訓練課程」才能提交。
          </p>
          <div class="dept-chips">
            <span v-for="d in data.depts" :key="d.code" class="chip" :class="{ ok: onJobCount(data.courses, d.code) >= MIN_ON_JOB }">
              {{ d.code }} {{ d.name ?? '' }} · 在職訓練 {{ onJobCount(data.courses, d.code) }} / {{ MIN_ON_JOB }}
              <GBadge v-if="data.lockedDepts.includes(d.code)" tone="neutral">已提交</GBadge>
            </span>
          </div>
          <GAlert v-if="data.outOfScope.length" tone="warning" icon="alert">
            以下部門不在您的主管範圍內,不能編輯:{{ data.outOfScope.map((d) => d.code).join('、') }}
          </GAlert>
          <div class="row tools">
            <GButton v-can="'portal.mgr.training.edit'" variant="primary" icon="plus" :disabled="!canWrite || !editable.length" @click="openNew"
              >新增課程</GButton
            >
            <GButton v-can="'portal.mgr.training.edit'" variant="secondary" icon="send" :loading="submitting" :disabled="!canWrite" @click="submit"
              >確定提交</GButton
            >
            <span class="spacer" />
            <GSelect v-model="exportDept" :options="deptOptions" placeholder="匯出部門" class="exp" aria-label="匯出部門" />
            <GButton variant="ghost" icon="download" @click="doExport">匯出 Excel</GButton>
          </div>
          <GAlert v-if="problems.length" tone="danger" icon="alert" title="尚有資料未補齊,未能提交">
            <ul class="problems">
              <li v-for="(p, i) in problems" :key="i">{{ p.message }}</li>
            </ul>
          </GAlert>
        </div>
      </GCard>

      <GCard v-if="data.depts.length" :title="`${data.year} 年度課程(${data.courses.length} 門)`" icon="list">
        <GEmpty v-if="!data.courses.length" icon="book-open" title="尚未建立課程" description="可新增課程,或從下方去年資料「帶入」。" />
        <div v-else class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>部門</th>
                <th>類別 / 子類</th>
                <th>性質</th>
                <th>課程名稱</th>
                <th>時數</th>
                <th>訓練單位 / 講師</th>
                <th>季別</th>
                <th>費用</th>
                <th>評核</th>
                <th v-if="canWrite"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in data.courses" :key="c.classId">
                <td class="mono">{{ c.dept }}</td>
                <td>{{ c.classType ?? '—' }} / {{ c.subType ?? '—' }}</td>
                <td>{{ c.classWhere ?? '—' }} · {{ c.onType ?? '—' }}</td>
                <td class="name">
                  <b>{{ c.className }}</b>
                  <span class="xs faint agenda">{{ c.agenda }}</span>
                </td>
                <td class="mono">{{ c.hour ?? '—' }}</td>
                <td>{{ [c.teacherUnit, c.teacherName].filter(Boolean).join(' / ') || '—' }}</td>
                <td>{{ seasonText(c.season) }}</td>
                <td class="mono">{{ c.cost ?? '—' }}</td>
                <td>{{ c.testType || '—' }}</td>
                <td v-if="canWrite" class="acts">
                  <template v-if="editable.includes(c.dept)">
                    <GButton size="sm" variant="ghost" square icon="edit" aria-label="編輯" @click="openEdit(c)" />
                    <GButton size="sm" variant="ghost" square icon="trash" aria-label="刪除" @click="remove(c)" />
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </GCard>

      <GCard v-if="data.depts.length" title="帶入去年資料" icon="file-down">
        <div class="stack">
          <GSegmented v-model="source" :options="sourceOptions" size="sm" />
          <div class="table-wrap">
            <table v-if="source === 'last'" class="data-table">
              <thead>
                <tr>
                  <th>部門</th>
                  <th>課程名稱</th>
                  <th>子類</th>
                  <th>時數</th>
                  <th>季別</th>
                  <th v-if="canWrite"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in data.lastYear" :key="c.classId">
                  <td class="mono">{{ c.dept }}</td>
                  <td>{{ c.className }}</td>
                  <td>{{ c.subType ?? '—' }}</td>
                  <td class="mono">{{ c.hour ?? '—' }}</td>
                  <td>{{ seasonText(c.season) }}</td>
                  <td v-if="canWrite"><GButton size="sm" variant="ghost" icon="plus" @click="importPlan(c)">帶入</GButton></td>
                </tr>
                <tr v-if="!data.lastYear.length">
                  <td colspan="6" class="faint">沒有去年的訓練計畫</td>
                </tr>
              </tbody>
            </table>
            <table v-else class="data-table">
              <thead>
                <tr>
                  <th>申請日</th>
                  <th>主辦部門</th>
                  <th>課程名稱</th>
                  <th>性質</th>
                  <th>講師</th>
                  <th>時數</th>
                  <th v-if="canWrite"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(a, i) in data.applied" :key="i">
                  <td class="mono">{{ a.applyDate ?? '—' }}</td>
                  <td>{{ a.deptName ?? a.dept ?? '—' }}</td>
                  <td>{{ a.className }}</td>
                  <td>{{ a.classWhere }}</td>
                  <td>{{ a.teacherName ?? '—' }}</td>
                  <td class="mono">{{ a.hours ?? '—' }}</td>
                  <td v-if="canWrite"><GButton size="sm" variant="ghost" icon="plus" @click="importApplied(a)">帶入</GButton></td>
                </tr>
                <tr v-if="!data.applied.length">
                  <td colspan="7" class="faint">沒有去年的 E-Learning 申請紀錄</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </GCard>
    </template>

    <GModal v-model:open="modal" :title="editingId ? '編輯課程' : '新增課程'" icon="book-open" width="720px">
      <form v-if="data" class="stack" @submit.prevent="save">
        <div class="grid2">
          <GSelect v-model="form.dept" label="部門" :options="deptOptions.filter((o) => editable.includes(o.value))" required :error="err('dept')" />
          <GInput v-model="form.className" label="課程名稱" required :error="err('className')" />
          <GInput v-model="form.joinDept" label="參加部門" required :error="err('joinDept')" />
          <GSelect
            v-model="form.classWhere"
            label="課程性質"
            :options="data.options.classWhere.map((v) => ({ label: v, value: v }))"
            required
            :error="err('classWhere')"
          />
          <GSelect
            v-model="form.onType"
            label="實施方式"
            :options="data.options.onTypes.map((v) => ({ label: v, value: v }))"
            required
            :error="err('onType')"
          />
          <GSelect
            v-model="form.testType"
            label="評核方式"
            :options="[...data.options.testTypes, '其他'].map((v) => ({ label: v, value: v }))"
            required
            :error="err('testType')"
          />
          <GInput v-if="testIsOther" v-model="form.otherTest" label="其他評核方式" required />
          <GSelect
            v-model="form.classType"
            label="課程類別"
            :options="data.options.classTypes.map((v) => ({ label: v, value: v }))"
            required
            :error="err('classType')"
            @update:model-value="form.subType = ''"
          />
          <GSelect v-model="form.subType" label="課程類別-子類" :options="subTypes.map((v) => ({ label: v, value: v }))" required :error="err('subType')" />
          <GInput v-model="form.teacherUnit" label="訓練單位(提交前必填)" :error="err('teacherUnit')" />
          <GInput v-model="form.teacherName" label="講師(提交前必填)" :error="err('teacherName')" />
          <GInput v-model="form.hour" type="number" label="課程時數(至少 0.5)" required :error="err('hour')" />
        </div>
        <div class="seasons">
          <span class="xs">實施季別 <span class="danger">*</span></span>
          <div class="row wrap">
            <label v-for="s in data.options.seasons" :key="s" class="season">
              <input v-model="form.seasons" type="checkbox" :value="s" />
              {{ SEASON_LABEL[s] ?? s }}
            </label>
          </div>
          <span v-if="err('seasons')" class="xs danger">{{ err('seasons') }}</span>
        </div>
        <GTextarea v-model="form.agenda" label="課程大綱" :rows="3" required :error="err('agenda')" />
        <div class="grid4">
          <GInput v-model="form.cost1" type="number" label="講師費" :error="err('cost1')" />
          <GInput v-model="form.cost2" type="number" label="報名費" :error="err('cost2')" />
          <GInput v-model="form.cost3" type="number" label="雜費" :error="err('cost3')" />
          <div class="total">
            <span class="xs">總費用</span><b class="mono">{{ total }}</b>
          </div>
        </div>
        <div class="row end">
          <GButton @click="modal = false">取消</GButton>
          <GButton v-can="'portal.mgr.training.edit'" type="submit" variant="primary" icon="check" :loading="saving">
            {{ editingId ? '編輯上傳' : '新增課程' }}
          </GButton>
        </div>
      </form>
    </GModal>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.m-0 {
  margin: 0;
}
.dept-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--c-warning);
  font-size: var(--fs-sm);
}
.chip.ok {
  border-color: var(--c-primary);
}
.tools {
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.spacer {
  flex: 1;
}
.exp {
  width: 200px;
}
.problems {
  margin: 0;
  padding-left: 18px;
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
  padding: 8px 10px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
}
.data-table th {
  font-weight: 600;
  color: var(--text-2);
  background: var(--glass-soft);
  white-space: nowrap;
}
.name {
  min-width: 180px;
}
.agenda {
  display: block;
  white-space: pre-wrap;
  max-height: 3.6em;
  overflow: hidden;
}
.acts {
  white-space: nowrap;
}
.mono {
  font-family: var(--font-mono, monospace);
}
.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.grid4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  align-items: end;
}
.total {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 8px;
}
.seasons {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.wrap {
  flex-wrap: wrap;
  gap: 12px;
}
.season {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font-size: var(--fs-sm);
}
.danger {
  color: var(--c-danger);
}
.end {
  justify-content: flex-end;
  gap: 8px;
}
@media (max-width: 600px) {
  .grid2,
  .grid4 {
    grid-template-columns: 1fr;
  }
  .exp {
    width: 100%;
  }
}
</style>
