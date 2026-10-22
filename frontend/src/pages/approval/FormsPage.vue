<script setup lang="ts">
/**
 * 表單下載(P4;FEATURE-PLAN §4「表單下載」、PORTAL-API-PLAN D-25;docs/Gherkin/approval/forms.feature)。
 * 舊系統沒有此頁:編輯者(按鈕 portal.forms.edit,portal-editor)上傳表單檔到 giga-file-service(sourceApp / refType portal-forms,
 * refNo = 表單 id)並維護分類;所有員工依分類 / 關鍵字下載(file-service 下載,需 file.object.read)。
 */
import { computed, reactive, ref } from 'vue';
import { can, describeError } from '@/api/gateway';
import { fmtTime } from '@/api/format';
import {
  bindFiles,
  createForm,
  createFormCategory,
  deleteForm,
  deleteFormCategory,
  fileDownloadUrl,
  listForms,
  updateForm,
  updateFormCategory,
  uploadFile,
  type FormCategory,
  type FormDoc,
  type FormDocInput,
} from '@/api/portal';
import { FORM_ACCEPT, FORM_EXTENSIONS, formExt, formKind, groupForms } from '@/composables/forms';
import { useAsync } from '@/composables/useAsync';
import { confirm, toast } from '@/ui/feedback';

const REF = 'portal-forms';
const admin = ref(false);
const { data, loading, error, reload } = useAsync(() => listForms(admin.value));
const category = ref('all');
const keyword = ref('');
const catOptions = computed(() => [
  { label: '全部分類', value: 'all' },
  ...(data.value?.categories ?? []).map((c) => ({ label: c.name, value: String(c.id) })),
]);
const groups = computed(() => groupForms(data.value, category.value === 'all' ? 'all' : Number(category.value), keyword.value));
const KIND_TONE: Record<string, 'danger' | 'primary' | 'storage' | 'neutral'> = { PDF: 'danger', Excel: 'primary', Word: 'storage' };

function toggleAdmin() {
  admin.value = !admin.value;
  void reload();
}

// ───── 表單新增 / 修改 ─────
const modal = ref(false);
const editing = ref<FormDoc | null>(null);
const form = reactive({ categoryId: '', name: '', description: '', sort: '0', active: true });
const file = ref<File | null>(null);
const saving = ref(false);

function openForm(f: FormDoc | null) {
  if (!data.value?.categories.length) return toast.error('請先新增表單分類');
  editing.value = f;
  Object.assign(form, {
    categoryId: String(f?.categoryId ?? (category.value !== 'all' ? category.value : data.value.categories[0]!.id)),
    name: f?.name ?? '',
    description: f?.description ?? '',
    sort: String(f?.sort ?? 0),
    active: f?.active ?? true,
  });
  file.value = null;
  modal.value = true;
}
function pick(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0] ?? null;
  if (f && !formExt(f.name)) {
    toast.error(`表單檔只接受 ${FORM_EXTENSIONS.join(' / ')}`);
    input.value = '';
    return;
  }
  file.value = f;
  if (f && !form.name.trim()) form.name = f.name.replace(/\.[^.]+$/, '');
}
async function save() {
  if (!editing.value && !file.value) return toast.error('請選擇表單檔');
  saving.value = true;
  try {
    // 先上傳檔案(暫存),portal-api 登記後再以表單 id 綁定(未綁定的暫存檔 24 小時後由 file-service 清除)
    const fileId = file.value ? await uploadFile(REF, file.value) : editing.value!.fileId;
    const body: FormDocInput = {
      categoryId: Number(form.categoryId),
      name: form.name,
      description: form.description.trim() || null,
      fileId,
      fileName: file.value?.name ?? editing.value!.fileName,
      sort: Number(form.sort) || 0,
      active: form.active,
    };
    const before = editing.value;
    const saved = before ? await updateForm(before.id, body) : await createForm(body);
    if (file.value) {
      try {
        await bindFiles(REF, String(saved.id), [fileId]);
      } catch (e) {
        // 綁定失敗:暫存檔 24 小時後會被清除,撤回剛才的登記,避免表單指向會消失的檔案(資安審查 L-2)
        await (before ? updateForm(before.id, { ...body, fileId: before.fileId, fileName: before.fileName }) : deleteForm(saved.id)).catch(() => undefined);
        throw e;
      }
    }
    modal.value = false;
    toast.success('已儲存');
    await reload();
  } catch (e) {
    toast.fromError(e, '儲存失敗');
  } finally {
    saving.value = false;
  }
}
async function remove(f: FormDoc) {
  if (!(await confirm({ title: '刪除表單', message: `確定刪除「${f.name}」?`, confirmText: '刪除', tone: 'danger' }))) return;
  try {
    await deleteForm(f.id);
    await reload();
  } catch (e) {
    toast.fromError(e, '刪除失敗');
  }
}

// ───── 分類維護 ─────
const catModal = ref(false);
const catForm = reactive({ id: 0, name: '', sort: '0' });
function editCat(c: FormCategory | null) {
  Object.assign(catForm, { id: c?.id ?? 0, name: c?.name ?? '', sort: String(c?.sort ?? 0) });
}
async function saveCat() {
  try {
    const body = { name: catForm.name, sort: Number(catForm.sort) || 0 };
    if (catForm.id) await updateFormCategory(catForm.id, body);
    else await createFormCategory(body);
    editCat(null);
    toast.success('已儲存分類');
    await reload();
  } catch (e) {
    toast.fromError(e, '儲存分類失敗');
  }
}
async function removeCat(c: FormCategory) {
  if (!(await confirm({ title: '刪除分類', message: `確定刪除分類「${c.name}」?`, confirmText: '刪除', tone: 'danger' }))) return;
  try {
    await deleteFormCategory(c.id);
    if (category.value === String(c.id)) category.value = 'all';
    await reload();
  } catch (e) {
    toast.fromError(e, '刪除分類失敗');
  }
}
</script>

