<script setup lang="ts">
/**
 * 出勤時數異常回報 (對齊 old_PortalSolar apyr520_2.aspx)
 * 供同仁針對下班後滯留廠區或延遲刷卡原因進行線上勾選分類回報，由主管進行核閱。
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GSelect } from '@/ui';

const queryDate = ref('2026-09');

interface RespondItem {
  id: string;
  date: string;
  shift: string;
  punchOut: string;
  lagDuration: string;
  selectedReason: string;
  subReason: string;
  customNote: string;
  checked: boolean;
}

const list = ref<RespondItem[]>([
  {
    id: '1',
    date: '2026/09/22',
    shift: '常日班 (17:30 應下班)',
    punchOut: '19:45:10',
    lagDuration: '2 小時 15 分',
    selectedReason: '因私事滯留廠區',
    subReason: '吃晚餐',
    customNote: '',
    checked: true,
  },
  {
    id: '2',
    date: '2026/09/25',
    shift: '常日班 (17:30 應下班)',
    punchOut: '19:10:00',
    lagDuration: '1 小時 40 分',
    selectedReason: '處理公務需補申報加班',
    subReason: '',
    customNote: '產線伺服器突發網路告警處理',
    checked: true,
  },
]);

const reasonOptions = [
  { label: '因私事滯留廠區', value: '因私事滯留廠區' },
  { label: '處理公務需補申報加班', value: '處理公務需私加班' },
];

const subReasonOptions = [
  { label: '吃晚餐', value: '吃晚餐' },
  { label: '處理私人事務', value: '處理私人事務' },
  { label: '等待家人接送', value: '等待家人接送' },
  { label: '等待教育訓練上課', value: '等待教育訓練上課' },
  { label: '其他 (請自填)', value: '其他' },
];
</script>

<template>
  <div class="abnormal-respond-page stack">
    <GCard class="filter-card glass">
      <div class="filter-row">
        <div class="filter-group">
          <label class="filter-label">查詢日期</label>
          <GInput v-model="queryDate" type="month" style="width: 180px" />
          <GButton variant="primary" icon="search">重新查詢</GButton>
        </div>
        <div class="actions">
          <GButton variant="primary" icon="upload">回報上傳主管審核</GButton>
        </div>
      </div>
    </GCard>

    <GCard title="下班刷卡時數異常待回報清單" icon="clock" class="glass">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th width="50" class="text-center">選取</th>
              <th>異常日期</th>
              <th>班別與下班刷卡</th>
              <th>滯留時數</th>
              <th width="200">主要回報原因</th>
              <th width="180">滯留次分類</th>
              <th>補充備註說明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in list" :key="item.id">
              <td class="text-center">
                <input v-model="item.checked" type="checkbox" />
              </td>
              <td class="mono font-bold">{{ item.date }}</td>
              <td>
                <div>{{ item.shift }}</div>
                <div class="mono text-primary">下班: {{ item.punchOut }}</div>
              </td>
              <td><GBadge tone="neutral">{{ item.lagDuration }}</GBadge></td>
              <td>
                <GSelect v-model="item.selectedReason" :options="reasonOptions" />
              </td>
              <td>
                <GSelect
                  v-if="item.selectedReason === '因私事滯留廠區'"
                  v-model="item.subReason"
                  :options="subReasonOptions"
                />
                <span v-else class="faint small">無需次分類</span>
              </td>
              <td>
                <GInput v-model="item.customNote" placeholder="說明事由 (可選)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>

    <GAlert tone="neutral" icon="info">
      系統每日自動統計下班刷卡時間超過班別結束時間 60 分鐘以上且無核准加班單之同仁紀錄。請同仁如實勾選回報，單位主管每月將定期抽查檢視。
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
.text-primary {
  color: var(--c-primary);
}
</style>
