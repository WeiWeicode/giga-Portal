<script setup lang="ts">
/**
 * 首頁輪播維護(FEATURE-PLAN §1「公告輪播 / 集團動態」;按鈕 portal.home.edit,portal-editor):
 * 圖片上傳到 giga-file-service(sourceApp / refType portal-home,需 file.object.upload)後登記;依起訖日顯示,取代舊站寫死在 aspx 的圖片。
 */
import { computed, reactive, ref, watch } from 'vue';
import { describeError } from '@/api/gateway';
import { bindFiles, createSlide, deleteSlide, fileUrl, listSlides, updateSlide, uploadFile, type Slide, type SlideInput, type SlideKind } from '@/api/portal';
import { confirm, toast } from '@/ui/feedback';

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ changed: [] }>();

const KIND_OPTIONS = [
  { label: '公告輪播', value: 'policy' },
  { label: '集團動態', value: 'gallery' },
];
const kindLabel = (k: string) => KIND_OPTIONS.find((o) => o.value === k)?.label ?? k;

const items = ref<Slide[]>([]);
const loading = ref(false);
const error = ref<unknown>(null);
const editing = ref<Slide | null>(null);
const formOpen = ref(false);
const form = reactive({ kind: 'policy' as string, title: '', linkUrl: '', startDate: '', endDate: '', sort: '10', active: true, fileId: '' });
const file = ref<File | null>(null);
const saving = ref(false);
let dirty = false;

const sorted = computed(() => [...items.value].sort((a, b) => a.kind.localeCompare(b.kind) || a.sort - b.sort || a.id - b.id));

async function load() {
  loading.value = true;
  error.value = null;
  try {
    items.value = (await listSlides()).items;
  } catch (e) {
    error.value = e;
  } finally {
    loading.value = false;
  }
}
watch(open, (v) => {
  if (v) {
    dirty = false;
    void load();
  } else if (dirty) emit('changed');
});

function openForm(s: Slide | null) {
  editing.value = s;
  file.value = null;
  Object.assign(form, {
    kind: s?.kind ?? 'policy',
    title: s?.title ?? '',
    linkUrl: s?.linkUrl ?? '',
    startDate: s?.startDate ?? '',
    endDate: s?.endDate ?? '',
    sort: String(s?.sort ?? 10),
    active: s?.active ?? true,
    fileId: s?.fileId ?? '',
  });
  formOpen.value = true;
}

function pick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null;
  // SVG 可內嵌腳本,不收(file-service 以 inline 同源顯示)
  if (f && (!f.type.startsWith('image/') || f.type === 'image/svg+xml' || /\.svgz?$/i.test(f.name))) {
    toast.error('只接受 JPG / PNG / GIF / WebP 圖片');
    (e.target as HTMLInputElement).value = '';
    return;
  }
  file.value = f;
}

async function save() {
  if (!file.value && !form.fileId) return toast.error('請選擇圖片');
  saving.value = true;
  try {
    const uploaded = file.value ? await uploadFile('portal-home', file.value) : null;
    const body: SlideInput = {
      kind: form.kind as SlideKind,
      title: form.title,
      fileId: uploaded ?? form.fileId,
      linkUrl: form.linkUrl.trim() || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      sort: Number(form.sort) || 0,
      active: form.active,
    };
    const saved = editing.value ? await updateSlide(editing.value.id, body) : await createSlide(body);
    // 綁定才不會被 file-service 24 小時後清除
    if (uploaded) await bindFiles('portal-home', String(saved.id), [uploaded]);
    dirty = true;
    formOpen.value = false;
    toast.success('已儲存');
    await load();
  } catch (e) {
    toast.fromError(e, '儲存失敗');
  } finally {
    saving.value = false;
  }
}

async function remove(s: Slide) {
  if (!(await confirm({ title: '刪除輪播圖片', message: `確定刪除「${s.title}」?`, confirmText: '刪除', tone: 'danger' }))) return;
  try {
    await deleteSlide(s.id);
    dirty = true;
    await load();
  } catch (e) {
    toast.fromError(e, '刪除失敗');
  }
}
</script>

<template>
  <GModal v-model:open="open" title="維護首頁輪播" icon="image" width="760px">
    <div class="stack">
      <div class="row head">
        <span class="xs faint">圖片存放於附件服務;起訖日空白表示不限。</span>
        <GButton variant="primary" size="sm" icon="plus" @click="openForm(null)">新增圖片</GButton>
      </div>
      <GSkeleton v-if="loading && !items.length" :lines="4" />
      <GEmpty v-else-if="error" compact tone="danger" icon="alert" title="無法取得輪播清單" :description="describeError(error)" />
      <GEmpty v-else-if="!items.length" compact icon="image" title="尚未設定輪播圖片" />
      <div v-else class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>圖片</th>
              <th>種類</th>
              <th>標題</th>
              <th>期間</th>
              <th>排序</th>
              <th>狀態</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in sorted" :key="s.id">
              <td><img class="thumb" :src="fileUrl(s.fileId)" :alt="s.title" /></td>
              <td>{{ kindLabel(s.kind) }}</td>
              <td>{{ s.title }}</td>
              <td class="xs">{{ s.startDate ?? '不限' }} ~ {{ s.endDate ?? '不限' }}</td>
              <td>{{ s.sort }}</td>
              <td>
                <GBadge :tone="s.active ? 'success' : 'neutral'">{{ s.active ? '啟用' : '停用' }}</GBadge>
              </td>
              <td class="acts">
                <GButton size="sm" variant="ghost" square icon="edit" aria-label="編輯" @click="openForm(s)" />
                <GButton size="sm" variant="ghost" square icon="trash" aria-label="刪除" @click="remove(s)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </GModal>

  <GModal v-model:open="formOpen" :title="editing ? '編輯輪播圖片' : '新增輪播圖片'" icon="image">
    <form class="stack" @submit.prevent="save">
      <GSelect v-model="form.kind" label="種類" :options="KIND_OPTIONS" required />
      <GInput v-model="form.title" label="標題" required />
      <label class="file">
        <span class="xs">圖片{{ editing ? '(不換圖可不選)' : '' }}</span>
        <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" @change="pick" />
      </label>
      <GInput v-model="form.linkUrl" label="點圖片前往(選填)" placeholder="https://… 或 /news" />
      <div class="row2">
        <GInput v-model="form.startDate" type="date" label="開始日" />
        <GInput v-model="form.endDate" type="date" label="結束日" />
      </div>
      <div class="row2">
        <GInput v-model="form.sort" type="number" label="排序(小的在前)" />
        <GSwitch v-model="form.active" label="啟用" />
      </div>
      <div class="row acts">
        <GButton @click="formOpen = false">取消</GButton>
        <GButton type="submit" variant="primary" icon="check" :loading="saving">儲存</GButton>
      </div>
    </form>
  </GModal>
</template>

<style scoped>
.head {
  justify-content: space-between;
  gap: 8px;
}
.table-wrap {
  overflow-x: auto;
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-sm);
}
.tbl th,
.tbl td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--glass-border-2);
  text-align: left;
  white-space: nowrap;
}
.thumb {
  width: 72px;
  height: 32px;
  object-fit: cover;
  border-radius: 6px;
  display: block;
}
.acts {
  justify-content: flex-end;
  gap: 4px;
}
.row2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  align-items: end;
}
.file {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
