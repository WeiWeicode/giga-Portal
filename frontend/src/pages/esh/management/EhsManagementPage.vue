<script setup lang="ts">
/**
 * 證照管理儀表板(old_PortalSolar EHS/EHManagement.aspx;FEATURE-PLAN §8;docs/Gherkin/esh/license.feature)。
 * 每公司每證照:應有張數(需求)、有效張數(在職且下次複訓日 ≥ 今天)、符合度;不足為「待改善」。
 * 公司只能選本人在 LicenseManagerInfo 的公司(後端每支 API 檢查)。描述為後端白名單清洗後的 HTML,顯示前再以 web-kit sanitizeHtml 清洗。
 */
import { computed, ref } from 'vue';
import { sanitizeHtml } from '@giganexus/web-kit';
import { describeError } from '@/api/gateway';
import { eshDashboard, eshValidHolders, type EshDashboardItem, type EshHolder } from '@/api/portal';
import { dashboardCounts, docHref, filterDashboard, logoSrc, monthsText, type DashboardFilter } from '@/composables/esh';
import { useAsync } from '@/composables/useAsync';

const company = ref('');
const { data, loading, error, reload } = useAsync(async () => {
  const d = await eshDashboard(company.value || undefined);
  if (!company.value && d.company) company.value = d.company;
  return d;
});
const companyOptions = computed(() => (data.value?.companies ?? []).map((c) => ({ label: c, value: c })));
const filter = ref<DashboardFilter>('all');
const counts = computed(() => dashboardCounts(data.value?.items ?? []));
const filterOptions = computed(() => [
  { label: `全部證照(${counts.value.all})`, value: 'all' },
  { label: `待改善(${counts.value.ng})`, value: 'ng' },
  { label: `符合規定(${counts.value.ok})`, value: 'ok' },
]);
const items = computed(() => filterDashboard(data.value?.items ?? [], filter.value));
const expanded = ref<number | null>(null);

const viewing = ref<EshDashboardItem | null>(null);
const holders = ref<EshHolder[]>([]);
const holdersLoading = ref(false);
const holdersError = ref<unknown>(null);
async function view(item: EshDashboardItem) {
  viewing.value = item;
  holders.value = [];
  holdersError.value = null;
  holdersLoading.value = true;
  try {
    holders.value = (await eshValidHolders(company.value, item.licenseId)).items;
  } catch (e) {
    holdersError.value = e;
  } finally {
    holdersLoading.value = false;
  }
}
</script>

