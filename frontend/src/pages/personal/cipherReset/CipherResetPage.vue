<script setup lang="ts">
/**
 * 薪資金鑰驗證密碼重置 (對齊 old_PortalSolar CiperResetAccount.aspx)
 * 供員工重新設定個人薪資單、獎金明細與敏感人事個資查詢之專屬二階段解鎖安全金鑰。
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput } from '@/ui';

const form = ref({
  empNo: 'V112001',
  name: '蔣佳緯',
  idCard: '',
  birthday: '',
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const isSubmitted = ref(false);

function handleSubmit() {
  isSubmitted.value = true;
}
</script>

<template>
  <div class="cipher-reset-page stack">
    <GCard title="薪資金鑰驗證密碼重置 (Reset Security Password)" icon="key" class="glass form-card">
      <form class="reset-form stack" @submit.prevent="handleSubmit">
        <!-- 區塊 1: 身分驗證資訊 -->
        <div class="section-title">
          <GBadge tone="primary">步驟 1</GBadge>
          <strong>驗證同仁個人身分資訊</strong>
        </div>

        <div class="form-grid">
          <div class="field-col">
            <label class="form-label">員工工號 (Employee No.)</label>
            <GInput v-model="form.empNo" disabled class="mono" />
          </div>
          <div class="field-col">
            <label class="form-label">中文姓名 (Chinese Name)</label>
            <GInput v-model="form.name" disabled />
          </div>
          <div class="field-col">
            <label class="form-label">身分證字號 / 居留證號 (ID / Passport No.) <span class="required">*</span></label>
            <GInput v-model="form.idCard" placeholder="請輸入完整 10 碼身分證字號" />
          </div>
          <div class="field-col">
            <label class="form-label">出生年月日 (Birthday) <span class="required">*</span></label>
            <GInput v-model="form.birthday" type="date" />
          </div>
        </div>

        <hr class="divider" />

        <!-- 區塊 2: 設定新安全金鑰密碼 -->
        <div class="section-title">
          <GBadge tone="storage">步驟 2</GBadge>
          <strong>設定薪資安全金鑰 (6 碼以上英數字)</strong>
        </div>

        <div class="form-grid">
          <div class="field-col">
            <label class="form-label">目前安全密碼 (首次設定可留空)</label>
            <GInput v-model="form.oldPassword" type="password" placeholder="請輸入舊密碼" />
          </div>
          <div class="field-col" />
          <div class="field-col">
            <label class="form-label">新薪資安全密碼 (New Password) <span class="required">*</span></label>
            <GInput v-model="form.newPassword" type="password" placeholder="6 碼以上，建議混用大小寫與數字" />
          </div>
          <div class="field-col">
            <label class="form-label">確認新安全密碼 (Confirm Password) <span class="required">*</span></label>
            <GInput v-model="form.confirmPassword" type="password" placeholder="請再次輸入相同新密碼" />
          </div>
        </div>

        <div class="form-actions">
          <GButton type="submit" variant="primary" icon="check">確認重置薪資金鑰</GButton>
        </div>
      </form>
    </GCard>

    <GAlert v-if="isSubmitted" tone="positive" icon="check-circle">
      薪資安全金鑰已成功變更！日後於「薪資獎金」與「年度所得」頁面解鎖查詢時，請使用本次設定之新安全密碼。
    </GAlert>

    <GAlert tone="neutral" icon="info">
      此密碼為獨立於 Windows AD 與 SSO 登入密碼之專屬第二層薪資防護密碼。若遺忘密碼且身分驗證失敗，請親洽人事管理部薪資專員辦理臨櫃重置。
    </GAlert>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.form-card {
  max-width: 800px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: var(--fs-md);
  margin-top: 6px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}
.field-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-label {
  font-weight: 600;
  font-size: var(--fs-sm);
  color: var(--text-2);
}
.required {
  color: var(--c-danger);
}
.divider {
  border: 0;
  border-top: 1px solid var(--line);
  margin: 8px 0;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}
.mono {
  font-family: var(--font-mono, monospace);
}
</style>
