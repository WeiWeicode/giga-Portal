<script setup lang="ts">
/** 變更密碼(本機帳號;AD 帳號依公司 AD 流程)。成功後 Gateway 撤銷其他裝置的登入並換發本裝置的工作階段 */
import { ref, watch } from 'vue';
import { changePassword } from '@/api/gateway';
import SetPasswordForm from '@/pages/auth/SetPasswordForm.vue';
import { toast } from '@/ui';

const open = defineModel<boolean>('open', { default: false });
const formRef = ref<InstanceType<typeof SetPasswordForm>>();

watch(open, (v) => v && formRef.value?.reset());

async function save(next: string, current?: string) {
  await changePassword(next, current ?? '');
  toast.success('密碼已變更', '其他裝置需重新登入');
  open.value = false;
}
</script>

<template>
  <GModal v-model:open="open" title="變更密碼" subtitle="至少 8 碼,需包含英文字母與數字" icon="lock" width="440px">
    <SetPasswordForm ref="formRef" form-id="pwd-form" :action="save" need-current hide-submit />
    <template #footer>
      <GButton variant="ghost" @click="open = false">取消</GButton>
      <GButton variant="primary" type="submit" form="pwd-form" :loading="formRef?.saving">儲存</GButton>
    </template>
  </GModal>
</template>
