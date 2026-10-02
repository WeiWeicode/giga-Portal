<script setup lang="ts">
/**
 * 部門全員必修工安課程追蹤 (對齊 old_PortalSolar AnnualCurse.aspx)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GSelect } from '@/ui';

interface SafetyStaff {
  empNo: string;
  name: string;
  title: string;
  dept: string;
  completedCount: number;
  totalCourses: number;
  unfinishedList: string[];
  status: '完全合格' | '即將到期' | '進度落後';
}

const staffList = ref<SafetyStaff[]>([
  {
    empNo: 'V112001',
    name: '王大明',
    title: '資深系統工程師',
    dept: '資訊服務部',
    completedCount: 12,
    totalCourses: 12,
    unfinishedList: [],
    status: '完全合格',
  },
  {
    empNo: 'S180002',
    name: '鄭智寬',
    title: '資訊工程師',
    dept: '資訊服務部',
    completedCount: 10,
    totalCourses: 12,
    unfinishedList: ['急救常識與 AED 操作實務', '化學品危害通識'],
    status: '即將到期',
  },
  {
    empNo: 'V113045',
    name: '周志成',
    title: '倉儲專員',
    dept: '倉儲物流課',
    completedCount: 6,
    totalCourses: 12,
    unfinishedList: ['消防避難演練數位課程', '堆高機安全作業要點', '人因危害預防', '化學品危害通識', '性騷擾防治法遵', '資訊安全意識'],
    status: '進度落後',
  },
  {
    empNo: 'V112045',
    name: '黃宏達',
    title: '製造課長',
    dept: '製造一課',
    completedCount: 12,
    totalCourses: 12,
    unfinishedList: [],
    status: '完全合格',
  },
]);

const deptFilter = ref('');

const filteredStaff = computed(() => {
  return staffList.value.filter((s) => !deptFilter.value || s.dept === deptFilter.value);
});
</script>

<template>
  <div class="safety-courses-page stack">
    <!-- 達成率指標卡 -->
    <div class="stats-grid">
      <GCard class="glass stat-card">
        <span class="faint small">部門全員應訓人數</span>
        <strong class="stat-num mono text-primary">4 位</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">全數合格達標人數</span>
        <strong class="stat-num mono text-healthy">2 位</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">待補訓催課名單</span>
        <strong class="stat-num mono text-warning">2 位</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">部門工安課程總達成率</span>
        <strong class="stat-num mono text-healthy">83.3%</strong>
      </GCard>
    </div>

    <!-- 篩選列 -->
    <GCard class="glass filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <label class="filter-label">部門篩選</label>
          <GSelect
            v-model="deptFilter"
            :options="[
              { label: '全部部門', value: '' },
              { label: '資訊服務部', value: '資訊服務部' },
              { label: '倉儲物流課', value: '倉儲物流課' },
              { label: '製造一課', value: '製造一課' },
            ]"
          />
        </div>
      </div>
    </GCard>

    <!-- 部門全員名冊表格 -->
    <GCard class="glass table-wrapper">
      <table class="safety-table">
        <thead>
          <tr>
            <th>工號</th>
            <th>姓名</th>
            <th>職稱</th>
            <th>所屬部門</th>
            <th class="text-center">修畢門數</th>
            <th class="text-center">達成進度</th>
            <th>尚未完訓課程清單</th>
            <th class="text-center">受訓狀態</th>
            <th class="text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in filteredStaff" :key="s.empNo">
            <td class="mono font-bold">{{ s.empNo }}</td>
            <td class="font-bold">{{ s.name }}</td>
            <td class="small faint">{{ s.title }}</td>
            <td>{{ s.dept }}</td>
            <td class="mono text-center font-bold text-primary">{{ s.completedCount }} / {{ s.totalCourses }} 門</td>
            <td class="mono text-center">{{ Math.round((s.completedCount / s.totalCourses) * 100) }}%</td>
            <td class="small">
              <span v-if="s.unfinishedList.length === 0" class="text-healthy font-bold">✓ 全部 12 門已修畢</span>
              <span v-else class="text-danger">{{ s.unfinishedList.join('、') }}</span>
            </td>
            <td class="text-center">
              <GBadge :tone="s.status === '完全合格' ? 'healthy' : s.status === '即將到期' ? 'warning' : 'danger'">
                {{ s.status }}
              </GBadge>
            </td>
            <td class="text-center">
              <GButton size="sm" :disabled="s.unfinishedList.length === 0" variant="secondary">
                催課提醒
              </GButton>
            </td>
          </tr>
        </tbody>
      </table>
    </GCard>

    <GAlert tone="neutral" icon="info">
      依職業安全衛生教育訓練規則第 17 條規定，在職員工每年應定期接受至少 3 小時之一般安全衛生在職教育訓練。未達標同仁請主管敦促其於 11 月 30 日前至 E-Learning 線上平台修畢。
    </GAlert>
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
}
.filter-item {
  width: 220px;
}
.filter-label {
  display: block;
  font-size: 13px;
  color: var(--color-faint);
  margin-bottom: 4px;
}
.table-wrapper {
  overflow-x: auto;
  padding: 0;
}
.safety-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.safety-table th, .safety-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}
.safety-table th {
  background: var(--color-surface-hover);
  text-align: left;
  font-weight: 600;
}
.text-center { text-align: center; }
.font-bold { font-weight: 600; }
</style>
