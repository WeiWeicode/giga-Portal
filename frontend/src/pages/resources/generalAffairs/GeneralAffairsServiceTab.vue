<script setup lang="ts">
/**
 * 總務服務項目 (對齊 old_PortalSolar GAffairs.aspx Tab1)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GCard } from '@/ui';

const services = [
  { title: '公務車派車與管理', desc: '湖口一廠及二廠公務車輛調派、出車登記、加油卡核銷及定檢維護。', ext: '# 2150 (張專員)', hours: '08:00 - 17:30' },
  { title: '汽機車停車證核發', desc: '員工廠內車位申請、車證製作發放、磁卡權限設定及違規勸導處理。', ext: '# 2152 (林管理員)', hours: '每週二、四下午' },
  { title: '員工宿舍管理', desc: '新進與外縣市同仁宿舍床位安排、水電收費、退宿驗收及設施修繕。', ext: '# 2153 (陳舍監)', hours: '全日服務' },
  { title: '總務五金與設施修繕', desc: '辦公區水電燈具更換、空調溫控、消防安全巡檢及辦公傢俱維修。', ext: '# 2155 (工務班)', hours: '08:00 - 17:00' },
  { title: '文具耗材申領發放', desc: '每月 10 日常態文具線上申領彙整、庫存盤點及各部門文具包發放。', ext: '# 2151 (王總務)', hours: '每月 10 日 ~ 15 日' },
  { title: '環境清潔與廢棄物清運', desc: '全廠區清潔維護、資源回收、事業廢棄物合法清除申報督導。', ext: '# 2156 (總務組長)', hours: '08:00 - 17:30' },
];
</script>

<template>
  <div class="ga-service-tab stack">
    <div class="services-grid">
      <GCard v-for="s in services" :key="s.title" class="service-card glass">
        <div class="service-header">
          <strong>{{ s.title }}</strong>
          <GBadge tone="storage">{{ s.hours }}</GBadge>
        </div>
        <p class="service-desc">{{ s.desc }}</p>
        <div class="service-footer">
          <span class="faint small">聯絡窗口 / 分機：</span>
          <strong class="mono text-primary">{{ s.ext }}</strong>
        </div>
      </GCard>
    </div>

    <GAlert tone="neutral" icon="info">
      總務組辦公室位於湖口一廠 2F 行政大樓，各項紙本送件或公務車鑰匙借還，請於每日 08:30 ~ 17:00 前往辦公室辦理。
    </GAlert>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
.service-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.service-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.service-desc {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--text-2);
  line-height: 1.5;
}
.service-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--line);
  padding-top: 8px;
  margin-top: auto;
}
.mono {
  font-family: var(--font-mono, monospace);
}
.text-primary {
  color: var(--c-primary);
}
</style>
