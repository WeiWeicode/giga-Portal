<script setup lang="ts">
import { ref } from 'vue'
import { GCard, GTable, GButton, GBadge, GInput, GSelect } from '@/ui'

const searchKeyword = ref('')
const selectedDept = ref('ALL')

const deptOptions = [
  { label: '全部使用部門 (All Departments)', value: 'ALL' },
  { label: '廠務設施組 (Facility)', value: 'FAC' },
  { label: '晶片製造組 (Manufacturing)', value: 'MFG' },
  { label: '製程研發處 (R&D)', value: 'RD' },
  { label: '品質保證組 (QA/QC)', value: 'QA' },
]

const columns = [
  { key: 'itemCode', title: '料號 / 化學品品名' },
  { key: 'category', title: '用途類別' },
  { key: 'dept', title: '使用部門' },
  { key: 'location', title: '儲存/作業位置' },
  { key: 'ppe', title: '必備防護裝備 (PPE)' },
  { key: 'sdsDate', title: '最新 SDS 日期' },
  { key: 'safetyStatus', title: '安規查核' },
  { key: 'action', title: '操作' },
]

const generalChemicals = ref([
  {
    id: 'GCH-01',
    itemCode: 'MAT-9921',
    nameZh: '異丙醇 (IPA 99.8%)',
    nameEn: 'Isopropyl Alcohol',
    category: '晶圓表面擦拭 / 溶劑',
    dept: '晶片製造組',
    location: 'Fab 1 黃光區專用防爆櫃',
    ppe: '丁腈手套、防護眼鏡',
    sdsDate: '2024-05-12',
    status: 'PASS',
  },
  {
    id: 'GCH-02',
    itemCode: 'MAT-8843',
    nameZh: '工業級合成潤滑油 ISO VG 68',
    nameEn: 'Synthetic Lubricant Oil',
    category: '機械設備保養用油',
    dept: '廠務設施組',
    location: '冰水機房潤滑油庫',
    ppe: '耐油手套、防滑工作鞋',
    sdsDate: '2023-09-20',
    status: 'PASS',
  },
  {
    id: 'GCH-03',
    itemCode: 'MAT-7712',
    nameZh: '檸檬酸水溶液 (10%)',
    nameEn: 'Citric Acid Solution',
    category: '管路水垢清洗劑',
    dept: '廠務設施組',
    location: '冷卻水塔保養加藥間',
    ppe: '護目鏡、橡膠手套',
    sdsDate: '2023-12-01',
    status: 'PASS',
  },
  {
    id: 'GCH-04',
    itemCode: 'MAT-6601',
    nameZh: '超音波清洗專用中性洗劑',
    nameEn: 'Neutral Ultrasonic Cleaner',
    category: '治具零組件去漬',
    dept: '晶片製造組',
    location: '零件清洗房 Wash-01',
    ppe: '防護面罩、耐酸鹼手套',
    sdsDate: '2024-02-14',
    status: 'PASS',
  },
  {
    id: 'GCH-05',
    itemCode: 'MAT-5530',
    nameZh: '緩衝氧化物蝕刻液 (BOE 6:1)',
    nameEn: 'Buffered Oxide Etch',
    category: '實驗室微量蝕刻試劑',
    dept: '製程研發處',
    location: 'Lab R-203 耐酸鹼排煙櫃',
    ppe: '抗強酸圍裙、防護面罩、厚手套',
    sdsDate: '2024-04-10',
    status: 'PASS',
  },
])
</script>

<template>
  <div class="space-y-6">
    <!-- 概況 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <GCard>
        <div class="text-sm text-gray-500">一般使用化學品項目</div>
        <div class="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">114 <span class="text-sm font-normal text-gray-400">項</span></div>
        <div class="text-xs text-gray-500 mt-1">定期辦理現場危害通識教育</div>
      </GCard>
      <GCard>
        <div class="text-sm text-gray-500">SDS 全面登錄率</div>
        <div class="text-2xl font-bold text-emerald-600 mt-1">100%</div>
        <div class="text-xs text-emerald-600 mt-1">現場皆已張貼標示與危害通識卡</div>
      </GCard>
      <GCard>
        <div class="text-sm text-gray-500">防護裝備 (PPE) 檢驗率</div>
        <div class="text-2xl font-bold text-blue-600 mt-1">99.2%</div>
        <div class="text-xs text-blue-500 mt-1">各庫房與作業區防護用具完備</div>
      </GCard>
    </div>

    <!-- 篩選列 -->
    <GCard>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">化學品品名 / 料號</label>
          <GInput v-model="searchKeyword" placeholder="輸入中文名稱或料號..." />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">使用單位</label>
          <GSelect v-model="selectedDept" :options="deptOptions" />
        </div>
        <div class="flex gap-2">
          <GButton variant="primary" class="w-full" icon="search">篩選清冊</GButton>
          <GButton variant="secondary" icon="refresh-cw">重置</GButton>
        </div>
      </div>
    </GCard>

    <!-- 一般化學品清單 -->
    <GCard>
      <GTable :columns="columns" :data="generalChemicals">
        <template #cell-itemCode="{ row }">
          <div class="font-bold text-gray-900 dark:text-gray-100">{{ row.nameZh }}</div>
          <div class="text-xs text-gray-400 font-mono">{{ row.itemCode }} · {{ row.nameEn }}</div>
        </template>
        <template #cell-category="{ row }">
          <span class="text-xs text-gray-600 dark:text-gray-300">{{ row.category }}</span>
        </template>
        <template #cell-dept="{ row }">
          <span class="text-gray-800 dark:text-gray-200">{{ row.dept }}</span>
        </template>
        <template #cell-location="{ row }">
          <span class="text-xs text-gray-600 dark:text-gray-400 font-medium">{{ row.location }}</span>
        </template>
        <template #cell-ppe="{ row }">
          <span class="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
            🥽 {{ row.ppe }}
          </span>
        </template>
        <template #cell-sdsDate="{ row }">
          <span class="text-xs text-gray-500 font-mono">{{ row.sdsDate }}</span>
        </template>
        <template #cell-safetyStatus="{ row }">
          <GBadge variant="success">合規檢驗</GBadge>
        </template>
        <template #cell-action="{ row }">
          <div class="flex gap-2">
            <GButton size="sm" variant="ghost" class="text-blue-600">檢視 SDS</GButton>
          </div>
        </template>
      </GTable>
    </GCard>
  </div>
</template>
