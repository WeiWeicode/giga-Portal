<script setup lang="ts">
/**
 * BPM 簽核資訊 - 未結案分頁 (對齊 old_PortalSolar EFInfo.aspx Tab2)
 * 由本人發起但仍在各級關卡審核中之申請單據進度追蹤。
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard } from '@/ui';

interface UnclosedItem {
  id: string;
  formName: string;
  subject: string;
  submitTime: string;
  currentStep: string;
  currentSigner: string;
  progress: string;
  link: string;
}

const unclosedList: UnclosedItem[] = [
  {
    id: 'BPM-20261002-0008',
    formName: 'IT 權限異動申請單',
    subject: '申請 GitLab Runner 測試主機 WSL root 權限授權',
    submitTime: '2026/10/02 08:30',
    currentStep: '處長核決',
    currentSigner: '李處長 (V100005)',
    progress: '關卡 2 / 3',
    link: 'http://10.10.130.190:9090/NaNaWeb/',
  },
  {
    id: 'BPM-20260925-0042',
    formName: '公務費用報支申請單',
    subject: '2026 年 Q3 雲端開發套件維護合約年費報支',
    submitTime: '2026/09/25 11:20',
    currentStep: '財務審核',
    currentSigner: '張會計 (V102011)',
    progress: '關卡 3 / 4',
    link: 'http://10.10.130.190:9090/NaNaWeb/',
  },
];
</script>

<template>
  <div class="ef-unclosed-tab stack">
    <GCard title="我發起的未結案申請單" icon="file-clock" class="glass">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>申請單號 / 送審時間</th>
              <th>表單類型</th>
              <th>主旨內容</th>
              <th>目前關卡與簽核人</th>
              <th>簽核進度</th>
              <th class="text-center">流程追蹤</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in unclosedList" :key="item.id">
              <td>
                <div class="mono font-bold">{{ item.id }}</div>
                <div class="small faint mono">{{ item.submitTime }}</div>
              </td>
              <td><GBadge tone="storage">{{ item.formName }}</GBadge></td>
              <td>
                <strong>{{ item.subject }}</strong>
              </td>
              <td>
                <div class="font-bold">{{ item.currentStep }}</div>
                <div class="small faint">{{ item.currentSigner }}</div>
              </td>
              <td><GBadge tone="neutral">{{ item.progress }}</GBadge></td>
              <td class="text-center">
                <GButton
                  as="a"
                  :href="item.link"
                  target="_blank"
                  variant="secondary"
                  size="small"
                  icon="external"
                >
                  流程明細
                </GButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>

    <GAlert tone="neutral" icon="info">
      表單流程經全體關卡核准完成後將自動歸檔為「已結案」，並同步移至「表單與簽核 -> 歷史紀錄」。如欲催簽可於 BPM 系統中點擊「催簽通知」。
    </GAlert>
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
