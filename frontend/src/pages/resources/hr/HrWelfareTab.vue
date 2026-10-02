<script setup lang="ts">
/**
 * 人資專區 - 員工團體保險 (對齊 old_PortalSolar HR.aspx Tab1 團險)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard } from '@/ui';

const currentSubTab = ref<'content' | 'forms' | 'terms'>('content');

const insurancePlans = [
  { item: '定期人壽保險', amount: 'NT$ 2,000,000', coverage: '身故或完全失能保險金保障，24 小時全球有效。' },
  { item: '意外傷害保險 (含重大燒燙傷)', amount: 'NT$ 3,000,000', coverage: '因意外事故致身故或 1~11 級失能給付；重大燒燙傷最高 50% 保額。' },
  { item: '傷害醫療保險金 (實支實付)', amount: 'NT$ 50,000 / 次', coverage: '意外門診或住院醫療自費項目限額實支實付。' },
  { item: '傷害醫療住院日額', amount: 'NT$ 2,000 / 日', coverage: '因意外傷害事故住院治療，每日定額給付 (最高 90 日)。' },
  { item: '防癌健康保險', amount: 'NT$ 1,000,000', coverage: '初次罹患原位癌或侵襲性癌症一次給付金。' },
  { item: '眷屬自費優惠團險', amount: '自由加選方案', coverage: '員工配偶及子女可以公司優惠團體費率加選投保。' },
];

const claimSteps = [
  { step: '1', title: '就醫診斷', desc: '於全民健保特約合格醫院就醫，保留所有單據。' },
  { step: '2', title: '備齊文件', desc: '醫師診斷證明書正本 1 份、健保醫療費用收據正本（或加蓋醫院關防之副本）。' },
  { step: '3', title: '填寫表單', desc: '填妥「團體保險理賠申請書」並由被保險人親自簽名蓋章。' },
  { step: '4', title: '送件審核', desc: '將理賠申請文件送交人資福利窗口 (湖口一廠 2F 分機 #1212)，統一送交保險公司理賠。' },
];
</script>

<template>
  <div class="hr-welfare-tab stack">
    <!-- 子分頁切換 -->
    <div class="sub-nav-row">
      <button
        type="button"
        class="sub-tab-btn"
        :class="{ active: currentSubTab === 'content' }"
        @click="currentSubTab = 'content'"
      >
        團險保障內容
      </button>
      <button
        type="button"
        class="sub-tab-btn"
        :class="{ active: currentSubTab === 'forms' }"
        @click="currentSubTab = 'forms'"
      >
        理賠申請表單與流程
      </button>
      <button
        type="button"
        class="sub-tab-btn"
        :class="{ active: currentSubTab === 'terms' }"
        @click="currentSubTab = 'terms'"
      >
        團體保險合約條款說明
      </button>
    </div>

    <!-- 1. 團險保障內容 -->
    <div v-if="currentSubTab === 'content'" class="stack">
      <GCard class="glass banner-box">
        <div class="banner-top">
          <div>
            <h4 class="m-0">碩禾集團全員團體福利保險計劃</h4>
            <span class="faint small">承保機構：國泰人壽保險股份有限公司 ｜ 保險合約年度：2026 年度</span>
          </div>
          <GBadge tone="healthy">公司全額負擔保費</GBadge>
        </div>
      </GCard>

      <GCard class="glass table-wrapper">
        <table class="welfare-table">
          <thead>
            <tr>
              <th>保險項目名稱</th>
              <th>員工個人保障額度</th>
              <th>保障內容與給付說明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in insurancePlans" :key="p.item">
              <td class="font-bold">{{ p.item }}</td>
              <td class="mono font-bold text-primary">{{ p.amount }}</td>
              <td class="small">{{ p.coverage }}</td>
            </tr>
          </tbody>
        </table>
      </GCard>
    </div>

    <!-- 2. 理賠申請表單 -->
    <div v-if="currentSubTab === 'forms'" class="stack">
      <GCard class="glass download-card">
        <div class="dl-header">
          <strong>理賠申請書下載</strong>
          <span class="faint small">請下載下列表單列印填寫：</span>
        </div>
        <div class="dl-row">
          <div class="dl-item">
            <span class="dl-title">📄 2026年團體保險理賠申請書 (含簽名欄與帳戶影本貼紙).pdf</span>
            <GButton size="sm" variant="secondary">下載 PDF 表單</GButton>
          </div>
          <div class="dl-item">
            <span class="dl-title">📄 眷屬自費加保/退保申請書.pdf</span>
            <GButton size="sm" variant="secondary">下載 PDF 表單</GButton>
          </div>
        </div>
      </GCard>

      <GCard class="glass steps-card">
        <strong>理賠申請標準作業流程 (SOP)</strong>
        <div class="steps-grid">
          <div v-for="s in claimSteps" :key="s.step" class="step-box">
            <div class="step-num mono font-bold">{{ s.step }}</div>
            <strong class="step-title">{{ s.title }}</strong>
            <p class="step-desc faint extra-small">{{ s.desc }}</p>
          </div>
        </div>
      </GCard>
    </div>

    <!-- 3. 團體保險合約條款 -->
    <div v-if="currentSubTab === 'terms'" class="stack">
      <GCard class="glass terms-card">
        <strong>承保主要條款與除外責任摘錄</strong>
        <ul class="terms-list faint small">
          <li><strong>承保對象：</strong>碩禾電子材料及其關係企業全體正式在職員工（含試用期同仁），自到職日起納保。</li>
          <li><strong>事故通知期限：</strong>被保險人發生承保範圍內之事故時，應於知悉後 10 日內通知人資組並提出申請。</li>
          <li><strong>除外責任：</strong>被保險人故意自殺或自傷、犯罪行為、酒後駕車或吸食毒品所致傷害，保險公司不負給付之責。</li>
          <li><strong>給付時程：</strong>保險公司收齊完整理賠文件後，審核無誤預計於 7~10 個工作天內撥款至同仁提供之金融帳戶。</li>
        </ul>
      </GCard>
    </div>

    <GAlert tone="neutral" icon="info">
      若有團保理賠或眷屬加保相關諮詢，請洽人資部福利窗口（分機 #1212，李專員）。
    </GAlert>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.sub-nav-row {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 8px;
}
.sub-tab-btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--color-foreground);
  font-size: 13.5px;
  cursor: pointer;
}
.sub-tab-btn:hover {
  background: var(--color-surface-hover);
}
.sub-tab-btn.active {
  background: var(--color-surface-hover);
  border-color: var(--color-border);
  font-weight: 600;
  color: var(--color-primary);
}
.banner-box {
  padding: 16px 20px;
}
.banner-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.m-0 {
  margin: 0;
}
.table-wrapper {
  overflow-x: auto;
  padding: 0;
}
.welfare-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.welfare-table th,
.welfare-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border);
}
.welfare-table th {
  background: var(--color-surface-hover);
  text-align: left;
  font-weight: 600;
  font-size: 13px;
}
.download-card,
.steps-card,
.terms-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
}
.dl-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dl-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
}
.steps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-top: 6px;
}
.step-box {
  padding: 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.step-num {
  font-size: 18px;
  color: var(--color-primary);
}
.step-desc {
  line-height: 1.4;
  margin: 0;
}
.terms-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding-left: 20px;
  line-height: 1.6;
}
.font-bold {
  font-weight: 600;
}
.extra-small {
  font-size: 12px;
}
</style>
