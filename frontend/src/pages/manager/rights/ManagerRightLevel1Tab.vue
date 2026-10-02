<script setup lang="ts">
/**
 * 課級主管權益與權限規範 (對齊 old_PortalSolar ManagerRightInfo.aspx Tab1)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GCard } from '@/ui';

const duties = [
  { item: '職級定義', desc: '課長、副課長、專案主任 (職等 Grade 7~8)' },
  { item: '人事權限', desc: '部屬日常差勤假單審核 (3 日內)、加班單核准、試用期滿初核、年度考績初評' },
  { item: '採購核決額度', desc: '一般耗材與小額請購：單筆 NT$ 10,000 以下核決權限' },
  { item: '生產調度權', desc: '產線現場人員排班輪值、機台設備臨時停工通報、異常品標記與返工安排' },
  { item: '工安責任', desc: '現場危害通識實施、上工前精神狀態確認、每日 5S 巡檢與一般工安初報' },
];

const benefits = [
  { title: '主管加給', value: '依職等每月核發課級管理職務加給 NT$ 3,000 ~ 6,000' },
  { title: '特休獎勵', value: '年資考核優良者享每年主管特休日 2 天' },
  { title: '健康檢查', value: '每年升級享有進階心血管及精密超音波健檢專案' },
  { title: '公務停車', value: '優先參與廠區主管保留車位抽籤登記' },
];
</script>

<template>
  <div class="manager-level-tab stack">
    <GCard class="glass banner-card">
      <div class="banner-top">
        <div>
          <h4 class="m-0">課級主管職責授權與福利規章</h4>
          <span class="faint small">涵蓋課長、副課長、各專案組長之核決權限與福利政策說明</span>
        </div>
        <GBadge tone="storage">基層主管管理職</GBadge>
      </div>
    </GCard>

    <div class="cards-grid">
      <!-- 職責與核決權限 -->
      <GCard class="glass duty-card">
        <strong class="card-title font-bold">📋 核決權限與管理職責</strong>
        <table class="duty-table">
          <tbody>
            <tr v-for="d in duties" :key="d.item">
              <td class="item-name font-bold">{{ d.item }}</td>
              <td class="item-desc small">{{ d.desc }}</td>
            </tr>
          </tbody>
        </table>
      </GCard>

      <!-- 福利加給待遇 -->
      <GCard class="glass benefit-card">
        <strong class="card-title font-bold">🎁 管理職待遇與福利配套</strong>
        <div class="benefits-list">
          <div v-for="b in benefits" :key="b.title" class="benefit-item">
            <span class="font-bold small text-primary">{{ b.title }}</span>
            <span class="small faint">{{ b.value }}</span>
          </div>
        </div>
      </GCard>
    </div>

    <GAlert tone="neutral" icon="info">
      課級主管因公差或請假超過 2 日時，其核決權限將依各部門主管職務代理名冊移轉至第一順位代理人，請假前務必完成系統工作移交。
    </GAlert>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.banner-card {
  padding: 16px 20px;
}
.banner-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.m-0 { margin: 0; }
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 16px;
}
.duty-card, .benefit-card {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card-title {
  font-size: 15px;
}
.duty-table {
  width: 100%;
  border-collapse: collapse;
}
.duty-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--color-border);
  vertical-align: top;
}
.item-name {
  width: 110px;
}
.benefits-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.benefit-item {
  padding: 8px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.font-bold { font-weight: 600; }
</style>
