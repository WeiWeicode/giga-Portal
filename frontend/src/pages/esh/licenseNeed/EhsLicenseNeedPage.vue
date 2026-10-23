<script setup lang="ts">
/**
 * 證照需求(old_PortalSolar EHS/EHLicenseNeed.aspx;FEATURE-PLAN §8;docs/Gherkin/esh/license.feature)。
 * 公司 × 證照 × 需求張數(整數 ≥ 0)+ 備註;公司只能選本人管理的公司(後端檢查)。
 * 刪除同舊版為硬刪,新站人員清單不以需求表篩選,持證資料不會消失。維護按鈕 portal.esh.need.edit。
 */
import { computed, reactive, ref } from 'vue';
import { can, describeError } from '@/api/gateway';
import { createEshNeed, deleteEshNeed, eshItems, eshNeeds, updateEshNeed, type EshNeed } from '@/api/portal';
import { useAsync } from '@/composables/useAsync';
import { confirm, toast } from '@/ui/feedback';

const company = ref('');
const { data, loading, error, reload } = useAsync(async () => {
  const [needs, items] = await Promise.all([eshNeeds(company.value || undefined), eshItems()]);
  return { ...needs, licenses: items.items };
});
const companyOptions = computed(() => [{ label: '全部公司', value: '' }, ...(data.value?.companies ?? []).map((c) => ({ label: c, value: c }))]);
const licenseOptions = computed(() => (data.value?.licenses ?? []).map((l) => ({ label: l.name, value: String(l.id) })));

const modal = ref(false);
const editing = ref<EshNeed | null>(null);
const form = reactive({ company: '', licenseId: '', required: '1', notes: '' });
const saving = ref(false);
function open(n: EshNeed | null) {
  editing.value = n;
  Object.assign(form, {
    company: n?.company ?? (company.value || data.value?.companies[0] || ''),
    licenseId: n ? String(n.licenseId) : '',
    required: String(n?.required ?? 1),
    notes: n?.notes ?? '',
  });
  modal.value = true;
}
async function save() {
  saving.value = true;
  try {
    const body = { company: form.company, required: Number(form.required), notes: form.notes || null };
    if (editing.value) await updateEshNeed(editing.value.licenseId, body);
    else await createEshNeed({ ...body, licenseId: Number(form.licenseId) });
    modal.value = false;
    toast.success('已儲存');
    await reload();
  } catch (e) {
    toast.fromError(e, '儲存失敗');
  } finally {
    saving.value = false;
  }
}
async function remove(n: EshNeed) {
  if (
    !(await confirm({
      title: '刪除證照需求',
      message: `確定刪除「${n.company} · ${n.licenseName}」的需求?(持證人員資料不受影響)`,
      confirmText: '刪除',
      tone: 'danger',
    }))
  )
    return;
  try {
    await deleteEshNeed(n.company, n.licenseId);
    await reload();
  } catch (e) {
    toast.fromError(e, '刪除失敗');
  }
}
</script>

<template>
  <div class="stack">
    <GCard>
      <div class="row filters">
        <GSelect v-model="company" :options="companyOptions" class="sel" @update:model-value="reload" />
        <GButton v-can="'portal.esh.need.edit'" variant="primary" icon="plus" :disabled="!data?.companies.length" @click="open(null)">新增證照需求</GButton>
      </div>
    </GCard>

    <GCard v-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得證照需求" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="loading && !data"><GSkeleton :lines="5" /></GCard>
    <GCard v-else-if="data" title="證照需求" icon="layers">
      <GEmpty v-if="!data.companies.length" icon="lock" title="您不是任何公司的證照管理員" />
      <GEmpty v-else-if="!data.items.length" icon="layers" title="尚未設定證照需求" />
      <div v-else class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>公司</th>
              <th>證照名稱</th>
              <th>需求張數</th>
              <th>備註</th>
              <th v-if="can('portal.esh.need.edit')"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="n in data.items" :key="`${n.company}-${n.licenseId}`">
              <td class="nowrap">{{ n.company }}</td>
              <td class="wrap">{{ n.licenseName }}</td>
              <td>{{ n.required }}</td>
              <td class="wrap">{{ n.notes || '—' }}</td>
              <td v-if="can('portal.esh.need.edit')">
                <span class="acts">
                  <GButton size="sm" variant="ghost" square icon="edit" aria-label="編輯" @click="open(n)" />
                  <GButton size="sm" variant="ghost" square icon="trash" aria-label="刪除" @click="remove(n)" />
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>

    <GModal v-model:open="modal" :title="editing ? '編輯證照需求' : '新增證照需求'" icon="layers">
      <form class="stack" @submit.prevent="save">
        <GSelect v-model="form.company" label="公司" :options="(data?.companies ?? []).map((c) => ({ label: c, value: c }))" :disabled="!!editing" required />
        <GSelect v-model="form.licenseId" label="證照" :options="licenseOptions" placeholder="選擇證照" :disabled="!!editing" required />
        <GInput v-model="form.required" type="number" label="需求張數(整數 ≥ 0)" required />
        <GTextarea v-model="form.notes" label="備註(350 字內)" :rows="3" />
        <div class="row end">
          <GButton @click="modal = false">取消</GButton>
          <GButton v-can="'portal.esh.need.edit'" type="submit" variant="primary" icon="check" :loading="saving">儲存</GButton>
        </div>
      </form>
    </GModal>
  </div>
</template>

<style scoped src="../esh.css"></style>
