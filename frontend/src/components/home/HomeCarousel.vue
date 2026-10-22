<script setup lang="ts">
/**
 * 首頁圖片輪播(公告輪播 / 集團動態;FEATURE-PLAN §1):圖片來自 giga-file-service,依起訖日由 portal-api 篩選。
 * 每 5 秒切換、滑鼠移入或聚焦時暫停;有連結的圖片可點(站內走 router、外部另開分頁)。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { fileUrl, type Slide } from '@/api/portal';
import { isInternal, nextIndex, SLIDE_INTERVAL_MS, type SectionState } from '@/composables/home';

const props = defineProps<{ title: string; subtitle: string; icon: string; slides: Slide[]; state: SectionState; loading?: boolean }>();

const index = ref(0);
const paused = ref(false);
const current = computed(() => props.slides[index.value] ?? null);
let timer: ReturnType<typeof setInterval> | undefined;

watch(
  () => props.slides.length,
  () => (index.value = 0),
);
onMounted(() => {
  timer = setInterval(() => {
    if (!paused.value && props.slides.length > 1) index.value = nextIndex(index.value, props.slides.length);
  }, SLIDE_INTERVAL_MS);
});
onBeforeUnmount(() => clearInterval(timer));

const go = (step: number) => (index.value = nextIndex(index.value, props.slides.length, step));
</script>

<template>
  <GCard :title="title" :subtitle="subtitle" :icon="icon">
    <template #actions><slot name="actions" /></template>
    <GSkeleton v-if="loading" :lines="3" />
    <GEmpty v-else-if="state === 'error'" compact tone="danger" icon="alert" title="暫時無法取得" />
    <GEmpty v-else-if="!current" compact icon="image" title="目前沒有圖片" />
    <div v-else class="carousel" @mouseenter="paused = true" @mouseleave="paused = false" @focusin="paused = true" @focusout="paused = false">
      <RouterLink v-if="current.linkUrl && isInternal(current.linkUrl)" :to="current.linkUrl" class="frame">
        <img :src="fileUrl(current.fileId)" :alt="current.title" />
      </RouterLink>
      <a v-else-if="current.linkUrl" :href="current.linkUrl" target="_blank" rel="noopener noreferrer" class="frame">
        <img :src="fileUrl(current.fileId)" :alt="current.title" />
      </a>
      <div v-else class="frame"><img :src="fileUrl(current.fileId)" :alt="current.title" /></div>
      <div class="bar">
        <span class="xs ellipsis">{{ current.title }}</span>
        <span v-if="slides.length > 1" class="nav">
          <GButton size="sm" variant="ghost" square icon="chevron-left" aria-label="上一張" @click="go(-1)" />
          <span class="xs faint">{{ index + 1 }} / {{ slides.length }}</span>
          <GButton size="sm" variant="ghost" square icon="chevron-right" aria-label="下一張" @click="go(1)" />
        </span>
      </div>
    </div>
  </GCard>
</template>

<style scoped>
.carousel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.frame {
  display: block;
  aspect-ratio: 16 / 7;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--glass-soft);
}
.frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}
.nav {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
}
</style>
