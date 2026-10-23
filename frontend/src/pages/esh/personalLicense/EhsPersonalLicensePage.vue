<script setup lang="ts">
/**
 * 證照人員設定(old_PortalSolar EHS/EHLicense.aspx;FEATURE-PLAN §8;docs/Gherkin/esh/license.feature、notify.feature)。
 *   - 清單:目前追蹤 / 含歷史(已刪除、離職)/ 無需追蹤(通知天數 0);狀態由後端計算(有效 / 需通知 / 已失效 / 已離職)
 *   - 新增持證:工號需在職(後端查 LOS);下次複訓日由後端計算(取得 / 初訓 / 複訓日最晚者 + 有效期 − 1 天),畫面只顯示預覽
 *   - 證照影本經 giga-file-service(refType portal-esh-license,refNo = 人員證照 ID),不再同名覆蓋他人檔案;舊站影本唯讀連結
 *   - 「立即通知」(按鈕 portal.esh.notify.send):只寄本人管理的公司;平常由排程每週一寄送;通知紀錄可查每封結果
 * 維護按鈕 portal.esh.personal.edit。
 */
import { computed, reactive, ref } from 'vue';
import { can, describeError } from '@/api/gateway';
import { fmtTime } from '@/api/format';
import {
  addEshHolderDoc,
  bindFiles,
  createEshHolder,
  deleteEshHolder,
  deleteEshHolderDoc,
  deleteEshLegacyDoc,
  eshHolders,
  eshItems,
  eshNotifyLogs,
  eshNotifyRuns,
  sendEshNotify,
  updateEshHolder,
  uploadFile,
  type EshHolder,
  type EshHolderDoc,
  type EshHolderView,
  type EshJobRun,
  type EshNotifyLog,
} from '@/api/portal';
import {
  accept,
  DOC_EXTENSIONS,
  docHref,
  filterHolders,
  hasExt,
  notifySummary,
  previewNextDate,
  REF,
  sendStatusText,
  STATUS_TONE,
  statusText,
} from '@/composables/esh';
import { useAsync } from '@/composables/useAsync';
import { confirm, toast } from '@/ui/feedback';

const company = ref('');
const view = ref<EshHolderView>('current');
const licenseId = ref('');
const keyword = ref('');
const { data, loading, error, reload } = useAsync(async () => {
  const [h, items] = await Promise.all([eshHolders({ company: company.value || undefined, view: view.value }), eshItems()]);
  return { ...h, licenses: items.items };
});
const companies = computed(() => data.value?.companies ?? []);
const companyOptions = computed(() => [{ label: '全部公司', value: '' }, ...companies.value.map((c) => ({ label: c, value: c }))]);
const licenseOptions = computed(() => (data.value?.licenses ?? []).map((l) => ({ label: l.name, value: String(l.id) })));
const viewOptions = [
  { label: '目前追蹤', value: 'current' },
  { label: '含歷史', value: 'history' },
  { label: '無需追蹤', value: 'untracked' },
];
const rows = computed(() => filterHolders(data.value?.items ?? [], keyword.value, licenseId.value));
const editable = computed(() => can('portal.esh.personal.edit'));

