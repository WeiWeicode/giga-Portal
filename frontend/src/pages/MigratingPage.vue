<script setup lang="ts">
/**
 * 人事系統轉移中(composables/migrating.ts):資料來自舊人事系統的功能頁,整頁以此取代 Tab 內容,不呼叫任何 API。
 */
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { MIGRATING_TEXT } from '@/composables/migrating';

const route = useRoute();
const page = computed(() => route.matched[1]?.meta);
</script>

<template>
  <GCard>
    <GEmpty
      icon="refresh-cw"
      :title="MIGRATING_TEXT"
      :description="`人事系統轉移中,「${page?.title ?? '此功能'}${route.meta.tab ? ` · ${route.meta.tab}` : ''}」暫不提供查詢;轉移完成後恢復。`"
    />
  </GCard>
</template>
