<script setup lang="ts">
/**
 * 問卷調查 › 問卷維護(old_PortalSolar QA/MyQAList.aspx;FEATURE-PLAN §3.4;D-19)
 *   - portal.qa.edit:只列 / 維護自己建立的問卷(新增、編輯、預覽、複製、統計、匯出、刪除)
 *   - portal.qa.admin:切換「代管全部」可查看並維護所有出題者的問卷(取代舊系統寫死 S094009 的「人員轉換」)
 *   預覽不會寫入作答(舊版預覽就是正式填答頁)。
 */
import { computed, ref, watch } from 'vue';
import { can, describeError } from '@/api/gateway';
import { qaCopy, qaDelete, qaDetail, qaExportUrl, qaList, type QaListItem, type QaSurveyView } from '@/api/portal';
import { emptyFill, type FillAnswer } from '@/composables/qa';
import { useAsync } from '@/composables/useAsync';
import { confirm, toast } from '@/ui/feedback';
import QaEditDialog from './QaEditDialog.vue';
import QaFillView from './QaFillView.vue';
import QaStatsDialog from './QaStatsDialog.vue';

const admin = ref(false);
const canAdmin = computed(() => can('portal.qa.admin'));
const q = ref('');
const creator = ref('');
const current = ref(false);
const page = ref(1);
const PAGE_SIZE = 20;

const { data, loading, error, reload } = useAsync(() =>
  qaList(admin.value, { q: q.value.trim(), current: current.value, creator: creator.value.trim(), page: page.value, pageSize: PAGE_SIZE }),
);
const pages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / PAGE_SIZE)));
watch([admin, current], () => {
  page.value = 1;
  void reload();
});
function search() {
  page.value = 1;
  void reload();
}
function go(p: number) {
  page.value = p;
  void reload();
}

const editOpen = ref(false);
const editNo = ref<string | null>(null);
const statsOpen = ref(false);
const statsNo = ref<string | null>(null);
const previewOpen = ref(false);
const preview = ref<QaSurveyView | null>(null);
const previewState = ref<Record<number, FillAnswer>>({});

function openNew() {
  editNo.value = null;
  editOpen.value = true;
}
function openEdit(s: QaListItem) {
  editNo.value = s.qaNo;
  editOpen.value = true;
}
function openStats(s: QaListItem) {
  statsNo.value = s.qaNo;
  statsOpen.value = true;
}
async function openPreview(s: QaListItem) {
  try {
    const d = await qaDetail(admin.value, s.qaNo);
    preview.value = d;
    previewState.value = emptyFill(d.questions);
    previewOpen.value = true;
  } catch (e) {
    toast.fromError(e, '無法預覽');
  }
}
async function copy(s: QaListItem) {
  try {
    const r = await qaCopy(admin.value, s.qaNo);
    toast.success(`已複製為 ${r.qaNo}`);
    await reload();
  } catch (e) {
    toast.fromError(e, '複製失敗');
  }
}
async function remove(s: QaListItem) {
  const msg = s.respondents ? `「${s.title}」已有 ${s.respondents} 人作答,刪除後不再開放填寫(作答資料保留)。確定刪除?` : `確定刪除「${s.title}」?`;
  if (!(await confirm({ title: '刪除問卷', message: msg, confirmText: '刪除', tone: 'danger' }))) return;
  try {
    await qaDelete(admin.value, s.qaNo);
    toast.success('已刪除');
    await reload();
  } catch (e) {
    toast.fromError(e, '刪除失敗');
  }
}
const exportExcel = (s: QaListItem) => window.open(qaExportUrl(admin.value, s.qaNo), '_blank', 'noopener');
</script>

<template>
  <div class="stack qa-manage">
    <GCard padding="sm">
      <form class="row filters" @submit.prevent="search">
        <GInput v-model="q" icon="search" placeholder="搜尋標題" clearable class="grow" />
        <GInput v-if="admin" v-model="creator" icon="user" placeholder="出題者工號" clearable />
        <GSwitch v-model="current" label="只看進行中" />
        <GSwitch v-if="canAdmin" v-model="admin" label="代管全部" />
        <GButton type="submit" icon="search">查詢</GButton>
        <GButton v-can="'portal.qa.edit'" variant="primary" icon="plus" @click="openNew">新增問卷</GButton>
      </form>
    </GCard>

    <GCard v-if="loading && !data"><GEmpty icon="clock" title="載入中…" /></GCard>
    <GCard v-else-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得問卷" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="data && !data.items.length">
      <GEmpty icon="trello" :title="admin ? '沒有符合的問卷' : '您尚未建立問卷'" description="按「新增問卷」建立;已刪除的問卷不列出。" />
    </GCard>
    <template v-else-if="data">
      <GCard v-for="s in data.items" :key="s.qaNo" :title="s.title" icon="trello" padding="sm">
        <div class="row meta">
          <span class="mono small faint">{{ s.qaNo }}</span>
          <GBadge v-if="s.dept" tone="neutral">{{ s.dept }}</GBadge>
          <span class="small faint mono">{{ s.startDate ?? '—' }} ~ {{ s.endDate ?? '—' }}</span>
          <span class="small faint">{{ s.questionCount }} 題 · 作答 {{ s.respondents }} 人</span>
          <GBadge v-if="s.locked" tone="warning" icon="lock">題目已鎖定</GBadge>
          <span v-if="admin" class="small faint">出題者 {{ s.creator ?? '—' }}</span>
        </div>
        <div class="row acts">
          <GButton size="sm" variant="ghost" icon="edit" @click="openEdit(s)">編輯</GButton>
          <GButton size="sm" variant="ghost" icon="eye" @click="openPreview(s)">預覽</GButton>
          <GButton size="sm" variant="ghost" icon="pie-chart" @click="openStats(s)">統計</GButton>
          <GButton size="sm" variant="ghost" icon="download" :disabled="!s.respondents" @click="exportExcel(s)">匯出</GButton>
          <GButton size="sm" variant="ghost" icon="repeat" @click="copy(s)">複製</GButton>
          <GButton size="sm" variant="ghost" icon="trash" @click="remove(s)">刪除</GButton>
        </div>
      </GCard>
      <div v-if="pages > 1" class="row pager">
        <GButton size="sm" icon="chevron-left" :disabled="page <= 1" @click="go(page - 1)">上一頁</GButton>
        <span class="small faint">第 {{ page }} / {{ pages }} 頁(共 {{ data.total }} 份)</span>
        <GButton size="sm" icon-right="chevron-right" :disabled="page >= pages" @click="go(page + 1)">下一頁</GButton>
      </div>
    </template>

    <QaEditDialog v-model:open="editOpen" :qa-no="editNo" :admin="admin" @saved="reload" />
    <QaStatsDialog v-model:open="statsOpen" :qa-no="statsNo" :admin="admin" />
    <GModal v-model:open="previewOpen" :title="preview ? `預覽:${preview.title}` : '預覽'" icon="eye" width="760px">
      <QaFillView v-if="preview" :survey="preview" :state="previewState" readonly />
    </GModal>
  </div>
</template>

<style scoped>
.qa-manage {
  --gap: 14px;
}
.filters {
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.grow {
  flex: 1 1 200px;
}
.meta {
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.acts {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 6px;
}
.pager {
  justify-content: center;
  gap: 12px;
  align-items: center;
}
.small {
  font-size: var(--fs-sm);
}
</style>
