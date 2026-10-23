<script setup lang="ts">
/**
 * 部門年度必上課程(old_PortalSolar AnnualCurse.aspx 主管版;FEATURE-PLAN §7;docs/Gherkin/manager/manager.feature)。
 * 資料:GET /api/portal/manager/courses(範圍內部屬每人 12 門課;規則同個人版 D-9,扣分欄依規則計算,舊版固定 0.0 不沿用)。
 */
import { computed, ref } from 'vue';
import { managerCourses, type CourseStatus } from '@/api/portal';
import { describeError } from '@/api/gateway';
import { courseStats } from '@/composables/manager';
import { useAsync } from '@/composables/useAsync';
import MgrDeptFilter from '../MgrDeptFilter.vue';

const thisYear = new Date().getFullYear();
const year = ref(String(thisYear));
const years = [thisYear, thisYear - 1, thisYear - 2].map((y) => ({ label: `${y} 年`, value: String(y) }));
const dept = ref('');
const includeSub = ref(true);
const keyword = ref('');

const { data, loading, error, reload } = useAsync(() => managerCourses({ dept: dept.value, includeSub: includeSub.value, year: Number(year.value) }), {
  immediate: false,
});
const search = () => dept.value && reload();

const MARK: Record<CourseStatus, { text: string; tone: string }> = {
  done: { text: 'Y', tone: 'primary' },
  missing: { text: 'N', tone: 'danger' },
  na: { text: '--', tone: 'neutral' },
};
const items = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return (data.value?.items ?? []).filter((p) => !kw || [p.empNo, p.name ?? '', p.dept ?? '', p.deptName ?? ''].some((s) => s.toLowerCase().includes(kw)));
});
const stats = computed(() => courseStats(items.value));
const statusOf = (p: { courses: { key: string; status: CourseStatus }[] }, key: string) => p.courses.find((c) => c.key === key)?.status ?? 'na';
</script>

<template>
  <div class="stack">
    <GCard>
      <MgrDeptFilter v-model:dept="dept" v-model:include-sub="includeSub" @ready="search">
        <GSelect v-model="year" :options="years" class="year" aria-label="年度" />
        <GButton variant="primary" icon="search" :loading="loading" :disabled="!dept" @click="search">查詢</GButton>
        <GInput v-model="keyword" icon="search" placeholder="篩選工號 / 姓名 / 部門" clearable class="kw" />
      </MgrDeptFilter>
    </GCard>

    <GCard v-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得部屬必上課程" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="loading && !data"><GSkeleton :lines="5" /></GCard>
    <template v-else-if="data">
      <div class="grid-stats">
        <GStatCard label="部屬人數" :value="`${stats.people} 人`" tone="neutral" icon="users" />
        <GStatCard label="課程完成率" :value="`${stats.rate}%`" tone="primary" icon="award" :meta="`${stats.done} / ${stats.applicable} 人次`" />
        <GStatCard label="工安扣分人數" :value="`${stats.deducted} 人`" :tone="stats.deducted ? 'alert' : 'primary'" icon="shield" />
      </div>
      <GCard :title="`${data.year} 年度必上課程完訓名冊`" icon="check-square">
        <GEmpty v-if="!items.length" icon="users" title="沒有符合的部屬" description="對象為碩禾(公司別 DS11 / DS15 / DS36)在職或 11/30 後離職的同仁。" />
        <div v-else class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>部門</th>
                <th>工號</th>
                <th>姓名</th>
                <th v-for="c in data.courses" :key="c.key" :class="{ safety: c.category === 'safety' }" :title="c.name">{{ c.name }}</th>
                <th>扣分</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in items" :key="p.empNo">
                <td>{{ p.deptName ?? p.dept ?? '—' }}</td>
                <td class="mono">{{ p.empNo }}</td>
                <td>{{ p.name ?? '—' }}</td>
                <td v-for="c in data.courses" :key="c.key" class="mark">
                  <GBadge :tone="MARK[statusOf(p, c.key)].tone">{{ MARK[statusOf(p, c.key)].text }}</GBadge>
                </td>
                <td class="mono" :class="{ minus: p.deduction < 0 }">{{ p.deduction }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </GCard>
      <GAlert tone="neutral" icon="info">
        Y 已完成、N 未完成、-- 不適用(當年 9/30 後到職、免訓名單或非適用對象);工安課程(必修)適用卻未完成者每門扣 2 分。規則同「個人資訊 › 年度必上課程」。
      </GAlert>
    </template>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.year {
  width: 120px;
}
.kw {
  flex: 1;
  min-width: 180px;
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
  padding: 8px 10px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  white-space: nowrap;
}
.data-table th {
  font-weight: 600;
  color: var(--text-2);
  background: var(--glass-soft);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.data-table th.safety {
  color: var(--c-danger);
}
.mark {
  text-align: center;
}
.mono {
  font-family: var(--font-mono, monospace);
}
.minus {
  color: var(--c-danger);
  font-weight: 600;
}
</style>
