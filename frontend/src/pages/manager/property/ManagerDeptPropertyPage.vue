<script setup lang="ts">
/**
 * 部門資產明細(old_PortalSolar DeptPropertyInfo.aspx;FEATURE-PLAN §7、D-12;docs/Gherkin/manager/manager.feature)。
 * 資產清單本身在 TIPTOP(轉移中),只列範圍內在職同仁已在 PortalSolar 填過備註的資產;
 * 修改備註(按鈕 portal.mgr.property.edit)寫到**保管人**的紀錄(舊版以主管工號寫入,保管人讀不到)。照片待 file-service F4。
 */
import { computed, ref } from 'vue';
import { managerProperty, updateManagerPropertyNote, type MgrPropertyNote } from '@/api/portal';
import { can, describeError } from '@/api/gateway';
import { useAsync } from '@/composables/useAsync';
import { toast } from '@/ui/feedback';
import MgrDeptFilter from '../MgrDeptFilter.vue';

const dept = ref('');
const includeSub = ref(true);
const keyword = ref('');
const { data, loading, error, reload } = useAsync(() => managerProperty({ dept: dept.value, includeSub: includeSub.value }), { immediate: false });
const search = () => dept.value && reload();

const items = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return (data.value?.items ?? []).filter(
    (p) => !kw || [p.empNo, p.name ?? '', p.assetNo, p.note ?? '', p.deptName ?? ''].some((s) => s.toLowerCase().includes(kw)),
  );
});
const keyOf = (p: MgrPropertyNote) => `${p.empNo}/${p.compDb ?? ''}/${p.assetNo}/${p.assetSub ?? ''}`;

const editing = ref<MgrPropertyNote | null>(null);
const note = ref('');
const saving = ref(false);
function edit(p: MgrPropertyNote) {
  editing.value = p;
  note.value = p.note ?? '';
}
async function save() {
  const p = editing.value;
  if (!p) return;
  saving.value = true;
  try {
    await updateManagerPropertyNote(p, note.value);
    toast.success('已更新備註');
    editing.value = null;
    await reload();
  } catch (e) {
    toast.fromError(e, '更新備註失敗');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="stack">
    <GCard>
      <MgrDeptFilter v-model:dept="dept" v-model:include-sub="includeSub" @ready="search">
        <GButton variant="primary" icon="search" :loading="loading" :disabled="!dept" @click="search">查詢</GButton>
        <GInput v-model="keyword" icon="search" placeholder="篩選保管人 / 財編 / 備註" clearable class="kw" />
      </MgrDeptFilter>
    </GCard>
    <GAlert tone="info" icon="info" title="資產清單系統轉移中">資產主檔在舊人事 / 資產系統(TIPTOP),目前只列同仁已在入口網填寫備註的資產。</GAlert>

    <GCard v-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得部門資產" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="loading && !data"><GSkeleton :lines="5" /></GCard>
    <GCard v-else-if="data" title="部門資產備註" icon="box">
      <GEmpty v-if="!items.length" icon="box" title="沒有已填備註的資產" />
      <div v-else class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>部門</th>
              <th>保管人</th>
              <th>財產編號</th>
              <th>附號</th>
              <th>備註</th>
              <th>照片</th>
              <th v-if="can('portal.mgr.property.edit')"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in items" :key="keyOf(p)">
              <td>{{ p.deptName ?? p.dept ?? '—' }}</td>
              <td>
                {{ p.name ?? '—' }} <span class="mono faint">{{ p.empNo }}</span>
              </td>
              <td class="mono">{{ p.assetNo }}</td>
              <td class="mono">{{ p.assetSub || '—' }}</td>
              <td class="note">{{ p.note || '—' }}</td>
              <td><GBadge v-if="p.hasPhoto" tone="neutral">有照片(待檔案服務)</GBadge><span v-else class="faint">—</span></td>
              <td v-if="can('portal.mgr.property.edit')">
                <GButton size="sm" variant="ghost" square icon="edit" aria-label="修改備註" @click="edit(p)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>

    <GModal :open="!!editing" title="修改資產備註" icon="edit" @update:open="(v: boolean) => !v && (editing = null)">
      <form v-if="editing" class="stack" @submit.prevent="save">
        <span class="small"
          >保管人 {{ editing.name ?? '' }}({{ editing.empNo }})· 財編 {{ editing.assetNo }}{{ editing.assetSub ? `-${editing.assetSub}` : '' }}</span
        >
        <GTextarea v-model="note" label="備註(150 字內,保管人在「個人資產明細」也會看到)" :rows="3" />
        <div class="row end">
          <GButton @click="editing = null">取消</GButton>
          <GButton v-can="'portal.mgr.property.edit'" type="submit" variant="primary" icon="check" :loading="saving">儲存</GButton>
        </div>
      </form>
    </GModal>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.kw {
  flex: 1;
  min-width: 180px;
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
}
.data-table th {
  font-weight: 600;
  color: var(--text-2);
  background: var(--glass-soft);
  white-space: nowrap;
}
.note {
  min-width: 200px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.mono {
  font-family: var(--font-mono, monospace);
}
.end {
  justify-content: flex-end;
  gap: 8px;
}
</style>
