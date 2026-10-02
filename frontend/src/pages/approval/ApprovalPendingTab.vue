<script setup lang="ts">
/**
 * 待我簽核分頁 (表單與簽核)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GModal, GSelect } from '@/ui';

interface ApprovalItem {
  id: string;
  formType: string;
  applicant: string;
  dept: string;
  submitTime: string;
  priority: 'urgent' | 'normal';
  subject: string;
  amount?: string;
}

const list = ref<ApprovalItem[]>([
  {
    id: 'EF-20261002-0012',
    formType: '請假申請單',
    applicant: '王大明 (V112045)',
    dept: '資訊服務部',
    submitTime: '2026/10/02 08:45',
    priority: 'normal',
    subject: '事假 1 天 (家庭個人事務處理)',
  },
  {
    id: 'EF-20261001-0088',
    formType: '加班申請單',
    applicant: '陳建安 (V113012)',
    dept: '製造二課',
    submitTime: '2026/10/01 17:30',
    priority: 'urgent',
    subject: '平日加班 3.5 小時 (太陽能網印機急件維修保養)',
  },
  {
    id: 'EF-20260930-0145',
    formType: '公務用車預約單',
    applicant: '林雅婷 (V112089)',
    dept: '業務業務組',
    submitTime: '2026/09/30 14:10',
    priority: 'normal',
    subject: '公務車借用：湖口廠至竹科客戶拜訪與樣品交付',
  },
]);

const actionModal = ref(false);
const currentItem = ref<ApprovalItem | null>(null);
const actionType = ref<'approve' | 'reject'>('approve');
const comment = ref('');

function handleApprove(item: ApprovalItem) {
  currentItem.value = item;
  actionType.value = 'approve';
  comment.value = '同意，依公司規章辦理。';
  actionModal.value = true;
}

function handleReject(item: ApprovalItem) {
  currentItem.value = item;
  actionType.value = 'reject';
  comment.value = '';
  actionModal.value = true;
}

function submitAction() {
  if (currentItem.value) {
    list.value = list.value.filter((i) => i.id !== currentItem.value?.id);
  }
  actionModal.value = false;
}
</script>

<template>
  <div class="approval-pending-tab stack">
    <div class="toolbar">
      <div class="summary">
        <GBadge tone="primary" icon="inbox">待簽核共 {{ list.length }} 筆單據</GBadge>
      </div>
      <div class="actions">
        <GButton variant="secondary" icon="check-square">批次全部核准</GButton>
      </div>
    </div>

    <GCard title="待批表單審核清單" icon="file-text" class="glass">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>單號 / 送審時間</th>
              <th>表單類型</th>
              <th>申請人 / 部門</th>
              <th>緊急度</th>
              <th>申請主旨與說明</th>
              <th class="text-center">簽核操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in list" :key="item.id">
              <td>
                <div class="mono font-bold">{{ item.id }}</div>
                <div class="small faint mono">{{ item.submitTime }}</div>
              </td>
              <td><GBadge tone="storage">{{ item.formType }}</GBadge></td>
              <td>
                <strong>{{ item.applicant }}</strong>
                <div class="small faint">{{ item.dept }}</div>
              </td>
              <td>
                <GBadge :tone="item.priority === 'urgent' ? 'danger' : 'neutral'">
                  {{ item.priority === 'urgent' ? '急件' : '一般' }}
                </GBadge>
              </td>
              <td>
                <div>{{ item.subject }}</div>
              </td>
              <td class="text-center">
                <div class="btn-row">
                  <GButton variant="primary" size="small" icon="check" @click="handleApprove(item)">核准</GButton>
                  <GButton variant="ghost" size="small" icon="x" @click="handleReject(item)">退回</GButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>

    <GAlert tone="neutral" icon="info">
      簽核單據直接同步 BPM (NaNaWeb) 流程資料庫。核准後將自動流轉至次一關卡；若退回，單據將退回申請同仁重新修改。
    </GAlert>

    <!-- 簽核核准/退回彈窗 -->
    <GModal
      v-model:open="actionModal"
      :title="actionType === 'approve' ? '確認核准單據' : '退回申請單據'"
    >
      <div v-if="currentItem" class="modal-content stack">
        <div class="info-row"><span class="k">單號：</span><strong class="mono">{{ currentItem.id }}</strong></div>
        <div class="info-row"><span class="k">表單：</span><span>{{ currentItem.formType }}</span></div>
        <div class="info-row"><span class="k">申請人：</span><span>{{ currentItem.applicant }} ({{ currentItem.dept }})</span></div>
        <div class="info-row"><span class="k">主旨：</span><span>{{ currentItem.subject }}</span></div>
        <div>
          <label class="form-label">簽核簽核意見 / 備註：</label>
          <GInput v-model="comment" :placeholder="actionType === 'approve' ? '請輸入核准意見 (選填)' : '請輸入退回原因 (必填)'" />
        </div>
        <div class="modal-actions">
          <GButton variant="secondary" @click="actionModal = false">取消</GButton>
          <GButton
            :variant="actionType === 'approve' ? 'primary' : 'danger'"
            :icon="actionType === 'approve' ? 'check' : 'x'"
            @click="submitAction"
          >
            {{ actionType === 'approve' ? '確定核准' : '確定退回' }}
          </GButton>
        </div>
      </div>
    </GModal>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
.btn-row {
  display: flex;
  justify-content: center;
  gap: 6px;
}
.mono {
  font-family: var(--font-mono, monospace);
}
.font-bold {
  font-weight: 700;
}
.form-label {
  display: block;
  font-weight: 600;
  font-size: var(--fs-sm);
  margin-bottom: 6px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
}
.info-row {
  font-size: var(--fs-sm);
}
.info-row .k {
  color: var(--text-3);
}
</style>
