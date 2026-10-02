<script setup lang="ts">
/**
 * 群組主管與總經理室權益與權限規範 (對齊 old_PortalSolar ManagerRightInfo.aspx Tab4)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GCard } from '@/ui';

const duties = [
  { item: '職級定義', desc: '副總經理、事業群總經理、執行副總、總經理室 (職等 Grade 13+)' },
  { item: '人事權限', desc: '全集團組織架構變革審定、高階主管任免核定、年度激勵獎金與紅利分配方案核決' },
  { item: '採購核決額度', desc: '單筆 NT$ 3,000,000 以上採購案與重大資本支出專案審查提報' },
  { item: '經營決策權', desc: '年度事業群營運預算核定、海外建廠投資評估、資本市場法說會代表' },
  { item: 'ESG 與治理', desc: '集團 ESG 永續委員會核心成員、重大工安災變指揮中心總指揮官、內稽內控審定' },
];

const benefits = [
  { title: '群組高階加給', value: '核發最高階主管特別加給與年度營運目標達成獎金' },
  { title: '高階專用座車', value: '公司全額配屬進口商務專用座車及司機勤務支援' },
  { title: '全家高端健檢', value: '每年享有頂級醫學中心總裁級健檢專案 (本人及配偶)' },
  { title: '遞延股權激勵', value: '享有公司員工認股權憑證 (ESOP) 與限制員工權利新股 (RS)' },
];
</script>

<template>
  <div class="manager-level-tab stack">
    <GCard class="glass banner-card">
      <div class="banner-top">
        <div>
          <h4 class="m-0">事業群與群組主管職責授權與福利規章</h4>
          <span class="faint small">涵蓋副總經理、事業群總經理及總經理室之最高經營授權說明</span>
        </div>
        <GBadge tone="danger">最高經營管理層</GBadge>
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
      群組主管受董事會與總經理之全權委任，主導事業群整體經營績效，受上市公司證券交易法之經理人利益衝突迴避規範。
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
