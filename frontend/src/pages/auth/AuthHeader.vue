<script setup lang="ts">
/** 登入前頁面卡片的標題區 */
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <header class="auth-header">
    <GLogo class="mobile-logo" :size="40" />
    <h2>{{ title }}</h2>
    <p v-if="description">{{ description }}</p>
  </header>
</template>

<style scoped>
.auth-header {
  margin-bottom: 22px;
}
h2 {
  font-size: var(--fs-2xl);
  font-weight: 750;
}
p {
  margin: 6px 0 0;
  color: var(--text-2);
}
.mobile-logo {
  display: none;
  margin-bottom: 14px;
}
@media (max-width: 960px) {
  .mobile-logo {
    display: grid;
  }
}
</style>
