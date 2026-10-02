<script setup lang="ts">
import { ref } from 'vue'
import { GCard, GTable, GButton, GBadge, GInput, GSelect, GAlert } from '@/ui'

const searchKeyword = ref('')
const selectedClass = ref('ALL')
const selectedPlant = ref('ALL')

const classOptions = [
  { label: '全部列管等級 (All Regulated Classes)', value: 'ALL' },
  { label: '第1~3類 毒性化學物質 (Toxic Cat 1-3)', value: 'CAT13' },
  { label: '第4類 毒性化學物質 (Toxic Cat 4)', value: 'CAT4' },
  { label: '關注化學物質 (Concern Chemical)', value: 'CONCERN' },
  { label: '優先管理化學品 (Priority Chemical)', value: 'PRIORITY' },
]

const plantOptions = [
  { label: '全部廠區 (All Plants)', value: 'ALL' },
  { label: '新竹一廠 (Fab 1)', value: 'F1' },
  { label: '竹南二廠 (Fab 2)', value: 'F2' },
  { label: '台中三廠 (Fab 3)', value: 'F3' },
]

const columns = [
  { key: 'casNo', title: 'CAS No. / 管制編號' },
  { key: 'chemicalName', title: '化學品中文名稱 / 英文名' },
  { key: 'category', title: '列管分類級別' },
  { key: 'ghsPictogram', title: 'GHS 危害圖示' },
  { key: 'storageLocation', title: '存放地點 / 廠區' },
  { key: 'currentStorage', title: '現存量 / 法定上限' },
  { key: 'sdsVersion', title: 'SDS 安全資料表' },
  { key: 'action', title: '操作' },
]

const chemicalList = ref([
  {
    id: 'CH-001',
    casNo: '7664-39-3',
    toxicCode: 'T-108-01',
    nameZh: '氫氟酸 (水溶液 49%)',
    nameEn: 'Hydrofluoric Acid',
    category: '毒性第2類 / 優先管理',
    ghs: ['💀 劇毒', '☣️ 腐蝕', '⚠️ 急毒性'],
    plant: '竹南二廠',
    location: '化學品庫房 C-02 槽區',
    currentQty: '2,400 L',
    maxQty: '5,000 L',
    sdsDate: '2024-06-15 (v4.2)',
  },
  {
    id: 'CH-002',
    casNo: '67-64-1',
    toxicCode: 'P-099-04',
    nameZh: '丙酮 (高純度電子級)',
    nameEn: 'Acetone (Electronic Grade)',
    category: '優先管理化學品',
    ghs: ['🔥 易燃液體', '⚠️ 刺激性'],
    plant: '新竹一廠',
    location: '晶圓洗淨區供應櫃 A-1',
    currentQty: '800 L',
    maxQty: '1,200 L',
    sdsDate: '2024-03-10 (v3.1)',
  },
  {
    id: 'CH-003',
    casNo: '7783-60-0',
    toxicCode: 'T-112-03',
    nameZh: '四氟化硫 (特氣)',
    nameEn: 'Sulfur Tetrafluoride',
    category: '第3類 毒性化學物質',
    ghs: ['💀 劇毒氣體', '☣️ 強腐蝕'],
    plant: '台中三廠',
    location: '特氣鋼瓶室 G-05',
    currentQty: '12 鋼瓶 (240kg)',
    maxQty: '20 鋼瓶',
    sdsDate: '2024-08-01 (v5.0)',
  },
  {
    id: 'CH-004',
    casNo: '1336-21-6',
    toxicCode: 'C-087-02',
    nameZh: '氨水 (28% 水溶液)',
    nameEn: 'Ammonium Hydroxide',
    category: '關注化學物質',
    ghs: ['☣️ 腐蝕', '🌊 水生危害'],
    plant: '竹南二廠',
    location: '廢水處理加藥站 B-01',
    currentQty: '3,100 L',
    maxQty: '6,000 L',
    sdsDate: '2023-11-20 (v2.8)',
  },
  {
    id: 'CH-005',
    casNo: '67-56-1',
    toxicCode: 'P-101-12',
    nameZh: '甲醇 (工業級)',
    nameEn: 'Methanol',
    category: '優先管理化學品',
    ghs: ['🔥 易燃液體', '💀 急毒性'],
    plant: '新竹一廠',
    location: '有機溶劑防爆庫 D-03',
    currentQty: '1,500 L',
    maxQty: '3,000 L',
    sdsDate: '2024-01-18 (v4.0)',
  },
])
</script>

