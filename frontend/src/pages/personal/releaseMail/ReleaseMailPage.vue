<script setup lang="ts">
/**
 * 郵件審核資訊 (對齊 old_PortalSolar ReleaseMailInfo.aspx)
 * 供同仁查詢個人外發郵件被垃圾郵件防護閘道 (Mail Gateway) 攔截、隔離或放行之審核紀錄。
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GStatCard } from '@/ui';

const startDate = ref('2026-09-01');
const endDate = ref('2026-10-02');

interface MailRecord {
  id: string;
  sender: string;
  email: string;
  recipient: string;
  subject: string;
  sentTime: string;
  auditStatus: 'released' | 'quarantine' | 'pending';
  auditLog: string;
}

const mailList: MailRecord[] = [
  {
    id: 'MSG-20261001-9871',
    sender: '蔣佳緯 (V112001)',
    email: 'jiawei.jiang@gigasolar.com.tw',
    recipient: 'vendor-support@supplier.com',
    subject: 'RE: 湖口一廠機房設備年度維護合約規格書附件確認',
    sentTime: '2026/10/01 17:15:22',
    auditStatus: 'released',
    auditLog: '外發郵件含加密壓縮檔，主管李處長已於 17:28 完成安全審核並自動放行。',
  },
  {
    id: 'MSG-20260926-4512',
    sender: '蔣佳緯 (V112001)',
    email: 'jiawei.jiang@gigasolar.com.tw',
    recipient: 'partner@external-lab.org',
    subject: '太陽能網印銀膠測試數據匯總試算表',
    sentTime: '2026/09/26 10:04:18',
    auditStatus: 'released',
    auditLog: '經 DLP 機敏資料過濾器掃描無異常，資安系統自動核准放行。',
  },
  {
    id: 'MSG-20260920-1102',
    sender: '蔣佳緯 (V112001)',
    email: 'jiawei.jiang@gigasolar.com.tw',
    recipient: 'service@thirdparty.com.tw',
    subject: '洽詢防火牆憑證展延報價單',
    sentTime: '2026/09/20 14:40:05',
    auditStatus: 'released',
    auditLog: '常規外部通訊郵件，直接放行投遞。',
  },
];
</script>

<template>
  <div class="release-mail-page stack">
    <GCard class="filter-card glass">
      <div class="filter-row">
        <div class="filter-group">
          <label class="filter-label">寄件日期區間</label>
          <GInput v-model="startDate" type="date" style="width: 170px" />
          <span class="faint">~</span>
          <GInput v-model="endDate" type="date" style="width: 170px" />
          <GButton variant="primary" icon="search">查詢郵件</GButton>
        </div>
        <div class="actions">
          <GButton
            as="a"
            href="http://releasemail.gigasolar.com.tw/Login.aspx"
            target="_blank"
            variant="secondary"
            icon="external"
          >
            登入外寄郵件審核系統
          </GButton>
        </div>
      </div>
    </GCard>

    <div class="grid-stats">
      <GStatCard label="區間外送郵件總數" value="3 件" tone="neutral" icon="mail" meta="全數正常投遞" />
      <GStatCard label="主管審核放行" value="1 件" tone="primary" icon="check" meta="含附件壓縮檔" />
      <GStatCard label="系統自動放行" value="2 件" tone="neutral" icon="zap" meta="常規通訊" />
      <GStatCard label="目前攔截隔離" value="0 件" tone="neutral" icon="shield" meta="無敏感資料阻擋" />
    </div>

    <GCard title="外發郵件安全審核與投遞歷程" icon="shield-check" class="glass">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>寄件時間 / 編號</th>
              <th>收件人與主旨</th>
              <th>審核狀態</th>
              <th>郵件稽核安全日誌 (DLP / Audit Log)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="mail in mailList" :key="mail.id">
              <td>
                <div class="mono font-bold">{{ mail.sentTime }}</div>
                <div class="mono small faint">{{ mail.id }}</div>
              </td>
              <td>
                <div class="small faint mono">{{ mail.recipient }}</div>
                <strong>{{ mail.subject }}</strong>
              </td>
              <td>
                <GBadge :tone="mail.auditStatus === 'released' ? 'primary' : 'alert'">
                  {{ mail.auditStatus === 'released' ? '已審核放行' : '隔離審核中' }}
                </GBadge>
              </td>
              <td>
                <div class="audit-log">{{ mail.auditLog }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>

    <GAlert tone="neutral" icon="info">
      依集團資訊安全政策，所有包含副檔名（ZIP、RAR、EXE、DLL）或涉及客戶營業秘密之外部郵件，將自動暫存於隔離區並發送審核通知至直屬主管信箱。主管簽核放行後，系統於 5 分鐘內自動投遞。
    </GAlert>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.filter-group {
  display: flex;
  align-items: center;
  gap: 10px;
}
.filter-label {
  font-weight: 600;
  font-size: var(--fs-sm);
  color: var(--text-2);
}
.grid-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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
.audit-log {
  font-size: var(--fs-xs);
  color: var(--text-2);
  line-height: 1.5;
}
</style>
