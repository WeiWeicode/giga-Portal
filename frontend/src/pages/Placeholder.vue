<script setup lang="ts">
/**
 * 尚未實作的功能頁:M1 只建立選單、Tab 與權限框架,內容依 PRD §11 里程碑實作(meta.milestone)。
 * 不顯示任何假資料(AGENT §5)。
 */
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const page = computed(() => route.matched[1]?.meta);
</script>

<template>
  <GCard>
    <GEmpty
      icon="construction"
      :title="`${page?.title ?? '此功能'}${route.meta.tab ? ` · ${route.meta.tab}` : ''} 建置中`"
      :description="`預計於里程碑 ${page?.milestone ?? '後續'} 串接資料;目前只有選單、Tab 與權限框架。`"
    />
  </GCard>
</template>
