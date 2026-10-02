<script setup lang="ts">
/**
 * 部屬出勤異常狀況與警示清冊 (對齊 old_PortalSolar HRAnalysisChart3.aspx Tab2)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GModal } from '@/ui';

interface AbnormalEmployee {
  empNo: string;
  name: string;
  dept: string;
  title: string;
  lateCount: number;
  earlyCount: number;
  missedCardCount: number;
  absentCount: number;
  warningLevel: '正常' | '注意' | '高風險警戒';
  interviewStatus: '尚未面談' | '已完成輔導面談';
}

const list = ref<AbnormalEmployee[]>([
  {
    empNo: 'V113012',
    name: '陳建安',
    dept: '製造二課',
    title: '製程操作員',
    lateCount: 4,
    earlyCount: 0,
    missedCardCount: 3,
    absentCount: 0,
    warningLevel: '高風險警戒',
    interviewStatus: '尚未面談',
  },
  {
    empNo: 'V113045',
    name: '周志成',
    dept: '倉儲物流課',
    title: '倉儲專員',
    lateCount: 3,
    earlyCount: 1,
    missedCardCount: 2,
    absentCount: 0,
    warningLevel: '注意',
    interviewStatus: '尚未面談',
  },
  {
    empNo: 'V112089',
    name: '林雅婷',
    dept: '業務營業處',
    title: '業務助理',
    lateCount: 1,
    earlyCount: 0,
    missedCardCount: 2,
    absentCount: 0,
    warningLevel: '注意',
    interviewStatus: '已完成輔導面談',
  },
]);

const interviewModal = ref(false);
const activeEmp = ref<AbnormalEmployee | null>(null);

function openInterview(emp: AbnormalEmployee) {
  activeEmp.value = emp;
  interviewModal.value = true;
}

function confirmInterview() {
  if (activeEmp.value) {
    activeEmp.value.interviewStatus = '已完成輔導面談';
  }
  interviewModal.value = false;
}
</script>

<template>
  <div class="attendance-abnormal-tab stack">
    <!-- 警示統計指標 -->
    <div class="stats-grid">
      <GCard class="glass stat-card">
        <span class="faint small">遲到累積超過 3 次名單</span>
        <strong class="stat-num mono text-danger">2 名</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">未刷卡忘刷超過 2 次名單</span>
        <strong class="stat-num mono text-warning">3 名</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">無故曠職同仁人數</span>
        <strong class="stat-num mono text-healthy">0 名</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">待安排關懷面談人數</span>
        <strong class="stat-num mono text-primary">2 名</strong>
      </GCard>
    </div>

    <!-- 異常清冊表格 -->
    <GCard class="glass table-wrapper">
      <div class="table-header">
        <strong class="font-bold">部門同仁出勤異常連續警示名冊</strong>
        <span class="faint small">統計期間：當月份累計</span>
      </div>
      <table class="abnormal-table">
        <thead>
          <tr>
            <th>工號</th>
            <th>姓名</th>
            <th>所屬部門</th>
            <th>職稱</th>
            <th class="text-center">遲到次數</th>
            <th class="text-center">早退次數</th>
            <th class="text-center">缺卡未刷</th>
            <th class="text-center">曠職紀錄</th>
            <th class="text-center">風險等級</th>
            <th class="text-center">面談輔導狀態</th>
            <th class="text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="emp in list" :key="emp.empNo">
            <td class="mono font-bold">{{ emp.empNo }}</td>
            <td class="font-bold">{{ emp.name }}</td>
            <td>{{ emp.dept }}</td>
            <td class="small faint">{{ emp.title }}</td>
            <td class="mono text-center" :class="{ 'text-danger font-bold': emp.lateCount >= 3 }">
              {{ emp.lateCount }} 次
            </td>
            <td class="mono text-center">{{ emp.earlyCount }} 次</td>
            <td class="mono text-center" :class="{ 'text-warning font-bold': emp.missedCardCount >= 2 }">
              {{ emp.missedCardCount }} 次
            </td>
            <td class="mono text-center">{{ emp.absentCount }} 次</td>
            <td class="text-center">
              <GBadge :tone="emp.warningLevel === '高風險警戒' ? 'danger' : 'warning'">
                {{ emp.warningLevel }}
              </GBadge>
            </td>
            <td class="text-center">
              <GBadge :tone="emp.interviewStatus === '已完成輔導面談' ? 'healthy' : 'neutral'">
                {{ emp.interviewStatus }}
              </GBadge>
            </td>
            <td class="text-center">
              <GButton
                size="sm"
                :tone="emp.interviewStatus === '尚未面談' ? 'primary' : 'secondary'"
                @click="openInterview(emp)"
              >
                {{ emp.interviewStatus === '尚未面談' ? '安排面談' : '檢視紀錄' }}
              </GButton>
            </td>
          </tr>
        </tbody>
      </table>
    </GCard>

    <GAlert tone="warning" icon="alert">
      依工作規則規定，單月遲到累計滿 3 次者，主管應落實工作關懷與面談輔導；單月曠職累積達 3 日或一年內達 6 日者，公司得依法終止勞動契約。
    </GAlert>

    <!-- 面談紀錄 Modal -->
    <GModal v-model="interviewModal" :title="`主管出勤輔導面談 - ${activeEmp?.name ?? ''}`" width="540px">
      <div v-if="activeEmp" class="interview-stack">
        <div class="emp-summary">
          <div><strong>部屬：</strong>{{ activeEmp.name }} ({{ activeEmp.empNo }})</div>
          <div><strong>部門：</strong>{{ activeEmp.dept }} / {{ activeEmp.title }}</div>
          <div>
            <strong>當月異常：</strong>
            遲到 {{ activeEmp.lateCount }} 次、缺卡 {{ activeEmp.missedCardCount }} 次
          </div>
        </div>
        <div class="form-sec">
          <label class="form-label font-bold">主管面談輔導紀錄與改善約定事項：</label>
          <textarea
            rows="4"
            class="interview-textarea"
            placeholder="請記錄面談原因（例如交通通勤困難、家庭突發事務）、改善輔導建議與後續追蹤約定..."
          />
        </div>
      </div>
      <template #footer>
        <GButton variant="secondary" @click="interviewModal = false">取消</GButton>
        <GButton tone="primary" @click="confirmInterview">確認記錄並送存人資</GButton>
      </template>
    </GModal>
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
.abnormal-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.abnormal-table th, .abnormal-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}
.abnormal-table th {
  background: var(--color-surface-hover);
  text-align: left;
  font-weight: 600;
}
.text-center { text-align: center; }
.font-bold { font-weight: 600; }
.interview-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.emp-summary {
  padding: 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
}
.form-sec {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-label {
  font-size: 13px;
}
.interview-textarea {
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
}
</style>
