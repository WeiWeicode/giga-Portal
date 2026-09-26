<script setup lang="ts">
/** 應用層守衛的無權限頁(PRD FR-2.4):已登入但沒有 portal.app.access;不導回 /,提供登出與切換到其他有權限的應用 */
import { computed } from 'vue';
import { useAuth, type PortalMe } from '@/api/gateway';
import { CURRENT_APP, resolveApps } from '@/composables/apps';
import AuthHeader from './auth/AuthHeader.vue';

const auth = useAuth();
const me = computed(() => auth.me.me as PortalMe | null);
const others = computed(() => resolveApps(me.value).apps.filter((a) => a.code !== CURRENT_APP));
const go = (path: string) => location.assign(path);
</script>

<template>
  <div>
    <AuthHeader title="沒有員工入口網使用權限" description="您的帳號已登入,但尚未取得員工入口網的使用權限。" />
    <div class="stack">
      <GAlert tone="warning" icon="shield-alert">
        登入帳號:<strong>{{ me?.user.name }}</strong
        >(<span class="mono">{{ me?.user.employeeNo }}</span
        >)<br />
        如需使用,請洽 IT 申請權限。
      </GAlert>
      <GButton v-for="a in others" :key="a.code" variant="secondary" block :icon="a.icon" @click="go(a.basePath)">前往{{ a.name }}</GButton>
      <GButton variant="primary" block icon="logout" @click="auth.logout()">登出</GButton>
    </div>
  </div>
</template>
