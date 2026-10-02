<script setup lang="ts">
/**
 * 自助查詢 - 勞健保明細 Tab
 * 對應 old_PortalSolar/Fixgridviewaspx.aspx (Tab8)
 * GridView6: 員工代號、姓名、身份證字號、眷屬、身份證字號、關係、勞保費、健保費
 */
import { ref } from 'vue';
import type { Column } from '@/ui/components/GTable.vue';
import QueryFilterBar from './QueryFilterBar.vue';

const columns: Column[] = [
  { key: 'empNo', label: '員工代號', width: '110px', mono: true },
  { key: 'name', label: '姓名', width: '110px' },
  { key: 'idNo', label: '身份證字號', width: '140px', mono: true },
  { key: 'dependentName', label: '眷屬', width: '110px' },
  { key: 'dependentIdNo', label: '眷屬身分證', width: '140px', mono: true },
  { key: 'relation', label: '關係', width: '100px' },
  { key: 'laborFee', label: '勞保費', width: '120px', align: 'right', mono: true },
  { key: 'healthFee', label: '健保費', width: '120px', align: 'right', mono: true },
];

const rows = ref([
  {
    id: '1',
    empNo: 'S112009',
    name: '王大明',
    idNo: 'A123***789',
    dependentName: '本人口',
    dependentIdNo: 'A123***789',
    relation: '本人',
    laborFee: '1,100',
    healthFee: '710',
  },
  {
    id: '2',
    empNo: 'S112009',
    name: '王大明',
    idNo: 'A123***789',
    dependentName: '陳小美',
    dependentIdNo: 'F222***456',
    relation: '配偶',
    laborFee: '0',
    healthFee: '710',
  },
  {
    id: '3',
    empNo: 'S112009',
    name: '王大明',
    idNo: 'A123***789',
    dependentName: '王小明',
    dependentIdNo: 'A124***321',
    relation: '子女',
    laborFee: '0',
    healthFee: '710',
  },
]);
</script>

<template>
  <div class="stack query-tab">
    <QueryFilterBar />

    <GCard title="勞健保扣繳明細" subtitle="員工本人與隨保眷屬之勞保、健保當月保費扣繳明細" icon="shield">
      <GTable :columns="columns" :rows="rows" row-key="id" :page-size="10" />
    </GCard>
  </div>
</template>

<style scoped>
.query-tab {
  --gap: 16px;
}
</style>
