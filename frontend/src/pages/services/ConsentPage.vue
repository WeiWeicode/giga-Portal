<script setup lang="ts">
/**
 * 同意書(P7 臨時服務;FEATURE-PLAN §9、D-8;docs/Gherkin/services/consent.feature)。
 * 一頁承接所有版本:/services/consent/<GUID>(ConsentX 通用同意書)或 /services/consent/<編號>(指派名單,例 20260814 集保帳號調查)。
 * 勾選同意 + 線上簽名:簽名 PNG 先上傳 giga-file-service(sourceApp portal-consent),**先綁定**(refType portal-consent、refNo = <編號>:<工號>,
 * file-service 只允許綁定本人上傳的檔案)成功後才送出簽署;綁定失敗不簽署(資安審查 H1)。
 * 身分證只顯示末 4 碼;後端擋重簽與過期(410 服務已結束)。
 */
import { computed, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { sanitizeHtml } from '@giganexus/web-kit';
import { describeError, useAuth } from '@/api/gateway';
import { bindFiles, consentDetail, signConsent, uploadFile } from '@/api/portal';
import SignaturePad from '@/components/services/SignaturePad.vue';
import { accountValid, consentStateText, isServiceEnded } from '@/composables/services';
import { useAsync } from '@/composables/useAsync';
import { toast } from '@/ui/feedback';

const REF = 'portal-consent';
const auth = useAuth();
const me = computed(() => auth.me.me);
const route = useRoute();
const id = computed(() => String(route.params.id ?? ''));
const { data, loading, error, reload } = useAsync(() => consentDetail(id.value));
watch(id, () => void reload());

const html = computed(() => (data.value?.html ? sanitizeHtml(data.value.html) : ''));
const state = computed(() => (data.value ? consentStateText(data.value.state, data.value.signedAt) : null));
const open = computed(() => data.value?.state === 'open');
const forbidden = computed(() => (error.value as { status?: number } | null)?.status === 403);

const agree = ref(false);
const fields = reactive({ phone: '', homeAddress: '', mailAddress: '', account: '' });
const pad = ref<InstanceType<typeof SignaturePad> | null>(null);
const saving = ref(false);
const done = ref<{ signedAt: string; accountLast4: string | null } | null>(null);

async function submit() {
  const d = data.value;
  if (!d) return;
  if (!agree.value) return toast.error('未勾選確認同意', '為確保您的權利,請詳細閱讀後勾選');
  if (d.kind === 'account-survey') {
    if (!fields.phone.trim() || !fields.homeAddress.trim() || !fields.mailAddress.trim()) return toast.error('請填寫聯絡電話、戶籍地址與通訊地址');
    if (!accountValid(fields.account)) return toast.error('集保帳號為 11 碼數字,請確認');
  }
  saving.value = true;
  try {
    let signatureFileId: string | null = null;
    if (d.requireSign) {
      const file = await pad.value?.toFile();
      if (!file) return toast.error('請完成線上簽名');
      signatureFileId = await uploadFile(REF, file);
      await bindFiles(REF, `${d.id}:${me.value?.user.employeeNo ?? ''}`, [signatureFileId]);
    }
    const r = await signConsent(d.id, { agree: true, signatureFileId, fields: d.kind === 'account-survey' ? { ...fields } : null });
    done.value = r;
    toast.success('成功上傳!');
    await reload();
  } catch (e) {
    if (isServiceEnded(e)) await reload();
    toast.fromError(e, '送出失敗');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="stack consent-page">
    <GPageHeader :title="data?.title ?? '同意書'" icon="file-check" eyebrow="臨時服務" />

    <GCard v-if="loading && !data"><GSkeleton :lines="6" /></GCard>
    <GCard v-else-if="error">
      <GEmpty
        :tone="forbidden ? 'neutral' : 'danger'"
        :icon="forbidden ? 'lock' : 'alert'"
        :title="forbidden ? '此同意書不適用於您' : '無法開啟同意書'"
        :description="forbidden ? '若您認為應簽署此同意書,請洽人資' : describeError(error)"
      >
        <GButton v-if="!forbidden" icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <template v-else-if="data">
      <GAlert v-if="state" :tone="state.tone" :title="state.text">
        <template v-if="data.startDate || data.endDate">開放期間:{{ data.startDate ?? '不限' }} ~ {{ data.endDate ?? '不限' }}</template>
      </GAlert>

      <!-- 內文:後端已白名單清洗,顯示前再以 web-kit sanitizeHtml 清洗一次 -->
      <GCard v-if="html" padding="lg"><div class="doc" v-html="html" /></GCard>

      <GCard v-if="data.kind === 'account-survey' && data.profile" title="基本資料" icon="user">
        <dl class="kv">
          <dt>工號</dt>
          <dd>{{ data.profile.empNo }}</dd>
          <dt>姓名</dt>
          <dd>{{ data.profile.name ?? '—' }}</dd>
          <dt>身分證字號</dt>
          <dd>{{ data.profile.nationalIdLast4 ? `******${data.profile.nationalIdLast4}` : '—' }}</dd>
          <dt>出生年月日</dt>
          <dd>{{ data.profile.birthDate ?? '—' }}</dd>
        </dl>
        <p class="xs faint">股款繳款日會另行發送繳款通知。</p>
      </GCard>

      <GCard v-if="open" title="確認與送出" icon="edit">
        <form class="stack" @submit.prevent="submit">
          <template v-if="data.kind === 'account-survey'">
            <GInput v-model="fields.phone" label="聯絡電話" required autocomplete="tel" />
            <GInput v-model="fields.homeAddress" label="戶籍地址" required />
            <GInput v-model="fields.mailAddress" label="通訊地址" required />
            <GInput
              v-model="fields.account"
              label="集保帳號(11 碼)"
              required
              autocomplete="off"
              :error="fields.account && !accountValid(fields.account) ? '集保帳號為 11 碼數字' : null"
            />
          </template>
          <div v-if="data.requireSign" class="stack">
            <span class="sm">線上簽名</span>
            <SignaturePad ref="pad" />
          </div>
          <GCheckbox v-model="agree" :label="data.agreeText" />
          <div class="row">
            <GButton type="submit" variant="primary" icon="upload" :loading="saving">上傳</GButton>
          </div>
        </form>
      </GCard>
      <GAlert v-if="done?.accountLast4" tone="success" title="已記錄集保帳號">末 4 碼 {{ done.accountLast4 }}</GAlert>
    </template>
  </div>
</template>

<style scoped>
.doc {
  line-height: 1.8;
  overflow-x: auto;
}
.doc :deep(table) {
  max-width: 100%;
}
.kv {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 16px;
  margin: 0 0 8px;
}
.kv dt {
  color: var(--text-2);
}
.kv dd {
  margin: 0;
}
</style>