// ───── 新增 / 編輯 ─────
const modal = ref(false);
const editing = ref<EshHolder | null>(null);
const form = reactive({ empNo: '', licenseId: '', company: '', trainingDate: '', gatDate: '', retrainDate: '', notifyDays: '90' });
const saving = ref(false);
const selectedLicense = computed(() => data.value?.licenses.find((l) => String(l.id) === form.licenseId) ?? null);
const preview = computed(() =>
  previewNextDate(
    [form.trainingDate, form.gatDate, form.retrainDate],
    selectedLicense.value?.months ?? editing.value?.months ?? null,
    selectedLicense.value?.permanent ?? editing.value?.permanent ?? false,
  ),
);
function open(h: EshHolder | null) {
  editing.value = h;
  Object.assign(form, {
    empNo: h?.empNo ?? '',
    licenseId: h ? String(h.licenseId) : '',
    company: h?.company ?? (company.value || companies.value[0] || ''),
    trainingDate: h?.trainingDate ?? '',
    gatDate: h?.gatDate ?? '',
    retrainDate: h?.retrainDate ?? '',
    notifyDays: String(h?.notifyDays ?? 90),
  });
  modal.value = true;
}
async function save() {
  saving.value = true;
  try {
    const body = {
      company: form.company,
      trainingDate: form.trainingDate || null,
      gatDate: form.gatDate || null,
      retrainDate: form.retrainDate || null,
      notifyDays: Number(form.notifyDays),
    };
    const saved = editing.value
      ? await updateEshHolder(editing.value.id, body)
      : await createEshHolder({ ...body, empNo: form.empNo, licenseId: Number(form.licenseId) });
    modal.value = false;
    toast.success(`已儲存,下次複訓日 ${saved.nextTrainingDate ?? '未設定'}`);
    await reload();
  } catch (e) {
    toast.fromError(e, '儲存失敗');
  } finally {
    saving.value = false;
  }
}
async function remove(h: EshHolder) {
  if (!(await confirm({ title: '刪除人員證照', message: `確定刪除 ${h.empNo} ${h.name ?? ''} 的「${h.licenseName}」?`, confirmText: '刪除', tone: 'danger' })))
    return;
  try {
    await deleteEshHolder(h.id);
    await reload();
  } catch (e) {
    toast.fromError(e, '刪除失敗');
  }
}

// ───── 證照影本 ─────
const docInput = ref<HTMLInputElement | null>(null);
const docTarget = ref<EshHolder | null>(null);
function pickDoc(h: EshHolder) {
  docTarget.value = h;
  docInput.value?.click();
}
async function onDoc(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = '';
  const h = docTarget.value;
  if (!f || !h) return;
  if (!hasExt(f.name, DOC_EXTENSIONS)) return toast.error(`證照影本只接受 ${DOC_EXTENSIONS.join(' / ')}`);
  try {
    const fileId = await uploadFile(REF.license, f);
    await addEshHolderDoc(h.id, { fileId, fileName: f.name });
    await bindFiles(REF.license, String(h.id), [fileId]);
    toast.success('影本已上傳');
    await reload();
  } catch (err) {
    toast.fromError(err, '影本上傳失敗');
  }
}
async function removeDoc(h: EshHolder, d: EshHolderDoc) {
  if (!(await confirm({ title: '刪除證照影本', message: `確定刪除「${d.fileName}」?`, confirmText: '刪除', tone: 'danger' }))) return;
  try {
    if (d.kind === 'file') await deleteEshHolderDoc(h.id, d.id);
    else await deleteEshLegacyDoc(h.id, d.fileName);
    await reload();
  } catch (e) {
    toast.fromError(e, '刪除影本失敗');
  }
}

// ───── 複訓通知 ─────
const sending = ref(false);
async function notify() {
  if (
    !(await confirm({
      title: '立即通知',
      message: '依規則寄送複訓通知給本人、主管與管理員彙整(只含您管理的公司)。平常每週一由排程自動寄送,確定現在寄送?',
      confirmText: '寄送',
    }))
  )
    return;
  sending.value = true;
  try {
    toast.success(notifySummary(await sendEshNotify()));
  } catch (e) {
    toast.fromError(e, '通知失敗');
  } finally {
    sending.value = false;
  }
}
const runsOpen = ref(false);
const runs = ref<{ mode: string; items: EshJobRun[] } | null>(null);
const logs = ref<EshNotifyLog[] | null>(null);
async function openRuns() {
  runsOpen.value = true;
  logs.value = null;
  try {
    runs.value = await eshNotifyRuns();
  } catch (e) {
    toast.fromError(e, '無法取得通知紀錄');
  }
}
async function openLogs(r: EshJobRun) {
  try {
    logs.value = (await eshNotifyLogs(r.id)).items;
  } catch (e) {
    toast.fromError(e, '無法取得寄送明細');
  }
}
const KIND: Record<string, string> = { holder: '本人', boss: '主管', admin: '管理員彙整' };
</script>

