<script setup lang="ts">
/**
 * BPM 簽核資訊 - 待簽核分頁 (對齊 old_PortalSolar EFInfo.aspx Tab1)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard } from '@/ui';

interface BpmItem {
  id: string;
  company: string;
  unit: string;
  formName: string;
  subject: string;
  createTime: string;
  currentStep: string;
  stepUser: string;
  status: string;
  link: string;
}

const pendingList: BpmItem[] = [
  {
    id: 'BPM-20261001-0023',
    company: '碩禾電子材料',
    unit: 'V1420 資訊服務部',
    formName: '請假申請單',
    subject: '同仁事假 8 小時申請 (出差後補休折抵)',
    createTime: '2026/10/01 14:20',
    currentStep: '部門主管審核',
    stepUser: '蔣佳緯 (V112001)',
    status: '簽核中',
    link: 'http://10.10.130.190:9090/NaNaWeb/',
  },
  {
    id: 'BPM-20260930-0081',
    company: '碩禾電子材料',
    unit: 'V1210 廠務工程部',
    formName: '公務車預約借用單',
    subject: '公務車預約：湖口至桃園觀音廠公務視察',
    createTime: '2026/09/30 09:15',
    currentStep: '主管核決',
    stepUser: '蔣佳緯 (V112001)',
    status: '簽核中',
    link: 'http://10.10.130.190:9090/NaNaWeb/',
  },
  {
    id: 'BPM-20260928-0105',
    company: '國碩科技',
    unit: 'G1100 總管理處',
    formName: '電子簽核工作聯繫單',
    subject: '集團單一入口網 GigaNexus 測試環境切換會簽',
    createTime: '2026/09/28 16:40',
    currentStep: '協同會簽',
    stepUser: '蔣佳緯 (V112001)',
    status: '簽核中',
    link: 'http://10.10.130.190:9090/NaNaWeb/',
  },
];
</script>

<template>
  <div class="ef-pending-tab stack">
    <GCard title="待我簽核表單清單" icon="inbox" class="glass">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>流程編號 / 提出時間</th>
              <th>公司 / 提出單位</th>
              <th>表單名稱與主旨</th>
              <th>當前關卡 / 審核人</th>
              <th>狀態</th>
              <th class="text-center">簽核入口</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in pendingList" :key="item.id">
              <td>
                <div class="mono font-bold">{{ item.id }}</div>
                <div class="small faint mono">{{ item.createTime }}</div>
              </td>
              <td>
                <div>{{ item.company }}</div>
                <div class="small faint">{{ item.unit }}</div>
              </td>
              <td>
                <strong>{{ item.formName }}</strong>
                <div class="small text-secondary">{{ item.subject }}</div>
              </td>
              <td>
                <div><GBadge tone="storage">{{ item.currentStep }}</GBadge></div>
                <div class="small faint">{{ item.stepUser }}</div>
              </td>
              <td><GBadge tone="primary">{{ item.status }}</GBadge></td>
              <td class="text-center">
                <GButton
                  as="a"
                  :href="item.link"
                  target="_blank"
                  variant="primary"
                  size="small"
                  icon="external"
                >
                  前往簽核
                </GButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>

    <GAlert tone="neutral" icon="info">
      本資料即時連線集團 BPM (NaNaWeb / EasyFlow) 簽核引擎。點擊「前往簽核」將於新分頁開啟 BPM 批核介面。
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
.text-secondary {
  color: var(--text-2);
}
</style>
