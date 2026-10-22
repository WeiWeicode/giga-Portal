<script setup lang="ts">
/**
 * 待我簽核 › 待簽核(P4;FEATURE-PLAN §4、D-6、D-24;docs/Gherkin/approval/approval.feature)
 * 資料:GET /api/portal/bpm/pending(NaNa 唯讀);入口網不代簽,「前往簽核」以新視窗開啟 BPM 原畫面完成核准 / 退回。
 */
import { computed } from 'vue';
import { describeError } from '@/api/gateway';
import { bpmPending } from '@/api/portal';
import { BPM_BLOCKER_TEXT, bpmBlocker, fmtBpmTime, openBpmLink, requesterLabel } from '@/composables/bpm';
import { useAsync } from '@/composables/useAsync';
import type { Column } from '@/ui/components/GTable.vue';

const { data, loading, error, reload } = useAsync(() => bpmPending());
const blocker = computed(() => bpmBlocker(data.value));
const rows = computed(() => (data.value?.items ?? []).map((i, k) => ({ ...i, key: k, requester: requesterLabel(i) })));
const columns: Column[] = [
  { key: 'processName', label: '表單名稱' },
  { key: 'subject', label: '主旨' },
  { key: 'requester', label: '申請人' },
  { key: 'submittedAt', label: '送出時間', mono: true, hideSm: true },
  { key: 'workItemName', label: '目前關卡' },
  { key: 'acts', label: '', align: 'right' },
];
</script>

<template>
  <div class="stack">
    <GCard v-if="loading && !data"><GSkeleton :lines="4" /></GCard>
    <GCard v-else-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得 BPM 待簽核" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="blocker">
      <GEmpty icon="user-x" :title="BPM_BLOCKER_TEXT[blocker].title" :description="BPM_BLOCKER_TEXT[blocker].description" />
    </GCard>
    <template v-else-if="data">
      <div class="row head">
        <GBadge tone="storage" icon="inbox">待簽核 {{ data.total }} 筆</GBadge>
        <GBadge v-if="data.abnormal" tone="danger" icon="alert-triangle">異常關卡 {{ data.abnormal }} 筆</GBadge>
        <div class="spacer" />
        <GButton variant="ghost" size="sm" icon="refresh" :loading="loading" @click="reload">重新整理</GButton>
      </div>
      <GAlert v-if="data.truncated" tone="info" icon="info">待簽核超過 500 筆,只顯示最新的 500 筆;其餘請至 BPM 查看。</GAlert>
      <GCard>
        <GTable :columns="columns" :rows="rows" row-key="key" :page-size="20" empty-title="沒有待簽核的單據">
          <template #cell-processName="{ row }">
            <div>{{ row.processName ?? '—' }}</div>
            <div class="xs faint mono">{{ row.serialNumber ?? '' }}</div>
          </template>
          <template #cell-subject="{ row }">
            <span class="subject">{{ row.subject ?? '—' }}</span>
          </template>
          <template #cell-submittedAt="{ row }">{{ fmtBpmTime(row.submittedAt) }}</template>
          <template #cell-workItemName="{ row }">
            {{ row.workItemName ?? '—' }}
            <GBadge v-if="row.abnormal" tone="danger">異常</GBadge>
          </template>
          <template #cell-acts="{ row }">
            <span class="acts">
              <GButton v-if="row.performUrl" variant="primary" size="sm" icon="external" @click="openBpmLink(row.performUrl)">前往簽核</GButton>
              <GButton v-if="row.traceUrl" variant="ghost" size="sm" icon="eye" @click="openBpmLink(row.traceUrl)">追蹤</GButton>
            </span>
          </template>
        </GTable>
      </GCard>
      <GAlert tone="info" icon="info">核准、退回請按「前往簽核」到 BPM 原畫面完成;完成後回來按「重新整理」。</GAlert>
      <GAlert v-if="data.abnormal" tone="warning" icon="alert-triangle">
        標示「異常」的關卡卡在流程中、BPM 不計入待辦,無法從這裡簽核;請以「追蹤」查看並洽流程管理員。
      </GAlert>
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
.acts {
  display: inline-flex;
  gap: 4px;
  white-space: nowrap;
}
</style>
