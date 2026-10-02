<script setup lang="ts">
/**
 * 個人基本資料 - 健保眷屬加退保異動 Tab
 * 對應 old_PortalSolar/HRPDataBase.aspx (Tab3)
 */
import { ref } from 'vue';
import type { Column } from '@/ui/components/GTable.vue';

interface HealthFamilyRow {
  id: string;
  name: string;
  relation: string;
  changeDate: string;
  type: string;
}

const columns: Column[] = [
  { key: 'name', label: '姓名', width: '160px' },
  { key: 'relation', label: '關係', width: '140px' },
  { key: 'changeDate', label: '異動日期', width: '180px', mono: true },
  { key: 'type', label: '加退保', width: '140px' },
];

const rows = ref<HealthFamilyRow[]>([
  { id: '1', name: '陳小美', relation: '配偶', changeDate: '2021/08/01', type: '加保' },
  { id: '2', name: '王小明', relation: '子女', changeDate: '2022/03/15', type: '加保' },
  { id: '3', name: '王老先生', relation: '父親', changeDate: '2020/03/01', type: '退保' },
]);
</script>

<template>
  <div class="stack profile-health-family">
    <GCard title="健保眷屬加退保異動紀錄" subtitle="眷屬全民健康保險投保異動歷史" icon="users">
      <GTable :columns="columns" :rows="rows" row-key="id" :page-size="10">
        <template #cell-type="{ value }">
          <GBadge :tone="value === '加保' ? 'success' : 'danger'" dot>
            {{ value }}
          </GBadge>
        </template>
      </GTable>
    </GCard>
  </div>
</template>

<style scoped>
.profile-health-family {
  --gap: 16px;
}
</style>
