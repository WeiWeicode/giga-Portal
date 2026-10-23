<script setup lang="ts">
/** 主管權益內容(靜態照搬舊 ManagerRightInfo;不呼叫 API) */
import { computed } from 'vue';
import { GAlert, GBadge, GCard } from '@/ui';
import { itemNo, MANAGER_RIGHTS, RIGHTS_FOOTNOTE, RIGHTS_NO_DATE } from './rightsContent';

const props = defineProps<{ level: '1' | '2' | '3' | '4' }>();
const data = computed(() => MANAGER_RIGHTS[props.level]);
</script>

<template>
  <div class="stack rights">
    <GCard :title="data.title" icon="shield">
      <template #actions
        ><GBadge tone="neutral">{{ RIGHTS_NO_DATE }}</GBadge></template
      >
      <ol class="items">
        <li v-for="(t, i) in data.items" :key="i">
          <span class="no">{{ itemNo(i) }}</span>
          <span>{{ t }}</span>
        </li>
      </ol>
    </GCard>
    <GAlert tone="neutral" icon="info">{{ RIGHTS_FOOTNOTE }}</GAlert>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  line-height: 1.7;
}
.items li {
  display: flex;
  gap: 4px;
  overflow-wrap: anywhere;
}
.no {
  flex: none;
  font-weight: 600;
}
</style>
