<script setup lang="ts">
/**
 * 問卷統計(old_PortalSolar MyQAList.aspx「分析」;FEATURE-PLAN §3.4、D-18)。
 * 每題答案人數與百分比(分母 = 作答人數,複選題加總可超過 100%);依人事屬性分組顯示「系統轉移中」。
 */
import { ref, watch } from 'vue';
import { describeError } from '@/api/gateway';
import { qaExportUrl, qaStats, type QaStats } from '@/api/portal';

const props = defineProps<{ qaNo: string | null; admin: boolean }>();
const open = defineModel<boolean>('open', { default: false });

const data = ref<QaStats | null>(null);
const error = ref<unknown>(null);
const loading = ref(false);

watch(
  open,
  async (v) => {
    if (!v || !props.qaNo) return;
    loading.value = true;
    error.value = null;
    data.value = null;
    try {
      data.value = await qaStats(props.admin, props.qaNo);
    } catch (e) {
      error.value = e;
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

const exportExcel = () => props.qaNo && window.open(qaExportUrl(props.admin, props.qaNo), '_blank', 'noopener');
const typeLabel = (t: string | null) => (t === 'single' ? '單選' : t === 'multi' ? '複選(可複選)' : t === 'text' ? '問答' : '說明');
</script>

<template>
  <GModal v-model:open="open" :title="data ? `統計:${data.title}` : '問卷統計'" icon="pie-chart" width="760px">
    <GEmpty v-if="loading" icon="clock" title="載入中…" compact />
    <GEmpty v-else-if="error" tone="danger" icon="alert" title="無法取得統計" :description="describeError(error)" compact />
    <div v-else-if="data" class="stack">
      <div class="row head">
        <GBadge tone="primary">作答人數 {{ data.respondents }}</GBadge>
        <span class="spacer" />
        <GButton icon="download" :disabled="!data.respondents" @click="exportExcel">匯出作答明細 Excel</GButton>
      </div>
      <GAlert v-if="data.unavailable.includes('hr')" tone="neutral" icon="construction" title="依人事屬性分組:系統轉移中">
        性別、年齡、年資、職等等人事屬性來自人事系統,轉移完成前不提供分組統計與匯出。
      </GAlert>
      <GCard v-for="q in data.questions" :key="q.no" padding="sm">
        <div class="qhead">
          <strong class="mono">{{ q.no }}.</strong> <span class="qtext">{{ q.text }}</span>
          <GBadge tone="neutral">{{ typeLabel(q.type) }}</GBadge>
          <span class="small faint">有作答 {{ q.answered }} 人</span>
        </div>
        <div v-if="q.items.length" class="table-wrap">
          <table class="stat">
            <thead>
              <tr>
                <th>答案</th>
                <th class="num">人數</th>
                <th class="num">百分比</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in q.items" :key="it.answer">
                <td class="ans">{{ it.answer }}</td>
                <td class="num mono">{{ it.count }}</td>
                <td class="num mono">
                  <span class="bar" :style="{ width: `${Math.min(it.percent, 100)}%` }" />
                  {{ it.percent }}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="small faint">尚無作答</p>
      </GCard>
    </div>
  </GModal>
</template>

<style scoped>
.head {
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.spacer {
  flex: 1;
}
.qhead {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.qtext {
  font-weight: 600;
  overflow-wrap: anywhere;
}
.table-wrap {
  overflow-x: auto;
}
.stat {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-sm);
}
.stat th,
.stat td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--line);
  text-align: left;
}
.stat .num {
  text-align: right;
  white-space: nowrap;
  position: relative;
  width: 110px;
}
.ans {
  overflow-wrap: anywhere;
}
.bar {
  position: absolute;
  left: 0;
  bottom: 2px;
  height: 3px;
  background: var(--c-primary);
  border-radius: 2px;
}
.small {
  font-size: var(--fs-sm);
}
</style>
