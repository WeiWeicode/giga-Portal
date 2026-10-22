<script setup lang="ts">
/**
 * 待我簽核 › 我送出的(P4;FEATURE-PLAN §4;docs/Gherkin/approval/approval.feature)
 * 資料:GET /api/portal/bpm/requested(分頁;預設只列進行中 = 未結案,可切換「全部」);「追蹤」以新視窗開啟 BPM 原畫面。
 */
import { computed, ref, watch } from 'vue';
import { describeError } from '@/api/gateway';
import { bpmRequested, type BpmRequestedState } from '@/api/portal';
import { BPM_BLOCKER_TEXT, bpmBlocker, fmtBpmTime, openBpmLink } from '@/composables/bpm';
import { useAsync } from '@/composables/useAsync';
import type { Column } from '@/ui/components/GTable.vue';

const PAGE_SIZE = 20;
const page = ref(1);
const state = ref<string>('open');
const STATE_OPTIONS = [
  { label: '進行中', value: 'open' },
  { label: '全部', value: 'all' },
];
const { data, loading, error, reload } = useAsync(() => bpmRequested(page.value, PAGE_SIZE, state.value as BpmRequestedState));
watch(page, () => void reload());
watch(state, () => {
  if (page.value === 1) void reload();
  else page.value = 1;
});
const blocker = computed(() => bpmBlocker(data.value));
const rows = computed(() => (data.value?.items ?? []).map((i, k) => ({ ...i, key: k })));
const columns: Column[] = [
  { key: 'processName', label: '表單名稱' },
  { key: 'subject', label: '主旨' },
  { key: 'createdAt', label: '送出時間', mono: true, hideSm: true },
  { key: 'current', label: '目前關卡 / 狀態' },
  { key: 'acts', label: '', align: 'right' },
];
</script>

<template>
  <div class="stack">
    <GCard v-if="loading && !data"><GSkeleton :lines="4" /></GCard>
    <GCard v-else-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得我送出的單據" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="blocker">
      <GEmpty icon="user-x" :title="BPM_BLOCKER_TEXT[blocker].title" :description="BPM_BLOCKER_TEXT[blocker].description" />
    </GCard>
    <template v-else-if="data">
      <div class="row head">
        <GSegmented v-model="state" :options="STATE_OPTIONS" size="sm" />
        <GBadge tone="storage" icon="send">{{ state === 'open' ? '進行中' : '全部' }} {{ data.total }} 筆</GBadge>
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
          :empty-title="state === 'open' ? '沒有進行中的申請單' : '沒有送出過的申請單'"
        >
          <template #cell-processName="{ row }">
            <div>{{ row.processName ?? '—' }}</div>
            <div class="xs faint mono">{{ row.serialNumber ?? '' }}</div>
          </template>
          <template #cell-subject="{ row }">
            <span class="subject">{{ row.subject ?? '—' }}</span>
          </template>
          <template #cell-createdAt="{ row }">{{ fmtBpmTime(row.createdAt) }}</template>
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
  flex-wrap: wrap;
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
