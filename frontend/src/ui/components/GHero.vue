<script setup lang="ts">
/**
 * 問候橫幅(UI-GUIDE §3、§4.1):深綠漸層底(--grad-hero),左側日期、標題、身分資訊與快捷按鈕,右側資訊卡 slot。
 * 光點裝飾只在玻璃風格顯示(--card-glow-opacity)。
 */
defineProps<{ eyebrow?: string; title: string; meta?: string }>();
</script>

<template>
  <section class="g-hero">
    <div class="main">
      <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p v-if="meta" class="meta">{{ meta }}</p>
      <div v-if="$slots.actions" class="actions"><slot name="actions" /></div>
    </div>
    <div v-if="$slots.aside" class="aside"><slot name="aside" /></div>
  </section>
</template>

<style scoped>
.g-hero {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 24px;
  padding: 28px 32px;
  border-radius: var(--radius-xl);
  background: var(--grad-hero);
  color: var(--on-hero);
  overflow: hidden;
  box-shadow: var(--shadow-md);
}
.g-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(320px 320px at 92% 0%, var(--hero-glow-1), transparent 70%), radial-gradient(360px 360px at 60% 130%, var(--hero-glow-2), transparent 70%);
  opacity: var(--card-glow-opacity);
  pointer-events: none;
}
.main,
.aside {
  position: relative;
}
.main {
  flex: 1 1 320px;
  min-width: 0;
}
.eyebrow {
  margin: 0 0 6px;
  font-size: var(--fs-sm);
  opacity: 0.85;
}
h1 {
  font-size: var(--fs-3xl);
  letter-spacing: -0.02em;
}
.meta {
  margin: 8px 0 0;
  opacity: 0.88;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}
.aside {
  flex: 0 1 320px;
}
@media (max-width: 760px) {
  .g-hero {
    padding: 22px 20px;
  }
  h1 {
    font-size: var(--fs-2xl);
  }
}
</style>
