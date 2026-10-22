<script setup lang="ts">
/**
 * 問卷調查 › 我的問卷(old_PortalSolar 首頁待辦 + QA/QuestView.aspx;FEATURE-PLAN §3.4;docs/Gherkin/resources/qa.feature)
 * 列出待填問卷(資格與是否已填由 portal-api 判斷),填答後整份送出;送出按鈕 v-can="portal.survey.submit"。
 */
import { ref } from 'vue';
import { describeError } from '@/api/gateway';
import { qaForFill, qaPending, qaSubmit, type QaPendingItem, type QaSurveyView } from '@/api/portal';
import { emptyFill, fillErrors, toAnswers, type FillAnswer } from '@/composables/qa';
import { useAsync } from '@/composables/useAsync';
import { toast } from '@/ui/feedback';
import QaFillView from './QaFillView.vue';

const { data, loading, error, reload } = useAsync(() => qaPending());

const modal = ref(false);
const survey = ref<QaSurveyView | null>(null);
const state = ref<Record<number, FillAnswer>>({});
const opening = ref('');
const errors = ref<string[]>([]);
const sending = ref(false);

async function open(item: QaPendingItem) {
  opening.value = item.qaNo;
  try {
    const s = await qaForFill(item.qaNo);
    survey.value = s;
    state.value = emptyFill(s.questions);
    errors.value = [];
    modal.value = true;
  } catch (e) {
    toast.fromError(e, '無法開啟問卷');
    await reload();
  } finally {
    opening.value = '';
  }
}

async function submit() {
  if (!survey.value) return;
  errors.value = fillErrors(survey.value.questions, state.value);
  if (errors.value.length) return;
  sending.value = true;
  try {
    await qaSubmit(survey.value.qaNo, toAnswers(survey.value.questions, state.value));
    modal.value = false;
    toast.success('問卷已送出,謝謝您的填寫!');
    await reload();
  } catch (e) {
    const d = (e as { details?: { message: string }[] }).details;
    if (Array.isArray(d) && d.length) errors.value = d.map((x) => x.message);
    toast.fromError(e, '送出失敗');
    if ((e as { code?: string }).code === 'PORTAL_QA_ANSWERED') {
      modal.value = false;
      await reload();
    }
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <div class="stack qa-mine">
    <GCard v-if="loading && !data"><GEmpty icon="clock" title="載入中…" /></GCard>
    <GCard v-else-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得問卷" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="data && !data.items.length">
      <GEmpty icon="check-circle" title="目前沒有待填寫的問卷" description="開放中且您在填寫對象內的問卷會列在這裡;填寫完成後即不再顯示。" />
    </GCard>
    <template v-else-if="data">
      <GCard v-for="s in data.items" :key="s.qaNo" :title="s.title" icon="trello">
        <div class="row meta">
          <GBadge tone="warning">待填寫</GBadge>
          <GBadge v-if="s.dept" tone="neutral">{{ s.dept }}</GBadge>
          <span class="small faint mono">{{ s.startDate }} ~ {{ s.endDate }}</span>
          <span class="small faint">{{ s.questionCount }} 題</span>
        </div>
        <div class="row acts">
          <GButton variant="primary" icon="edit" :loading="opening === s.qaNo" @click="open(s)">填寫問卷</GButton>
        </div>
      </GCard>
    </template>

    <GModal v-model:open="modal" :title="survey?.title ?? '問卷'" icon="trello" width="760px">
      <div v-if="survey" class="stack">
        <QaFillView :survey="survey" :state="state" />
        <GAlert v-if="errors.length" tone="danger" title="請確認作答">
          <ul class="errs">
            <li v-for="m in errors" :key="m">{{ m }}</li>
          </ul>
        </GAlert>
        <div class="row modal-actions">
          <GButton @click="modal = false">取消</GButton>
          <GButton v-can="'portal.survey.submit'" variant="primary" icon="send" :loading="sending" @click="submit">送出問卷</GButton>
        </div>
      </div>
    </GModal>
  </div>
</template>

<style scoped>
.qa-mine {
  --gap: 16px;
}
.meta {
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.acts,
.modal-actions {
  justify-content: flex-end;
  margin-top: 8px;
  gap: 8px;
}
.small {
  font-size: var(--fs-sm);
}
.errs {
  margin: 0;
  padding-left: 18px;
}
</style>
