<script setup lang="ts">
/**
 * 個人資產移轉記錄分頁 (對齊 old_PortalSolar PersonalPropertyInfo.aspx DataModal / GridView2)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard } from '@/ui';

interface TransferRecord {
  transferNo: string;
  transferDate: string;
  applicant: string;
  applicantDept: string;
  assetNo: string;
  assetName: string;
  oldCustodian: string;
  newCustodian: string;
  status: string;
}

const transfers: TransferRecord[] = [
  {
    transferNo: 'FAS-2023-0108',
    transferDate: '2023/05/10',
    applicant: '張管理員 (V100012)',
    applicantDept: '總務組',
    assetNo: 'FA20230045',
    assetName: '筆記型電腦 ThinkPad X1 Carbon Gen 11',
    oldCustodian: '總務倉庫庫存',
    newCustodian: '蔣佳緯 (V112001) / 資訊服務部',
    status: '已結案生效',
  },
  {
    transferNo: 'FAS-2023-0112',
    transferDate: '2023/05/15',
    applicant: '張管理員 (V100012)',
    applicantDept: '總務組',
    assetNo: 'FA20230088',
    assetName: '27 吋 4K 專業螢幕 Dell U2723QE',
    oldCustodian: '總務倉庫庫存',
    newCustodian: '蔣佳緯 (V112001) / 資訊服務部',
    status: '已結案生效',
  },
  {
    transferNo: 'FAS-2021-0045',
    transferDate: '2021/04/15',
    applicant: '人資總務組',
    applicantDept: '人資部',
    assetNo: 'FA20210312',
    assetName: '人體工學網布高背辦公椅',
    oldCustodian: '辦公區公用配置',
    newCustodian: '蔣佳緯 (V112001) / 資訊服務部',
    status: '已結案生效',
  },
];
</script>

<template>
  <div class="property-transfer-tab stack">
    <GCard title="名下資產移轉與異動單據歷程" icon="repeat" class="glass">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>移轉單號 / 異動日期</th>
              <th>財產編號與設備名稱</th>
              <th>申請人 / 部門</th>
              <th>原保管人 (舊)</th>
              <th>承接保管人 (新)</th>
              <th>異動狀態</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in transfers" :key="t.transferNo">
              <td>
                <div class="mono font-bold">{{ t.transferNo }}</div>
                <div class="mono small faint">{{ t.transferDate }}</div>
              </td>
              <td>
                <div class="mono text-primary font-bold">{{ t.assetNo }}</div>
                <div>{{ t.assetName }}</div>
              </td>
              <td>
                <div>{{ t.applicant }}</div>
                <div class="small faint">{{ t.applicantDept }}</div>
              </td>
              <td>{{ t.oldCustodian }}</td>
              <td><strong>{{ t.newCustodian }}</strong></td>
              <td><GBadge tone="primary">{{ t.status }}</GBadge></td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>

    <GAlert tone="neutral" icon="info">
      資產移轉經雙方保管人確認與單位主管簽核完成後，總務資產帳務將自動同步更新。如需辦理新設備移轉請至「總務專區 -> 申請專區」提出申請。
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
.mono {
  font-family: var(--font-mono, monospace);
}
.font-bold {
  font-weight: 700;
}
.text-primary {
  color: var(--c-primary);
}
</style>
