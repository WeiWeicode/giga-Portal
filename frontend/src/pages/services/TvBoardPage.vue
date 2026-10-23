<script setup lang="ts">
/**
 * 電視看板(P7 臨時服務;FEATURE-PLAN §9;docs/Gherkin/services/tv.feature)。公共螢幕全螢幕顯示,**免登入**(路由 meta.public)。
 * 舊程式 TVDemo.aspx:圖片輪播(每張 5 秒)+ 跑馬燈;舊版另有會議室狀態 iframe(http 舊站,https 下會被擋,未搬,CONFIRM-NEEDED P7)。
 * 新站上傳的圖片經 file-service 下載,需登入(公共螢幕以專用帳號登入或另行開放,CONFIRM-NEEDED P7);載入失敗的圖片自動略過。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { fileUrl, tvBoard, type TvBoard } from '@/api/portal';

const board = ref<TvBoard | null>(null);
const failed = ref<Set<string>>(new Set());
const index = ref(0);
const images = computed(() => (board.value?.images ?? []).filter((i) => !failed.value.has(i.key)));
const current = computed(() => images.value[index.value % Math.max(images.value.length, 1)] ?? null);
const src = (i: NonNullable<typeof current.value>) => (i.source === 'file' ? fileUrl(i.fileId) : (i.url ?? ''));

async function load() {
  try {
    board.value = await tvBoard();
    failed.value = new Set();
  } catch {
    // 看板持續顯示上一次的內容,下次再試
  }
}
let slide: ReturnType<typeof setInterval> | undefined;
let refresh: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  void load();
  slide = setInterval(() => (index.value += 1), 5000);
  refresh = setInterval(load, 5 * 60_000);
});
onBeforeUnmount(() => {
  clearInterval(slide);
  clearInterval(refresh);
});
</script>

<template>
  <div class="tv">
    <div class="stage">
      <img v-if="current" :key="current.key" :src="src(current)" :alt="current.name" @error="failed = new Set([...failed, current.key])" />
      <p v-else class="none">目前沒有展示圖片</p>
    </div>
    <div v-if="board?.message" class="ticker" :style="{ fontSize: `${board.fontSize}pt` }">
      <span>{{ board.message }}</span>
    </div>
  </div>
</template>

<style scoped>
.tv {
  position: fixed;
  inset: 0;
  display: grid;
  grid-template-rows: 1fr auto;
  background: var(--bg);
  color: var(--text);
}
.stage {
  display: grid;
  place-items: center;
  overflow: hidden;
}
.stage img {
  max-width: 99%;
  max-height: 100%;
  object-fit: contain;
}
.none {
  color: var(--text-3);
}
.ticker {
  overflow: hidden;
  white-space: nowrap;
  padding: 8px 0;
  color: var(--c-info);
}
.ticker span {
  display: inline-block;
  padding-left: 100%;
  animation: ticker 25s linear infinite;
}
@keyframes ticker {
  to {
    transform: translateX(-100%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .ticker span {
    animation: none;
    padding-left: 16px;
    white-space: normal;
  }
}
</style>
