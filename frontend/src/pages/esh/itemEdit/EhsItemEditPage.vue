<script setup lang="ts">
/**
 * ESH 證照項目設定 (對齊 old_PortalSolar EHS/EHItemEdit.aspx)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GModal, GSelect } from '@/ui';

interface LicenseItemDef {
  code: string;
  name: string;
  authority: '勞動部職安署' | '衛生福利部' | '環境部';
  validYears: number;
  retrainHours: number;
  category: '特種機械操作' | '安衛管理人員' | '急救與化學品' | '環境保護';
  status: '啟用' | '停用';
}

const items = ref<LicenseItemDef[]>([
  {
    code: 'LIC-001',
    name: '荷重在一公噸以上之堆高機操作人員',
    authority: '勞動部職安署',
    validYears: 3,
    retrainHours: 3,
    category: '特種機械操作',
    status: '啟用',
  },
  {
    code: 'LIC-002',
    name: '甲種職業安全衛生業務主管',
    authority: '勞動部職安署',
    validYears: 2,
    retrainHours: 6,
    category: '安衛管理人員',
    status: '啟用',
  },
  {
    code: 'LIC-003',
    name: '乙種職業安全衛生業務主管',
    authority: '勞動部職安署',
    validYears: 2,
    retrainHours: 6,
    category: '安衛管理人員',
    status: '啟用',
  },
  {
    code: 'LIC-004',
    name: '勞工急救人員證書 (CPR+AED)',
    authority: '衛生福利部',
    validYears: 3,
    retrainHours: 3,
    category: '急救與化學品',
    status: '啟用',
  },
  {
    code: 'LIC-005',
    name: '固定式起重機操作人員 (天車)',
    authority: '勞動部職安署',
    validYears: 3,
    retrainHours: 3,
    category: '特種機械操作',
    status: '啟用',
  },
  {
    code: 'LIC-006',
    name: '甲級毒性及關注化學物質專業技術管理人員',
    authority: '環境部',
    validYears: 3,
    retrainHours: 8,
    category: '環境保護',
    status: '啟用',
  },
]);

const newModal = ref(false);
const newForm = ref({
  code: '',
  name: '',
  authority: '勞動部職安署',
  validYears: 3,
  retrainHours: 3,
  category: '特種機械操作',
});

function openNewModal() {
  newForm.value = {
    code: `LIC-00${items.value.length + 1}`,
    name: '',
    authority: '勞動部職安署',
    validYears: 3,
    retrainHours: 3,
    category: '特種機械操作',
  };
  newModal.value = true;
}

function submitNew() {
  if (!newForm.value.name) return;
  items.value.push({
    code: newForm.value.code,
    name: newForm.value.name,
    authority: newForm.value.authority as any,
    validYears: newForm.value.validYears,
    retrainHours: newForm.value.retrainHours,
    category: newForm.value.category as any,
    status: '啟用',
  });
  newModal.value = false;
}
</script>

<template>
  <div class="ehs-item-edit-page stack">
    <!-- 頂部操作列 -->
    <GCard class="glass action-card">
      <div class="action-flex">
        <div>
          <strong class="font-bold">法定特種作業與安衛證照項目設定清冊</strong>
          <span class="faint small">（維護有效期限、回訓時數與主管機關規範）</span>
        </div>
        <GButton tone="primary" @click="openNewModal">+ 新增證照項目</GButton>
      </div>
    </GCard>

    <!-- 項目表格 -->
    <GCard class="glass table-wrapper">
      <table class="item-table">
        <thead>
          <tr>
            <th>項目代碼</th>
            <th>法定證照名稱</th>
            <th>主管主管機關</th>
            <th>證照分類</th>
            <th class="text-center">有效年限</th>
            <th class="text-right">在職回訓時數</th>
            <th class="text-center">狀態</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="it in items" :key="it.code">
            <td class="mono font-bold">{{ it.code }}</td>
            <td class="font-bold text-primary">{{ it.name }}</td>
            <td>
              <GBadge tone="storage">{{ it.authority }}</GBadge>
            </td>
            <td>{{ it.category }}</td>
            <td class="mono text-center">{{ it.validYears }} 年</td>
            <td class="mono text-right font-bold">{{ it.retrainHours }} 小時</td>
            <td class="text-center">
              <GBadge :tone="it.status === '啟用' ? 'healthy' : 'neutral'">
                {{ it.status }}
              </GBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </GCard>

    <!-- 新增證照項目 Modal -->
    <GModal v-model="newModal" title="新增法定證照項目" width="540px">
      <div class="modal-form-stack">
        <div>
          <label class="form-label font-bold">證照代碼</label>
          <GInput v-model="newForm.code" disabled />
        </div>
        <div>
          <label class="form-label font-bold">證照名稱 *</label>
          <GInput v-model="newForm.name" placeholder="例如：乙級職業安全衛生管理員" />
        </div>
        <div class="form-row">
          <div class="form-col">
            <label class="form-label font-bold">主管機關</label>
            <GSelect
              v-model="newForm.authority"
              :options="[
                { label: '勞動部職安署', value: '勞動部職安署' },
                { label: '衛生福利部', value: '衛生福利部' },
                { label: '環境部', value: '環境部' },
              ]"
            />
          </div>
          <div class="form-col">
            <label class="form-label font-bold">證照分類</label>
            <GSelect
              v-model="newForm.category"
              :options="[
                { label: '特種機械操作', value: '特種機械操作' },
                { label: '安衛管理人員', value: '安衛管理人員' },
                { label: '急救與化學品', value: '急救與化學品' },
                { label: '環境保護', value: '環境保護' },
              ]"
            />
          </div>
        </div>
        <div class="form-row">
          <div class="form-col">
            <label class="form-label font-bold">有效期限 (年)</label>
            <GInput v-model.number="newForm.validYears" type="number" />
          </div>
          <div class="form-col">
            <label class="form-label font-bold">在職回訓時數 (小時)</label>
            <GInput v-model.number="newForm.retrainHours" type="number" />
          </div>
        </div>
      </div>
      <template #footer>
        <GButton variant="secondary" @click="newModal = false">取消</GButton>
        <GButton tone="primary" @click="submitNew">確認新增</GButton>
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
.action-card {
  padding: 14px 18px;
}
.action-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.table-wrapper {
  overflow-x: auto;
  padding: 0;
}
.item-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.item-table th, .item-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}
.item-table th {
  background: var(--color-surface-hover);
  text-align: left;
  font-weight: 600;
}
.text-center { text-align: center; }
.text-right { text-align: right; }
.font-bold { font-weight: 600; }
.modal-form-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.form-row {
  display: flex;
  gap: 12px;
}
.form-col {
  flex: 1;
}
.form-label {
  display: block;
  font-size: 13px;
  margin-bottom: 4px;
}
</style>
