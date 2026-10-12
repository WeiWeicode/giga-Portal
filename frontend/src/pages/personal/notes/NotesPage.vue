<script setup lang="ts">
/**
 * 個人提醒(docs/Gherkin/personal/notes.feature):只有本人看得到的待辦、截止日與備忘。
 * 資料:/api/portal/notes(portal.personal_note);新增 / 修改 / 刪除按鈕 v-can="portal.note.edit"(includes portal.api.note.write)。
 */
import { computed, reactive, ref } from 'vue';
import { describeError } from '@/api/gateway';
import { createNote, deleteNote, listNotes, updateNote, type Note, type NoteInput, type NotePriority } from '@/api/portal';
import { useAsync } from '@/composables/useAsync';
import { confirm, toast } from '@/ui/feedback';

const { data, loading, error, reload } = useAsync(() => listNotes());
const notes = computed(() => data.value?.items ?? []);
const pending = computed(() => notes.value.filter((n) => !n.done).length);

const CATEGORIES = ['工作交辦', '行事提醒', '重要截止', '個人筆記'];
const categoryOptions = CATEGORIES.map((c) => ({ label: c, value: c }));
const PRIORITY: Record<NotePriority, { label: string; tone: string }> = {
  high: { label: '高', tone: 'danger' },
  medium: { label: '中', tone: 'alert' },
  low: { label: '低', tone: 'neutral' },
};
const priorityOptions = (Object.keys(PRIORITY) as NotePriority[]).map((p) => ({ label: `${PRIORITY[p].label}優先`, value: p }));

const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
const overdue = (n: Note) => !n.done && !!n.dueDate && n.dueDate < today;

// 新增 / 編輯
const modal = ref(false);
const editing = ref<Note | null>(null);
const form = reactive({ title: '', content: '', category: '工作交辦', priority: 'medium' as NotePriority, dueDate: '' });
const saving = ref(false);
const titleError = ref<string | null>(null);

function openNew() {
  editing.value = null;
  Object.assign(form, { title: '', content: '', category: '工作交辦', priority: 'medium', dueDate: '' });
  titleError.value = null;
  modal.value = true;
}
function openEdit(n: Note) {
  editing.value = n;
  Object.assign(form, { title: n.title, content: n.content ?? '', category: n.category, priority: n.priority, dueDate: n.dueDate ?? '' });
  titleError.value = null;
  modal.value = true;
}

async function save() {
  if (!form.title.trim()) {
    titleError.value = '請填寫標題';
    return;
  }
  const body: NoteInput = { title: form.title, content: form.content || null, category: form.category, priority: form.priority, dueDate: form.dueDate || null };
  saving.value = true;
  try {
    if (editing.value) await updateNote(editing.value.id, body);
    else await createNote(body);
    modal.value = false;
    toast.success(editing.value ? '已更新提醒' : '已新增提醒');
    await reload();
  } catch (e) {
    toast.fromError(e, '儲存失敗');
  } finally {
    saving.value = false;
  }
}

async function toggle(n: Note) {
  try {
    await updateNote(n.id, { done: !n.done });
    await reload();
  } catch (e) {
    toast.fromError(e);
  }
}

async function remove(n: Note) {
  if (!(await confirm({ title: '刪除提醒', message: `確定刪除「${n.title}」?`, confirmText: '刪除', tone: 'danger' }))) return;
  try {
    await deleteNote(n.id);
    toast.success('已刪除');
    await reload();
  } catch (e) {
    toast.fromError(e, '刪除失敗');
  }
}
</script>

<template>
  <div class="notes-page stack">
    <div class="header-actions">
      <GBadge tone="storage" icon="bell">未完成 {{ pending }} 項</GBadge>
      <GButton v-can="'portal.note.edit'" variant="primary" icon="plus" @click="openNew">新增提醒</GButton>
    </div>

    <GCard v-if="loading && !data"><GEmpty icon="clock" title="載入中…" /></GCard>
    <GCard v-else-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得個人提醒" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="!notes.length">
      <GEmpty icon="bell" title="還沒有提醒" description="記錄待辦事項、截止日或備忘,只有自己看得到。" />
    </GCard>
    <div v-else class="notes-grid">
      <GCard v-for="n in notes" :key="n.id" class="note-card" :class="{ completed: n.done }">
        <div class="note-header">
          <div class="note-badges">
            <GBadge :tone="PRIORITY[n.priority].tone">{{ PRIORITY[n.priority].label }}</GBadge>
            <GBadge tone="storage">{{ n.category }}</GBadge>
          </div>
          <span v-if="n.dueDate" class="mono small" :class="overdue(n) ? 'late' : 'faint'">{{ overdue(n) ? '已逾期 ' : '' }}{{ n.dueDate }}</span>
        </div>
        <div class="note-body">
          <h4 :class="{ strikethrough: n.done }">{{ n.title }}</h4>
          <p v-if="n.content" class="content-text">{{ n.content }}</p>
        </div>
        <div v-can="'portal.note.edit'" class="note-footer">
          <GButton variant="ghost" size="sm" :icon="n.done ? 'undo' : 'check'" @click="toggle(n)">{{ n.done ? '標記未完成' : '標記完成' }}</GButton>
          <GButton variant="ghost" size="sm" icon="edit" @click="openEdit(n)">編輯</GButton>
          <GButton variant="ghost" size="sm" icon="trash" @click="remove(n)">刪除</GButton>
        </div>
      </GCard>
    </div>

    <GModal v-model:open="modal" :title="editing ? '編輯提醒' : '新增提醒'" icon="bell">
      <form class="stack" @submit.prevent="save">
        <GInput v-model="form.title" label="標題" placeholder="例:繳交體檢報告" :error="titleError" required />
        <div class="grid grid-3">
          <GInput v-model="form.dueDate" type="date" label="到期日" />
          <GSelect v-model="form.category" label="類別" :options="categoryOptions" />
          <GSelect v-model="form.priority" label="優先" :options="priorityOptions" />
        </div>
        <GTextarea v-model="form.content" label="內容" />
        <div class="row modal-actions">
          <GButton @click="modal = false">取消</GButton>
          <GButton type="submit" variant="primary" icon="check" :loading="saving">儲存</GButton>
        </div>
      </form>
    </GModal>
  </div>
</template>

<style scoped>
.notes-page {
  --gap: 16px;
}
.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.note-card.completed {
  opacity: 0.7;
}
.note-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.note-badges {
  display: flex;
  gap: 6px;
}
.note-body h4 {
  margin: 10px 0 6px;
  font-size: var(--fs-md);
  overflow-wrap: anywhere;
}
.note-body h4.strikethrough {
  text-decoration: line-through;
  color: var(--text-3);
}
.content-text {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--text-2);
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.note-footer {
  display: flex;
  gap: 4px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.late {
  color: var(--c-danger, #e11d48);
  font-weight: 600;
}
.modal-actions {
  justify-content: flex-end;
}
.small {
  font-size: var(--fs-sm);
}
</style>
