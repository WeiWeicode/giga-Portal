<script setup lang="ts">
/**
 * 個人保管資產清冊 (對齊 old_PortalSolar PersonalPropertyInfo.aspx GridView1)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GModal } from '@/ui';

interface AssetRecord {
  assetNo: string;
  subNo: string;
  category: string;
  nameZh: string;
  nameEn: string;
  model: string;
  location: string;
  entryDate: string;
  custodian: string;
  note: string;
}

const assets = ref<AssetRecord[]>([
  {
    assetNo: 'FA20230045',
    subNo: '00',
    category: '生財器具 - 資訊設備',
    nameZh: '商用筆記型電腦 ThinkPad X1 Carbon',
    nameEn: 'Lenovo ThinkPad X1 Carbon Gen 11',
    model: 'i7-1365U / 32G / 1TB SSD',
    location: '湖口一廠 3F 資訊服務部 A301',
    entryDate: '2023/05/10',
    custodian: '蔣佳緯 (V112001)',
    note: '開發專案配發主機',
  },
  {
    assetNo: 'FA20230088',
    subNo: '00',
    category: '生財器具 - 資訊設備',
    nameZh: '27 吋 4K 專業螢幕 Dell U2723QE',
    nameEn: 'Dell UltraSharp 27 4K USB-C Hub Monitor',
    model: 'Dell U2723QE IPS Black',
    location: '湖口一廠 3F 資訊服務部 A301',
    entryDate: '2023/05/15',
    custodian: '蔣佳緯 (V112001)',
    note: '雙螢幕開發環境配置',
  },
  {
    assetNo: 'FA20210312',
    subNo: '00',
    category: '生財器具 - 辦公傢俱',
    nameZh: '人體工學網布高背辦公椅',
    nameEn: 'Ergonomic Office Mesh Chair',
    model: 'B-Type 黑色',
    location: '湖口一廠 3F 資訊服務部 A301',
    entryDate: '2021/04/15',
    custodian: '蔣佳緯 (V112001)',
    note: '座位固定配置',
  },
]);

const editModal = ref(false);
const activeItem = ref<AssetRecord | null>(null);

function editNote(item: AssetRecord) {
  activeItem.value = { ...item };
  editModal.value = true;
}

function saveNote() {
  if (!activeItem.value) return;
  const target = assets.value.find((a) => a.assetNo === activeItem.value?.assetNo);
  if (target) target.note = activeItem.value.note;
  editModal.value = false;
}
</script>

<template>
  <div class="property-current-tab stack">
    <div class="actions-bar">
      <div class="summary-badge">
        <GBadge tone="storage" icon="package">本人保管資產共 {{ assets.length }} 項</GBadge>
      </div>
      <div class="button-group">
        <GButton variant="secondary" icon="download">匯出資產清冊 (Excel)</GButton>
      </div>
    </div>

    <GCard title="本人保管之固定資產與辦公設備清冊" icon="layers" class="glass">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>財產編號 / 附號</th>
              <th>資產中文 / 英文名稱</th>
              <th>規格型號</th>
              <th>存放位置</th>
              <th>入帳日期</th>
              <th>保管備註</th>
              <th class="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in assets" :key="item.assetNo">
              <td>
                <div class="mono font-bold text-primary">{{ item.assetNo }}</div>
                <div class="mono small faint">附號: {{ item.subNo }}</div>
                <div class="small"><GBadge tone="neutral">{{ item.category }}</GBadge></div>
              </td>
              <td>
                <strong>{{ item.nameZh }}</strong>
                <div class="small faint">{{ item.nameEn }}</div>
              </td>
              <td><span class="mono">{{ item.model }}</span></td>
              <td>{{ item.location }}</td>
              <td class="mono">{{ item.entryDate }}</td>
              <td>
                <span class="faint">{{ item.note || '無備註' }}</span>
              </td>
              <td class="text-center">
                <GButton variant="ghost" size="small" icon="edit" @click="editNote(item)">編輯備註</GButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>

    <GAlert tone="neutral" icon="info">
      依集團固定資產管理辦法，名下保管設備如有損壞、遺失或跨部門人員異動，請及時洽總務資產管理員填寫「資產移轉單」或「資產報廢單」，勿私自互換。
    </GAlert>

    <!-- 編輯備註彈窗 -->
    <GModal v-model:open="editModal" :title="`更新資產備註 - ${activeItem?.assetNo}`">
      <div v-if="activeItem" class="modal-body stack">
        <div><strong>設備名稱：</strong>{{ activeItem.nameZh }}</div>
        <div>
          <label class="form-label">保管狀態與備註備忘</label>
          <GInput v-model="activeItem.note" placeholder="例如：螢幕支架已外借、主機板升級原廠保固等" />
        </div>
        <div class="modal-footer-row">
          <GButton variant="secondary" @click="editModal = false">取消</GButton>
          <GButton variant="primary" icon="check" @click="saveNote">儲存備註</GButton>
        </div>
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
.actions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.button-group {
  display: flex;
  gap: 10px;
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
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
}
.data-table th {
  font-weight: 600;
  color: var(--text-2);
  background: var(--glass-soft);
  text-align: left;
}
.text-center {
  text-align: center;
}
.mono {
  font-family: var(--font-mono, monospace);
}
.font-bold {
  font-weight: 700;
}
.text-primary {
  color: var(--c-primary);
}
.form-label {
  display: block;
  font-weight: 600;
  font-size: var(--fs-sm);
  margin-bottom: 6px;
}
.modal-footer-row {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
}
</style>
