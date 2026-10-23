<script setup lang="ts">
/**
 * 中華郵政寄件登記(P7 臨時服務;FEATURE-PLAN §9;docs/Gherkin/services/post.feature)。
 * 舊程式 ChunghwaPost.aspx:本人(寄件人)清單;寄件人以工號精確選擇在職員工(預設本人);有郵資後不可修改 / 作廢(後端檢查)。
 */
import { computed, reactive, ref } from 'vue';
import { describeError, useAuth } from '@/api/gateway';
import { createPost, listPosts, postSenders, updatePost, voidPost, type PostInput, type PostItem } from '@/api/portal';
import { useAsync } from '@/composables/useAsync';
import { confirm, toast } from '@/ui/feedback';

const auth = useAuth();
const me = computed(() => auth.me.me);
const today = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
const monthAgo = () => {
  const d = new Date(`${today()}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
};
const range = reactive({ from: monthAgo(), to: today() });
const { data, loading, error, reload } = useAsync(() => listPosts(range.from, range.to));
const typeOptions = computed(() => (data.value?.mailTypes ?? []).map((t) => ({ label: t, value: t })));

const blank = (): PostInput => ({
  senderId: me.value?.user.employeeNo ?? '',
  dept: me.value?.user.deptCode ?? '',
  receiver: '',
  zip: '',
  sendDate: today(),
  mailType: '',
});
const form = reactive<PostInput>(blank());
const editing = ref<number | null>(null);
const saving = ref(false);
const senderName = ref(me.value?.user.name ?? '');
const candidates = ref<{ empNo: string; name: string; dept: string | null }[]>([]);
const query = ref('');

async function search() {
  const q = query.value.trim();
  if (!q) return;
  try {
    candidates.value = (await postSenders(q)).items;
    if (!candidates.value.length) toast.warning('查無在職員工', '寄件人未在職會無法追蹤費用');
  } catch (e) {
    toast.fromError(e, '查詢寄件人失敗');
  }
}
function pickSender(c: { empNo: string; name: string; dept: string | null }) {
  form.senderId = c.empNo;
  senderName.value = c.name;
  if (c.dept && !editing.value) form.dept = c.dept;
  candidates.value = [];
  query.value = '';
}
function edit(p: PostItem) {
  if (p.locked) return toast.error('已有郵資資訊,不能修改');
  editing.value = p.sn;
  Object.assign(form, {
    senderId: p.senderId,
    dept: p.dept ?? '',
    receiver: p.receiver ?? '',
    zip: p.zip ?? '',
    sendDate: p.sendDate ?? today(),
    mailType: p.mailType ?? '',
  });
  senderName.value = p.senderName ?? '';
}
function cancel() {
  editing.value = null;
  Object.assign(form, blank());
  senderName.value = me.value?.user.name ?? '';
}
async function save() {
  if (!form.mailType) return toast.error('寄件類別未選取');
  saving.value = true;
  try {
    if (editing.value) await updatePost(editing.value, { ...form });
    else await createPost({ ...form });
    toast.success(editing.value ? '完成修改' : '已登記');
    cancel();
    await reload();
  } catch (e) {
    toast.fromError(e, '儲存失敗');
  } finally {
    saving.value = false;
  }
}
async function remove(p: PostItem) {
  if (!(await confirm({ title: '作廢', message: `確定作廢寄給「${p.receiver ?? ''}」的登記嗎?`, confirmText: '作廢', tone: 'danger' }))) return;
  try {
    await voidPost(p.sn);
    toast.success('成功作廢');
    await reload();
  } catch (e) {
    toast.fromError(e, '作廢失敗');
  }
}

const columns = [
  { key: 'sendDate', label: '寄件日期' },
  { key: 'sender', label: '寄件人 / 費用部門' },
  { key: 'mailType', label: '類別' },
  { key: 'receiver', label: '收件人 / 郵遞區號' },
  { key: 'callMailNo', label: '掛號號碼', hideSm: true },
  { key: 'mailMoney', label: '郵資', align: 'right' as const },
  { key: 'mailReturnMoney', label: '回郵', align: 'right' as const, hideSm: true },
  { key: 'acts', label: '' },
];
</script>

<template>
  <div class="stack">
    <GPageHeader title="中華郵政寄件登記" icon="mail" eyebrow="臨時服務" description="登記掛號 / 快捷等寄件,總務依寄件人與費用部門結算郵資" />

    <GCard v-can="'portal.svc.post.edit'" :title="editing ? '修改登記' : '新增登記'" icon="edit">
      <form class="stack" @submit.prevent="save">
        <div class="grid">
          <div class="stack sender">
            <span class="sm"
              >寄件人:<b>{{ form.senderId }}</b> {{ senderName }}</span
            >
            <div class="row">
              <GInput v-model="query" placeholder="以工號或姓名搜尋其他寄件人" icon="search" @keydown.enter.prevent="search" />
              <GButton size="sm" icon="search" @click="search">搜尋</GButton>
            </div>
            <ul v-if="candidates.length" class="cands">
              <li v-for="c in candidates" :key="c.empNo">
                <GButton size="sm" variant="ghost" @click="pickSender(c)">{{ c.empNo }} {{ c.name }} {{ c.dept ?? '' }}</GButton>
              </li>
            </ul>
          </div>
          <GInput v-model="form.dept" label="費用部門" required placeholder="例:S1800" />
          <GSelect v-model="form.mailType" label="寄件類別" :options="typeOptions" required />
          <GInput v-model="form.receiver" label="收件人" required />
          <GInput v-model="form.zip" label="郵遞區號" required />
          <GInput v-model="form.sendDate" type="date" label="寄件日期" required />
        </div>
        <div class="row">
          <GButton type="submit" variant="primary" icon="save" :loading="saving">{{ editing ? '修改' : '新增' }}</GButton>
          <GButton v-if="editing" variant="ghost" icon="x" @click="cancel">取消</GButton>
        </div>
      </form>
    </GCard>

    <GCard title="我的寄件登記" icon="list">
      <template #actions>
        <div class="row">
          <GInput v-model="range.from" type="date" />
          <span class="xs faint">~</span>
          <GInput v-model="range.to" type="date" />
          <GButton size="sm" icon="search" @click="reload">查詢</GButton>
        </div>
      </template>
      <GEmpty v-if="error" tone="danger" icon="alert" title="無法取得寄件登記" :description="describeError(error)" />
      <GTable v-else :columns="columns" :rows="data?.items ?? []" row-key="sn" :loading="loading" empty-title="區間內沒有寄件登記">
        <template #cell-sender="{ row }"
          >{{ row.senderName }}<br /><span class="xs faint">{{ row.dept }}</span></template
        >
        <template #cell-receiver="{ row }"
          >{{ row.receiver }}<br /><span class="xs faint">{{ row.zip }}</span></template
        >
        <template #cell-acts="{ row }">
          <span v-can="'portal.svc.post.edit'" class="row acts">
            <GButton size="sm" variant="ghost" square icon="edit" aria-label="修改" :disabled="row.locked" @click="edit(row)" />
            <GButton size="sm" variant="ghost" square icon="trash" aria-label="作廢" :disabled="row.locked" @click="remove(row)" />
          </span>
        </template>
      </GTable>
    </GCard>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.sender {
  grid-column: 1 / -1;
}
.cands {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.acts {
  gap: 2px;
}
</style>