<template>
  <div class="stack forms-page">
    <div class="row head">
      <GSelect v-model="category" :options="catOptions" class="cat" />
      <GInput v-model="keyword" icon="search" placeholder="搜尋表單名稱、說明、檔名" clearable class="kw" />
      <span v-if="can('portal.forms.edit')" class="row tools">
        <GButton size="sm" variant="ghost" :icon="admin ? 'eye-off' : 'eye'" @click="toggleAdmin">{{ admin ? '只看啟用中' : '含停用' }}</GButton>
        <GButton size="sm" variant="ghost" icon="list" @click="(editCat(null), (catModal = true))">分類維護</GButton>
        <GButton size="sm" variant="primary" icon="upload" @click="openForm(null)">上傳表單</GButton>
      </span>
    </div>

    <GCard v-if="loading && !data"><GSkeleton :lines="4" /></GCard>
    <GCard v-else-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得表單清單" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="!groups.length">
      <GEmpty icon="download" :title="keyword || category !== 'all' ? '查無符合的表單' : '尚未上傳表單'" />
    </GCard>
    <template v-else>
      <GCard v-for="g in groups" :key="g.id" :title="g.name" icon="file-down">
        <ul class="docs">
          <li v-for="f in g.items" :key="f.id" :class="{ off: !f.active }">
            <GBadge :tone="KIND_TONE[formKind(f.fileName)] ?? 'neutral'" class="kind">{{ formKind(f.fileName) }}</GBadge>
            <div class="main">
              <b class="ellipsis">{{ f.name }}</b>
              <span v-if="f.description" class="xs faint desc">{{ f.description }}</span>
            </div>
            <GBadge v-if="!f.active" tone="neutral">停用</GBadge>
            <span class="xs faint upd">更新 {{ fmtTime(f.updatedAt) }}</span>
            <a :href="fileDownloadUrl(f.fileId)" :download="f.fileName" rel="noopener noreferrer" class="dl">
              <GButton size="sm" variant="secondary" icon="download" tabindex="-1">下載</GButton>
            </a>
            <span v-if="can('portal.forms.edit')" class="acts">
              <GButton size="sm" variant="ghost" square icon="edit" aria-label="編輯" @click="openForm(f)" />
              <GButton size="sm" variant="ghost" square icon="trash" aria-label="刪除" @click="remove(f)" />
            </span>
          </li>
        </ul>
      </GCard>
    </template>

    <GModal v-model:open="modal" :title="editing ? '編輯表單' : '上傳表單'" icon="upload">
      <form class="stack" @submit.prevent="save">
        <GSelect v-model="form.categoryId" label="分類" :options="catOptions.slice(1)" required />
        <GInput v-model="form.name" label="表單名稱" required />
        <GTextarea v-model="form.description" label="說明" :rows="2" />
        <label class="file">
          <span class="xs">{{ editing ? `目前檔案:${editing.fileName}(選擇新檔即取代)` : '表單檔' }}({{ FORM_EXTENSIONS.join(' / ') }})</span>
          <input type="file" :accept="FORM_ACCEPT" @change="pick" />
        </label>
        <div class="row2">
          <GInput v-model="form.sort" type="number" label="排序" />
          <GSwitch v-model="form.active" label="啟用" />
        </div>
        <div class="row end">
          <GButton @click="modal = false">取消</GButton>
          <GButton type="submit" variant="primary" icon="check" :loading="saving">儲存</GButton>
        </div>
      </form>
    </GModal>

    <GModal v-model:open="catModal" title="表單分類維護" icon="list">
      <div class="stack">
        <ul class="cats">
          <li v-for="c in data?.categories ?? []" :key="c.id">
            <span class="ellipsis">{{ c.name }}</span>
            <span class="xs faint">排序 {{ c.sort }}</span>
            <GButton size="sm" variant="ghost" square icon="edit" aria-label="編輯分類" @click="editCat(c)" />
            <GButton size="sm" variant="ghost" square icon="trash" aria-label="刪除分類" @click="removeCat(c)" />
          </li>
          <li v-if="!data?.categories.length" class="xs faint">尚無分類</li>
        </ul>
        <form class="row2" @submit.prevent="saveCat">
          <GInput v-model="catForm.name" :label="catForm.id ? '修改分類名稱' : '新增分類'" required />
          <GInput v-model="catForm.sort" type="number" label="排序" />
          <div class="row end">
            <GButton v-if="catForm.id" @click="editCat(null)">取消修改</GButton>
            <GButton type="submit" variant="primary" icon="check">{{ catForm.id ? '儲存' : '新增' }}</GButton>
          </div>
        </form>
      </div>
    </GModal>
  </div>
</template>

<style scoped>
.head {
  gap: 8px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.cat {
  width: 180px;
}
.kw {
  flex: 1;
  min-width: 200px;
}
.tools {
  gap: 6px;
  flex-wrap: wrap;
}
.docs,
.cats {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.docs li,
.cats li {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.docs li.off {
  opacity: 0.6;
}
.kind {
  flex: none;
}
.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.desc {
  overflow-wrap: anywhere;
}
.upd {
  flex: none;
}
.dl {
  flex: none;
  text-decoration: none;
}
.acts {
  display: inline-flex;
  gap: 4px;
}
.cats li > .ellipsis {
  flex: 1;
}
.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: end;
}
.end {
  justify-content: flex-end;
  gap: 8px;
}
.file {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
@media (max-width: 600px) {
  .upd {
    display: none;
  }
  .cat,
  .kw {
    width: 100%;
  }
  .row2 {
    grid-template-columns: 1fr;
  }
}
</style>
