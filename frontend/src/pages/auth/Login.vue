<script setup lang="ts">
/**
 * 登入頁(PRD FR-1.1–1.3;Gateway 單一入口 POST /api/auth/login,AD / 本機帳號)。
 * 成功後導回 redirect(只接受同網域相對路徑);PASSWORD_CHANGE_REQUIRED 時就地切換為設定新密碼(Gateway PRD §8.2.5–§8.2.6)。
 */
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiError, changePassword, describeError, login } from '@/api/gateway';
import { safeRedirect } from '@/composables/redirect';
import { markMeFresh } from '@/composables/session';
import AuthHeader from './AuthHeader.vue';
import SetPasswordForm from './SetPasswordForm.vue';

const route = useRoute();
const router = useRouter();

const username = ref('');
const password = ref('');
const remember = ref(false);
const loading = ref(false);
const error = ref<{ code: string; message: string } | null>(null);
const mustChange = ref(false);

/** 導回原頁:入口網自己的路由用 SPA 導向;其他應用(例 /it/)整頁導向 */
function goBack() {
  markMeFresh();
  const target = safeRedirect(route.query.redirect);
  const matched = router.resolve(target).matched;
  if (matched.at(-1)?.path === '/:pathMatch(.*)*') location.assign(target);
  else router.replace(target);
}

async function submit() {
  error.value = null;
  loading.value = true;
  try {
    await login(username.value.trim(), password.value, remember.value);
    goBack();
  } catch (e) {
    if (e instanceof ApiError && e.code === 'PASSWORD_CHANGE_REQUIRED') mustChange.value = true;
    else error.value = { code: e instanceof ApiError ? e.code : 'UNKNOWN', message: describeError(e) };
  } finally {
    loading.value = false;
  }
}

async function setNewPassword(next: string) {
  await changePassword(next);
  goBack();
}

function backToLogin() {
  mustChange.value = false;
  password.value = '';
}
</script>

<template>
  <div v-if="!mustChange">
    <AuthHeader title="登入" description="使用 AD 帳號或本機帳號登入,所有應用共用同一次登入" />
    <form class="stack" @submit.prevent="submit">
      <GInput
        v-model="username"
        label="工號 / AD 帳號"
        icon="user"
        size="lg"
        autocomplete="username"
        placeholder="例:S112009"
        hint="可直接輸入工號,或「網域\帳號」"
        required
      />
      <GInput v-model="password" label="密碼" icon="lock" type="password" size="lg" autocomplete="current-password" required />
      <div class="row between">
        <GCheckbox v-model="remember" label="記住我(僅限公司內網)" />
        <RouterLink to="/reset-password" class="small">忘記密碼?</RouterLink>
      </div>
      <GAlert v-if="error" tone="danger">
        {{ error.message }}
        <template v-if="error.code === 'ACCOUNT_NOT_REGISTERED'"> <br /><RouterLink to="/register">前往註冊帳號</RouterLink> </template>
        <template v-else-if="error.code === 'ACCOUNT_LOCKED'"> <br /><RouterLink to="/reset-password">使用忘記密碼</RouterLink> </template>
      </GAlert>
      <GButton type="submit" variant="primary" size="lg" block :loading="loading" icon-right="login">登入</GButton>
    </form>
    <p class="alt small muted">沒有 AD 帳號的子公司同仁?<RouterLink to="/register">註冊本機帳號</RouterLink></p>
  </div>

  <div v-else>
    <AuthHeader title="設定新密碼" description="首次登入或密碼已由 IT 重設,請先設定新密碼" />
    <div class="stack">
      <GAlert tone="info">新入口網的密碼與舊單一入口(PortalSolar)無關,設定後請以新密碼登入。</GAlert>
      <SetPasswordForm :action="setNewPassword" submit-text="設定並登入" />
      <GButton variant="ghost" block icon="chevron-left" @click="backToLogin">回到登入</GButton>
    </div>
  </div>
</template>

<style scoped>
.between {
  justify-content: space-between;
}
.alt {
  margin: 20px 0 0;
  text-align: center;
}
</style>
