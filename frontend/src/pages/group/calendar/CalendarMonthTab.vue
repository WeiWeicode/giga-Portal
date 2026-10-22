<script setup lang="ts">
/**
 * 行事曆 › 年度行事曆(old_PortalSolar Schedule.aspx:年度下拉 + Document/<年>.pdf;FEATURE-PLAN §5「行事曆」)。
 * PDF 由編輯者上傳到 giga-file-service;Gateway 送 X-Frame-Options DENY,PDF 以新分頁開啟(同 D-14)。
 * 個人 / 部門行程不做(PCalendar 自 2021 未使用)。
 */
import { computed, ref, watch } from 'vue';
import { describeError } from '@/api/gateway';
import { fileUrl, listCalendars } from '@/api/portal';
import { defaultYear } from '@/composables/home';
import { useAsync } from '@/composables/useAsync';

const { data, loading, error, reload } = useAsync(listCalendars);
const year = ref('');
watch(data, (d) => {
  const y = defaultYear(d?.items ?? [], new Date().getFullYear());
  if (y !== null && !year.value) year.value = String(y);
});
const options = computed(() => (data.value?.items ?? []).map((c) => ({ label: `${c.year} 年`, value: String(c.year) })).reverse());
const current = computed(() => data.value?.items.find((c) => String(c.year) === year.value) ?? null);
</script>

<template>
  <GCard title="年度行事曆" subtitle="公司年度行事曆(放假、補班、廠慶等)" icon="calendar">
    <GSkeleton v-if="loading && !data" :lines="3" />
    <GEmpty v-else-if="error" tone="danger" icon="alert" title="無法取得行事曆" :description="describeError(error)">
      <GButton icon="refresh" @click="reload">重試</GButton>
    </GEmpty>
    <GEmpty v-else-if="!options.length" icon="calendar" title="尚未上傳年度行事曆" description="由人資 / 行政於「年度清單」上傳 PDF。" />
    <div v-else class="stack">
      <div class="row pick">
        <GSelect v-model="year" label="年度" :options="options" />
      </div>
      <div v-if="current" class="pdf">
        <GIcon name="file-text" />
        <span class="ellipsis">{{ current.fileName }}</span>
        <a :href="fileUrl(current.fileId)" target="_blank" rel="noopener noreferrer" class="open">開啟 PDF</a>
      </div>
    </div>
  </GCard>
</template>

<style scoped>
.pick {
  max-width: 220px;
}
.pdf {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  background: var(--glass-soft);
  min-width: 0;
}
.open {
  margin-left: auto;
  flex: none;
}
</style>
