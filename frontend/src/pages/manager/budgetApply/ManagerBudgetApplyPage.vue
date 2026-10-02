<script setup lang="ts">
/**
 * 部門年度預算編列與提報 (對齊 old_PortalSolar Budget_DeptData.aspx)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GModal, GSelect } from '@/ui';

interface BudgetProposal {
  id: string;
  accountCode: string;
  itemName: string;
  amount: number;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  category: '資本支出 (CAPEX)' | '營運費用 (OPEX)';
  reason: string;
  status: '草稿' | '財務部審查中' | '已核定通過';
}

const proposals = ref<BudgetProposal[]>([
  {
    id: 'PR-2027-001',
    accountCode: '6102',
    itemName: '核心資料庫伺服器高可用叢集汰換',
    amount: 850000,
    quarter: 'Q2',
    category: '資本支出 (CAPEX)',
    reason: '現有資料庫主機服役逾 5 年已過原廠保固期，提升 ERP 營運穩定度與高可用容錯。',
    status: '財務部審查中',
  },
  {
    id: 'PR-2027-002',
    accountCode: '6101',
    itemName: '次世代 AI 智慧開發輔助平台企業授權',
    amount: 240000,
    quarter: 'Q1',
    category: '營運費用 (OPEX)',
    reason: '導入 Copilot 企業版 20 人份授權，提升軟體開發與單元測試撰寫效率 30% 以上。',
    status: '已核定通過',
  },
  {
    id: 'PR-2027-003',
    accountCode: '6108',
    itemName: '全員資安防禦情資與攻防實戰培訓',
    amount: 150000,
    quarter: 'Q3',
    category: '營運費用 (OPEX)',
    reason: '符合 ISO 27001 年度外部認證之工程師資安防護演練要求。',
    status: '草稿',
  },
]);

const newModal = ref(false);
const newForm = ref({
  accountCode: '6101',
  itemName: '',
  amount: 100000,
  quarter: 'Q2',
  category: '營運費用 (OPEX)',
  reason: '',
});

function openNewModal() {
  newForm.value = {
    accountCode: '6101',
    itemName: '',
    amount: 100000,
    quarter: 'Q2',
    category: '營運費用 (OPEX)',
    reason: '',
  };
  newModal.value = true;
}

function submitNew() {
  if (!newForm.value.itemName || newForm.value.amount <= 0) return;
  proposals.value.unshift({
    id: `PR-2027-${String(proposals.value.length + 1).padStart(3, '0')}`,
    accountCode: newForm.value.accountCode,
    itemName: newForm.value.itemName,
    amount: newForm.value.amount,
    quarter: newForm.value.quarter as any,
    category: newForm.value.category as any,
    reason: newForm.value.reason,
    status: '財務部審查中',
  });
  newModal.value = false;
}

const totalProposed = computed(() => proposals.value.reduce((acc, cur) => acc + cur.amount, 0));
</script>

<template>
  <div class="budget-apply-page stack">
    <!-- 指標統計卡 -->
    <div class="stats-grid">
      <GCard class="glass stat-card">
        <span class="faint small">新年度編列總項目</span>
        <strong class="stat-num mono text-primary">{{ proposals.length }} 項</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">編列提案總金額</span>
        <strong class="stat-num mono text-primary">NT$ {{ totalProposed.toLocaleString() }}</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">資本支出 (CAPEX) 額度</span>
        <strong class="stat-num mono">NT$ 850,000</strong>
      </GCard>
      <GCard class="glass stat-card">
        <span class="faint small">審核完成通過比例</span>
        <strong class="stat-num mono text-healthy">33.3%</strong>
      </GCard>
    </div>

    <!-- 頂部操作列 -->
    <GCard class="glass action-card">
      <div class="action-flex">
        <div>
          <strong class="font-bold">2027 年度新預算項目編列清單</strong>
          <span class="faint small">（提報截止日：2026/11/15 17:00）</span>
        </div>
        <GButton tone="primary" @click="openNewModal">+ 新增預算編列提案</GButton>
      </div>
    </GCard>

    <!-- 編列清單表格 -->
    <GCard class="glass table-wrapper">
      <table class="proposal-table">
        <thead>
          <tr>
            <th>提案編號</th>
            <th>科目</th>
            <th>預算項目名稱</th>
            <th>類別</th>
            <th class="text-right">預計金額</th>
            <th class="text-center">動支季別</th>
            <th>編列事由與效益說明</th>
            <th class="text-center">審查進度</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in proposals" :key="p.id">
            <td class="mono font-bold">{{ p.id }}</td>
            <td class="mono small">{{ p.accountCode }}</td>
            <td class="font-bold">{{ p.itemName }}</td>
            <td>
              <GBadge tone="storage">{{ p.category }}</GBadge>
            </td>
            <td class="mono text-right font-bold text-primary">NT$ {{ p.amount.toLocaleString() }}</td>
            <td class="mono text-center">
              <GBadge tone="neutral">{{ p.quarter }}</GBadge>
            </td>
            <td class="small faint reason-cell">{{ p.reason }}</td>
            <td class="text-center">
              <GBadge :tone="p.status === '已核定通過' ? 'healthy' : p.status === '財務部審查中' ? 'warning' : 'neutral'">
                {{ p.status }}
              </GBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </GCard>

    <GAlert tone="neutral" icon="info">
      預算編列提案送出後，將由財務部會計專員進行科目與額度合規性初審，最終提報總經理室年度經營會議進行綜合審定。
    </GAlert>

    <!-- 新增編列提案 Modal -->
    <GModal v-model="newModal" title="新增新年度預算編列提案" width="580px">
      <div class="modal-form-stack">
        <div>
          <label class="form-label font-bold">預算項目名稱 *</label>
          <GInput v-model="newForm.itemName" placeholder="例如：核心備份儲存擴充" />
        </div>
        <div class="form-row">
          <div class="form-col">
            <label class="form-label font-bold">會計科目</label>
            <GSelect
              v-model="newForm.accountCode"
              :options="[
                { label: '6101 軟體授權與維護費', value: '6101' },
                { label: '6102 核心硬體購置 (CAPEX)', value: '6102' },
                { label: '6105 國內外出差差旅費', value: '6105' },
                { label: '6108 專業教育訓練費', value: '6108' },
                { label: '6112 辦公耗材與雜項購置', value: '6112' },
              ]"
            />
          </div>
          <div class="form-col">
            <label class="form-label font-bold">預估動支季別</label>
            <GSelect
              v-model="newForm.quarter"
              :options="[
                { label: '第一季 (Q1)', value: 'Q1' },
                { label: '第二季 (Q2)', value: 'Q2' },
                { label: '第三季 (Q3)', value: 'Q3' },
                { label: '第四季 (Q4)', value: 'Q4' },
              ]"
            />
          </div>
        </div>
        <div>
          <label class="form-label font-bold">預算金額 (新台幣元) *</label>
          <GInput v-model.number="newForm.amount" type="number" placeholder="金額" />
        </div>
        <div>
          <label class="form-label font-bold">編列事由與預期效益說明 *</label>
          <textarea
            v-model="newForm.reason"
            rows="3"
            class="reason-textarea"
            placeholder="請詳細敘述該筆支出之業務必要性及預期達成之營運效益..."
          />
        </div>
      </div>
      <template #footer>
        <GButton variant="secondary" @click="newModal = false">取消</GButton>
        <GButton tone="primary" @click="submitNew">送出審查提案</GButton>
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
.proposal-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.proposal-table th, .proposal-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}
.proposal-table th {
  background: var(--color-surface-hover);
  text-align: left;
  font-weight: 600;
}
.reason-cell {
  max-width: 320px;
  line-height: 1.4;
}
.text-right { text-align: right; }
.text-center { text-align: center; }
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
.reason-textarea {
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
}
</style>
