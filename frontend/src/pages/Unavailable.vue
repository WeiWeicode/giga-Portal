<script setup lang="ts">
/** 維護頁(PRD §10 可用性):Gateway BFF 無法連線時顯示,可重試回到原頁 */
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { safeRedirect } from '@/composables/redirect';
import AuthHeader from './auth/AuthHeader.vue';

const route = useRoute();
const router = useRouter();
const retrying = ref(false);

async function retry() {
  retrying.value = true;
  await router.replace(safeRedirect(route.query.redirect)).finally(() => (retrying.value = false));
}
</script>

<template>
  <div>
    <AuthHeader title="系統暫時無法使用" description="目前無法連線到登入服務,可能正在維護或網路中斷。" />
    <div class="stack">
      <GAlert tone="warning" icon="server-off">請稍後再試;若持續發生,請聯絡 IT。</GAlert>
      <GButton variant="primary" block icon="refresh" :loading="retrying" @click="retry">重新嘗試</GButton>
    </div>
  </div>
</template>
