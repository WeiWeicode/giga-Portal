<script setup lang="ts">
/**
 * 我送出的單據分頁 (表單與簽核)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard } from '@/ui';

interface SentItem {
  id: string;
  formType: string;
  submitTime: string;
  subject: string;
  currentStep: string;
  currentSigner: string;
  status: string;
}

const sentList: SentItem[] = [
  {
    id: 'EF-20261002-0008',
    formType: 'IT 權限異動申請單',
    submitTime: '2026/10/02 08:30',
    subject: '申請 GitLab Runner 測試主機 WSL root 權限授權',
    currentStep: '處長核決',
    currentSigner: '李處長',
    status: '簽核中',
  },
  {
    id: 'EF-20260925-0042',
    formType: '公務費用報支申請單',
    submitTime: '2026/09/25 11:20',
    subject: '2026 年 Q3 雲端開發套件維護合約年費報支',
    currentStep: '財務審核',
    currentSigner: '張會計',
    status: '簽核中',
  },
  {
    id: 'EF-20260915-0089',
    formType: '未刷卡證明單',
    submitTime: '2026/09/15 09:00',
    subject: '09/14 下班忘刷卡補卡申報',
    currentStep: '流程結案',
    currentSigner: '系統自動結案',
    status: '已結案',
  },
];
</script>

<template>
  <div class="approval-sent-tab stack">
    <GCard title="我發起的申請單據進度" icon="send" class="glass">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>申請單號 / 送審時間</th>
              <th>表單類型</th>
              <th>主旨內容</th>
              <th>目前關卡</th>
              <th>當前審核人</th>
              <th>單據狀態</th>
              <th class="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in sentList" :key="item.id">
              <td>
                <div class="mono font-bold">{{ item.id }}</div>
                <div class="small faint mono">{{ item.submitTime }}</div>
              </td>
              <td><GBadge tone="storage">{{ item.formType }}</GBadge></td>
              <td><strong>{{ item.subject }}</strong></td>
              <td><GBadge tone="neutral">{{ item.currentStep }}</GBadge></td>
              <td>{{ item.currentSigner }}</td>
              <td>
                <GBadge :tone="item.status === '已結案' ? 'primary' : 'alert'">
                  {{ item.status }}
                </GBadge>
              </td>
              <td class="text-center">
                <GButton
                  v-if="item.status !== '已結案'"
                  variant="ghost"
                  size="small"
                  icon="bell"
                >
                  催簽通知
                </GButton>
                <span v-else class="small faint">已完成</span>
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
