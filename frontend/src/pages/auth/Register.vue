<script setup lang="ts">
/**
 * 自行註冊(PRD FR-1.4;Gateway PRD §8.2.5):沒有 AD 網域的子公司員工以工號 + 姓名申請(無 Email 者另填到職日)。
 * 帶 token(Email 驗證連結或 IT 代建的 /register/activate?token=)時改為設定密碼並啟用帳號。
 * 申請結果(寄出驗證連結 / 直接啟用 / 轉 IT 審核)以 Gateway 回傳的 message 為準;無法註冊時為統一訊息,不透露原因。
 */
import { computed, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { describeError, register, verifyRegistration } from '@/api/gateway';
import AuthHeader from './AuthHeader.vue';
import SetPasswordForm from './SetPasswordForm.vue';

const route = useRoute();
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''));

const form = reactive({ employeeNo: '', name: '', hireDate: '' });
const loading = ref(false);
const error = ref<string | null>(null);
const done = ref<string | null>(null);

async function apply() {
  error.value = null;
  loading.value = true;
  try {
    const r = await register({
      employeeNo: form.employeeNo.trim().toUpperCase(),
      name: form.name.trim(),
      ...(form.hireDate ? { hireDate: form.hireDate } : {}),
    });
    done.value = r?.message ?? '已寄出驗證連結,請至公司 Email 收信並於 30 分鐘內完成設定';
  } catch (e) {
    error.value = describeError(e);
  } finally {
    loading.value = false;
  }
}

async function activate(password: string) {
  const r = await verifyRegistration(token.value, password);
  done.value = r?.message ?? '帳號已啟用,請以新密碼登入';
}
</script>

<template>
  <div v-if="done">
    <AuthHeader :title="token ? '帳號已啟用' : '已送出申請'" />
    <div class="stack">
      <GAlert tone="success">{{ done }}</GAlert>
      <RouterLink to="/login" class="back"><GIcon name="chevron-left" :size="16" />回到登入</RouterLink>
    </div>
  </div>

  <div v-else-if="token">
    <AuthHeader title="設定密碼" description="設定本機帳號的登入密碼,完成後即可登入所有應用" />
    <SetPasswordForm :action="activate" submit-text="設定並啟用帳號" />
  </div>

  <div v-else>
    <AuthHeader title="註冊本機帳號" description="適用於沒有 AD 帳號的子公司同仁;有 AD 帳號者請直接以 AD 帳號登入" />
    <form class="stack" @submit.prevent="apply">
      <GInput v-model="form.employeeNo" label="工號" icon="id-card" size="lg" autocomplete="username" placeholder="例:V112001" required />
      <GInput v-model="form.name" label="姓名" icon="user" size="lg" autocomplete="name" required />
      <GInput v-model="form.hireDate" label="到職日" icon="calendar" type="date" size="lg" hint="沒有公司 Email 的同仁才需要填寫,用於確認身分" />
      <GAlert v-if="error" tone="danger">{{ error }}</GAlert>
      <GButton type="submit" variant="primary" size="lg" block :loading="loading" icon-right="send">送出申請</GButton>
    </form>
    <p class="alt small muted">已有帳號?<RouterLink to="/login">回到登入</RouterLink></p>
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
