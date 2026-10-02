<script setup lang="ts">
/**
 * 理級主管權益與權限規範 (對齊 old_PortalSolar ManagerRightInfo.aspx Tab2)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GCard } from '@/ui';

const duties = [
  { item: '職級定義', desc: '經理、副理、資深經理 (職等 Grade 9~10)' },
  { item: '人事權限', desc: '部屬請假 7 日內審核、新進人員面試錄用審查、年度考績複評、晉升調薪提案提報' },
  { item: '採購核決額度', desc: '各項日常費用動支與請購單：單筆 NT$ 100,000 以下直接核決權限' },
  { item: '預算管控權', desc: '部門年度營運預算（OPEX）及專案資本支出（CAPEX）進度管理與審查' },
  { item: '跨部門協調', desc: '產銷協調會議代表、客戶重大客訴審查判定、重大資產報廢核轉' },
];

const benefits = [
  { title: '理級管理加給', value: '依職等每月核發理級主管加給 NT$ 8,000 ~ 15,000' },
  { title: '公務通話補助', value: '每月公務行動電話通話費定額補助 NT$ 1,500' },
  { title: '固定專屬車位', value: '配發湖口廠區理級主管固定編號汽車停車位' },
  { title: '高階醫療健檢', value: '每年享有主管級精密全身健檢專案 (含腦部與心血管低劑量 CT)' },
];
</script>

<template>
  <div class="manager-level-tab stack">
    <GCard class="glass banner-card">
      <div class="banner-top">
        <div>
          <h4 class="m-0">理級主管職責授權與福利規章</h4>
          <span class="faint small">涵蓋經理、副理、資深經理之中階管理職權責與福利政策</span>
        </div>
        <GBadge tone="healthy">中階主管管理職</GBadge>
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
      理級主管具備所屬部門年度預算動支權，每季應定期召開預算檢討會議，並追蹤各科目執行率與部屬出勤工時安全。
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
