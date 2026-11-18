<script setup lang="ts">
/** 總務專區 - 總務服務項目(old_PortalSolar GAffairs.aspx Tab1 照搬;PORTAL-API-PLAN D-14) */
const contact = { name: '陳宥榮', ext: '1538' };
const duties = [
  '統籌總務業務規畫及管理',
  '警勤管理',
  '固定資產管理',
  '廠房租賃管理',
  '集團印鑑清冊管理',
  '大陸人士申請來台作業',
  '鞋櫃管理&座位安排&座位牌訂製',
  '制服、工作服管理',
  '廠區清潔管理',
  '產線消耗品訂購',
  '事務機器管理',
  '飲水機管理',
  '停車場管理',
  '公務車、eTag系統管理',
  '公共區域修繕',
  '植栽維護',
  '文具申請',
  '寄信',
  '五金、清潔用品訂購',
  '監視器工程規劃管理',
  '廢銀回收作業',
  '出售下腳及廢品、資源回收',
  '信件發送',
  '公司信封、名片申請',
];
</script>

<template>
  <GCard title="總務服務項目" :subtitle="`窗口:${contact.name} #${contact.ext}`" icon="list">
    <ul class="duties">
      <li v-for="d in duties" :key="d">{{ d }}</li>
    </ul>
  </GCard>
</template>

<style scoped>
.duties {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 6px 16px;
  margin: 0;
  padding-left: 18px;
}
</style>
