<script setup lang="ts">
/**
 * 證照管理員(old_PortalSolar EHS/EHManagerSetup.aspx;FEATURE-PLAN §8;docs/Gherkin/esh/license.feature)。
 * 新增:工號需在職、同公司不重複、公司須在本人範圍內;通知開關 = 是否收複訓彙整;不可刪除公司最後一位管理員。
 * 管理員名單也是 ESH 資料範圍的來源;新管理員另需 IT 指派角色 portal-esh-admin 才看得到選單。維護按鈕 portal.esh.manager.edit。
 */
import { computed, reactive, ref } from 'vue';
import { can, describeError } from '@/api/gateway';
import { createEshManager, deleteEshManager, eshManagers, updateEshManager, type EshManager } from '@/api/portal';
import { useAsync } from '@/composables/useAsync';
import { confirm, toast } from '@/ui/feedback';

const company = ref('');
const { data, loading, error, reload } = useAsync(() => eshManagers(company.value || undefined));
const companies = computed(() => data.value?.companies ?? []);
const companyOptions = computed(() => [{ label: '全部公司', value: '' }, ...companies.value.map((c) => ({ label: c, value: c }))]);

const modal = ref(false);
const form = reactive({ company: '', empNo: '', sendMail: true });
const saving = ref(false);
function open() {
  Object.assign(form, { company: company.value || companies.value[0] || '', empNo: '', sendMail: true });
  modal.value = true;
}
async function save() {
  saving.value = true;
  try {
    await createEshManager({ ...form });
    modal.value = false;
    toast.success('已新增;請 IT 指派角色 portal-esh-admin');
    await reload();
  } catch (e) {
    toast.fromError(e, '新增失敗');
  } finally {
    saving.value = false;
  }
}
async function toggle(m: EshManager, sendMail: boolean) {
  try {
    await updateEshManager({ company: m.company, empNo: m.empNo, sendMail });
    m.sendMail = sendMail;
  } catch (e) {
    toast.fromError(e, '更新失敗');
    await reload();
  }
}
async function remove(m: EshManager) {
  if (!(await confirm({ title: '刪除證照管理員', message: `確定刪除 ${m.company} 的管理員 ${m.empNo} ${m.name ?? ''}?`, confirmText: '刪除', tone: 'danger' })))
    return;
  try {
    await deleteEshManager(m.company, m.empNo);
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
        <GButton v-can="'portal.esh.manager.edit'" variant="primary" icon="user-plus" :disabled="!companies.length" @click="open">新增管理員</GButton>
      </div>
    </GCard>

    <GCard v-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得證照管理員" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="loading && !data"><GSkeleton :lines="5" /></GCard>
    <GCard v-else-if="data" title="證照管理員" icon="users">
      <GEmpty v-if="!companies.length" icon="lock" title="您不是任何公司的證照管理員" />
      <div v-else class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>公司</th>
              <th>工號 / 姓名</th>
              <th>部門</th>
              <th>在職</th>
              <th>收複訓通知</th>
              <th v-if="can('portal.esh.manager.edit')"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in data.items" :key="`${m.company}-${m.empNo}`" :class="{ off: !m.inService }">
              <td class="nowrap">{{ m.company }}</td>
              <td class="nowrap">
                <span class="mono">{{ m.empNo }}</span> {{ m.name ?? '' }}
              </td>
              <td>{{ m.dept ?? '—' }}</td>
              <td>
                <GBadge :tone="m.inService ? 'success' : 'neutral'">{{ m.inService ? '在職' : '離職 / 查無' }}</GBadge>
              </td>
              <td>
                <GSwitch
                  :model-value="m.sendMail"
                  :disabled="!can('portal.esh.manager.edit')"
                  :aria-label="`${m.empNo} 收複訓通知`"
                  size="sm"
                  @update:model-value="(v: boolean) => toggle(m, v)"
                />
              </td>
              <td v-if="can('portal.esh.manager.edit')">
                <GButton size="sm" variant="ghost" square icon="trash" aria-label="刪除" @click="remove(m)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>

    <GModal v-model:open="modal" title="新增證照管理員" icon="user-plus">
      <form class="stack" @submit.prevent="save">
        <GSelect v-model="form.company" label="公司" :options="companies.map((c) => ({ label: c, value: c }))" required />
        <GInput v-model="form.empNo" label="工號(需在職)" required />
        <GCheckbox v-model="form.sendMail" label="收複訓通知彙整" />
        <div class="row end">
          <GButton @click="modal = false">取消</GButton>
          <GButton v-can="'portal.esh.manager.edit'" type="submit" variant="primary" icon="check" :loading="saving">新增</GButton>
        </div>
      </form>
    </GModal>
  </div>
</template>

<style scoped src="../esh.css"></style>
