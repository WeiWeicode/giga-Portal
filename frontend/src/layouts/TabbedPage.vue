<script setup lang="ts">
/**
 * 第二層功能頁的外框:頁首 + 頁籤(Tab)+ 子路由內容(PRD FR-3.1)。
 * 標題、英文副標、說明、圖示與 Tab 定義在路由 meta(router.ts),子路由就是各個 Tab;沒有權限的 Tab 由 GTabs 隱藏。
 */
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const page = computed(() => route.matched[1]!.meta);
</script>

<template>
  <div class="tabbed stack">
    <GPageHeader :title="page.title ?? ''" :description="page.description" :icon="page.icon" :eyebrow="page.subtitle">
      <div id="page-actions" class="row" />
    </GPageHeader>
    <GTabs v-if="page.tabs && page.tabs.length > 1" :items="page.tabs" />
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" :key="route.path" />
      </Transition>
    </RouterView>
  </div>
</template>

<style scoped>
.tabbed {
  --gap: 20px;
}
</style>
