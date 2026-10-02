<script setup lang="ts">
/**
 * 個人基本資料 - 勞退新制資料 Tab
 * 對應 old_PortalSolar/HRPDataBase.aspx (Tab2)
 */
import { ref } from 'vue';

const pension = ref({
  system: '新制 (勞工退休金條例)',
  voluntary: '是',
  startDate: '2020/03/01',
  endDate: '—',
  voluntaryRate: '6.0 %',
  employerRate: '6.0 %',
});
</script>

<template>
  <div class="stack profile-pension">
    <GCard title="勞工退休金新制提繳現況" icon="shield">
      <div class="grid grid-3">
        <GInput v-model="pension.system" label="勞退制度" disabled />
        <GInput v-model="pension.voluntary" label="自願提繳" disabled />
        <GInput v-model="pension.startDate" label="提繳起始日" disabled />
        <GInput v-model="pension.endDate" label="提繳結束日" disabled />
        <GInput v-model="pension.voluntaryRate" label="自願提繳率" disabled />
        <GInput v-model="pension.employerRate" label="雇主提繳率" disabled />
      </div>
    </GCard>

    <GAlert tone="info" title="勞工退休金自願提繳異動申請注意事項">
      <ol class="notes-list">
        <li>第一次申請提繳者，為申請當月生效，並自當月薪資中（未足月者依比例計算）開始執行代扣。</li>
        <li>申請提繳率異動者，於申報勞保局後，於次月一日起開始生效，並自異動日起，一年內僅限異動二次；公司將於每年六月十五日及十二月十五日統一辦理異動事宜。如欲申請異動者，請於前述日期內提出申請。</li>
        <li>個人自願提繳率（由 0.1% 至 6.0% 為限，如非整數計至小數點後 1 位）。</li>
        <li>申請變更後，將由薪酬課為您處理。</li>
      </ol>
    </GAlert>
  </div>
</template>

<style scoped>
.profile-pension {
  --gap: 16px;
}
.notes-list {
  margin: 6px 0 0;
  padding-left: 20px;
  line-height: 1.65;
}
.notes-list li {
  margin-bottom: 4px;
}
</style>
