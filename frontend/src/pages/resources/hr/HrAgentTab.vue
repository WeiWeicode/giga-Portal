<script setup lang="ts">
/**
 * 各部門主管職務代理人名冊 (對齊 old_PortalSolar HR.aspx Tab2)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GSelect } from '@/ui';

interface AgentRecord {
  deptNo: string;
  deptName: string;
  position: string;
  manager: string;
  agent1: string;
  agent1Ext: string;
  agent2: string;
  agent2Ext: string;
  scope: string;
  updatedDate: string;
}

const records = ref<AgentRecord[]>([
  {
    deptNo: 'V1420',
    deptName: '資訊服務部',
    position: '經理 (理級)',
    manager: '林協理 (V108001)',
    agent1: '王大明 (V112001)',
    agent1Ext: '# 2120',
    agent2: '鄭智寬 (S180002)',
    agent2Ext: '# 2109',
    scope: '系統變更審批、BPM 簽核、預算費用動支',
    updatedDate: '2026/01/10',
  },
  {
    deptNo: 'V1210',
    deptName: '人力資源部',
    position: '課長 (課級)',
    manager: '陳課長 (V110008)',
    agent1: '張雅筑 (V112009)',
    agent1Ext: '# 1210',
    agent2: '李專員 (V112015)',
    agent2Ext: '# 1212',
    scope: '差勤假單審核、人員進用提報、工資核算確認',
    updatedDate: '2026/02/01',
  },
  {
    deptNo: 'V1220',
    deptName: '財務會計部',
    position: '副理 (理級)',
    manager: '李美華 (V111005)',
    agent1: '黃組長 (V111088)',
    agent1Ext: '# 1320',
    agent2: '吳專員 (V113002)',
    agent2Ext: '# 1325',
    scope: '出納付款覆核、傳票簽准、發票統編核准',
    updatedDate: '2026/01/15',
  },
  {
    deptNo: 'V2100',
    deptName: '製造一課',
    position: '課長 (課級)',
    manager: '黃宏達 (V112045)',
    agent1: '張副課長 (V112046)',
    agent1Ext: '# 3102',
    agent2: '林領班 (V113010)',
    agent2Ext: '# 3105',
    scope: '排班表調度、領料單核准、加班單審查',
    updatedDate: '2026/03/01',
  },
  {
    deptNo: 'V3200',
    deptName: '職業安全衛生室',
    position: '主管 (室主任)',
    manager: '何主任 (V109012)',
    agent1: '林佑任 (V113018)',
    agent1Ext: '# 1119',
    agent2: '廠護中心 (S180005)',
    agent2Ext: '# 1120',
    scope: '危險作業許可核發、工傷事故提報、外包施工審查',
    updatedDate: '2026/01/05',
  },
  {
    deptNo: 'V1100',
    deptName: '業務營業處',
    position: '協理 (處級)',
    manager: '張協理 (V105003)',
    agent1: '吳佩蓉 (V112089)',
    agent1Ext: '# 2205',
    agent2: '陳副理 (V111019)',
    agent2Ext: '# 2208',
    scope: '報價單核准、海外出貨放行、客戶信用額度審核',
    updatedDate: '2026/02/18',
  },
]);

const deptFilter = ref('');
const searchKeyword = ref('');

const filteredRecords = computed(() => {
  return records.value.filter((r) => {
    const matchDept = !deptFilter.value || r.deptName === deptFilter.value;
    const kw = searchKeyword.value.toLowerCase().trim();
    const matchKw =
      !kw ||
      r.deptName.toLowerCase().includes(kw) ||
      r.manager.toLowerCase().includes(kw) ||
      r.agent1.toLowerCase().includes(kw) ||
      r.agent2.toLowerCase().includes(kw);
    return matchDept && matchKw;
  });
});
</script>

<template>
  <div class="hr-agent-tab stack">
    <!-- 篩選列 -->
    <GCard class="glass filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <label class="filter-label">關鍵字搜尋</label>
          <GInput v-model="searchKeyword" placeholder="搜尋部門、主管姓名、代理人姓名..." />
        </div>
        <div class="filter-item filter-select">
          <label class="filter-label">部門篩選</label>
          <GSelect
            v-model="deptFilter"
            :options="[
              { label: '全部部門', value: '' },
              { label: '資訊服務部', value: '資訊服務部' },
              { label: '人力資源部', value: '人力資源部' },
              { label: '財務會計部', value: '財務會計部' },
              { label: '製造一課', value: '製造一課' },
              { label: '職業安全衛生室', value: '職業安全衛生室' },
              { label: '業務營業處', value: '業務營業處' },
            ]"
          />
        </div>
      </div>
    </GCard>

    <!-- 職務代理清冊表格 -->
    <GCard class="glass table-wrapper">
      <table class="agent-table">
        <thead>
          <tr>
            <th>部門代號</th>
            <th>部門名稱</th>
            <th>管理職等</th>
            <th>受代理主管</th>
            <th>第一順位代理人</th>
            <th>第一代理分機</th>
            <th>第二順位代理人</th>
            <th>第二代理分機</th>
            <th>授權代理職掌範圍</th>
            <th class="text-center">更新日期</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in filteredRecords" :key="r.deptNo">
            <td class="mono small faint">{{ r.deptNo }}</td>
            <td class="font-bold">{{ r.deptName }}</td>
            <td>
              <GBadge tone="storage">{{ r.position }}</GBadge>
            </td>
            <td class="font-bold text-primary">{{ r.manager }}</td>
            <td>
              <GBadge tone="healthy">{{ r.agent1 }}</GBadge>
            </td>
            <td class="mono small">{{ r.agent1Ext }}</td>
            <td>
              <GBadge tone="neutral">{{ r.agent2 }}</GBadge>
            </td>
            <td class="mono small">{{ r.agent2Ext }}</td>
            <td class="small">{{ r.scope }}</td>
            <td class="mono small text-center faint">{{ r.updatedDate }}</td>
          </tr>
          <tr v-if="filteredRecords.length === 0">
            <td colspan="10" class="text-center faint p-4">查無符合條件之部門主管職務代理紀錄</td>
          </tr>
        </tbody>
      </table>
    </GCard>

    <GAlert tone="neutral" icon="info">
      依公司人事差勤規章，課級（含）以上主管請假或出差超過 2 個工作天，電子簽核系統（BPM）將依上述名冊自動移轉待批單據至第一順位代理人；若第一順位代理人同時請假，則自動順延至第二順位代理人。
    </GAlert>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
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
.agent-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.agent-table th,
.agent-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}
.agent-table th {
  background: var(--color-surface-hover);
  text-align: left;
  font-weight: 600;
  font-size: 13px;
}
.text-center {
  text-align: center;
}
.font-bold {
  font-weight: 600;
}
</style>
