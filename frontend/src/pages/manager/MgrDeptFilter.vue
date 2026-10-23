<script setup lang="ts">
/**
 * 主管專區部門篩選(GET /api/portal/manager/depts):範圍 = Token 部門含下層,portal-manager-all 全公司(須選部門)。
 * 載入後預設選第一個部門(本人部門),並 emit ready。
 */
import { computed, watch } from 'vue';
import { managerDepts } from '@/api/portal';
import { describeError } from '@/api/gateway';
import { deptOptions } from '@/composables/manager';
import { useAsync } from '@/composables/useAsync';

const dept = defineModel<string>('dept', { default: '' });
const includeSub = defineModel<boolean>('includeSub', { default: true });
const emit = defineEmits<{ ready: [] }>();

const { data, error, reload } = useAsync(() => managerDepts());
const options = computed(() => deptOptions(data.value?.items ?? []));
const empty = computed(() => !!data.value && !data.value.items.length);

watch(data, (d) => {
  if (!d) return;
  if (!dept.value && options.value.length) dept.value = options.value[0]!.value;
  emit('ready');
});
defineExpose({ empty, error, reload });
</script>

<template>
  <div class="row filter">
    <GSelect v-model="dept" :options="options" placeholder="選擇部門" class="dept" :disabled="!options.length" aria-label="部門" />
    <GCheckbox v-model="includeSub" label="含下層部門" />
    <slot />
    <span v-if="error" class="xs danger">部門清單無法取得:{{ describeError(error) }}</span>
  </div>
</template>

<style scoped>
.filter {
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.dept {
  width: 260px;
  max-width: 100%;
}
.danger {
  color: var(--c-danger, #e11d48);
}
</style>
