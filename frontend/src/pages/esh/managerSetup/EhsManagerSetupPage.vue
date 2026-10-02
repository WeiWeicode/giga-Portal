<script setup lang="ts">
import { ref } from 'vue'
import { GCard, GTable, GButton, GBadge, GInput, GSelect, GModal, GAlert } from '@/ui'

const isModalOpen = ref(false)
const searchPlant = ref('ALL')
const searchRole = ref('ALL')

const plantOptions = [
  { label: '全部廠區 (All Plants)', value: 'ALL' },
  { label: '新竹一廠 (Fab 1)', value: 'F1' },
  { label: '竹南二廠 (Fab 2)', value: 'F2' },
  { label: '台中三廠 (Fab 3)', value: 'F3' },
  { label: '企業總部 (HQ)', value: 'HQ' },
]

const roleOptions = [
  { label: '全部角色 (All Roles)', value: 'ALL' },
  { label: '環安業務主責人 (EHS Lead)', value: 'EHS_LEAD' },
  { label: '部門安全推行員 (Safety Officer)', value: 'SAFETY_OFFICER' },
  { label: '毒化物業務專責 (Toxic Chemical Rep)', value: 'TOXIC_REP' },
  { label: '廠區緊急應變副指揮 (ERT Sub-Commander)', value: 'ERT_SUB' },
]

const columns = [
  { key: 'plant', title: '廠區' },
  { key: 'dept', title: '部門' },
  { key: 'role', title: '環安擔當角色' },
  { key: 'primaryUser', title: '正擔當 (Primary)' },
  { key: 'deputyUser', title: '職務代理人 (Deputy)' },
  { key: 'contact', title: '聯絡分機 / 公務手機' },
  { key: 'scope', title: '管轄作業區域' },
  { key: 'status', title: '在任狀態' },
  { key: 'action', title: '操作' },
]

const managerList = ref([
  {
    id: 'MGR-01',
    plant: '新竹一廠',
    dept: '廠務設施組',
    role: '毒化物業務專責',
    primaryUser: 'T10892 陳大華 (課長)',
    deputyUser: 'T11002 吳正則 (工程師)',
    ext: '#5102 / 0912-345678',
    scope: 'Gas Yard, 毒化物供應儲槽區',
    status: 'ACTIVE',
  },
  {
    id: 'MGR-02',
    plant: '新竹一廠',
    dept: '環境安全組',
    role: '環安業務主責人',
    primaryUser: 'T10123 林俊傑 (經理)',
    deputyUser: 'T11456 林志豪 (管理員)',
    ext: '#5888 / 0920-112233',
    scope: '新竹一廠全區環安法規與稽核',
    status: 'ACTIVE',
  },
  {
    id: 'MGR-03',
    plant: '竹南二廠',
    dept: '化學供應組',
    role: '部門安全推行員',
    primaryUser: 'T13220 黃智翔 (資深工)',
    deputyUser: 'T13450 柯文賓 (工程師)',
    ext: '#6210 / 0933-445566',
    scope: '廢水處理廠、酸鹼洗滌塔區',
    status: 'ACTIVE',
  },
  {
    id: 'MGR-04',
    plant: '竹南二廠',
    dept: '晶片製造組',
    role: '廠區緊急應變副指揮',
    primaryUser: 'T12089 張佳玲 (副理)',
    deputyUser: 'T12555 許世銘 (組長)',
    ext: '#6300 / 0955-889900',
    scope: 'Fab 2 Cleanroom 潔淨室區',
    status: 'ACTIVE',
  },
  {
    id: 'MGR-05',
    plant: '台中三廠',
    dept: '廠務設施組',
    role: '環安業務主責人',
    primaryUser: 'T10452 鄭雅慧 (課長)',
    deputyUser: 'T11888 羅光宇 (工程師)',
    ext: '#7101 / 0966-778899',
    scope: '台中三廠動力廠區及高低壓變電所',
    status: 'ACTIVE',
  },
])

