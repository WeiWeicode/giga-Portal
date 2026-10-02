<script setup lang="ts">
/**
 * 個人基本資料 - 溫室氣體盤查員工通勤調查 Tab
 * 對應 old_PortalSolar/HRPDataBase.aspx (Tab5)
 */
import { ref } from 'vue';

const address = ref('新竹市東區光復路二段101號');
const commuteMethod = ref('機車 (燃油)');
const distance = ref('8.5 公里');
const duration = ref('20 分鐘');
</script>

<template>
  <div class="stack profile-commute">
    <GCard title="溫室氣體盤查 · 員工通勤調查" subtitle="集團範疇三 (Scope 3) 員工日常上下班通勤碳足跡盤查" icon="leaf">
      <template #actions>
        <GButton variant="secondary" icon="edit">前往變更</GButton>
      </template>

      <div class="grid grid-2">
        <GInput v-model="address" label="上班通勤現居地" disabled />
        <GInput v-model="commuteMethod" label="主要通勤交通工具" disabled />
        <GInput v-model="distance" label="單程預估距離" disabled />
        <GInput v-model="duration" label="單程通勤時間" disabled />
      </div>
    </GCard>

    <GAlert tone="info" title="通勤調查說明與注意事項">
      <p class="muted">
        本問卷調查配合金管會及集團永續發展 (ESG) 政策推動，依 ISO 14064-1 規範盤查全體員工日常通勤產生的間接溫室氣體排放量。
        若您的現居住所或主要通勤工具發生變更，請點選上方「前往變更」按鈕更新申報，確保碳盤查基礎資料之準確性。
      </p>
    </GAlert>
  </div>
</template>

<style scoped>
.profile-commute {
  --gap: 16px;
}
</style>
