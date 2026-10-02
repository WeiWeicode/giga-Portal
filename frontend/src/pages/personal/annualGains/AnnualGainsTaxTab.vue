<script setup lang="ts">
/**
 * 報稅所得與補充保費證明單分頁 (對齊 old_PortalSolar HRPersonalAnnualGains.aspx 扣繳憑單與二代健保證明單)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GSelect } from '@/ui';

const selectedTaxYear = ref('2025');
const yearOptions = [
  { label: '2025 年度 (民國 114 年申報)', value: '2025' },
  { label: '2024 年度 (民國 113 年申報)', value: '2024' },
  { label: '2023 年度 (民國 112 年申報)', value: '2023' },
];

const taxCert = {
  withholdingUnit: '碩禾電子材料股份有限公司 (統一編號: 80315729)',
  employeeNo: 'V112001',
  name: '蔣佳緯',
  idNumber: 'A123456789',
  incomeType: '50 薪資所得',
  grossPay: 1142000,
  taxWithheld: 57100,
  netPay: 1084900,
  pensionVoluntary: 0,
};

const nhiCert = {
  insureUnit: '碩禾電子材料股份有限公司',
  totalBonusOverLimit: 172000,
  nhi2Rate: '2.11%',
  totalNhi2Amount: 3629,
  submissionDate: '2026/01/15',
  filingStatus: '國稅局及健保署申報完成',
};
</script>

<template>
  <div class="tax-tab-view stack">
    <GCard class="filter-card glass">
      <div class="filter-row">
        <div class="filter-group">
          <label class="filter-label">所得申報年度</label>
          <GSelect v-model="selectedTaxYear" :options="yearOptions" style="width: 250px" />
          <GButton variant="primary" icon="search">重新載入憑單</GButton>
        </div>
        <div class="action-buttons">
          <GButton variant="secondary" icon="download">下載 PDF 扣繳憑單</GButton>
          <GButton variant="secondary" icon="printer">列印補充保費證明</GButton>
        </div>
      </div>
    </GCard>

    <!-- 各類所得扣繳暨免扣繳憑單 (50 薪資所得) -->
    <GCard title="各類所得扣繳暨免扣繳憑單 (50 薪資所得)" icon="file-text" class="glass">
      <div class="cert-grid">
        <div class="cert-cell full-width">
          <span class="k">扣繳義務單位</span>
          <span class="v font-bold">{{ taxCert.withholdingUnit }}</span>
        </div>
        <div class="cert-cell">
          <span class="k">所得人姓名</span>
          <span class="v font-bold">{{ taxCert.name }} ({{ taxCert.employeeNo }})</span>
        </div>
        <div class="cert-cell">
          <span class="k">身分證字號</span>
          <span class="v mono font-bold">{{ taxCert.idNumber }}</span>
        </div>
        <div class="cert-cell">
          <span class="k">所得類別代號</span>
          <span class="v mono">{{ taxCert.incomeType }}</span>
        </div>
        <div class="cert-cell">
          <span class="k">給付總額 (A)</span>
          <span class="v mono font-bold text-primary">$ {{ taxCert.grossPay.toLocaleString() }}</span>
        </div>
        <div class="cert-cell">
          <span class="k">扣繳稅額 (B)</span>
          <span class="v mono font-bold text-danger">$ {{ taxCert.taxWithheld.toLocaleString() }}</span>
        </div>
        <div class="cert-cell">
          <span class="k">給付淨額 (A-B)</span>
          <span class="v mono font-bold">$ {{ taxCert.netPay.toLocaleString() }}</span>
        </div>
        <div class="cert-cell">
          <span class="k">個人自願提繳退休金 (免計入)</span>
          <span class="v mono">$ {{ taxCert.pensionVoluntary.toLocaleString() }}</span>
        </div>
      </div>
    </GCard>

    <!-- 二代健保補充保險費扣費證明單 -->
    <GCard title="全民健康保險扣繳補充保險費明細證明" icon="shield" class="glass">
      <div class="cert-grid">
        <div class="cert-cell full-width">
          <span class="k">扣費投保單位</span>
          <span class="v font-bold">{{ nhiCert.insureUnit }}</span>
        </div>
        <div class="cert-cell">
          <span class="k">累計逾投保金額之獎金總額</span>
          <span class="v mono font-bold">$ {{ nhiCert.totalBonusOverLimit.toLocaleString() }}</span>
        </div>
        <div class="cert-cell">
          <span class="k">法定補充保費費率</span>
          <span class="v mono">{{ nhiCert.nhi2Rate }}</span>
        </div>
        <div class="cert-cell">
          <span class="k">年度扣繳補充保險費總額</span>
          <span class="v mono font-bold text-danger">$ {{ nhiCert.totalNhi2Amount.toLocaleString() }}</span>
        </div>
        <div class="cert-cell">
          <span class="k">機關申報狀態</span>
          <span class="v"><GBadge tone="storage">{{ nhiCert.filingStatus }}</GBadge></span>
        </div>
      </div>
    </GCard>

    <GAlert tone="neutral" icon="info">
      本憑單數據已依法規向財政部臺北/北區國稅局完成媒體申報，所得人於每年 5 月使用自然人憑證或健保卡線上報稅時，系統將自動帶入上述各項所得。
    </GAlert>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.filter-group {
  display: flex;
  align-items: center;
  gap: 10px;
}
.filter-label {
  font-weight: 600;
  font-size: var(--fs-sm);
  color: var(--text-2);
}
.action-buttons {
  display: flex;
  gap: 10px;
}
.cert-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.cert-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--glass-soft);
}
.cert-cell.full-width {
  grid-column: 1 / -1;
}
.cert-cell .k {
  font-size: var(--fs-xs);
  color: var(--text-3);
}
.cert-cell .v {
  font-size: var(--fs-sm);
  color: var(--text);
}
.mono {
  font-family: var(--font-mono, monospace);
}
.font-bold {
  font-weight: 700;
}
.text-primary {
  color: var(--c-primary);
}
.text-danger {
  color: var(--c-danger);
}
</style>
