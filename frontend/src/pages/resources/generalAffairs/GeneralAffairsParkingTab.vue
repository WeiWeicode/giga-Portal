<script setup lang="ts">
/** 總務專區 - 湖口廠停車資訊(old_PortalSolar GAffairs.aspx Tab5 照搬;PORTAL-API-PLAN D-14) */
import { legacyDoc } from '@/composables/legacyDocs';

const maps = [
  { title: '一、B棟 B1 停車位', desc: '35~40、50~53、64~67、91~94 為一般員工車位', path: 'Document/ParkB棟B1.png' },
  { title: '二、B3 停車位', path: 'Document/ParkB棟B3.png' },
  { title: '三、B2 停車位', path: 'Document/ParkB棟B2.png' },
];
</script>

<template>
  <div class="stack ga-parking">
    <GAlert tone="info" icon="car" title="湖口廠停車區域">
      <p class="line">
        自 11/29 起,碩禾承租 B 棟 B1 整層、B3 部分車位及 B2 部分摩托車車位,請同仁依承租區域停放汽機車,請勿停放至非承租區域;若遇停車位已滿時煩請同仁停至公司外圍(原 A 棟 B1 的主管車位不做變動)。
      </p>
      <p class="line">P.S. 原公務車改停至 B 棟 B1 31 號及 68 號,欲借車的同仁請留意。</p>
    </GAlert>
    <GCard v-for="m in maps" :key="m.path" :title="m.title" :subtitle="m.desc" icon="compass">
      <img class="map" :src="legacyDoc(m.path)" :alt="m.title" loading="lazy" />
    </GCard>
  </div>
</template>

<style scoped>
.ga-parking {
  --gap: 16px;
}
.line {
  margin: 0 0 6px;
  line-height: 1.6;
}
.map {
  display: block;
  max-width: 100%;
  border-radius: 8px;
  border: 1px solid var(--line);
}
</style>
