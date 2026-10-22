<script setup lang="ts">
/**
 * 待我簽核 › 已簽核(經辦過;P4;FEATURE-PLAN §4、6_todo_viewer「我經辦過的」;docs/Gherkin/approval/approval.feature)
 * 資料:GET /api/portal/bpm/handled(分頁,簽核時間新到舊);「追蹤」以新視窗開啟 BPM 原畫面。
 */
import { computed, ref, watch } from 'vue';
import { describeError } from '@/api/gateway';
import { bpmHandled } from '@/api/portal';
import { BPM_BLOCKER_TEXT, bpmBlocker, fmtBpmTime, openBpmLink, requesterLabel } from '@/composables/bpm';
import { useAsync } from '@/composables/useAsync';
import type { Column } from '@/ui/components/GTable.vue';

const PAGE_SIZE = 20;
const page = ref(1);
const { data, loading, error, reload } = useAsync(() => bpmHandled(page.value, PAGE_SIZE));
watch(page, () => void reload());
const blocker = computed(() => bpmBlocker(data.value));
const rows = computed(() => (data.value?.items ?? []).map((i, k) => ({ ...i, key: k, requester: requesterLabel(i) })));
const columns: Column[] = [
  { key: 'processName', label: '表單名稱' },
  { key: 'subject', label: '主旨' },
  { key: 'requester', label: '申請人' },
  { key: 'submittedAt', label: '送出時間', mono: true, hideSm: true },
  { key: 'workItemName', label: '我經辦的關卡' },
  { key: 'completedAt', label: '簽核時間', mono: true, hideSm: true },
  { key: 'current', label: '目前關卡' },
  { key: 'acts', label: '', align: 'right' },
];
</script>

<template>
  <div class="stack">
    <GCard v-if="loading && !data"><GSkeleton :lines="4" /></GCard>
    <GCard v-else-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得已簽核單據" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="blocker">
      <GEmpty icon="user-x" :title="BPM_BLOCKER_TEXT[blocker].title" :description="BPM_BLOCKER_TEXT[blocker].description" />
    </GCard>
    <template v-else-if="data">
      <div class="row head">
        <GBadge tone="storage" icon="check">已簽核 {{ data.total }} 筆</GBadge>
        <div class="spacer" />
        <GButton variant="ghost" size="sm" icon="refresh" :loading="loading" @click="reload">重新整理</GButton>
      </div>
      <GCard>
        <GTable
          v-model:page="page"
          :columns="columns"
          :rows="rows"
          row-key="key"
          :page-size="PAGE_SIZE"
          :total="data.total"
          :loading="loading"
          empty-title="沒有經辦過的單據"
        >
          <template #cell-processName="{ row }">
            <div>{{ row.processName ?? '—' }}</div>
            <div class="xs faint mono">{{ row.serialNumber ?? '' }}</div>
          </template>
          <template #cell-subject="{ row }">
            <span class="subject">{{ row.subject ?? '—' }}</span>
          </template>
          <template #cell-submittedAt="{ row }">{{ fmtBpmTime(row.submittedAt) }}</template>
          <template #cell-completedAt="{ row }">{{ fmtBpmTime(row.completedAt) }}</template>
          <template #cell-current="{ row }">
            <template v-if="row.currentActivities.length">{{ row.currentActivities.join('、') }}</template>
            <GBadge v-else>{{ row.processState || '—' }}</GBadge>
          </template>
          <template #cell-acts="{ row }">
            <GButton v-if="row.traceUrl" variant="ghost" size="sm" icon="eye" @click="openBpmLink(row.traceUrl)">追蹤</GButton>
          </template>
        </GTable>
      </GCard>
    </template>
  </div>
</template>

<style scoped>
.head {
  gap: 8px;
  align-items: center;
}
.spacer {
  flex: 1;
}
.subject {
  display: inline-block;
  min-width: 180px;
  overflow-wrap: anywhere;
}
</style>
