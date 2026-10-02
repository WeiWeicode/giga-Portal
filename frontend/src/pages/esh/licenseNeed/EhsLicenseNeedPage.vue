<script setup lang="ts">
import { ref } from 'vue'
import { GCard, GTable, GButton, GBadge, GInput, GSelect, GAlert } from '@/ui'

const searchPlant = ref('ALL')
const searchDept = ref('ALL')
const searchStatus = ref('ALL')

const plantOptions = [
  { label: '全部廠區 (All Plants)', value: 'ALL' },
  { label: '新竹一廠 (Fab 1)', value: 'F1' },
  { label: '竹南二廠 (Fab 2)', value: 'F2' },
  { label: '台中三廠 (Fab 3)', value: 'F3' },
]

const deptOptions = [
  { label: '全部部門 (All Departments)', value: 'ALL' },
  { label: '廠務設施組 (Facility)', value: 'FAC' },
  { label: '化學供應組 (Chemical)', value: 'CHEM' },
  { label: '晶片製造組 (Manufacturing)', value: 'MFG' },
  { label: '環境安全組 (EHS)', value: 'EHS' },
]

const statusOptions = [
  { label: '全狀態 (All Status)', value: 'ALL' },
  { label: '法定缺口/不足 (Shortage)', value: 'SHORTAGE' },
  { label: '符合配置 (Compliant)', value: 'OK' },
]

const columns = [
  { key: 'plant', title: '廠區' },
  { key: 'dept', title: '所屬部門' },
  { key: 'station', title: '作業站點 / 設備區域' },
  { key: 'licenseName', title: '法定應具備證照名稱' },
  { key: 'legalBasis', title: '法令規範依據' },
  { key: 'reqHeadcount', title: '法定需求人數' },
  { key: 'actHeadcount', title: '現況配置人數' },
  { key: 'gap', title: '人力缺口' },
  { key: 'status', title: '法令合規狀態' },
  { key: 'action', title: '指派/調度' },
]

const needRecords = ref([
  {
    id: 'REQ-01',
    plant: '新竹一廠',
    dept: '廠務設施組',
    station: '特氣/毒化供應站 (Gas Central)',
    licenseName: '特定化學物質作業主管',
    legalBasis: '職安署特化預防規則第37條',
    reqHeadcount: 4,
    actHeadcount: 4,
    gap: 0,
    status: 'COMPLIANT',
  },
  {
    id: 'REQ-02',
    plant: '新竹一廠',
    dept: '廠務設施組',
    station: '高壓變電站 (Main Substation)',
    licenseName: '高壓氣體特定設備操作人員',
    legalBasis: '高壓氣體勞工安全規則第68條',
    reqHeadcount: 3,
    actHeadcount: 2,
    gap: -1,
    status: 'DEFICIT',
  },
  {
    id: 'REQ-03',
    plant: '竹南二廠',
    dept: '化學供應組',
    station: '廢水處理場 (WWT Plant)',
    licenseName: '廢水處理專責人員(乙級以上)',
    legalBasis: '水污染防治法第21條',
    reqHeadcount: 2,
    actHeadcount: 2,
    gap: 0,
    status: 'COMPLIANT',
  },
  {
    id: 'REQ-04',
    plant: '竹南二廠',
    dept: '晶片製造組',
    station: '晶圓洗淨自動化線 (Clean Bay)',
    licenseName: '有機溶劑作業主管',
    legalBasis: '有機溶劑中毒預防規則第18條',
    reqHeadcount: 6,
    actHeadcount: 5,
    gap: -1,
    status: 'DEFICIT',
  },
  {
    id: 'REQ-05',
    plant: '台中三廠',
    dept: '環境安全組',
    station: '全廠急救站 (First Aid Station)',
    licenseName: '急救人員(勞工健康保護)',
    legalBasis: '勞工健康保護規則第9條',
    reqHeadcount: 5,
    actHeadcount: 6,
    gap: 1,
    status: 'SURPLUS',
  },
])
</script>

