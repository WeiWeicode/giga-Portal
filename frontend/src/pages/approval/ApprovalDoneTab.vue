<script setup lang="ts">
/**
 * 已簽核紀錄分頁 (表單與簽核)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard } from '@/ui';

interface DoneItem {
  id: string;
  formType: string;
  applicant: string;
  dept: string;
  signTime: string;
  decision: 'approved' | 'rejected';
  comment: string;
}

const doneList: DoneItem[] = [
  {
    id: 'EF-20260928-0051',
    formType: '請假申請單',
    applicant: '張小芬 (V113009)',
    dept: '品保課',
    signTime: '2026/09/28 15:30',
    decision: 'approved',
    comment: '同意核准。',
  },
  {
    id: 'EF-20260925-0102',
    formType: '加班申請單',
    applicant: '周志強 (V111054)',
    dept: '資訊服務部',
    signTime: '2026/09/25 18:00',
    decision: 'approved',
    comment: '核准補休折抵。',
  },
  {
    id: 'EF-20260918-0033',
    formType: '工作聯繫會簽單',
    applicant: '廖家豪 (V110021)',
    dept: '採購課',
    signTime: '2026/09/18 11:20',
    decision: 'approved',
    comment: '會簽完畢。',
  },
];
</script>

<template>
  <div class="approval-done-tab stack">
    <GCard title="歷史已簽審單據清冊" icon="check-circle-2" class="glass">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>單號</th>
              <th>表單類型</th>
              <th>申請人 / 部門</th>
              <th>簽核時間</th>
              <th>審定結果</th>
              <th>核簽意見與備註</th>
              <th class="text-center">單據檢視</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in doneList" :key="item.id">
              <td class="mono font-bold">{{ item.id }}</td>
              <td><GBadge tone="storage">{{ item.formType }}</GBadge></td>
              <td>
                <strong>{{ item.applicant }}</strong>
                <div class="small faint">{{ item.dept }}</div>
              </td>
              <td class="mono">{{ item.signTime }}</td>
              <td>
                <GBadge :tone="item.decision === 'approved' ? 'primary' : 'danger'">
                  {{ item.decision === 'approved' ? '核准' : '退回' }}
                </GBadge>
              </td>
              <td>{{ item.comment }}</td>
              <td class="text-center">
                <GButton variant="ghost" size="small" icon="file-text">查看內容</GButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
}
.data-table th {
  font-weight: 600;
  color: var(--text-2);
  background: var(--glass-soft);
  text-align: left;
}
.text-center {
  text-align: center;
}
.mono {
  font-family: var(--font-mono, monospace);
}
.font-bold {
  font-weight: 700;
}
</style>
