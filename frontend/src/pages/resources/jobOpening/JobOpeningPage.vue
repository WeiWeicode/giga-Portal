<script setup lang="ts">
/**
 * 內部職缺(old_PortalSolar JobOpening.aspx;PORTAL-API-PLAN D-15;docs/Gherkin/resources/jobs.feature)
 * 同仁看開放中的職缺(可切換含已截止);人資以 v-can="portal.job.edit" 新增 / 修改 / 刪除。應徵請洽人資(不寄信)。
 */
import { reactive, ref } from 'vue';
import { describeError } from '@/api/gateway';
import { createJob, deleteJob, listJobs, updateJob, type Job } from '@/api/portal';
import { useAsync } from '@/composables/useAsync';
import { confirm, toast } from '@/ui/feedback';

const showAll = ref(false);
const { data, loading, error, reload } = useAsync(() => listJobs(showAll.value));

function toggleAll() {
  showAll.value = !showAll.value;
  void reload();
}

const modal = ref(false);
const editing = ref<Job | null>(null);
const form = reactive({ title: '', content: '', closeAt: '' });
const saving = ref(false);

function openNew() {
  editing.value = null;
  Object.assign(form, { title: '', content: '', closeAt: '' });
  modal.value = true;
}
function openEdit(j: Job) {
  editing.value = j;
  Object.assign(form, { title: j.title ?? '', content: j.content ?? '', closeAt: (j.closeAt ?? '').replace(/\//g, '-') });
  modal.value = true;
}

async function save() {
  saving.value = true;
  try {
    const body = { title: form.title, content: form.content, closeAt: form.closeAt };
    if (editing.value) await updateJob(editing.value.no, body);
    else await createJob(body);
    modal.value = false;
    toast.success(editing.value ? '已更新職缺' : '已新增職缺');
    await reload();
  } catch (e) {
    toast.fromError(e, '儲存失敗');
  } finally {
    saving.value = false;
  }
}

async function remove(j: Job) {
  if (!(await confirm({ title: '刪除職缺', message: `確定刪除「${j.title ?? ''}」?`, confirmText: '刪除', tone: 'danger' }))) return;
  try {
    await deleteJob(j.no);
    toast.success('已刪除');
    await reload();
  } catch (e) {
    toast.fromError(e, '刪除失敗');
  }
}
</script>

<template>
  <div class="stack jobs">
    <div class="row head">
      <GButton variant="ghost" size="sm" :icon="showAll ? 'eye-off' : 'eye'" @click="toggleAll">{{ showAll ? '只看開放中' : '含已截止' }}</GButton>
      <GButton v-can="'portal.job.edit'" variant="primary" icon="plus" @click="openNew">新增職缺</GButton>
    </div>

    <GCard v-if="loading && !data"><GEmpty icon="clock" title="載入中…" /></GCard>
    <GCard v-else-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得內部職缺" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="data && !data.items.length">
      <GEmpty icon="bell" title="目前沒有開放中的內部職缺" description="有興趣的職缺或推薦人選,請洽人資單位。" />
    </GCard>
    <template v-else-if="data">
      <GCard v-for="j in data.items" :key="j.no" :title="j.title ?? '(未命名)'" icon="user-plus" :class="{ closed: !j.open }">
        <div class="meta">
          <GBadge :tone="j.open ? 'primary' : 'neutral'">{{ j.open ? '開放中' : '已截止' }}</GBadge>
          <span class="small faint">刊登 {{ j.postedAt ?? '—' }} · 截止 {{ j.closeAt ?? '—' }}</span>
        </div>
        <p class="content">{{ j.content }}</p>
        <div v-can="'portal.job.edit'" class="row acts">
          <GButton variant="ghost" size="sm" icon="edit" @click="openEdit(j)">編輯</GButton>
          <GButton variant="ghost" size="sm" icon="trash" @click="remove(j)">刪除</GButton>
        </div>
      </GCard>
      <GAlert tone="neutral" icon="info">有興趣的職缺或推薦人選,請洽人資單位。</GAlert>
    </template>

    <GModal v-model:open="modal" :title="editing ? '編輯職缺' : '新增職缺'" icon="user-plus">
      <form class="stack" @submit.prevent="save">
        <GInput v-model="form.title" label="職稱 / 招募重點" required />
        <p class="hint">內容不可包含 &lt; &gt; 符號(舊入口網同步顯示)。</p>
        <GInput v-model="form.closeAt" type="date" label="截止日" required />
        <GTextarea v-model="form.content" label="職缺內容" required />
        <div class="row modal-actions">
          <GButton @click="modal = false">取消</GButton>
          <GButton type="submit" variant="primary" icon="check" :loading="saving">儲存</GButton>
        </div>
      </form>
    </GModal>
  </div>
</template>

<style scoped>
.jobs {
  --gap: 16px;
}
.head {
  justify-content: space-between;
  gap: 8px;
}
.meta {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 8px;
}
.content {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.6;
}
.closed {
  opacity: 0.7;
}
.acts,
.modal-actions {
  justify-content: flex-end;
  margin-top: 8px;
}
.small {
  font-size: var(--fs-sm);
}
.hint {
  margin: -6px 0 0;
  font-size: var(--fs-xs, 12px);
  color: var(--text-3);
}
</style>
