<script setup lang="ts">
/**
 * 忘記密碼(PRD FR-1.4;Gateway PRD §8.2.4):僅本機帳號;AD 帳號請依公司 AD 流程變更。
 * 無 token:輸入工號寄送重設連結,成功時一律顯示相同訊息(不透露帳號是否存在)。
 * 帶 token(Email 連結):設定新密碼。
 */
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { describeError, forgotPassword, resetPassword } from '@/api/gateway';
import AuthHeader from './AuthHeader.vue';
import SetPasswordForm from './SetPasswordForm.vue';

const SENT = '若帳號存在,已寄出重設連結到公司登記的 Email,請於時效內完成設定';

const route = useRoute();
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''));
const employeeNo = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const done = ref<string | null>(null);

async function send() {
  error.value = null;
  loading.value = true;
  try {
    await forgotPassword(employeeNo.value.trim().toUpperCase());
    done.value = SENT;
  } catch (e) {
    error.value = describeError(e);
  } finally {
    loading.value = false;
  }
}

async function reset(password: string) {
  const r = await resetPassword(token.value, password);
  done.value = r?.message ?? '密碼已重設,請以新密碼登入';
}
</script>

<template>
  <div v-if="done">
    <AuthHeader :title="token ? '密碼已重設' : '已送出'" />
    <div class="stack">
      <GAlert tone="success">{{ done }}</GAlert>
      <RouterLink to="/login" class="back"><GIcon name="chevron-left" :size="16" />回到登入</RouterLink>
    </div>
  </div>

  <div v-else-if="token">
    <AuthHeader title="重設密碼" description="設定新的登入密碼" />
    <SetPasswordForm :action="reset" submit-text="重設密碼" />
  </div>

  <div v-else>
    <AuthHeader title="忘記密碼" description="輸入本機帳號的工號,我們會寄送重設連結到公司登記的 Email" />
    <form class="stack" @submit.prevent="send">
      <GInput v-model="employeeNo" label="工號" icon="id-card" size="lg" autocomplete="username" placeholder="例:V112001" required />
      <GAlert tone="info">AD 帳號請依公司 AD 流程(Windows)變更密碼。</GAlert>
      <GAlert v-if="error" tone="danger">{{ error }}</GAlert>
      <GButton type="submit" variant="primary" size="lg" block :loading="loading" icon-right="mail">寄送重設連結</GButton>
    </form>
    <p class="alt small muted"><RouterLink to="/login">回到登入</RouterLink></p>
  </div>
</template>

<style scoped>
.alt {
  margin: 20px 0 0;
  text-align: center;
}
.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}
</style>
