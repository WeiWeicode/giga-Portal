<script setup lang="ts">
import { ref } from 'vue'
import { GCard, GTable, GButton, GBadge, GInput, GSelect, GModal, GAlert } from '@/ui'

const isModalOpen = ref(false)
const searchKeyword = ref('')
const selectedType = ref('ALL')
const selectedStatus = ref('ALL')

const typeOptions = [
  { label: '全部類別 (All Types)', value: 'ALL' },
  { label: '職業安全類 (Occupational Safety)', value: 'SAFETY' },
  { label: '環境保護類 (Environmental)', value: 'ENV' },
  { label: '危險性機械設備 (Dangerous Machinery)', value: 'MACHINE' },
  { label: '急救與消防類 (First Aid / Fire)', value: 'FIRST_AID' },
]

const statusOptions = [
  { label: '全部狀態 (All Status)', value: 'ALL' },
  { label: '有效 (Valid)', value: 'VALID' },
  { label: '即將到期 (Expiring)', value: 'EXPIRING' },
  { label: '待審核 (Pending)', value: 'PENDING' },
]

const columns = [
  { key: 'empNo', title: '工號/姓名' },
  { key: 'dept', title: '部門' },
  { key: 'category', title: '證照類別' },
  { key: 'licenseName', title: '證照名稱' },
  { key: 'certNo', title: '證書字號' },
  { key: 'issueDate', title: '發證日期' },
  { key: 'expireDate', title: '有效期限' },
  { key: 'reTrainDate', title: '下次複訓日' },
  { key: 'status', title: '狀態' },
  { key: 'action', title: '操作' },
]

const personalLicenses = ref([
  {
    id: 'PL-001',
    empNo: 'T10892',
    name: '陳大華',
    dept: '廠務設施組',
    category: '危險性機械設備',
    licenseName: '第一種壓力容器操作人員',
    certNo: '北檢壓證字第 108-9821 號',
    issueDate: '2022-04-10',
    expireDate: '2025-04-09',
    reTrainDate: '2025-03-01',
    status: 'EXPIRING',
    hasAttachment: true,
  },
  {
    id: 'PL-002',
    empNo: 'T11456',
    name: '林志豪',
    dept: '環境安全組',
    category: '職業安全類',
    licenseName: '乙級職業安全衛生管理員',
    certNo: '勞安證字第 110-33201 號',
    issueDate: '2021-08-15',
    expireDate: '2027-08-14',
    reTrainDate: '2025-07-20',
    status: 'VALID',
    hasAttachment: true,
  },
  {
    id: 'PL-003',
    empNo: 'T12089',
    name: '張佳玲',
    dept: '晶片製造組',
    category: '職業安全類',
    licenseName: '特定化學物質作業主管',
    certNo: '中檢特化字第 112-5510 號',
    issueDate: '2023-01-20',
    expireDate: '2026-01-19',
    reTrainDate: '2025-11-15',
    status: 'VALID',
    hasAttachment: true,
  },
  {
    id: 'PL-004',
    empNo: 'T13220',
    name: '黃智翔',
    dept: '化學供應組',
    category: '環境保護類',
    licenseName: '空氣污染防制專責人員(乙級)',
    certNo: '環署訓空字第 111-0988 號',
    issueDate: '2022-11-05',
    expireDate: '2027-11-04',
    reTrainDate: '2026-10-10',
    status: 'VALID',
    hasAttachment: true,
  },
  {
    id: 'PL-005',
    empNo: 'T14512',
    name: '王小芬',
    dept: '晶片製造組',
    category: '急救與消防類',
    licenseName: '基本救命術 (BLS / CPR+AED)',
    certNo: '紅十字急救第 113-7741 號',
    issueDate: '2024-03-12',
    expireDate: '2026-03-11',
    reTrainDate: '2026-02-15',
    status: 'VALID',
    hasAttachment: true,
  },
  {
    id: 'PL-006',
    empNo: 'T15099',
    name: '郭俊宏',
    dept: '廠務設施組',
    category: '危險性機械設備',
    licenseName: '固定式起重機操作人員(吊掛作業)',
    certNo: '北檢起證字第 113-1102 號',
    issueDate: '2024-09-01',
    expireDate: '2027-08-31',
    reTrainDate: '2026-08-01',
    status: 'PENDING',
    hasAttachment: true,
  },
])

