<script setup lang="ts">
/**
 * 個人基本資料 - 所得稅扶養眷屬異動 Tab
 * 對應 old_PortalSolar/HRPDataBase.aspx (Tab6)
 */
import { ref } from 'vue';
import type { Column } from '@/ui/components/GTable.vue';

interface TaxDependentRow {
  id: string;
  name: string;
  relation: string;
  idNo: string;
  birthDate: string;
  status: string;
  remarks: string;
}

const columns: Column[] = [
  { key: 'name', label: '姓名', width: '140px' },
  { key: 'relation', label: '稱謂/關係', width: '120px' },
  { key: 'idNo', label: '身份證字號', width: '150px', mono: true },
  { key: 'birthDate', label: '出生年月日', width: '150px', mono: true },
  { key: 'status', label: '申報狀態', width: '120px' },
  { key: 'remarks', label: '備註' },
];

const rows = ref<TaxDependentRow[]>([
  {
    id: '1',
    name: '王老先生',
    relation: '父親',
    idNo: 'A100***123',
    birthDate: '1955/04/10',
    status: '申報中',
    remarks: '直系尊親屬，年滿 60 歲',
  },
  {
    id: '2',
    name: '陳小美',
    relation: '配偶',
    idNo: 'F222***456',
    birthDate: '1990/11/20',
    status: '申報中',
    remarks: '合併申報',
  },
]);
</script>

<template>
  <div class="stack profile-tax">
    <GCard title="所得稅扶養眷屬申報清單" subtitle="年度綜合所得稅扶養親屬申報資料" icon="file-check">
      <template #actions>
        <GButton variant="secondary" icon="plus">申報異動申請</GButton>
      </template>

      <GTable :columns="columns" :rows="rows" row-key="id" :page-size="10">
        <template #cell-status="{ value }">
          <GBadge tone="primary" dot>{{ value }}</GBadge>
        </template>
      </GTable>
    </GCard>
  </div>
</template>

<style scoped>
.profile-tax {
  --gap: 16px;
}
</style>