const editForm = ref({
  plant: 'F1',
  dept: '',
  role: 'EHS_LEAD',
  primaryEmp: '',
  deputyEmp: '',
  ext: '',
  mobile: '',
  scope: '',
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <span>👥</span>
          <span>環安窗口與管理者設定 (EHS Managers & Safety Representatives)</span>
        </h1>
        <p class="text-sm text-gray-500 mt-1">
          維護各廠區各部門環安衛法定專責人、緊急應變擔當窗口與公務通報聯繫網絡。
        </p>
      </div>
      <div class="flex gap-2">
        <GButton variant="secondary" icon="printer">匯印緊急通報表</GButton>
        <GButton variant="primary" icon="plus" @click="isModalOpen = true">新增窗口擔當</GButton>
      </div>
    </div>

    <!-- 提示 -->
    <GAlert variant="info" title="緊急應變通報原則">
      若廠區發生化學品洩漏、火災或人員工傷事故，各級主管請依循緊急應變程序（ERT）第一時間致電各廠專責窗口或撥打廠區緊急分機 #8888。
    </GAlert>

    <!-- 查詢過濾 -->
    <GCard>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">廠區</label>
          <GSelect v-model="searchPlant" :options="plantOptions" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">角色職責</label>
          <GSelect v-model="searchRole" :options="roleOptions" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">關鍵字 (姓名/工號/責任區)</label>
          <GInput placeholder="搜尋擔當姓名或區域..." />
        </div>
        <div class="flex gap-2">
          <GButton variant="primary" class="w-full" icon="search">查詢</GButton>
          <GButton variant="secondary" icon="refresh-cw">重置</GButton>
        </div>
      </div>
    </GCard>

    <!-- 管理者清單 -->
    <GCard>
      <GTable :columns="columns" :data="managerList">
        <template #cell-plant="{ row }">
          <span class="font-medium text-gray-800 dark:text-gray-200">{{ row.plant }}</span>
        </template>
        <template #cell-dept="{ row }">
          <span class="text-gray-700 dark:text-gray-300">{{ row.dept }}</span>
        </template>
        <template #cell-role="{ row }">
          <GBadge variant="primary">{{ row.role }}</GBadge>
        </template>
        <template #cell-primaryUser="{ row }">
          <div class="font-bold text-gray-900 dark:text-gray-100">{{ row.primaryUser }}</div>
        </template>
        <template #cell-deputyUser="{ row }">
          <span class="text-gray-600 dark:text-gray-400">{{ row.deputyUser }}</span>
        </template>
        <template #cell-contact="{ row }">
          <span class="text-xs font-mono text-blue-600 dark:text-blue-400 font-semibold">{{ row.ext }}</span>
        </template>
        <template #cell-scope="{ row }">
          <span class="text-xs text-gray-600 dark:text-gray-400">{{ row.scope }}</span>
        </template>
        <template #cell-status="{ row }">
          <GBadge variant="success">在任中</GBadge>
        </template>
        <template #cell-action="{ row }">
          <div class="flex gap-2">
            <GButton size="sm" variant="ghost">編輯</GButton>
            <GButton size="sm" variant="ghost" class="text-red-500">解除</GButton>
          </div>
        </template>
      </GTable>
    </GCard>

    <!-- 新增窗口 Modal -->
    <GModal v-model="isModalOpen" title="新增環安窗口 / 擔當設定" size="md">
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">廠區</label>
            <GSelect v-model="editForm.plant" :options="plantOptions" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">部門</label>
            <GInput v-model="editForm.dept" placeholder="例: 廠務設施組" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">擔當角色</label>
          <GSelect v-model="editForm.role" :options="roleOptions" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">主要擔當人員 (工號/姓名)</label>
            <GInput v-model="editForm.primaryEmp" placeholder="例: T10892 陳大華" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">職務代理人 (工號/姓名)</label>
            <GInput v-model="editForm.deputyEmp" placeholder="例: T11002 吳正則" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">廠內分機</label>
            <GInput v-model="editForm.ext" placeholder="#5102" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">公務通報手機</label>
            <GInput v-model="editForm.mobile" placeholder="0912-345678" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">管轄作業範圍 / 責任區域</label>
          <GInput v-model="editForm.scope" placeholder="例: Fab 1 特氣房及高壓站" />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <GButton variant="secondary" @click="isModalOpen = false">取消</GButton>
          <GButton variant="primary" @click="isModalOpen = false">確認儲存</GButton>
        </div>
      </template>
    </GModal>
  </div>
</template>