<template>
  <div class="space-y-6">
    <!-- 警告提點 -->
    <GAlert variant="danger" title="毒性及關注化學物質法規申報注意">
      第 1~3 類毒性化學物質及關注化學物質之每月運作量申報截止日為次月 10 日前。運作廠區請每日確實落實槽體巡檢、連線即時偵測及運作紀錄簿登載。
    </GAlert>

    <!-- 總量指標 -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <GCard>
        <div class="text-sm text-gray-500">列管項目總計</div>
        <div class="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">28 <span class="text-sm font-normal text-gray-400">種</span></div>
        <div class="text-xs text-blue-600 mt-1">均具主管機關核可許可證</div>
      </GCard>
      <GCard>
        <div class="text-sm text-gray-500">毒性化學物質</div>
        <div class="text-2xl font-bold text-red-600 mt-1">9 <span class="text-sm font-normal text-gray-400">種</span></div>
        <div class="text-xs text-red-500 mt-1">依法裝設 24hr 連線偵測</div>
      </GCard>
      <GCard>
        <div class="text-sm text-gray-500">關注與優先管理化學品</div>
        <div class="text-2xl font-bold text-amber-600 mt-1">19 <span class="text-sm font-normal text-gray-400">種</span></div>
        <div class="text-xs text-amber-600 mt-1">每年依法向職安署申報</div>
      </GCard>
      <GCard>
        <div class="text-sm text-gray-500">SDS 最新版更新率</div>
        <div class="text-2xl font-bold text-emerald-600 mt-1">100%</div>
        <div class="text-xs text-emerald-600 mt-1">全品項符合 3 年內版次</div>
      </GCard>
    </div>

    <!-- 篩選列 -->
    <GCard>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">化學品品名 / CAS No.</label>
          <GInput v-model="searchKeyword" placeholder="例: 7664-39-3 或 氫氟酸..." />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">列管分類等級</label>
          <GSelect v-model="selectedClass" :options="classOptions" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">運作廠區</label>
          <GSelect v-model="selectedPlant" :options="plantOptions" />
        </div>
        <div class="flex gap-2">
          <GButton variant="primary" class="w-full" icon="search">查詢</GButton>
          <GButton variant="secondary" icon="refresh-cw">重置</GButton>
        </div>
      </div>
    </GCard>

    <!-- 化學品清冊表格 -->
    <GCard>
      <GTable :columns="columns" :data="chemicalList">
        <template #cell-casNo="{ row }">
          <div class="font-mono font-bold text-gray-900 dark:text-gray-100">{{ row.casNo }}</div>
          <div class="text-xs text-gray-400 font-mono">{{ row.toxicCode }}</div>
        </template>
        <template #cell-chemicalName="{ row }">
          <div class="font-bold text-gray-800 dark:text-gray-200">{{ row.nameZh }}</div>
          <div class="text-xs text-gray-500 italic">{{ row.nameEn }}</div>
        </template>
        <template #cell-category="{ row }">
          <GBadge :variant="row.category.includes('毒性') ? 'danger' : 'warning'">
            {{ row.category }}
          </GBadge>
        </template>
        <template #cell-ghsPictogram="{ row }">
          <div class="flex flex-wrap gap-1">
            <span v-for="g in row.ghs" :key="g" class="text-xs bg-red-50 dark:bg-red-950/40 text-red-600 border border-red-200 dark:border-red-800 px-1.5 py-0.5 rounded">
              {{ g }}
            </span>
          </div>
        </template>
        <template #cell-storageLocation="{ row }">
          <div class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ row.location }}</div>
          <div class="text-xs text-gray-500">{{ row.plant }}</div>
        </template>
        <template #cell-currentStorage="{ row }">
          <div class="font-bold text-blue-600 dark:text-blue-400">{{ row.currentQty }}</div>
          <div class="text-xs text-gray-400">上限: {{ row.maxQty }}</div>
        </template>
        <template #cell-sdsVersion="{ row }">
          <span class="text-xs text-gray-600 dark:text-gray-400 font-mono">{{ row.sdsDate }}</span>
        </template>
        <template #cell-action="{ row }">
          <div class="flex gap-2">
            <GButton size="sm" variant="ghost" class="text-blue-600">下載 SDS</GButton>
            <GButton size="sm" variant="ghost">卡片檢視</GButton>
          </div>
        </template>
      </GTable>
    </GCard>
  </div>
</template>
