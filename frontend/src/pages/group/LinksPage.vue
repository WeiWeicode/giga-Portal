<script setup lang="ts">
/**
 * 集團系統(old_PortalSolar 母版「集團系統」選單;FEATURE-PLAN §5「集團系統」、§6.3;PORTAL-API-PLAN D-22;docs/Gherkin/group/links.feature)。
 *   - 清單存 portal.system_link,編輯者維護(按鈕 portal.links.edit,portal-editor)
 *   - 舊站以 DES 金鑰 / 同步碼 / Base64 工號跳轉的系統只顯示「DES 跳轉(待重構)」,無任何功能(不產生 token、不帶連結)
 */
import { computed, reactive, ref } from 'vue';
import { can, describeError } from '@/api/gateway';
import { createSystemLink, deleteSystemLink, listSystemLinks, updateSystemLink, type SystemLink, type SystemLinkInput } from '@/api/portal';
import { DES_LABEL, groupLinks, isInternal } from '@/composables/home';
import { useAsync } from '@/composables/useAsync';
import { confirm, toast } from '@/ui/feedback';

const admin = ref(false);
const { data, loading, error, reload } = useAsync(() => listSystemLinks(admin.value));
const keyword = ref('');
const groups = computed(() => groupLinks(data.value?.items ?? [], keyword.value));

function toggleAdmin() {
  admin.value = !admin.value;
  void reload();
}

const modal = ref(false);
const editing = ref<SystemLink | null>(null);
const form = reactive({ name: '', description: '', category: '', url: '', openMode: 'new', legacyDes: false, sort: '0', active: true });
const saving = ref(false);
const OPEN_OPTIONS = [
  { label: '另開分頁', value: 'new' },
  { label: '同一頁', value: 'same' },
];

function openForm(l: SystemLink | null) {
  editing.value = l;
  Object.assign(form, {
    name: l?.name ?? '',
    description: l?.description ?? '',
    category: l?.category ?? '',
    url: l?.url ?? '',
    openMode: l?.openMode ?? 'new',
    legacyDes: l?.legacyDes ?? false,
    sort: String(l?.sort ?? 0),
    active: l?.active ?? true,
  });
  modal.value = true;
}

async function save() {
  saving.value = true;
  try {
    const body: SystemLinkInput = {
      name: form.name,
      description: form.description.trim() || null,
      category: form.category,
      url: form.legacyDes ? null : form.url.trim() || null,
      openMode: form.openMode === 'same' ? 'same' : 'new',
      legacyDes: form.legacyDes,
      sort: Number(form.sort) || 0,
      active: form.active,
    };
    if (editing.value) await updateSystemLink(editing.value.id, body);
    else await createSystemLink(body);
    modal.value = false;
    toast.success('已儲存');
    await reload();
  } catch (e) {
    toast.fromError(e, '儲存失敗');
  } finally {
    saving.value = false;
  }
}

async function remove(l: SystemLink) {
  if (!(await confirm({ title: '刪除集團系統', message: `確定刪除「${l.name}」?`, confirmText: '刪除', tone: 'danger' }))) return;
  try {
    await deleteSystemLink(l.id);
    await reload();
  } catch (e) {
    toast.fromError(e, '刪除失敗');
  }
}
</script>

<template>
  <div class="stack links-page">
    <div class="row head">
      <GInput v-model="keyword" icon="search" placeholder="搜尋系統名稱、說明、分類" clearable class="kw" />
      <span v-if="can('portal.links.edit')" class="row tools">
        <GButton size="sm" variant="ghost" :icon="admin ? 'eye-off' : 'eye'" @click="toggleAdmin">{{ admin ? '只看啟用中' : '含停用' }}</GButton>
        <GButton size="sm" variant="primary" icon="plus" @click="openForm(null)">新增系統</GButton>
      </span>
    </div>

    <GCard v-if="loading && !data"><GSkeleton :lines="4" /></GCard>
    <GCard v-else-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得集團系統" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="!groups.length"><GEmpty icon="external" :title="keyword ? '查無符合的系統' : '尚未設定集團系統'" /></GCard>
    <template v-else>
      <GCard v-for="g in groups" :key="g.category" :title="g.category" icon="apps">
        <div class="grid">
          <div v-for="l in g.items" :key="l.id" class="sys" :class="{ off: !l.active }">
            <div class="top">
              <b class="name">{{ l.name }}</b>
              <GBadge v-if="l.legacyDes" tone="warning" icon="construction">{{ DES_LABEL }}</GBadge>
              <GBadge v-else-if="!l.active" tone="neutral">停用</GBadge>
            </div>
            <p v-if="l.description" class="xs faint desc">{{ l.description }}</p>
            <div class="row bottom">
              <template v-if="!l.legacyDes && l.url">
                <RouterLink v-if="isInternal(l.url)" :to="l.url" class="go">前往系統</RouterLink>
                <a v-else :href="l.url" :target="l.openMode === 'same' ? '_self' : '_blank'" rel="noopener noreferrer" class="go">前往系統</a>
              </template>
              <span v-else class="xs faint">暫不提供連結</span>
              <span v-if="can('portal.links.edit')" class="acts">
                <GButton size="sm" variant="ghost" square icon="edit" aria-label="編輯" @click="openForm(l)" />
                <GButton size="sm" variant="ghost" square icon="trash" aria-label="刪除" @click="remove(l)" />
              </span>
            </div>
          </div>
        </div>
      </GCard>
    </template>

    <GModal v-model:open="modal" :title="editing ? '編輯集團系統' : '新增集團系統'" icon="external">
      <form class="stack" @submit.prevent="save">
        <GInput v-model="form.name" label="名稱" required />
        <GInput v-model="form.category" label="分類" placeholder="例:行政與流程" required />
        <GTextarea v-model="form.description" label="說明" :rows="2" />
        <GCheckbox v-model="form.legacyDes" label="舊站 DES 跳轉系統(只顯示「DES 跳轉(待重構)」,不帶連結)" />
        <GInput v-if="!form.legacyDes" v-model="form.url" label="網址" placeholder="https://… 或站內路徑 /…" required />
        <div class="row2">
          <GSelect v-model="form.openMode" label="開啟方式" :options="OPEN_OPTIONS" />
          <GInput v-model="form.sort" type="number" label="排序" />
        </div>
        <GSwitch v-model="form.active" label="啟用" />
        <div class="row end">
          <GButton @click="modal = false">取消</GButton>
          <GButton type="submit" variant="primary" icon="check" :loading="saving">儲存</GButton>
        </div>
      </form>
    </GModal>
  </div>
</template>

<style scoped>
.head {
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.kw {
  flex: 1;
  min-width: 200px;
  max-width: 420px;
}
.tools {
  gap: 8px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.sys {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--glass-soft);
  min-width: 0;
}
.sys.off {
  opacity: 0.6;
}
.top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.desc {
  margin: 0;
}
.bottom {
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
}
.acts {
  display: inline-flex;
  gap: 4px;
}
.row2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.end {
  justify-content: flex-end;
  gap: 8px;
}
@media (max-width: 600px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
