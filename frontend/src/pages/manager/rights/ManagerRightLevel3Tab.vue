<script setup lang="ts">
/**
 * 處級主管權益與權限規範 (對齊 old_PortalSolar ManagerRightInfo.aspx Tab3)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GCard } from '@/ui';

const duties = [
  { item: '職級定義', desc: '協理、處長 (職等 Grade 11~12)' },
  { item: '人事權限', desc: '跨部門同仁轉調審核、處級全員年度考績定讞、課級/理級主管任命提名與獎懲提報' },
  { item: '採購核決額度', desc: '年度預算內之採購合約與重大動支：單筆 NT$ 500,000 以下直接核決' },
  { item: '策略經營權', desc: '年度處級營運方針制定、研發/生產/業務重大專案里程碑驗收、跨事業群資源整合' },
  { item: '法規與風控', desc: '重大客訴與品質爭議最終處置裁決、商業機密與專利智財權保護措施督導' },
];

const benefits = [
  { title: '處級主管加給', value: '依職級每月核發高階管理加給 NT$ 20,000 ~ 35,000' },
  { title: '高階商務座車', value: '提供高階專用公務用車配車或私車公用每月高額油資補助' },
  { title: '頂級專案健檢', value: '每年享有頂級醫學中心全日型精密健檢專案 (含 MRI 磁振造影)' },
  { title: '高額人身保險', value: '公司全額加保 NT$ 10,000,000 高階主管專屬定期人壽與意外傷害險' },
];
</script>

<template>
  <div class="manager-level-tab stack">
    <GCard class="glass banner-card">
      <div class="banner-top">
        <div>
          <h4 class="m-0">處級主管職責授權與福利規章</h4>
          <span class="faint small">涵蓋協理、處長之高階策略執行、授權額度與高階主管待遇</span>
        </div>
        <GBadge tone="warning">高階主管管理職</GBadge>
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
      處級主管肩負處級組織治理與經營成效之直接責任，每季定期參與經營管理委員會報告營運績效與中長期目標達成率。
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
