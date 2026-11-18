<script setup lang="ts">
/**
 * 人資專區 - 團體保險(old_PortalSolar HR.aspx Tab1 照搬;PORTAL-API-PLAN D-14)
 * 文件來自舊入口網 Document/(public/legacy-docs),以新分頁開啟 PDF。
 */
import { openLegacyDoc } from '@/composables/legacyDocs';

const main = [
  { title: '團險內容', desc: '國泰團保險種說明', path: 'Document/01_11407_國泰團保險種說明(員工入口網).pdf' },
  { title: '申請表單', desc: '企業團體保險理賠申請書(含範例)', path: 'Document/國泰_1.企業團體保險理賠申請書-11412_含範例(更新).pdf' },
];

const clauses = [
  '職業傷害',
  '職災醫療給付',
  '燒燙傷給付',
  '新職災險(職保外)',
  '新職災險(職保內)',
  '傷害醫療限額附約',
  '傷害保險(15足歲以上)',
  '傷害住院日額',
  '國泰114年度團體保險手冊',
  '急診限額',
  '門診手術限額(無30日等待期)',
  '定期壽險',
  '每次住院醫療費用限額(乙型)',
  '每日住院病房費用(180乙型)',
  '住院醫療擇優(180乙型)',
  '住院兩週內回診(無30日等待期)',
  '住院日額(180計畫B)',
  '安保癌症門診醫療保險金(30日等待期)',
  '安保癌症住院醫療保險金(30日等待期)',
  '安保癌症住院手術保險金(30日等待期)',
  '安保癌症出院療養保險金(30日等待期)',
  '加護或燒燙傷病房(無等待期) --14天',
];
</script>

<template>
  <div class="stack hr-welfare">
    <div class="grid grid-2">
      <GCard v-for="m in main" :key="m.path" :title="m.title" :subtitle="m.desc" icon="file-text">
        <GButton variant="primary" icon="external" @click="openLegacyDoc(m.path)">開啟 PDF</GButton>
      </GCard>
    </div>
    <GCard title="團險條款" icon="shield-check">
      <div class="clauses">
        <button v-for="c in clauses" :key="c" type="button" class="clause" @click="openLegacyDoc(`Document/03_條款/${c}.pdf`)">
          <GIcon name="file-text" :size="16" />
          <span>{{ c }}</span>
        </button>
      </div>
    </GCard>
  </div>
</template>

<style scoped>
.hr-welfare {
  --gap: 16px;
}
.clauses {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 8px;
}
.clause {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--glass-soft);
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.clause:hover {
  border-color: var(--c-primary);
}
</style>
