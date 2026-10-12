<script setup lang="ts">
/**
 * BPM 簽核資訊 - 待簽核(old_PortalSolar EFInfo.aspx Tab1;docs/Gherkin/personal/bpm.feature)
 * 資料:GET /api/portal/bpm/pending(NaNa 唯讀);「簽核」「追蹤」以新視窗開啟 BPM 原畫面(入口網不代簽)。
 */
import { describeError } from '@/api/gateway';
import { bpmPending } from '@/api/portal';
import { useAsync } from '@/composables/useAsync';

const { data, loading, error, reload } = useAsync(() => bpmPending());
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('zh-TW', { hour12: false, timeZone: 'Asia/Taipei' }) : '—');
/** 只開 http(s) 連結(縱深防禦;後端已限制 BPM_WEB_URL) */
function open(url: string | null) {
  if (!url) return;
  try {
    if (['http:', 'https:'].includes(new URL(url).protocol)) window.open(url, '_blank', 'noopener');
  } catch {
    /* 格式錯誤的網址不開 */
  }
}
</script>

<template>
  <div class="stack bpm-tab">
    <GCard v-if="loading && !data"><GEmpty icon="clock" title="載入中…" /></GCard>
    <GCard v-else-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得 BPM 待簽核" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="data && !data.hasAccount">
      <GEmpty icon="user-x" title="BPM 沒有您的帳號" description="以工號在 BPM 找不到帳號,請洽資訊單位。" />
    </GCard>
    <template v-else-if="data">
      <div class="row head">
        <GBadge tone="storage" icon="inbox">待簽核 {{ data.total }} 筆</GBadge>
        <GBadge v-if="data.abnormal" tone="danger" icon="alert-triangle">異常關卡 {{ data.abnormal }} 筆</GBadge>
        <GButton variant="ghost" size="sm" icon="refresh" :loading="loading" @click="reload">重新整理</GButton>
      </div>
      <GAlert v-if="data.truncated" tone="info" icon="info">待簽核超過 500 筆,只顯示最新的 500 筆;其餘請至 BPM 查看。</GAlert>
      <GCard v-if="!data.items.length"><GEmpty icon="check-circle" title="沒有待簽核的單據" /></GCard>
      <GCard v-else>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>單號</th>
                <th>流程</th>
                <th>主旨</th>
                <th>目前關卡</th>
                <th>派送時間</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(i, k) in data.items" :key="k" :class="{ bad: i.abnormal }">
                <td class="mono">{{ i.serialNumber ?? '—' }}</td>
                <td>{{ i.processName ?? '—' }}</td>
                <td class="subject">{{ i.subject ?? '—' }}</td>
                <td>
                  {{ i.workItemName ?? '—' }}
                  <GBadge v-if="i.abnormal" tone="danger">異常</GBadge>
                </td>
                <td class="mono small">{{ fmt(i.createdAt) }}</td>
                <td class="acts">
                  <GButton v-if="i.performUrl" variant="primary" size="sm" icon="external" @click="open(i.performUrl)">簽核</GButton>
                  <GButton v-if="i.traceUrl" variant="ghost" size="sm" icon="eye" @click="open(i.traceUrl)">追蹤</GButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </GCard>
      <GAlert v-if="data.abnormal" tone="warning" icon="alert-triangle">
        標示「異常」的關卡卡在流程中、BPM 不計入待辦,無法從這裡簽核;請以「追蹤」查看並洽流程管理員。
      </GAlert>
    </template>
  </div>
</template>

<style scoped>
.bpm-tab {
  --gap: 16px;
}
.head {
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.table-wrap {
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-sm);
}
.data-table th,
.data-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
}
.data-table th {
  font-weight: 600;
  color: var(--text-2);
  background: var(--glass-soft);
}
.data-table tr.bad td {
  background: color-mix(in srgb, var(--c-danger, #e11d48) 6%, transparent);
}
.subject {
  min-width: 220px;
  overflow-wrap: anywhere;
}
.acts {
  white-space: nowrap;
}
.mono {
  font-family: var(--font-mono, monospace);
}
.small {
  font-size: var(--fs-xs, 12px);
}
</style>
