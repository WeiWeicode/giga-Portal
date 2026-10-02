<script setup lang="ts">
/**
 * 外送資產明細 (對齊 old_PortalSolar GAffairs.aspx Tab4)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GModal, GSelect } from '@/ui';

interface OutboundItem {
  id: string;
  propertyId: string;
  propertyName: string;
  type: '委外校驗' | '原廠維修' | '跨廠借調';
  vendor: string;
  outDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  status: '外送中' | '已返還結案' | '送修中' | '延期校驗中';
  handler: string;
  gatePassNo: string;
  remarks: string;
}

const outboundList = ref<OutboundItem[]>([
  {
    id: 'OB-202610-001',
    propertyId: 'FA20210088',
    propertyName: '數位電錶 / 網路巡檢分析儀',
    type: '委外校驗',
    vendor: '台灣電子檢驗中心 (ETC)',
    outDate: '2026-10-01',
    expectedReturnDate: '2026-10-14',
    status: '外送中',
    handler: '王大明 (V112001)',
    gatePassNo: 'GP-20261001-08',
    remarks: '年度 ISO17025 實驗室精度標準校驗',
  },
  {
    id: 'OB-202609-012',
    propertyId: 'FA20220033',
    propertyName: '光學顯微鏡攝影鏡頭組',
    type: '原廠維修',
    vendor: '台灣奧林巴斯股份有限公司',
    outDate: '2026-09-15',
    expectedReturnDate: '2026-09-30',
    actualReturnDate: '2026-09-28',
    status: '已返還結案',
    handler: '林專員 (V112045)',
    gatePassNo: 'GP-20260915-14',
    remarks: '調焦馬達異常異音檢修完畢返廠',
  },
  {
    id: 'OB-202608-005',
    propertyId: 'FA20230102',
    propertyName: '高壓絕緣電阻測試器',
    type: '跨廠借調',
    vendor: '碩禾湖口二廠 廠務課',
    outDate: '2026-08-20',
    expectedReturnDate: '2026-09-10',
    actualReturnDate: '2026-09-08',
    status: '已返還結案',
    handler: '陳副理 (V111003)',
    gatePassNo: 'GP-20260820-03',
    remarks: '支援二廠變電站歲修預防檢測',
  },
]);

const searchKeyword = ref('');
const statusFilter = ref('');

const filteredList = computed(() => {
  return outboundList.value.filter((item) => {
    const matchKw =
      !searchKeyword.value ||
      item.id.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
      item.propertyId.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
      item.propertyName.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
      item.vendor.toLowerCase().includes(searchKeyword.value.toLowerCase());
    const matchStatus = !statusFilter.value || item.status === statusFilter.value;
    return matchKw && matchStatus;
  });
});

const applyModal = ref(false);
const newForm = ref({
  propertyId: '',
  propertyName: '',
  type: '委外校驗',
  vendor: '',
  expectedReturnDate: '',
  remarks: '',
});

function openApplyModal() {
  newForm.value = {
    propertyId: '',
    propertyName: '',
    type: '委外校驗',
    vendor: '',
    expectedReturnDate: '',
    remarks: '',
  };
  applyModal.value = true;
}

function submitApply() {
  if (!newForm.value.propertyId || !newForm.value.vendor) return;
  outboundList.value.unshift({
    id: `OB-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(outboundList.value.length + 1).padStart(3, '0')}`,
    propertyId: newForm.value.propertyId,
    propertyName: newForm.value.propertyName || '公司資產設備',
    type: newForm.value.type as any,
    vendor: newForm.value.vendor,
    outDate: new Date().toISOString().slice(0, 10),
    expectedReturnDate: newForm.value.expectedReturnDate || '2026-10-31',
    status: '外送中',
    handler: '王大明 (V112001)',
    gatePassNo: `GP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-01`,
    remarks: newForm.value.remarks,
  });
  applyModal.value = false;
}
</script>

<template>
  <div class="ga-outbound-tab stack">
    <!-- 頂部操作與過濾列 -->
    <GCard class="glass filter-card">
      <div class="filter-flex">
        <div class="filter-item">
          <label class="filter-label">關鍵字檢索</label>
          <GInput v-model="searchKeyword" placeholder="搜尋外送單號、財產編號、設備名稱、廠商..." />
        </div>
        <div class="filter-item status-select">
          <label class="filter-label">狀態篩選</label>
          <GSelect
            v-model="statusFilter"
            :options="[
              { label: '全部狀態', value: '' },
              { label: '外送中', value: '外送中' },
              { label: '已返還結案', value: '已返還結案' },
              { label: '延期校驗中', value: '延期校驗中' },
            ]"
          />
        </div>
        <div class="btn-wrap">
          <GButton tone="primary" @click="openApplyModal">+ 登記外送放行單</GButton>
        </div>
      </div>
    </GCard>

    <!-- 外送清單表格 -->
    <GCard class="glass table-wrapper">
      <table class="outbound-table">
        <thead>
          <tr>
            <th>外送單號</th>
            <th>出廠放行條</th>
            <th>財產編號</th>
            <th>設備名稱</th>
            <th>外送類型</th>
            <th>外送廠商 / 接收單位</th>
            <th>出廠日期</th>
            <th>預計歸還日</th>
            <th>實際歸還日</th>
            <th>狀態</th>
            <th>備註</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filteredList" :key="item.id">
            <td class="mono font-bold">{{ item.id }}</td>
            <td class="mono small">{{ item.gatePassNo }}</td>
            <td class="mono">{{ item.propertyId }}</td>
            <td>{{ item.propertyName }}</td>
            <td>
              <GBadge tone="neutral">{{ item.type }}</GBadge>
            </td>
            <td class="font-bold">{{ item.vendor }}</td>
            <td class="mono small">{{ item.outDate }}</td>
            <td class="mono small">{{ item.expectedReturnDate }}</td>
            <td class="mono small">{{ item.actualReturnDate ?? '-' }}</td>
            <td>
              <GBadge :tone="item.status === '已返還結案' ? 'healthy' : 'warning'">
                {{ item.status }}
              </GBadge>
            </td>
            <td class="faint small">{{ item.remarks }}</td>
          </tr>
          <tr v-if="filteredList.length === 0">
            <td colspan="11" class="text-center faint p-4">查無符合條件之外送資產紀錄</td>
          </tr>
        </tbody>
      </table>
    </GCard>

    <!-- 外送資產管理法規提要 -->
    <GAlert tone="neutral" icon="info">
      依廠區保安規定，所有攜帶出廠之公司儀器設備、模具或治具，均須於出廠前 24 小時線上開立外送單，經權責主管及總務組核准後由守衛室查驗放行。設備返廠後請由守衛簽核歸還註銷。
    </GAlert>

    <!-- 登記外送 Modal -->
    <GModal v-model="applyModal" title="登記外送資產放行單" width="560px">
      <div class="modal-form-stack">
        <div>
          <label class="form-label">財產編號 *</label>
          <GInput v-model="newForm.propertyId" placeholder="例如：FA20230045" />
        </div>
        <div>
          <label class="form-label">設備名稱</label>
          <GInput v-model="newForm.propertyName" placeholder="例如：高精度電錶分析儀" />
        </div>
        <div>
          <label class="form-label">外送類型</label>
          <GSelect
            v-model="newForm.type"
            :options="[
              { label: '委外校驗', value: '委外校驗' },
              { label: '原廠維修', value: '原廠維修' },
              { label: '跨廠借調', value: '跨廠借調' },
            ]"
          />
        </div>
        <div>
          <label class="form-label">外送廠商 / 接收單位 *</label>
          <GInput v-model="newForm.vendor" placeholder="例如：台灣電子檢驗中心" />
        </div>
        <div>
          <label class="form-label">預計返廠日期</label>
          <GInput v-model="newForm.expectedReturnDate" type="date" />
        </div>
        <div>
          <label class="form-label">外送事由 / 備註說明</label>
          <GInput v-model="newForm.remarks" placeholder="請填寫外送維修或校正項目說明" />
        </div>
      </div>
      <template #footer>
        <GButton variant="secondary" @click="applyModal = false">取消</GButton>
        <GButton tone="primary" @click="submitApply">確認送審放行單</GButton>
      </template>
    </GModal>
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
.filter-flex {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.filter-item {
  flex: 1;
  min-width: 220px;
}
.status-select {
  max-width: 200px;
}
.filter-label,
.form-label {
  display: block;
  font-size: 13px;
  color: var(--color-faint);
  margin-bottom: 4px;
}
.btn-wrap {
  margin-bottom: 2px;
}
.table-wrapper {
  overflow-x: auto;
  padding: 0;
}
.outbound-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.outbound-table th,
.outbound-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}
.outbound-table th {
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
.modal-form-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
