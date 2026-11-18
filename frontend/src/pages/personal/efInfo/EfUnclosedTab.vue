<script setup lang="ts">
/**
 * BPM 簽核資訊 - 未結案(我申請、流程進行中;old_PortalSolar EFInfo.aspx Tab2;docs/Gherkin/personal/bpm.feature)
 * 資料:GET /api/portal/bpm/requested(分頁);「追蹤」以新視窗開啟 BPM 原畫面。
 */
import { computed, ref, watch } from 'vue';
import { describeError } from '@/api/gateway';
import { bpmRequested } from '@/api/portal';
import { useAsync } from '@/composables/useAsync';

const PAGE_SIZE = 20;
const page = ref(1);
const { data, loading, error, reload } = useAsync(() => bpmRequested(page.value, PAGE_SIZE));
const pages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / PAGE_SIZE)));
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

// 最後一頁的單據結案後重新整理會超出頁數:退回最後一頁
watch(data, (d) => {
  if (d && !d.items.length && page.value > 1 && d.total > 0) go(Math.ceil(d.total / PAGE_SIZE));
});

function go(p: number) {
  page.value = Math.min(Math.max(1, p), pages.value);
  void reload();
}
</script>

<template>
  <div class="stack bpm-tab">
    <GCard v-if="loading && !data"><GEmpty icon="clock" title="載入中…" /></GCard>
    <GCard v-else-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得未結案單據" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="data && !data.hasAccount">
      <GEmpty icon="user-x" title="BPM 沒有您的帳號" description="以工號在 BPM 找不到帳號,請洽資訊單位。" />
    </GCard>
    <template v-else-if="data">
      <div class="row head">
        <GBadge tone="storage" icon="clock">未結案 {{ data.total }} 筆</GBadge>
        <GButton variant="ghost" size="sm" icon="refresh" :loading="loading" @click="reload">重新整理</GButton>
      </div>
      <GCard v-if="!data.items.length"><GEmpty icon="check-circle" title="沒有進行中的申請單" /></GCard>
      <GCard v-else>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>單號</th>
                <th>流程</th>
                <th>主旨</th>
                <th>目前關卡</th>
                <th>申請時間</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(i, k) in data.items" :key="k">
                <td class="mono">{{ i.serialNumber ?? '—' }}</td>
                <td>{{ i.processName ?? '—' }}</td>
                <td class="subject">{{ i.subject ?? '—' }}</td>
                <td>{{ i.currentActivities.length ? i.currentActivities.join('、') : '—' }}</td>
                <td class="mono small">{{ fmt(i.createdAt) }}</td>
                <td class="acts">
                  <GButton v-if="i.traceUrl" variant="ghost" size="sm" icon="eye" @click="open(i.traceUrl)">追蹤</GButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="pages > 1" class="row pager">
          <GButton size="sm" icon="chevron-left" :disabled="page <= 1 || loading" @click="go(page - 1)">上一頁</GButton>
          <span class="small">{{ page }} / {{ pages }}</span>
          <GButton size="sm" icon-right="chevron-right" :disabled="page >= pages || loading" @click="go(page + 1)">下一頁</GButton>
        </div>
      </GCard>
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
.subject {
  min-width: 220px;
  overflow-wrap: anywhere;
}
.acts {
  white-space: nowrap;
}
.pager {
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}
.mono {
  font-family: var(--font-mono, monospace);
}
.small {
  font-size: var(--fs-xs, 12px);
}
</style>
