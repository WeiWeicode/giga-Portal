<script setup lang="ts">
/**
 * 班表批次上傳 (對齊 old_PortalSolar HRShiftUp.aspx)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GSelect } from '@/ui';

const selectedDept = ref('制造一課');
const selectedMonth = ref('2026-11');
const uploadSuccess = ref(false);

const shiftCodes = [
  { code: 'A', name: '常日班', hours: '08:30 - 17:30 (休息 12:00-13:00)', desc: '常態日班' },
  { code: 'D1', name: '早輪班', hours: '07:00 - 15:30 (休息 11:30-12:00)', desc: '四班二輪/三班' },
  { code: 'M1', name: '中輪班', hours: '15:00 - 23:30 (休息 19:00-19:30)', desc: '小夜班' },
  { code: 'N1', name: '大夜班', hours: '23:00 - 07:30 (休息 03:00-03:30)', desc: '大夜輪班' },
  { code: 'R', name: '輪休日', hours: '排定休息日 (符合勞基法例休)', desc: '輪休' },
  { code: 'H', name: '國定假日', hours: '國定公定放假', desc: '國定假' },
];

const previewList = ref([
  { empNo: 'V112045', name: '黃課長', d1: 'D1', d2: 'D1', d3: 'D1', d4: 'D1', d5: 'R', d6: 'R', d7: 'D1', status: '正常' },
  { empNo: 'V113010', name: '陳領班', d1: 'D1', d2: 'D1', d3: 'D1', d4: 'D1', d5: 'R', d6: 'R', d7: 'D1', status: '正常' },
  { empNo: 'V113088', name: '張技術員', d1: 'N1', d2: 'N1', d3: 'N1', d4: 'N1', d5: 'R', d6: 'R', d7: 'N1', status: '正常' },
  { empNo: 'V113092', name: '李操作員', d1: 'N1', d2: 'N1', d3: 'N1', d4: 'N1', d5: 'R', d6: 'R', d7: 'N1', status: '正常' },
]);

function handleUpload() {
  uploadSuccess.value = true;
}
</script>

<template>
  <div class="shift-upload-page stack">
    <!-- 上傳設定卡片 -->
    <GCard class="glass upload-card">
      <div class="card-title font-bold">📤 輪班人員排班表 Excel 批次匯入</div>
      <div class="upload-form-grid">
        <div class="form-item">
          <label class="form-label">選擇排班部門</label>
          <GSelect
            v-model="selectedDept"
            :options="[
              { label: '製造一課', value: '製造一課' },
              { label: '製造二課', value: '製造二課' },
              { label: '倉儲物流課', value: '倉儲物流課' },
              { label: '廠務公用工程組', value: '廠務公用工程組' },
            ]"
          />
        </div>
        <div class="form-item">
          <label class="form-label">排班目標年月</label>
          <GInput v-model="selectedMonth" type="month" />
        </div>
        <div class="form-item dl-wrap">
          <label class="form-label">Excel 範本</label>
          <GButton size="sm" variant="secondary">📄 下載排班表標準公版.xlsx</GButton>
        </div>
      </div>

      <!-- 拖曳上傳區 -->
      <div class="dropzone" @click="handleUpload">
        <span class="drop-icon">📁</span>
        <strong class="drop-title">點擊或拖曳 Excel 檔案至此處上傳</strong>
        <span class="faint small">支援 .xlsx、.xls 格式，檔案大小需小於 10MB</span>
      </div>

      <div v-if="uploadSuccess" class="success-alert">
        <GAlert tone="healthy" icon="check">
          檔案「2026年11月製造一課排班表.xlsx」解析驗證成功！共 45 名同仁排班資料無誤，可確認匯入。
        </GAlert>
      </div>
    </GCard>

    <!-- 班別代碼說明 -->
    <GCard class="glass table-wrapper">
      <div class="table-title font-bold">📋 系統班別代號對照說明表</div>
      <table class="shift-table">
        <thead>
          <tr>
            <th>班別代碼</th>
            <th>班別名稱</th>
            <th>工作起訖時間 (含休息工時)</th>
            <th>備註說明</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in shiftCodes" :key="s.code">
            <td class="mono font-bold text-primary">{{ s.code }}</td>
            <td class="font-bold">{{ s.name }}</td>
            <td class="small">{{ s.hours }}</td>
            <td class="faint small">{{ s.desc }}</td>
          </tr>
        </tbody>
      </table>
    </GCard>

    <!-- 預覽資料 -->
    <GCard class="glass table-wrapper">
      <div class="table-header-row">
        <div class="table-title font-bold">🔍 匯入班表預覽清單 (前 7 日抽樣)</div>
        <GButton tone="primary" size="sm" :disabled="!uploadSuccess">確認寫入 ERP 班表庫</GButton>
      </div>
      <table class="preview-table">
        <thead>
          <tr>
            <th>工號</th>
            <th>姓名</th>
            <th class="text-center">1日</th>
            <th class="text-center">2日</th>
            <th class="text-center">3日</th>
            <th class="text-center">4日</th>
            <th class="text-center">5日</th>
            <th class="text-center">6日</th>
            <th class="text-center">7日</th>
            <th class="text-center">驗證狀態</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in previewList" :key="p.empNo">
            <td class="mono font-bold">{{ p.empNo }}</td>
            <td>{{ p.name }}</td>
            <td class="mono text-center">{{ p.d1 }}</td>
            <td class="mono text-center">{{ p.d2 }}</td>
            <td class="mono text-center">{{ p.d3 }}</td>
            <td class="mono text-center">{{ p.d4 }}</td>
            <td class="mono text-center text-danger">{{ p.d5 }}</td>
            <td class="mono text-center text-danger">{{ p.d6 }}</td>
            <td class="mono text-center">{{ p.d7 }}</td>
            <td class="text-center">
              <GBadge tone="healthy">{{ p.status }}</GBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </GCard>

    <GAlert tone="warning" icon="alert">
      依勞動基準法第 36 條規定，勞工每七日中應有二日之休息，其中一日為例假，一日為休息日。匯入班表時系統將自動檢核是否有連續出勤逾 6 日之違規情事。
    </GAlert>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.upload-card {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.card-title {
  font-size: 16px;
}
.upload-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  align-items: flex-end;
}
.form-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.form-label {
  font-size: 13px;
  color: var(--color-faint);
}
.dropzone {
  border: 2px dashed var(--color-border);
  border-radius: 8px;
  padding: 30px 20px;
  text-align: center;
  background: var(--color-surface);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  transition: border-color 0.15s;
}
.dropzone:hover {
  border-color: var(--color-primary);
}
.drop-icon {
  font-size: 32px;
}
.drop-title {
  font-size: 15px;
}
.success-alert {
  margin-top: 4px;
}
.table-wrapper {
  overflow-x: auto;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.table-title {
  font-size: 14.5px;
}
.table-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.shift-table, .preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.shift-table th, .shift-table td,
.preview-table th, .preview-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}
.shift-table th, .preview-table th {
  background: var(--color-surface-hover);
  text-align: left;
  font-weight: 600;
}
.text-center { text-align: center; }
.font-bold { font-weight: 600; }
</style>