<template>
  <div class="stack">
    <GCard>
      <div class="row filters">
        <GSelect v-model="company" :options="companyOptions" class="sel" @update:model-value="reload" />
        <GSegmented v-model="view" :options="viewOptions" size="sm" @update:model-value="reload" />
        <GSelect v-model="licenseId" :options="[{ label: '全部證照', value: '' }, ...licenseOptions]" class="sel" />
        <GInput v-model="keyword" icon="search" placeholder="工號 / 姓名 / 部門 / 證照" clearable class="kw" />
      </div>
      <div class="row filters tools">
        <GButton v-can="'portal.esh.personal.edit'" variant="primary" icon="plus" :disabled="!companies.length" @click="open(null)">新增人員證照</GButton>
        <GButton v-can="'portal.esh.notify.send'" icon="send" :loading="sending" :disabled="!companies.length" @click="notify">立即通知</GButton>
        <GButton variant="ghost" icon="history" @click="openRuns">通知紀錄</GButton>
      </div>
    </GCard>
    <input ref="docInput" type="file" hidden :accept="accept(DOC_EXTENSIONS)" @change="onDoc" />

    <GCard v-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得人員證照" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="loading && !data"><GSkeleton :lines="6" /></GCard>
    <GCard v-else-if="data" :title="`人員證照(${rows.length})`" icon="id-card">
      <GEmpty v-if="!companies.length" icon="lock" title="您不是任何公司的證照管理員" />
      <GEmpty v-else-if="!rows.length" icon="id-card" title="沒有符合條件的人員證照" />
      <div v-else class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>公司</th>
              <th>部門</th>
              <th>工號 / 姓名</th>
              <th>證照</th>
              <th>初訓</th>
              <th>取得</th>
              <th>複訓</th>
              <th>下次複訓</th>
              <th>通知天數</th>
              <th>狀態</th>
              <th>證照影本</th>
              <th v-if="editable"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="h in rows" :key="h.id" :class="{ off: !h.active }">
              <td class="nowrap">{{ h.company }}</td>
              <td class="nowrap">{{ h.dept ?? '—' }}</td>
              <td class="nowrap">
                <span class="mono">{{ h.empNo }}</span> {{ h.name ?? '' }}
              </td>
              <td class="wrap">{{ h.licenseName }}</td>
              <td class="nowrap">{{ h.trainingDate ?? '—' }}</td>
              <td class="nowrap">{{ h.gatDate ?? '—' }}</td>
              <td class="nowrap">{{ h.retrainDate ?? '—' }}</td>
              <td class="nowrap">{{ h.nextTrainingDate ?? '—' }}</td>
              <td>{{ h.notifyDays ?? '—' }}</td>
              <td class="nowrap">
                <GBadge :tone="STATUS_TONE[h.status]">{{ statusText(h) }}</GBadge>
              </td>
              <td>
                <div class="docs">
                  <span v-for="d in h.docs" :key="d.kind === 'file' ? `f${d.id}` : `l${d.fileName}`" class="doc">
                    <a v-if="docHref(d)" :href="docHref(d)!" target="_blank" rel="noopener noreferrer">{{ d.fileName }}</a>
                    <span v-else class="faint">{{ d.fileName }}</span>
                    <GBadge v-if="d.kind === 'legacy'" tone="neutral">舊站</GBadge>
                    <GButton v-if="editable && h.active" size="sm" variant="ghost" square icon="x" aria-label="刪除影本" @click="removeDoc(h, d)" />
                  </span>
                  <span v-if="!h.docs.length" class="faint">—</span>
                </div>
              </td>
              <td v-if="editable">
                <span v-if="h.active" class="acts">
                  <GButton size="sm" variant="ghost" square icon="upload" aria-label="上傳影本" @click="pickDoc(h)" />
                  <GButton size="sm" variant="ghost" square icon="edit" aria-label="編輯" @click="open(h)" />
                  <GButton size="sm" variant="ghost" square icon="trash" aria-label="刪除" @click="remove(h)" />
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>

    <GModal v-model:open="modal" :title="editing ? '編輯人員證照' : '新增人員證照'" icon="id-card" width="640px">
      <form class="stack" @submit.prevent="save">
        <div class="grid2">
          <GInput v-model="form.empNo" label="工號(需在職)" :disabled="!!editing" required />
          <GSelect v-model="form.licenseId" label="證照" :options="licenseOptions" placeholder="選擇證照" :disabled="!!editing" required />
          <GSelect v-model="form.company" label="公司" :options="companies.map((c) => ({ label: c, value: c }))" required />
          <GInput v-model="form.notifyDays" type="number" label="通知天數(0 = 不追蹤)" required />
          <GInput v-model="form.trainingDate" type="date" label="初訓日" />
          <GInput v-model="form.gatDate" type="date" label="取得日" />
          <GInput v-model="form.retrainDate" type="date" label="複訓日" />
        </div>
        <GAlert tone="info" icon="info">下次複訓日由系統計算(三個日期中最晚者 + 有效期 − 1 天):預覽 {{ preview ?? '未設定' }}</GAlert>
        <div class="row end">
          <GButton @click="modal = false">取消</GButton>
          <GButton v-can="'portal.esh.personal.edit'" type="submit" variant="primary" icon="check" :loading="saving">儲存</GButton>
        </div>
      </form>
    </GModal>

    <GModal v-model:open="runsOpen" title="複訓通知紀錄" icon="history" width="760px">
      <GAlert v-if="runs?.mode === 'dry-run'" tone="warning" icon="alert">目前為模擬寄送(dry-run):只寫寄送紀錄,不會寄出 Email。</GAlert>
      <GEmpty v-if="runs && !runs.items.length" icon="history" title="尚無通知紀錄" />
      <div v-else-if="runs" class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>時間</th>
              <th>方式</th>
              <th>執行者</th>
              <th>結果</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in runs.items" :key="r.id">
              <td class="nowrap">{{ fmtTime(r.startedAt) }}</td>
              <td>{{ r.trigger === 'schedule' ? '排程' : '手動' }}</td>
              <td class="mono">{{ r.requestedBy ?? '—' }}</td>
              <td class="wrap">
                <GBadge :tone="r.status === 'ok' ? 'success' : r.status === 'failed' ? 'danger' : 'neutral'">{{ r.status }}</GBadge> {{ r.summary ?? '' }}
              </td>
              <td><GButton size="sm" variant="ghost" @click="openLogs(r)">明細</GButton></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="logs" class="table-wrap">
        <h4>寄送明細</h4>
        <GEmpty v-if="!logs.length" icon="mail" title="這次沒有需要通知的對象" />
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>收件人</th>
              <th>類型</th>
              <th>公司</th>
              <th>筆數</th>
              <th>結果</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(l, idx) in logs" :key="idx">
              <td class="mono">{{ l.empNo }}</td>
              <td>{{ KIND[l.kind] ?? l.kind }}</td>
              <td>{{ l.company ?? '—' }}</td>
              <td>{{ l.itemCount }}</td>
              <td class="wrap">{{ sendStatusText(l.status) }}{{ l.message ? `:${l.message}` : '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </GModal>
  </div>
</template>

<style scoped src="../esh.css"></style>
<style scoped>
.tools {
  margin-top: 10px;
}
.doc {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  overflow-wrap: anywhere;
}
</style>
