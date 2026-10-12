<script setup lang="ts">
/**
 * 年度必上課程(old_PortalSolar PersonalAnnualCurse.aspx;docs/Gherkin/personal/courses.feature)
 * 資料:GET /api/portal/courses/required(本人;規則同舊系統:12 門課、工安課程未完成各扣 2 分)。
 */
import { computed } from 'vue';
import { requiredCourses, type CourseStatus } from '@/api/portal';
import { describeError } from '@/api/gateway';
import { useAsync } from '@/composables/useAsync';

const { data, loading, error, reload } = useAsync(() => requiredCourses());

const STATUS: Record<CourseStatus, { label: string; tone: string }> = {
  done: { label: '已完成', tone: 'primary' },
  missing: { label: '未完成', tone: 'alert' },
  na: { label: '不適用', tone: 'neutral' },
};

const stats = computed(() => {
  const list = data.value?.courses ?? [];
  const applicable = list.filter((c) => c.status !== 'na');
  return {
    applicable: applicable.length,
    done: applicable.filter((c) => c.status === 'done').length,
    missing: applicable.filter((c) => c.status === 'missing').length,
  };
});
</script>

<template>
  <div class="stack courses">
    <GCard v-if="loading && !data"><GEmpty icon="clock" title="載入中…" /></GCard>
    <GCard v-else-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得年度必上課程" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <template v-else-if="data">
      <GCard v-if="!data.eligible">
        <GEmpty icon="award" :title="`${data.year} 年度沒有必上課程`" description="年度必上課程適用於碩禾(公司別 DS11 / DS15 / DS36)在職同仁。" />
      </GCard>
      <template v-else>
        <GAlert v-if="!data.inYear" tone="info" icon="info" :title="`${data.year} 年 9 月 30 日後到職`">今年度的必上課程不適用,明年度起列入。</GAlert>
        <div class="grid-stats">
          <GStatCard label="考訓年度" :value="`${data.year} 年`" tone="neutral" icon="calendar" />
          <GStatCard label="適用課程" :value="`${stats.applicable} 門`" tone="neutral" icon="award" />
          <GStatCard label="已完成" :value="`${stats.done} 門`" tone="primary" icon="check" />
          <GStatCard
            label="工安課程扣分"
            :value="`${data.deduction} 分`"
            :tone="data.deduction < 0 ? 'alert' : 'primary'"
            icon="shield"
            :meta="stats.missing ? `尚有 ${stats.missing} 門未完成` : '全部完成'"
          />
        </div>

        <GCard title="必上課程完訓狀態" icon="check-square">
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>類別</th>
                  <th>課程</th>
                  <th>時數</th>
                  <th>狀態</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in data.courses" :key="c.key" :class="{ miss: c.status === 'missing' && c.category === 'safety' }">
                  <td>
                    <GBadge :tone="c.category === 'safety' ? 'alert' : 'neutral'">{{ c.category === 'safety' ? '工安(必修)' : '宣導 / 通識' }}</GBadge>
                  </td>
                  <td>
                    <strong>{{ c.name }}</strong>
                  </td>
                  <td class="mono">{{ c.minHours !== undefined && c.status !== 'na' ? `${c.hours ?? 0} / ${c.minHours} 小時` : '—' }}</td>
                  <td>
                    <GBadge :tone="STATUS[c.status].tone">{{ STATUS[c.status].label }}</GBadge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </GCard>
      </template>

      <GAlert tone="neutral" icon="info">
        完訓紀錄取自 E-Learning(含擔任講師)與線上測驗通過的當年度課程;工安課程(必修)適用卻未完成者,每門扣 2 分。名單與適用對象依環安設定。
      </GAlert>
    </template>
  </div>
</template>

<style scoped>
.courses {
  --gap: 16px;
}
.grid-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
}
.table-wrap {
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-sm);
}
.data-table th,
.data-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
  text-align: left;
}
.data-table th {
  font-weight: 600;
  color: var(--text-2);
  background: var(--glass-soft);
}
.data-table tr.miss td {
  background: color-mix(in srgb, var(--c-alert, #e11d48) 8%, transparent);
}
.mono {
  font-family: var(--font-mono, monospace);
}
</style>
