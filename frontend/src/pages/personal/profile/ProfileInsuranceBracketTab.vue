<script setup lang="ts">
/**
 * 個人基本資料 - 勞健保/勞退級距 Tab
 * 對應 old_PortalSolar/HRPDataBase.aspx (Tab4)
 */
import { ref } from 'vue';
import type { Column } from '@/ui/components/GTable.vue';

const summary = ref({
  laborAmount: '45,800 元',
  laborFee: '1,100 元',
  pensionSystem: '新制 (勞工退休金條例)',
  healthAmount: '45,800 元',
  healthFee: '710 元',
  pensionAmount: '45,800 元',
  employerContrib: '2,748 元 (6%)',
  voluntaryContrib: '2,748 元 (6%)',
});

// 勞保異動
const laborColumns: Column[] = [
  { key: 'date', label: '勞保變動日期', width: '140px', mono: true },
  { key: 'beforeRate', label: '變動前費率', width: '120px' },
  { key: 'beforeAmount', label: '變動前金額', width: '130px', mono: true },
  { key: 'afterRate', label: '變動後費率', width: '120px' },
  { key: 'afterAmount', label: '變動後金額', width: '130px', mono: true },
  { key: 'remarks', label: '備註' },
];
const laborRows = ref([
  { id: '1', date: '2025/01/01', beforeRate: '11.5 %', beforeAmount: '43,900', afterRate: '12.0 %', afterAmount: '45,800', remarks: '年度基本工資及級距調整' },
  { id: '2', date: '2023/01/01', beforeRate: '11.0 %', beforeAmount: '42,000', afterRate: '11.5 %', afterAmount: '43,900', remarks: '職等晉升調薪調整級距' },
]);

// 健保異動
const healthColumns: Column[] = [
  { key: 'date', label: '健保變動日期', width: '160px', mono: true },
  { key: 'beforeAmount', label: '變動前金額', width: '160px', mono: true },
  { key: 'afterAmount', label: '變動後金額', width: '160px', mono: true },
  { key: 'remarks', label: '備註' },
];
const healthRows = ref([
  { id: '1', date: '2025/01/01', beforeAmount: '43,900', afterAmount: '45,800', remarks: '年度健保投保金額調整' },
  { id: '2', date: '2023/01/01', beforeAmount: '42,000', afterAmount: '43,900', remarks: '年度健保投保金額調整' },
]);

// 勞退異動
const pensionColumns: Column[] = [
  { key: 'date', label: '勞退變動日期', width: '160px', mono: true },
  { key: 'beforeAmount', label: '變動前金額', width: '160px', mono: true },
  { key: 'afterAmount', label: '變動後金額', width: '160px', mono: true },
  { key: 'remarks', label: '備註' },
];
const pensionRows = ref([
  { id: '1', date: '2025/01/01', beforeAmount: '43,900', afterAmount: '45,800', remarks: '月提繳工資分級表調整' },
  { id: '2', date: '2023/01/01', beforeAmount: '42,000', afterAmount: '43,900', remarks: '調薪調整提繳工資' },
]);
</script>

<template>
  <div class="stack profile-bracket">
    <!-- 目前投保級距概況 -->
    <GCard title="目前投保與提繳級距概況" subtitle="勞保、健保與勞退月提繳金額及自付保費" icon="layers">
      <div class="grid grid-3">
        <GInput v-model="summary.laborAmount" label="勞保投保金額" disabled />
        <GInput v-model="summary.laborFee" label="勞保保費" disabled />
        <GInput v-model="summary.pensionSystem" label="勞退制度" disabled />
        <GInput v-model="summary.healthAmount" label="健保投保金額" disabled />
        <GInput v-model="summary.healthFee" label="健保保費" disabled />
        <GInput v-model="summary.pensionAmount" label="勞退投保金額" disabled />
        <GInput v-model="summary.employerContrib" label="雇主提撥 6%" disabled />
        <GInput v-model="summary.voluntaryContrib" label="自願提撥" disabled />
      </div>
    </GCard>

    <!-- 勞保異動歷史 -->
    <GCard title="勞保投保級距異動紀錄" icon="shield">
      <GTable :columns="laborColumns" :rows="laborRows" row-key="id" :page-size="5" />
    </GCard>

    <!-- 健保異動歷史 -->
    <GCard title="健保投保級距異動紀錄" icon="shield">
      <GTable :columns="healthColumns" :rows="healthRows" row-key="id" :page-size="5" />
    </GCard>

    <!-- 勞退異動歷史 -->
    <GCard title="勞退提繳級距異動紀錄" icon="shield">
      <GTable :columns="pensionColumns" :rows="pensionRows" row-key="id" :page-size="5" />
    </GCard>
  </div>
</template>

<style scoped>
.profile-bracket {
  --gap: 16px;
}
</style>
