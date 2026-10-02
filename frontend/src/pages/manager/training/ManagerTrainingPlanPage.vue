<script setup lang="ts">
/**
 * 年度教育訓練計畫 (對齊 old_PortalSolar Ellessionplan.aspx)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GModal, GSelect } from '@/ui';

interface TrainingCourse {
  id: string;
  name: string;
  category: '專業技術' | '品質管理' | '工安環保' | '管理領導';
  month: string;
  hours: number;
  capacity: number;
  instructor: string;
  completionRate: string;
  status: '已結案' | '開課中' | '籌劃中';
}

const courses = ref<TrainingCourse[]>([
  {
    id: 'TR-2026-001',
    name: '次世代 TOPCon 導電漿料配方流變特性分析實務',
    category: '專業技術',
    month: '2026-03',
    hours: 8,
    capacity: 25,
    instructor: '黃副總 / 研發資深專家',
    completionRate: '100% (25/25人)',
    status: '已結案',
  },
  {
    id: 'TR-2026-002',
    name: 'ISO 14064-1 企業溫室氣體碳盤查實務與查證要點',
    category: '工安環保',
    month: '2026-05',
    hours: 12,
    capacity: 30,
    instructor: '外部專家 (SGS 顧問團隊)',
    completionRate: '100% (30/30人)',
    status: '已結案',
  },
  {
    id: 'TR-2026-003',
    name: '精實製造 (Lean Manufacturing) 與 8D 問題分析改善',
    category: '品質管理',
    month: '2026-08',
    hours: 16,
    capacity: 35,
    instructor: '製造處 資深課長',
    completionRate: '94% (33/35人)',
    status: '已結案',
  },
  {
    id: 'TR-2026-004',
    name: '中階管理職領導力工作坊：目標管理與部屬激勵',
    category: '管理領導',
    month: '2026-10',
    hours: 8,
    capacity: 20,
    instructor: '企管顧問名師',
    completionRate: '報名中 (18/20人)',
    status: '開課中',
  },
  {
    id: 'TR-2026-005',
    name: '工廠自動化 PLC 控制與工業物聯網 (IIoT) 數據採集',
    category: '專業技術',
    month: '2026-11',
    hours: 12,
    capacity: 20,
    instructor: '資訊部 系統架構師',
    completionRate: '籌劃中',
    status: '籌劃中',
  },
]);

const selectedYear = ref('2026');
const catFilter = ref('');

const filteredCourses = computed(() => {
  return courses.value.filter((c) => !catFilter.value || c.category === catFilter.value);
});
</script>

<template>
  <div class="training-plan-page stack">
    <!-- 指標統計卡 -->
    <div class="stats-grid">
      <GCard class="glass stat-card">
        <span class="faint small">年度預計總開課門數</span>
        <strong class="stat-num mono text-primary">5 門</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">預計總受訓人次</span>
        <strong class="stat-num mono">130 人次</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">已完成結案課程</span>
        <strong class="stat-num mono text-healthy">3 門</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">年度培訓計畫執行達成率</span>
        <strong class="stat-num mono text-healthy">75%</strong>
      </GCard>
    </div>

    <!-- 篩選列 -->
    <GCard class="glass filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <label class="filter-label">計畫年度</label>
          <GSelect
            v-model="selectedYear"
            :options="[
              { label: '2026 年度', value: '2026' },
              { label: '2025 年度', value: '2025' },
            ]"
          />
        </div>
        <div class="filter-item">
          <label class="filter-label">課程類別</label>
          <GSelect
            v-model="catFilter"
            :options="[
              { label: '全部類別', value: '' },
              { label: '專業技術', value: '專業技術' },
              { label: '品質管理', value: '品質管理' },
              { label: '工安環保', value: '工安環保' },
              { label: '管理領導', value: '管理領導' },
            ]"
          />
        </div>
      </div>
    </GCard>

    <!-- 訓練計畫表格 -->
    <GCard class="glass table-wrapper">
      <div class="table-header">
        <strong class="font-bold">2026 年度部門教育訓練開課計畫一覽表</strong>
        <span class="faint small">人資部核准案號：HR-EDU-2026-003</span>
      </div>
      <table class="plan-table">
        <thead>
          <tr>
            <th>課程代號</th>
            <th>課程主題名稱</th>
            <th>分類</th>
            <th class="text-center">開課月份</th>
            <th class="text-right">培訓時數</th>
            <th class="text-right">名額</th>
            <th>授課講師</th>
            <th>受訓進度 / 結案達成</th>
            <th class="text-center">狀態</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in filteredCourses" :key="c.id">
            <td class="mono font-bold">{{ c.id }}</td>
            <td class="font-bold">{{ c.name }}</td>
            <td>
              <GBadge tone="neutral">{{ c.category }}</GBadge>
            </td>
            <td class="mono text-center">{{ c.month }}</td>
            <td class="mono text-right">{{ c.hours }} h</td>
            <td class="mono text-right">{{ c.capacity }} 名</td>
            <td class="small">{{ c.instructor }}</td>
            <td class="small font-bold text-primary">{{ c.completionRate }}</td>
            <td class="text-center">
              <GBadge :tone="c.status === '已結案' ? 'healthy' : c.status === '開課中' ? 'warning' : 'storage'">
                {{ c.status }}
              </GBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </GCard>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 14px;
}
.stat-card {
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-num {
  font-size: 22px;
}
.text-healthy { color: var(--color-healthy); }
.filter-card {
  padding: 12px 16px;
}
.filter-row {
  display: flex;
  gap: 16px;
}
.filter-item {
  width: 200px;
}
.filter-label {
  display: block;
  font-size: 13px;
  color: var(--color-faint);
  margin-bottom: 4px;
}
.table-wrapper {
  overflow-x: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.plan-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.plan-table th, .plan-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}
.plan-table th {
  background: var(--color-surface-hover);
  text-align: left;
  font-weight: 600;
}
.text-center { text-align: center; }
.text-right { text-align: right; }
.font-bold { font-weight: 600; }
</style>
