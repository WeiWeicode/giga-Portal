<script setup lang="ts">
/**
 * 問卷內容與作答欄位(填答與出題者預覽共用;old_PortalSolar QA/QuestView.aspx)。
 * 前言 / 結語:後端已白名單清洗,顯示前再以 web-kit sanitizeHtml 清洗;題目圖片經 giga-file-service(D-28)。
 * readonly = 預覽:可操作但不會送出(舊版預覽就是正式填答頁,會真的寫入作答)。
 */
import { computed, ref } from 'vue';
import { sanitizeHtml } from '@giganexus/web-kit';
import { qaImageUrl, type QaQuestion, type QaSurveyView } from '@/api/portal';
import { toDisplayHtml, toggleChoice, type FillAnswer } from '@/composables/qa';

const props = defineProps<{ survey: QaSurveyView; state: Record<number, FillAnswer>; readonly?: boolean }>();

const intro = computed(() => sanitizeHtml(toDisplayHtml(props.survey.intro)));
const outro = computed(() => sanitizeHtml(toDisplayHtml(props.survey.outro)));
const broken = ref(new Set<number>());

const typeLabel = (q: QaQuestion) => (q.type === 'single' ? '單選' : q.type === 'multi' ? '複選' : q.type === 'text' ? '問答' : '說明');
const imgStyle = (q: QaQuestion) => ({
  ...(q.image?.width ? { width: `${q.image.width}px` } : {}),
  ...(q.image?.height ? { height: `${q.image.height}px` } : {}),
});
</script>

<template>
  <div class="qa-fill stack">
    <div class="meta small faint">
      <span v-if="survey.dept">主辦:{{ survey.dept }}</span>
      <span>期間:{{ survey.startDate ?? '—' }} ~ {{ survey.endDate ?? '—' }}</span>
      <span v-if="readonly"><GBadge tone="warning">預覽(不會送出)</GBadge></span>
    </div>
    <div v-if="survey.intro" class="rich" v-html="intro" />

    <ol class="questions">
      <li v-for="q in survey.questions" :key="q.no" class="question">
        <template v-for="pos in ['before', 'after'] as const" :key="pos">
          <div v-if="pos === 'after'" class="q-head">
            <span class="q-no mono">{{ q.no }}.</span>
            <span class="q-text">{{ q.text }}</span>
            <GBadge tone="neutral">{{ typeLabel(q) }}</GBadge>
            <GBadge v-if="q.type && q.required" tone="danger">必填</GBadge>
            <span v-if="q.type === 'multi' && q.limit !== null" class="small faint">(最多可選 {{ q.limit }})</span>
          </div>
          <div v-if="q.image && q.image.position === pos" class="q-img">
            <img v-if="!broken.has(q.no)" :src="qaImageUrl(q.image.fileId)" :style="imgStyle(q)" alt="題目圖片" @error="broken.add(q.no)" />
            <span v-else class="small faint">(圖片無法顯示)</span>
          </div>
        </template>
        <p v-if="q.legacyImage" class="small faint">(此題有舊入口網上傳的圖片,新入口網不顯示)</p>

        <div v-if="q.type === 'single'" class="opts" role="radiogroup">
          <label v-for="o in q.options" :key="o" class="opt">
            <input v-model="state[q.no]!.choice" type="radio" :name="`q${q.no}`" :value="o" />
            <span>{{ o }}</span>
          </label>
        </div>
        <div v-else-if="q.type === 'multi'" class="opts">
          <label v-for="o in q.options" :key="o" class="opt">
            <input
              type="checkbox"
              :checked="state[q.no]!.choices.includes(o)"
              @change="toggleChoice(q, state[q.no]!, o, ($event.target as HTMLInputElement).checked)"
            />
            <span>{{ o }}</span>
          </label>
        </div>
        <GTextarea v-else-if="q.type === 'text'" v-model="state[q.no]!.text" :rows="3" placeholder="請輸入(最多 300 字)" />
      </li>
    </ol>

    <div v-if="survey.outro" class="rich" v-html="outro" />
  </div>
</template>

<style scoped>
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
.rich {
  overflow-wrap: anywhere;
  line-height: 1.6;
}
.questions {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.question {
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--glass-soft);
}
.q-head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.q-no {
  font-weight: 700;
}
.q-text {
  font-weight: 600;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.q-img img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
}
.opts {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.opt {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  cursor: pointer;
  overflow-wrap: anywhere;
}
.opt input {
  margin-top: 4px;
  accent-color: var(--c-primary);
}
.small {
  font-size: var(--fs-sm);
}
</style>