// 登記 Form
const newCert = ref({
  empNo: '',
  name: '',
  dept: '',
  licenseName: '',
  category: 'SAFETY',
  certNo: '',
  issueDate: '',
  expireDate: '',
  issuer: '',
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <span>📜</span>
          <span>人員證照管理與登記 (Personnel License Registration)</span>
        </h1>
        <p class="text-sm text-gray-500 mt-1">
          同仁取得之法定勞安、環保、危險性機械及急救證照清冊登錄、審核與電子證書附件歸檔。
        </p>
      </div>
      <div class="flex gap-2">
        <GButton variant="secondary" icon="download">匯出個人證照清冊</GButton>
        <GButton variant="primary" icon="plus" @click="isModalOpen = true">登記新取得證照</GButton>
      </div>
    </div>

    <!-- 統計概況 -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <GCard>
        <div class="text-sm text-gray-500">已登記總證照數</div>
        <div class="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">318 <span class="text-sm font-normal text-gray-400">張</span></div>
        <div class="text-xs text-blue-600 mt-1">涵蓋 215 位專業同仁</div>
      </GCard>
      <GCard>
        <div class="text-sm text-gray-500">有效合格證照</div>
        <div class="text-2xl font-bold text-emerald-600 mt-1">295 <span class="text-sm font-normal text-gray-400">張</span></div>
        <div class="text-xs text-emerald-600 mt-1">在效期內比例 92.8%</div>
      </GCard>
      <GCard>
        <div class="text-sm text-gray-500">90天內即將到期</div>
        <div class="text-2xl font-bold text-amber-600 mt-1">17 <span class="text-sm font-normal text-gray-400">張</span></div>
        <div class="text-xs text-amber-500 mt-1">已發出複訓提醒信件</div>
      </GCard>
      <GCard>
        <div class="text-sm text-gray-500">待環安審核登記</div>
        <div class="text-2xl font-bold text-purple-600 mt-1">6 <span class="text-sm font-normal text-gray-400">筆</span></div>
        <div class="text-xs text-gray-400 mt-1">同仁上傳待查驗正本</div>
      </GCard>
    </div>

    <!-- 篩選器 -->
    <GCard>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">關鍵字查詢 (工號/姓名/字號)</label>
          <GInput v-model="searchKeyword" placeholder="請輸入工號或姓名..." />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">證照分類</label>
          <GSelect v-model="selectedType" :options="typeOptions" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">證書狀態</label>
          <GSelect v-model="selectedStatus" :options="statusOptions" />
        </div>
        <div class="flex gap-2">
          <GButton variant="primary" class="w-full" icon="search">搜尋證照</GButton>
          <GButton variant="secondary" icon="refresh-cw">清除</GButton>
        </div>
      </div>
    </GCard>

    <!-- 證照清單 -->
    <GCard>
      <GTable :columns="columns" :data="personalLicenses">
        <template #cell-empNo="{ row }">
          <div class="font-bold text-gray-900 dark:text-gray-100">{{ row.name }}</div>
          <div class="text-xs text-gray-400 font-mono">{{ row.empNo }}</div>
        </template>
        <template #cell-dept="{ row }">
          <span class="text-gray-700 dark:text-gray-300">{{ row.dept }}</span>
        </template>
        <template #cell-category="{ row }">
          <span class="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
            {{ row.category }}
          </span>
        </template>
        <template #cell-licenseName="{ row }">
          <div class="font-semibold text-blue-600 dark:text-blue-400">{{ row.licenseName }}</div>
        </template>
        <template #cell-certNo="{ row }">
          <span class="font-mono text-xs text-gray-700 dark:text-gray-300">{{ row.certNo }}</span>
        </template>
        <template #cell-issueDate="{ row }">
          <span class="text-xs text-gray-600 dark:text-gray-400">{{ row.issueDate }}</span>
        </template>
        <template #cell-expireDate="{ row }">
          <span class="text-xs font-medium" :class="row.status === 'EXPIRING' ? 'text-amber-600 font-bold' : 'text-gray-600 dark:text-gray-400'">
            {{ row.expireDate }}
          </span>
        </template>
        <template #cell-reTrainDate="{ row }">
          <span class="text-xs text-gray-500">{{ row.reTrainDate }}</span>
        </template>
        <template #cell-status="{ row }">
          <GBadge v-if="row.status === 'VALID'" variant="success">有效持有</GBadge>
          <GBadge v-else-if="row.status === 'EXPIRING'" variant="warning">即將屆期</GBadge>
          <GBadge v-else variant="info">待環安審核</GBadge>
        </template>
        <template #cell-action="{ row }">
          <div class="flex gap-2">
            <GButton size="sm" variant="ghost">查閱證書</GButton>
            <GButton size="sm" variant="ghost" class="text-blue-600">複訓報名</GButton>
          </div>
        </template>
      </GTable>
    </GCard>

    <!-- 登記新證照 Modal -->
    <GModal v-model="isModalOpen" title="登記新取得專業證照" size="lg">
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">同仁工號</label>
            <GInput v-model="newCert.empNo" placeholder="例: T10892" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">同仁姓名</label>
            <GInput v-model="newCert.name" placeholder="例: 陳大華" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">證照類別</label>
            <GSelect v-model="newCert.category" :options="typeOptions" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">證照名稱</label>
            <GInput v-model="newCert.licenseName" placeholder="例: 有機溶劑作業主管" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">證書字號</label>
            <GInput v-model="newCert.certNo" placeholder="例: 勞安證字第 113-XXXX 號" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">發證/檢定機關</label>
            <GInput v-model="newCert.issuer" placeholder="例: 勞動部勞動力發展署" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">發證日期</label>
            <GInput v-model="newCert.issueDate" type="date" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">有效截止日期</label>
            <GInput v-model="newCert.expireDate" type="date" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">證書掃描檔/照片 (PDF 或 JPG)</label>
          <div class="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center hover:border-blue-500 cursor-pointer">
            <div class="text-3xl text-gray-400 mb-1">📤</div>
            <div class="text-sm font-medium text-gray-700 dark:text-gray-300">點擊上傳或將證件檔案拖曳至此處</div>
            <div class="text-xs text-gray-400 mt-1">支援 PDF, JPG, PNG 格式，檔案大小不超過 10MB</div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <GButton variant="secondary" @click="isModalOpen = false">取消</GButton>
          <GButton variant="primary" @click="isModalOpen = false">送出審核</GButton>
        </div>
      </template>
    </GModal>
  </div>
</template>
