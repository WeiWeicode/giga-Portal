<script setup lang="ts">
/**
 * 個人常用連結維護(首頁個人秘書;FEATURE-PLAN §1;按鈕 portal.home.link-edit):本人新增 / 修改 / 刪除 / 上移下移。
 * 網址只接受 http(s):// 或站內路徑(後端再檢查);關閉時通知首頁重新整理。
 */
import { reactive, ref, watch } from 'vue';
import { describeError } from '@/api/gateway';
import { createPersonalLink, deletePersonalLink, listPersonalLinks, reorderPersonalLinks, updatePersonalLink, type PersonalLink } from '@/api/portal';
import { moveId } from '@/composables/home';
import { confirm, toast } from '@/ui/feedback';

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ changed: [] }>();

const items = ref<PersonalLink[]>([]);
const loading = ref(false);
const error = ref<unknown>(null);
const form = reactive({ id: 0, name: '', url: '' });
const saving = ref(false);
let dirty = false;

async function load() {
  loading.value = true;
  error.value = null;
  try {
    items.value = (await listPersonalLinks()).items;
  } catch (e) {
    error.value = e;
  } finally {
    loading.value = false;
  }
}
watch(open, (v) => {
  if (v) {
    dirty = false;
    reset();
    void load();
  } else if (dirty) emit('changed');
});

function reset() {
  Object.assign(form, { id: 0, name: '', url: '' });
}
function edit(l: PersonalLink) {
  Object.assign(form, { id: l.id, name: l.name, url: l.url });
}

async function save() {
  saving.value = true;
  try {
    const body = { name: form.name, url: form.url };
    if (form.id) await updatePersonalLink(form.id, body);
    else await createPersonalLink(body);
    dirty = true;
    reset();
    await load();
  } catch (e) {
    toast.fromError(e, '儲存失敗');
  } finally {
    saving.value = false;
  }
}

async function remove(l: PersonalLink) {
  if (!(await confirm({ title: '刪除常用連結', message: `確定刪除「${l.name}」?`, confirmText: '刪除', tone: 'danger' }))) return;
  try {
    await deletePersonalLink(l.id);
    dirty = true;
    await load();
  } catch (e) {
    toast.fromError(e, '刪除失敗');
  }
}

async function move(l: PersonalLink, delta: -1 | 1) {
  const ids = moveId(
    items.value.map((x) => x.id),
    l.id,
    delta,
  );
  if (!ids) return;
  try {
    items.value = (await reorderPersonalLinks(ids)).items;
    dirty = true;
  } catch (e) {
    toast.fromError(e, '排序失敗');
  }
}
</script>

<template>
  <GModal v-model:open="open" title="個人常用連結" icon="link" width="600px">
    <div class="stack">
      <GSkeleton v-if="loading && !items.length" :lines="3" />
      <GEmpty v-else-if="error" compact tone="danger" icon="alert" title="無法取得常用連結" :description="describeError(error)" />
      <ul v-else-if="items.length" class="links">
        <li v-for="(l, i) in items" :key="l.id">
          <span class="txt">
            <span class="ellipsis">{{ l.name }}</span>
            <span class="xs faint ellipsis">{{ l.url }}</span>
          </span>
          <GButton size="sm" variant="ghost" square icon="arrow-up" aria-label="上移" :disabled="i === 0" @click="move(l, -1)" />
          <GButton size="sm" variant="ghost" square icon="arrow-down" aria-label="下移" :disabled="i === items.length - 1" @click="move(l, 1)" />
          <GButton size="sm" variant="ghost" square icon="edit" aria-label="編輯" @click="edit(l)" />
          <GButton size="sm" variant="ghost" square icon="trash" aria-label="刪除" @click="remove(l)" />
        </li>
      </ul>
      <GEmpty v-else compact icon="link" title="尚未設定常用連結" />

      <form class="stack form" @submit.prevent="save">
        <div class="row2">
          <GInput v-model="form.name" label="名稱" required />
          <GInput v-model="form.url" label="網址" placeholder="https://… 或 /personal/notes" required />
        </div>
        <div class="row acts">
          <GButton v-if="form.id" @click="reset">取消編輯</GButton>
          <GButton type="submit" variant="primary" :icon="form.id ? 'check' : 'plus'" :loading="saving">{{ form.id ? '儲存' : '新增' }}</GButton>
        </div>
      </form>
    </div>
  </GModal>
</template>

<style scoped>
.links {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.links li {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 10px;
  background: var(--glass-soft);
}
.txt {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.form {
  border-top: 1px solid var(--glass-border-2);
  padding-top: 12px;
}
.row2 {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: 10px;
}
.acts {
  justify-content: flex-end;
  gap: 8px;
}
@media (max-width: 600px) {
  .row2 {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