<template>
  <div class="stack">
    <GCard>
      <div class="row filters">
        <GSelect v-model="company" :options="companyOptions" placeholder="選擇公司" class="sel" @update:model-value="reload" />
        <GSegmented v-model="filter" :options="filterOptions" size="sm" />
      </div>
    </GCard>

    <GCard v-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得證照資料" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="loading && !data"><GSkeleton :lines="5" /></GCard>
    <GCard v-else-if="data && !data.companies.length">
      <GEmpty icon="lock" title="您不是任何公司的證照管理員" description="管理範圍依舊系統「證照管理員」(LicenseManagerInfo)設定,請洽 ESH 管理員新增。" />
    </GCard>
    <GCard v-else-if="data && !items.length"><GEmpty icon="award" title="沒有符合條件的證照需求" /></GCard>
    <div v-else-if="data" class="grid">
      <GCard v-for="i in items" :key="i.licenseId" :class="['lic', { ng: !i.ok }]">
        <div class="head">
          <img v-if="logoSrc(i)" :src="logoSrc(i)!" alt="" class="logo" loading="lazy" />
          <div class="logo ph" v-else><GIcon name="award" :size="28" /></div>
          <div class="title">
            <b>{{ i.name }}</b>
            <span class="xs faint">有效期 {{ monthsText(i) }}</span>
          </div>
        </div>
        <div class="nums">
          <span :class="['big', i.ok ? 'ok' : 'bad']">{{ i.valid }} / {{ i.required }}</span>
          <GBadge :tone="i.ok ? 'success' : 'danger'">{{ i.ok ? '符合規定' : '待改善' }} · {{ i.ratio }}%</GBadge>
        </div>
        <p v-if="i.notes" class="xs faint notes">{{ i.notes }}</p>
        <div class="row acts">
          <GButton size="sm" variant="secondary" icon="users" @click="view(i)">查看有效持證人</GButton>
          <GButton
            v-if="i.description"
            size="sm"
            variant="ghost"
            :icon="expanded === i.licenseId ? 'chevron-down' : 'chevron-right'"
            @click="expanded = expanded === i.licenseId ? null : i.licenseId"
            >說明</GButton
          >
        </div>
        <!-- 後端已白名單清洗,顯示前再以 web-kit sanitizeHtml 清洗 -->
        <div v-if="expanded === i.licenseId" class="desc" v-html="sanitizeHtml(i.description)" />
      </GCard>
    </div>

    <GModal
      :open="!!viewing"
      :title="viewing ? `${viewing.name} · 有效持證人` : ''"
      icon="users"
      width="860px"
      @update:open="(v: boolean) => !v && (viewing = null)"
    >
      <GSkeleton v-if="holdersLoading" :lines="4" />
      <GEmpty v-else-if="holdersError" tone="danger" icon="alert" title="無法取得持證人" :description="describeError(holdersError)" />
      <GEmpty v-else-if="!holders.length" icon="users" title="沒有有效持證人" />
      <div v-else class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>部門</th>
              <th>工號 / 姓名</th>
              <th>初訓</th>
              <th>取得</th>
              <th>複訓</th>
              <th>下次複訓</th>
              <th>通知天數</th>
              <th>證照文件</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="h in holders" :key="h.id">
              <td>{{ h.dept ?? '—' }}</td>
              <td>
                <span class="mono">{{ h.empNo }}</span> {{ h.name ?? '' }}
              </td>
              <td>{{ h.trainingDate ?? '—' }}</td>
              <td>{{ h.gatDate ?? '—' }}</td>
              <td>{{ h.retrainDate ?? '—' }}</td>
              <td>{{ h.nextTrainingDate ?? '—' }}</td>
              <td>{{ h.notifyDays ?? '—' }}</td>
              <td class="docs">
                <template v-for="d in h.docs" :key="d.kind === 'file' ? `f${d.id}` : `l${d.fileName}`">
                  <a v-if="docHref(d)" :href="docHref(d)!" target="_blank" rel="noopener noreferrer">{{ d.fileName }}</a>
                  <span v-else class="faint">{{ d.fileName }}(舊站檔案)</span>
                </template>
                <span v-if="!h.docs.length" class="faint">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GModal>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.filters {
  flex-wrap: wrap;
  gap: 12px;
}
.sel {
  min-width: 180px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.lic.ng {
  border-color: var(--danger, var(--line));
}
.head {
  display: flex;
  gap: 12px;
  align-items: center;
}
.logo {
  width: 56px;
  height: 64px;
  object-fit: contain;
  border-radius: 8px;
  flex: none;
}
.logo.ph {
  display: grid;
  place-items: center;
  background: var(--glass-soft);
  color: var(--text-3);
}
.title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.nums {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 0 4px;
  gap: 8px;
}
.big {
  font-size: var(--fs-xl, 1.4rem);
  font-weight: 700;
}
.big.ok {
  color: var(--success, inherit);
}
.big.bad {
  color: var(--danger, inherit);
}
.notes {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.acts {
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.desc {
  margin-top: 10px;
  max-height: 260px;
  overflow: auto;
  font-size: var(--fs-sm);
  overflow-wrap: anywhere;
}
.table-wrap {
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-sm);
}
.data-table th,
.data-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  white-space: nowrap;
}
.data-table th {
  font-weight: 600;
  color: var(--text-2);
  background: var(--glass-soft);
}
.docs {
  display: flex;
  flex-direction: column;
  gap: 2px;
  white-space: normal;
}
.mono {
  font-family: var(--font-mono, monospace);
}
</style>
