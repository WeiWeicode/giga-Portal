<script setup lang="ts">
/**
 * 設定新密碼表單(首次登入、Email 驗證 / 啟用連結、重設密碼、變更密碼共用)。
 * 密碼政策由 Gateway 檢查(PASSWORD_POLICY_VIOLATION 逐條列出、PASSWORD_REUSED);這裡只提示並檢查兩次輸入一致。
 */
import { reactive, ref } from 'vue';
import { describeError, policyMessages } from '@/api/gateway';

const props = defineProps<{
  action: (next: string, current?: string) => Promise<void>;
  submitText?: string;
  /** 已登入者變更密碼時需輸入目前密碼 */
  needCurrent?: boolean;
  formId?: string;
  /** 由外部(對話框 footer)放送出按鈕時設 true */
  hideSubmit?: boolean;
}>();

const form = reactive({ current: '', next: '', confirm: '' });
const error = ref<{ message: string; rules: string[] } | null>(null);
const saving = ref(false);
defineExpose({ saving, reset: () => (Object.assign(form, { current: '', next: '', confirm: '' }), (error.value = null)) });

async function submit() {
  error.value = null;
  if (form.next !== form.confirm) return (error.value = { message: '兩次輸入的新密碼不一致', rules: [] });
  saving.value = true;
  try {
    await props.action(form.next, props.needCurrent ? form.current : undefined);
  } catch (e) {
    error.value = { message: describeError(e), rules: policyMessages(e) };
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <form :id="formId" class="stack" @submit.prevent="submit">
    <GInput v-if="needCurrent" v-model="form.current" label="目前密碼" icon="lock" type="password" autocomplete="current-password" required />
    <GInput
      v-model="form.next"
      label="新密碼"
      icon="lock"
      type="password"
      autocomplete="new-password"
      hint="至少 8 碼、需包含英文字母與數字、不可包含工號"
      required
    />
    <GInput v-model="form.confirm" label="確認新密碼" icon="lock" type="password" autocomplete="new-password" required />
    <GAlert v-if="error" tone="danger">
      {{ error.message }}
      <ul v-if="error.rules.length">
        <li v-for="r in error.rules" :key="r">{{ r }}</li>
      </ul>
    </GAlert>
    <GButton v-if="!hideSubmit" type="submit" variant="primary" size="lg" block :loading="saving">{{ submitText ?? '設定密碼' }}</GButton>
  </form>
</template>