<template>
  <div class="space-y-6">
    <!-- 頂部說明 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <span>⚖️</span>
          <span>工作站法定持照配置需求 (License Requirements per Workstation)</span>
        </h1>
        <p class="text-sm text-gray-500 mt-1">
          管制各廠區高風險作業站點之法規必備專業人員配置名額、即時比對在職持照人數與人力缺口警示。
        </p>
      </div>
      <div class="flex gap-2">
        <GButton variant="secondary" icon="printer">列印法定名冊</GButton>
        <GButton variant="primary" icon="plus">新增作業站需求</GButton>
      </div>
    </div>

    <!-- 合規狀態指標儀表 -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <GCard>
        <div class="text-sm text-gray-500">法定列管工作站點</div>
        <div class="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">42 <span class="text-sm font-normal text-gray-400">處</span></div>
        <div class="text-xs text-emerald-600 mt-1">全廠覆蓋率 100%</div>
      </GCard>
      <GCard>
        <div class="text-sm text-gray-500">法定應配置總人次</div>
        <div class="text-2xl font-bold text-blue-600 mt-1">86 <span class="text-sm font-normal text-gray-400">人次</span></div>
        <div class="text-xs text-gray-500 mt-1">含備援合格人員</div>
      </GCard>
      <GCard>
        <div class="text-sm text-gray-500">現況合格派任人次</div>
        <div class="text-2xl font-bold text-emerald-600 mt-1">84 <span class="text-sm font-normal text-gray-400">人次</span></div>
        <div class="text-xs text-emerald-600 mt-1">配置率 97.7%</div>
      </GCard>
      <GCard>
        <div class="text-sm text-gray-500">法規缺口 (需補位)</div>
        <div class="text-2xl font-bold text-red-600 mt-1">2 <span class="text-sm font-normal text-gray-400">名額</span></div>
        <div class="text-xs text-red-500 mt-1 font-semibold">2 個站點待外部證照回訓補充</div>
      </GCard>
    </div>

    <GAlert variant="warning" title="法規稽查警示">
      竹南二廠晶片製造組「有機溶劑作業主管」及新竹一廠「高壓氣體特定設備操作人員」尚缺 1 名額，已排定於本月 25 日外部考證結訓，請相關課級主管留意班表調配。
    </GAlert>

    <!-- 查詢條件 -->
    <GCard>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">廠區別</label>
          <GSelect v-model="searchPlant" :options="plantOptions" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">部門</label>
          <GSelect v-model="searchDept" :options="deptOptions" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">配置狀態</label>
          <GSelect v-model="searchStatus" :options="statusOptions" />
        </div>
        <div class="flex gap-2">
          <GButton variant="primary" class="w-full" icon="search">套用篩選</GButton>
          <GButton variant="secondary" icon="refresh-cw">重置</GButton>
        </div>
      </div>
    </GCard>

    <!-- 需求清單表格 -->
    <GCard>
      <GTable :columns="columns" :data="needRecords">
        <template #cell-plant="{ row }">
          <span class="font-medium text-gray-800 dark:text-gray-200">{{ row.plant }}</span>
        </template>
        <template #cell-dept="{ row }">
          <span class="text-gray-700 dark:text-gray-300">{{ row.dept }}</span>
        </template>
        <template #cell-station="{ row }">
          <div class="font-semibold text-gray-900 dark:text-gray-100">{{ row.station }}</div>
          <div class="text-xs text-gray-400">{{ row.id }}</div>
        </template>
        <template #cell-licenseName="{ row }">
          <span class="text-blue-600 dark:text-blue-400 font-medium">{{ row.licenseName }}</span>
        </template>
        <template #cell-legalBasis="{ row }">
          <span class="text-xs text-gray-500">{{ row.legalBasis }}</span>
        </template>
        <template #cell-reqHeadcount="{ row }">
          <span class="font-bold text-gray-700 dark:text-gray-300">{{ row.reqHeadcount }} 人</span>
        </template>
        <template #cell-actHeadcount="{ row }">
          <span class="font-bold text-gray-800 dark:text-gray-200">{{ row.actHeadcount }} 人</span>
        </template>
        <template #cell-gap="{ row }">
          <span v-if="row.gap < 0" class="text-red-600 font-bold">{{ row.gap }} 人 (缺)</span>
          <span v-else-if="row.gap > 0" class="text-blue-600 font-bold">+{{ row.gap }} 人 (備)</span>
          <span v-else class="text-emerald-600 font-bold">0 人 (足)</span>
        </template>
        <template #cell-status="{ row }">
          <GBadge v-if="row.status === 'COMPLIANT'" variant="success">合規 (滿編)</GBadge>
          <GBadge v-else-if="row.status === 'SURPLUS'" variant="primary">充足 (備用)</GBadge>
          <GBadge v-else variant="danger">法定缺額 (警示)</GBadge>
        </template>
        <template #cell-action="{ row }">
          <GButton size="sm" variant="ghost">指派名單</GButton>
        </template>
      </GTable>
    </GCard>
  </div>
</template>
