<script setup lang="ts">
/**
 * 簡易分機查詢表 (對齊 old_PortalSolar ExtensionTable.aspx)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GModal, GSelect } from '@/ui';

interface ExtensionUser {
  empNo: string;
  name: string;
  deptNo: string;
  deptName: string;
  title: string;
  notesId: string;
  ext: string;
  remarks: string;
  email: string;
  seat: string;
}

const list = ref<ExtensionUser[]>([
  {
    empNo: 'V112001',
    name: '王大明',
    deptNo: 'V1420',
    deptName: '資訊服務部',
    title: '資深系統工程師',
    notesId: 'Daming Wang/GigaSolar',
    ext: '2120',
    remarks: '系統維運與開發',
    email: 'daming@gigasolar.com.tw',
    seat: '湖口一廠 3F S142',
  },
  {
    empNo: 'S180002',
    name: '鄭智寬',
    deptNo: 'V1420',
    deptName: '資訊服務部',
    title: '資訊工程師 (HelpDesk)',
    notesId: 'Eric Cheng/GigaSolar',
    ext: '2109',
    remarks: '電腦軟硬體、帳號與印表機報修',
    email: 'eric@gigasolar.com.tw',
    seat: '湖口一廠 3F S145',
  },
  {
    empNo: 'V112009',
    name: '張雅筑',
    deptNo: 'V1210',
    deptName: '人力資源部',
    title: '人資專員',
    notesId: 'Alice Chang/GigaSolar',
    ext: '1210',
    remarks: '員工差勤、福利、不法侵害申訴受理',
    email: 'hr@gigasolar.com.tw',
    seat: '湖口一廠 2F HR01',
  },
  {
    empNo: 'V111005',
    name: '李美華',
    deptNo: 'V1220',
    deptName: '財務會計部',
    title: '會計副理',
    notesId: 'Meihua Li/GigaSolar',
    ext: '1315',
    remarks: '費用核銷、發票統編、出納零用金',
    email: 'account@gigasolar.com.tw',
    seat: '湖口一廠 2F FA03',
  },
  {
    empNo: 'V110034',
    name: '陳志豪',
    deptNo: 'V1510',
    deptName: '總務安全組',
    title: '總務專員',
    notesId: 'Howard Chen/GigaSolar',
    ext: '2150',
    remarks: '公務車派車、停車證、修繕文具請領',
    email: 'ga@gigasolar.com.tw',
    seat: '湖口一廠 2F GA02',
  },
  {
    empNo: 'V112045',
    name: '黃宏達',
    deptNo: 'V2100',
    deptName: '製造一課',
    title: '製造課長',
    notesId: 'Hongda Huang/GigaSolar',
    ext: '3101',
    remarks: '太陽能導電漿配方製程車間',
    email: 'prod1@gigasolar.com.tw',
    seat: '湖口一廠 1F 現場辦公室',
  },
  {
    empNo: 'V113018',
    name: '林佑任',
    deptNo: 'V3200',
    deptName: '職業安全衛生室',
    title: '職安衛管理師',
    notesId: 'Youren Lin/GigaSolar',
    ext: '1119',
    remarks: '安環衛稽核、化學品管理、工傷通報',
    email: 'safety@gigasolar.com.tw',
    seat: '湖口一廠 2F EHS01',
  },
  {
    empNo: 'V112089',
    name: '吳佩蓉',
    deptNo: 'V1100',
    deptName: '業務營業處',
    title: '業務專員',
    notesId: 'Peggy Wu/GigaSolar',
    ext: '2205',
    remarks: '海外客戶訂單處理與出貨協調',
    email: 'sales@gigasolar.com.tw',
    seat: '湖口一廠 3F MK02',
  },
]);

const searchKeyword = ref('');
const deptFilter = ref('');

const filteredList = computed(() => {
  return list.value.filter((item) => {
    const kw = searchKeyword.value.toLowerCase().trim();
    const matchKw =
      !kw ||
      item.name.toLowerCase().includes(kw) ||
      item.empNo.toLowerCase().includes(kw) ||
      item.ext.includes(kw) ||
      item.deptName.toLowerCase().includes(kw) ||
      item.notesId.toLowerCase().includes(kw) ||
      item.remarks.toLowerCase().includes(kw);
    const matchDept = !deptFilter.value || item.deptName === deptFilter.value;
    return matchKw && matchDept;
  });
});

// 名片 Modal
const cardModal = ref(false);
const activeUser = ref<ExtensionUser | null>(null);

function viewCard(user: ExtensionUser) {
  activeUser.value = user;
  cardModal.value = true;
}

const copiedExt = ref<string | null>(null);
function copyExt(ext: string) {
  navigator.clipboard?.writeText(ext);
  copiedExt.value = ext;
  setTimeout(() => {
    copiedExt.value = null;
  }, 1500);
}

function exportCsv() {
  const headers = '工號,姓名,部門代號,部門名稱,職稱,NotesID,分機,電子郵件,座號,備註\n';
  const rows = filteredList.value
    .map(
      (u) =>
        `"${u.empNo}","${u.name}","${u.deptNo}","${u.deptName}","${u.title}","${u.notesId}","${u.ext}","${u.email}","${u.seat}","${u.remarks}"`,
    )
    .join('\n');
  const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `GigaSolar_分機表_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="extension-tab stack">
    <!-- 撥號指引看板 -->
    <GCard class="glass guide-card">
      <div class="guide-title">
        <strong>📞 跨廠區電話撥打方式指南</strong>
      </div>
      <div class="guide-grid">
        <div class="guide-item">
          <span class="guide-label">中華/新豐/桃科 ➔ 湖口/鹽城</span>
          <span class="guide-val font-bold text-primary">撥打 40 進語音後撥分機號碼</span>
        </div>
        <div class="guide-item">
          <span class="guide-label">湖口/鹽城 ➔ 中華/新豐/桃科</span>
          <span class="guide-val font-bold text-primary">撥打 42 進語音後撥分機號碼</span>
        </div>
        <div class="guide-item">
          <span class="guide-label">國際電話撥打方式</span>
          <span class="guide-val mono font-bold">002 + 國碼 + 區域號碼 + 國外號碼</span>
        </div>
      </div>
    </GCard>

    <!-- 搜尋列與操作 -->
    <GCard class="glass search-card">
      <div class="search-flex">
        <div class="input-wrap">
          <label class="filter-label">關鍵字檢索</label>
          <GInput v-model="searchKeyword" placeholder="搜尋同仁姓名、工號、分機、部門、NotesID、業務關鍵字..." />
        </div>
        <div class="select-wrap">
          <label class="filter-label">部門篩選</label>
          <GSelect
            v-model="deptFilter"
            :options="[
              { label: '全部部門', value: '' },
              { label: '資訊服務部', value: '資訊服務部' },
              { label: '人力資源部', value: '人力資源部' },
              { label: '財務會計部', value: '財務會計部' },
              { label: '總務安全組', value: '總務安全組' },
              { label: '製造一課', value: '製造一課' },
              { label: '職業安全衛生室', value: '職業安全衛生室' },
              { label: '業務營業處', value: '業務營業處' },
            ]"
          />
        </div>
        <div class="btn-wrap">
          <GButton variant="secondary" @click="exportCsv">匯出 CSV</GButton>
        </div>
      </div>
    </GCard>

    <!-- 分機表格 -->
    <GCard class="glass table-wrapper">
      <table class="ext-table">
        <thead>
          <tr>
            <th>工號</th>
            <th>姓名</th>
            <th>部門代號</th>
            <th>部門名稱</th>
            <th>職稱</th>
            <th>分機號碼</th>
            <th>NotesID</th>
            <th>主要負責職務 / 備註</th>
            <th class="text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in filteredList" :key="user.empNo">
            <td class="mono font-bold">{{ user.empNo }}</td>
            <td class="font-bold">{{ user.name }}</td>
            <td class="mono small faint">{{ user.deptNo }}</td>
            <td>
              <GBadge tone="neutral">{{ user.deptName }}</GBadge>
            </td>
            <td class="small">{{ user.title }}</td>
            <td class="ext-cell">
              <span class="ext-number mono font-bold text-primary"># {{ user.ext }}</span>
              <button type="button" class="copy-btn extra-small" @click="copyExt(user.ext)">
                {{ copiedExt === user.ext ? '已複製' : '複製' }}
              </button>
            </td>
            <td class="mono small faint">{{ user.notesId }}</td>
            <td class="small faint">{{ user.remarks }}</td>
            <td class="text-center">
              <GButton size="sm" variant="ghost" @click="viewCard(user)">名片</GButton>
            </td>
          </tr>
          <tr v-if="filteredList.length === 0">
            <td colspan="9" class="text-center faint p-4">查無符合搜尋條件之同仁分機</td>
          </tr>
        </tbody>
      </table>
    </GCard>

    <!-- 個人通訊名片 Modal -->
    <GModal v-model="cardModal" title="同仁通訊資訊卡" width="480px">
      <div v-if="activeUser" class="card-detail-stack">
        <div class="user-hero">
          <div class="user-avatar">
            {{ activeUser.name.slice(0, 1) }}
          </div>
          <div class="user-main-info">
            <h4 class="user-name">{{ activeUser.name }}</h4>
            <span class="faint small">{{ activeUser.title }} ｜ {{ activeUser.deptName }}</span>
          </div>
        </div>

        <div class="info-list">
          <div class="info-item">
            <span class="item-label">員工工號：</span>
            <span class="mono">{{ activeUser.empNo }}</span>
          </div>
          <div class="info-item">
            <span class="item-label">公司分機：</span>
            <strong class="mono text-primary font-bold"># {{ activeUser.ext }}</strong>
          </div>
          <div class="info-item">
            <span class="item-label">電子信箱：</span>
            <span class="mono">{{ activeUser.email }}</span>
          </div>
          <div class="info-item">
            <span class="item-label">Notes ID：</span>
            <span class="mono">{{ activeUser.notesId }}</span>
          </div>
          <div class="info-item">
            <span class="item-label">座位位置：</span>
            <span>{{ activeUser.seat }}</span>
          </div>
          <div class="info-item">
            <span class="item-label">職掌說明：</span>
            <span>{{ activeUser.remarks }}</span>
          </div>
        </div>
      </div>
      <template #footer>
        <GButton variant="secondary" @click="cardModal = false">關閉</GButton>
      </template>
    </GModal>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.guide-card {
  padding: 14px 18px;
  background: linear-gradient(135deg, rgba(20, 184, 166, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.guide-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}
.guide-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.guide-label {
  font-size: 12px;
  color: var(--color-faint);
}
.guide-val {
  font-size: 14px;
}
.search-card {
  padding: 12px 16px;
}
.search-flex {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.input-wrap {
  flex: 1;
  min-width: 250px;
}
.select-wrap {
  min-width: 180px;
}
.filter-label {
  display: block;
  font-size: 13px;
  color: var(--color-faint);
  margin-bottom: 4px;
}
.btn-wrap {
  margin-bottom: 2px;
}
.table-wrapper {
  overflow-x: auto;
  padding: 0;
}
.ext-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.ext-table th,
.ext-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}
.ext-table th {
  background: var(--color-surface-hover);
  text-align: left;
  font-weight: 600;
  font-size: 13px;
}
.ext-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ext-number {
  font-size: 15px;
}
.copy-btn {
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  color: var(--color-faint);
}
.copy-btn:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}
.card-detail-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.user-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--color-border);
}
.user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: bold;
}
.user-name {
  margin: 0;
  font-size: 18px;
}
.info-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.info-item {
  display: flex;
  font-size: 14px;
}
.item-label {
  width: 90px;
  color: var(--color-faint);
  flex-shrink: 0;
}
.text-center {
  text-align: center;
}
.font-bold {
  font-weight: 600;
}
.extra-small {
  font-size: 11px;
}
</style>
