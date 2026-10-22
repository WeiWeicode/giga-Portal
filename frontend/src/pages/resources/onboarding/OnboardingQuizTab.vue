<script setup lang="ts">
/**
 * 新人導覽 › 驗收區(old_PortalSolar HRnewPep05.aspx;FEATURE-PLAN §3.5、PORTAL-API-PLAN D-20;docs/Gherkin/resources/onboarding.feature)
 * 題目由 portal-api 提供(不含答案),送出後由後端計分:20 題全對才通過並寫入 HRNewPtest,不及格只顯示答對題數。
 * 「上傳答案」v-can="portal.onboarding.submit"(includes portal.api.onboarding.write);作答不預選(舊版預設「是」)。
 * 舊頁表頭的「求救」提示已失效,不做。
 */
import { computed, ref, watch } from 'vue';
import { describeError } from '@/api/gateway';
import { onboardingQuiz, onboardingStatus, submitOnboardingQuiz, type OnboardingQuizResult } from '@/api/portal';
import { QUIZ_OPTIONS, quizResultMessage, toAnswers, unansweredCount, type QuizChoice } from '@/composables/onboarding';
import { useAsync } from '@/composables/useAsync';
import { toast } from '@/ui/feedback';

const quiz = useAsync(onboardingQuiz);
const status = useAsync(onboardingStatus);

const choices = ref<QuizChoice[]>([]);
const comment = ref('');
watch(
  () => quiz.data.value,
  (q) => {
    choices.value = q ? q.questions.map(() => '') : [];
  },
);
const remaining = computed(() => unansweredCount(choices.value));

const submitting = ref(false);
const result = ref<OnboardingQuizResult | null>(null);
const resultMsg = computed(() => (result.value ? quizResultMessage(result.value) : null));

async function submit() {
  const answers = toAnswers(choices.value);
  if (!answers) {
    toast.warning('尚未作答完畢', `還有 ${remaining.value} 題未作答`);
    return;
  }
  submitting.value = true;
  try {
    const r = await submitOnboardingQuiz(answers, comment.value.trim());
    result.value = r;
    if (r.passed) {
      status.data.value = { readAt: status.data.value?.readAt ?? null, passedAt: r.passedAt };
      toast.success(quizResultMessage(r).title);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    toast.fromError(e, '送出失敗');
  } finally {
    submitting.value = false;
  }
}

function retry() {
  result.value = null;
  choices.value = choices.value.map(() => '');
}
</script>

<template>
  <div class="stack onboarding-quiz">
    <GCard title="驗收區" icon="file-check">
      <p class="intro">經過了前面各單元的導覽後您是否對公司有基礎的認識呢? 做個小測驗,自我測試一下吧!以下有 20 題是非題,請做答!</p>
      <p class="faint small">每題 5 分,20 題全對才算通過;通過後人資可看到您的完成紀錄。</p>
      <p v-if="status.data.value?.passedAt" class="passed">
        <GBadge tone="healthy">已通過</GBadge> 最近一次通過:<strong class="mono">{{ status.data.value.passedAt }}</strong>
      </p>
      <GAlert v-if="resultMsg" :tone="resultMsg.tone" :icon="resultMsg.tone === 'success' ? 'check-circle' : 'alert'" class="result">
        <strong>{{ resultMsg.title }}</strong> {{ resultMsg.message }}
        <GButton v-if="!result?.passed" size="sm" variant="secondary" icon="refresh" @click="retry">重新作答</GButton>
      </GAlert>
    </GCard>

    <GCard v-if="quiz.error.value">
      <GEmpty tone="danger" icon="alert" title="題目載入失敗" :description="describeError(quiz.error.value)">
        <GButton icon="refresh" @click="quiz.reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="quiz.loading.value || !quiz.data.value"><GSkeleton :lines="6" /></GCard>
    <template v-else>
      <GCard :title="`測驗題目(已作答 ${choices.length - remaining} / ${choices.length})`" icon="list-ordered">
        <ol class="questions">
          <li v-for="(q, i) in quiz.data.value.questions" :key="q.no" :class="{ unanswered: choices[i] === '' }">
            <span class="no mono">{{ q.no }}.</span>
            <span class="text">{{ q.text }}</span>
            <GSegmented v-model="choices[i]!" :options="QUIZ_OPTIONS" size="sm" :aria-label="`第 ${q.no} 題`" />
          </li>
        </ol>
      </GCard>

      <GCard title="我有話要說" icon="message">
        <GTextarea v-model="comment" :rows="4" placeholder="有任何意見都歡迎您提出~(最多 500 字)" :error="comment.length > 500 ? '最多 500 字' : null" />
        <div class="actions">
          <span v-if="remaining" class="faint small">尚有 {{ remaining }} 題未作答</span>
          <GButton
            v-can="'portal.onboarding.submit'"
            variant="primary"
            icon="send"
            :loading="submitting"
            :disabled="remaining > 0 || comment.length > 500"
            @click="submit"
            >上傳答案</GButton
          >
        </div>
      </GCard>
    </template>
  </div>
</template>

<style scoped>
.onboarding-quiz {
  --gap: 16px;
}
.intro {
  margin: 0 0 6px;
  font-weight: 600;
}
.passed {
  margin: 10px 0 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.result {
  margin-top: 12px;
}
.questions {
  list-style: none;
  margin: 0;
  padding: 0;
}
.questions li {
  display: grid;
  grid-template-columns: 2.2em 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
  line-height: 1.5;
}
.questions li:last-child {
  border-bottom: 0;
}
.no {
  font-weight: 700;
  color: var(--text-2);
}
@media (max-width: 560px) {
  .questions li {
    grid-template-columns: 2.2em 1fr;
  }
  .questions li > :last-child {
    grid-column: 2;
    justify-self: start;
  }
}
.actions {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
}
.mono {
  font-family: var(--font-mono, monospace);
}
.faint {
  color: var(--text-2);
}
.small {
  font-size: var(--fs-sm);
}
</style>
