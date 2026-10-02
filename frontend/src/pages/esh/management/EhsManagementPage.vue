<script setup lang="ts">
/**
 * ESH 證照管理清冊與到期預警 (對齊 old_PortalSolar EHS/EHManagement.aspx)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GModal, GSelect } from '@/ui';

interface StaffLicense {
  empNo: string;
  name: string;
  dept: string;
  licenseName: string;
  certNo: string;
  issueDate: string;
  expireDate: string;
  retrainHours: number;
  status: '有效' | '即將到期 (90天內)' | '已逾期';
}

const licenses = ref<StaffLicense[]>([
  {
    empNo: 'V112045',
    name: '黃宏達',
    dept: '製造一課',
    licenseName: '荷重在一公噸以上之堆高機操作人員',
    certNo: 'FL-2023-08812',
    issueDate: '2023-06-15',
    expireDate: '2026-06-15',
    retrainHours: 3,
    status: '已逾期',
  },
  {
    empNo: 'V113010',
    name: '陳領班',
    dept: '製造一課',
    licenseName: '荷重在一公噸以上之堆高機操作人員',
    certNo: 'FL-2024-01205',
    issueDate: '2024-01-20',
    expireDate: '2027-01-20',
    retrainHours: 3,
    status: '有效',
  },
  {
    empNo: 'V112001',
    name: '王大明',
    dept: '資訊服務部',
    licenseName: '勞工急救人員證書 (CPR+AED)',
    certNo: 'FA-2023-11009',
    issueDate: '2023-11-05',
    expireDate: '2026-11-05',
    retrainHours: 3,
    status: '即將到期 (90天內)',
  },
  {
    empNo: 'V113018',
    name: '林佑任',
    dept: '職業安全衛生室',
    licenseName: '甲種職業安全衛生業務主管',
    certNo: 'OSH-A-2022-003',
    issueDate: '2022-08-10',
    expireDate: '2025-08-10',
    retrainHours: 6,
    status: '有效',
  },
  {
    empNo: 'V113045',
    name: '周志成',
    dept: '倉儲物流課',
    licenseName: '固定式起重機操作人員 (天車)',
    certNo: 'CR-2024-05521',
    issueDate: '2024-05-15',
    expireDate: '2027-05-15',
    retrainHours: 3,
    status: '有效',
  },
]);

const searchKeyword = ref('');
const statusFilter = ref('');

const filteredLicenses = computed(() => {
  return licenses.value.filter((l) => {
    const kw = searchKeyword.value.toLowerCase().trim();
    const matchKw =
      !kw ||
      l.empNo.toLowerCase().includes(kw) ||
      l.name.toLowerCase().includes(kw) ||
      l.dept.toLowerCase().includes(kw) ||
      l.licenseName.toLowerCase().includes(kw) ||
      l.certNo.toLowerCase().includes(kw);
    const matchStatus = !statusFilter.value || l.status === statusFilter.value;
    return matchKw && matchStatus;
  });
});

const expiringCount = computed(() => licenses.value.filter((l) => l.status === '即將到期 (90天內)').length);
const expiredCount = computed(() => licenses.value.filter((l) => l.status === '已逾期').length);
</script>

<template>
  <div class="ehs-management-page stack">
    <!-- 指標統計卡 -->
    <div class="stats-grid">
      <GCard class="glass stat-card">
        <span class="faint small">全廠持證人員總人次</span>
        <strong class="stat-num mono text-primary">{{ licenses.length }} 筆</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">法定合格有效證照</span>
        <strong class="stat-num mono text-healthy">{{ licenses.length - expiringCount - expiredCount }} 筆</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">90 天內即將到期預警</span>
        <strong class="stat-num mono text-warning">{{ expiringCount }} 筆 (需安排回訓)</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">已逾期失效證照</span>
        <strong class="stat-num mono text-danger">{{ expiredCount }} 筆 (暫停特種作業)</strong>
      </GCard>
    </div>

    <!-- 篩選列 -->
    <GCard class="glass filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <label class="filter-label">關鍵字檢索</label>
          <GInput v-model="searchKeyword" placeholder="搜尋工號、姓名、證照名稱、證書字號..." />
        </div>
        <div class="filter-item filter-select">
          <label class="filter-label">證照有效狀態</label>
          <GSelect
            v-model="statusFilter"
            :options="[
              { label: '全部狀態', value: '' },
              { label: '有效', value: '有效' },
              { label: '即將到期 (90天內)', value: '即將到期 (90天內)' },
              { label: '已逾期', value: '已逾期' },
            ]"
          />
        </div>
      </div>
    </GCard>

    <!-- 證照清單表格 -->
    <GCard class="glass table-wrapper">
      <table class="license-table">
        <thead>
          <tr>
            <th>工號</th>
            <th>姓名</th>
            <th>所屬部門</th>
            <th>法定證照名稱</th>
            <th>證書字號</th>
            <th class="mono">發證日期</th>
            <th class="mono font-bold">有效到期日</th>
            <th class="text-right">回訓時數</th>
            <th class="text-center">狀態</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in filteredLicenses" :key="l.certNo">
            <td class="mono font-bold">{{ l.empNo }}</td>
            <td class="font-bold">{{ l.name }}</td>
            <td>{{ l.dept }}</td>
            <td class="font-bold text-primary">{{ l.licenseName }}</td>
            <td class="mono small faint">{{ l.certNo }}</td>
            <td class="mono small">{{ l.issueDate }}</td>
            <td class="mono font-bold" :class="{ 'text-danger': l.status === '已逾期', 'text-warning': l.status === '即將到期 (90天內)' }">
              {{ l.expireDate }}
            </td>
            <td class="mono text-right">{{ l.retrainHours }} 小時</td>
            <td class="text-center">
              <GBadge :tone="l.status === '有效' ? 'healthy' : l.status === '即將到期 (90天內)' ? 'warning' : 'danger'">
                {{ l.status }}
              </GBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </GCard>

    <GAlert tone="warning" icon="alert">
      依職業安全衛生法規定，特種作業人員證照逾期未完成在職回訓者，不得繼續擔任該項特種作業（例如駕駛堆高機、操作天車或擔任安全業務主管）。請管理員定期通報各單位安排受訓。
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
  font-size: 20px;
}
.text-healthy { color: var(--color-healthy); }
.filter-card {
  padding: 12px 16px;
}
.filter-row {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.filter-item {
  flex: 1;
  min-width: 220px;
}
.filter-select {
  max-width: 220px;
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
.license-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.license-table th, .license-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}
.license-table th {
  background: var(--color-surface-hover);
  text-align: left;
  font-weight: 600;
}
.text-right { text-align: right; }
.text-center { text-align: center; }
.font-bold { font-weight: 600; }
</style>
