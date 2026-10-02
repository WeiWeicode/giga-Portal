<script setup lang="ts">
/**
 * 出勤異常明細 (對齊 old_PortalSolar apyr520.aspx)
 * 供員工即時掌握當月缺卡、遲到、早退或出勤異常清單，並依規定期限補請假或填具證明單。
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GStatCard } from '@/ui';

const queryDate = ref('2026-09');

interface AbnormalItem {
  empNo: string;
  name: string;
  date: string;
  shift: string;
  holidayType: string;
  punchTime: string;
  reason: string;
  status: 'pending' | 'resolved';
}

const list: AbnormalItem[] = [
  {
    empNo: 'V112001',
    name: '蔣佳緯',
    date: '2026/09/16',
    shift: '常日班 A (08:30-17:30)',
    holidayType: '平日',
    punchTime: '未刷卡 / 17:35:12',
    reason: '上班未刷卡 (忘刷卡)',
    status: 'resolved',
  },
  {
    empNo: 'V112001',
    name: '蔣佳緯',
    date: '2026/09/24',
    shift: '常日班 A (08:30-17:30)',
    holidayType: '平日',
    punchTime: '08:42:15 / 17:38:00',
    reason: '遲到 (12 分鐘)',
    status: 'pending',
  },
];
</script>

<template>
  <div class="abnormal-att-page stack">
    <GCard class="filter-card glass">
      <div class="filter-row">
        <div class="filter-group">
          <label class="filter-label">查詢年月</label>
          <GInput v-model="queryDate" type="month" style="width: 180px" />
          <GButton variant="primary" icon="search">查詢異常紀錄</GButton>
        </div>
        <div class="meta-info">
          <span class="faint small">工號：<strong class="mono">V112001</strong> 蔣佳緯</span>
        </div>
      </div>
    </GCard>

    <div class="grid-stats">
      <GStatCard label="本月出勤異常總計" value="2 筆" tone="neutral" icon="alert" meta="忘刷卡 1 次、遲到 1 次" />
      <GStatCard label="待處理筆數" value="1 筆" tone="danger" icon="alert-circle" meta="需於 2 日內提出補卡或銷假" />
      <GStatCard label="已核准銷假" value="1 筆" tone="primary" icon="check" meta="證明單已簽核結案" />
    </div>

    <GCard title="出勤異常明細清單" icon="alert-triangle" class="glass">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>異常日期</th>
              <th>工號 / 姓名</th>
              <th>排定班別</th>
              <th>假日別</th>
              <th>實際刷卡時間 (上/下)</th>
              <th>異常原因</th>
              <th>處理狀態</th>
              <th class="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in list" :key="item.date">
              <td class="mono font-bold">{{ item.date }}</td>
              <td>{{ item.empNo }} · {{ item.name }}</td>
              <td>{{ item.shift }}</td>
              <td><GBadge tone="neutral">{{ item.holidayType }}</GBadge></td>
              <td class="mono">{{ item.punchTime }}</td>
              <td>
                <span class="text-danger font-bold">{{ item.reason }}</span>
              </td>
              <td>
                <GBadge :tone="item.status === 'resolved' ? 'primary' : 'danger'">
                  {{ item.status === 'resolved' ? '已補單結案' : '待補登處理' }}
                </GBadge>
              </td>
              <td class="text-center">
                <GButton v-if="item.status === 'pending'" variant="secondary" size="small" icon="edit">
                  填寫證明單
                </GButton>
                <span v-else class="faint small">已完成</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>

    <GCard title="出勤異常狀況處理辦法說明" icon="info" class="glass">
      <div class="rules-block stack">
        <p><strong>1. 缺勤狀況：</strong>如有缺勤狀況，請於缺勤翌日完成登錄請假程序，並至 BPM 系統繳交請假相關證明。</p>
        <p><strong>2. 未刷卡證明：</strong>如有上下班未刷卡時間，請線上填寫「未刷卡證明單」並經單位主管簽名核准，轉交人事考勤單位。</p>
        <p><strong>3. 加班單核銷：</strong>如有加班時間未填寫加班單，請確認加班單是否已跑完核決流程，逾期者請以工作聯繫單專案補申請加班。</p>
        <GAlert tone="danger" icon="alert-circle">
          上述出勤異常，請務必於缺勤及異常狀況發生的 <strong>兩日內</strong> 完成回覆或補件處理。逾期未回覆者將依集團「員工出勤管理辦法」辦理。
        </GAlert>
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
.text-center {
  text-align: center;
}
.mono {
  font-family: var(--font-mono, monospace);
}
.font-bold {
  font-weight: 700;
}
.text-danger {
  color: var(--c-danger);
}
.rules-block p {
  margin: 0;
  font-size: var(--fs-sm);
  line-height: 1.6;
}
</style>
