<script setup lang="ts">
/**
 * 線上簽名板(同意書;取代舊站 jQuery sketch + 上傳 jpg / png / gif 簽名檔)。
 * 以 Pointer Events 支援滑鼠、觸控與手寫筆;輸出 PNG(white 底)交給頁面上傳 file-service。
 */
import { onMounted, ref } from 'vue';

const canvas = ref<HTMLCanvasElement | null>(null);
const empty = ref(true);
let drawing = false;

function ctx() {
  return canvas.value?.getContext('2d') ?? null;
}
function reset() {
  const c = canvas.value;
  const g = ctx();
  if (!c || !g) return;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  g.lineWidth = 2.5;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = '#111111';
  empty.value = true;
}
function point(e: PointerEvent) {
  const c = canvas.value!;
  const r = c.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
}
function down(e: PointerEvent) {
  const g = ctx();
  if (!g) return;
  drawing = true;
  canvas.value!.setPointerCapture(e.pointerId);
  const p = point(e);
  g.beginPath();
  g.moveTo(p.x, p.y);
}
function move(e: PointerEvent) {
  if (!drawing) return;
  const g = ctx()!;
  const p = point(e);
  g.lineTo(p.x, p.y);
  g.stroke();
  empty.value = false;
}
function up() {
  drawing = false;
}

/** 簽名 PNG;尚未簽名回 null */
function toFile(): Promise<File | null> {
  return new Promise((resolve) => {
    if (empty.value || !canvas.value) return resolve(null);
    canvas.value.toBlob((b) => resolve(b ? new File([b], 'signature.png', { type: 'image/png' }) : null), 'image/png');
  });
}

onMounted(reset);
defineExpose({ reset, toFile, empty });
</script>

<template>
  <div class="sig">
    <canvas
      ref="canvas"
      width="600"
      height="200"
      aria-label="簽名區,請以滑鼠或手指簽名"
      @pointerdown.prevent="down"
      @pointermove.prevent="move"
      @pointerup="up"
      @pointercancel="up"
      @pointerleave="up"
    />
    <div class="row bar">
      <span class="xs faint">{{ empty ? '請在框內簽名' : '已簽名' }}</span>
      <GButton size="sm" variant="ghost" icon="refresh" @click="reset">清除重簽</GButton>
    </div>
  </div>
</template>

<style scoped>
.sig {
  display: grid;
  gap: 6px;
}
canvas {
  width: 100%;
  max-width: 600px;
  aspect-ratio: 3 / 1;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-sm);
  touch-action: none;
}
.bar {
  justify-content: space-between;
  max-width: 600px;
}
</style>
