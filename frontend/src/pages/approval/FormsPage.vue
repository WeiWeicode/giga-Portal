<script setup lang="ts">
/**
 * 表單下載專區 (對齊 old_PortalSolar forms)
 * 供全體同仁依職能分類檢索並下載行政、人事、財務、資訊各項標準表單檔案。
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput } from '@/ui';

const selectedCat = ref('all');
const searchKeyword = ref('');

interface FormDoc {
  id: string;
  category: string;
  name: string;
  ext: 'PDF' | 'Word' | 'Excel';
  dept: string;
  updateDate: string;
  downloads: number;
}

const forms: FormDoc[] = [
  { id: 'HR-F01', category: '人事考勤', name: '員工公傷假與團體保險理賠申請書', ext: 'PDF', dept: '人資部', updateDate: '2026/08/10', downloads: 312 },
  { id: 'HR-F02', category: '人事考勤', name: '未刷卡證明單 (紙本備用)', ext: 'Word', dept: '人資部', updateDate: '2026/05/18', downloads: 890 },
  { id: 'GA-F01', category: '總務行政', name: '湖口廠區同仁宿舍床位申請/退宿登記表', ext: 'Word', dept: '總務組', updateDate: '2026/04/01', downloads: 145 },
  { id: 'GA-F02', category: '總務行政', name: '汽機車停車證申請與換發登記表', ext: 'PDF', dept: '總務組', updateDate: '2026/07/20', downloads: 420 },
  { id: 'IT-F01', category: '資訊服務', name: 'VPN 遠端連線與軟硬體帳號權限申請單', ext: 'Word', dept: '資訊服務部', updateDate: '2026/09/01', downloads: 560 },
  { id: 'IT-F02', category: '資訊服務', name: '機密資料攜出與非標準軟體安裝申請書', ext: 'PDF', dept: '資訊服務部', updateDate: '2026/08/25', downloads: 210 },
  { id: 'FN-F01', category: '財務會計', name: '同仁差旅國內外雜支與代墊款費用報支清冊', ext: 'Excel', dept: '財務部', updateDate: '2026/06/15', downloads: 1040 },
  { id: 'SH-F01', category: '職業安全', name: '危害性化學物質作業環境安全評估表', ext: 'PDF', dept: '環安室', updateDate: '2026/03/12', downloads: 98 },
];

const categories = [
  { label: '全部表單', value: 'all' },
  { label: '人事考勤', value: '人事考勤' },
  { label: '總務行政', value: '總務行政' },
  { label: '資訊服務', value: '資訊服務' },
  { label: '財務會計', value: '財務會計' },
  { label: '職業安全', value: '職業安全' },
];

const filteredForms = computed(() => {
  return forms.filter((f) => {
    const matchCat = selectedCat.value === 'all' || f.category === selectedCat.value;
    const matchKw = !searchKeyword.value || f.name.includes(searchKeyword.value) || f.id.includes(searchKeyword.value);
    return matchCat && matchKw;
  });
});
</script>

<template>
  <div class="forms-page stack">
    <GCard class="filter-card glass">
      <div class="filter-row">
        <div class="cat-tabs">
          <button
            v-for="cat in categories"
            :key="cat.value"
            type="button"
            class="cat-btn"
            :class="{ active: selectedCat === cat.value }"
            @click="selectedCat = cat.value"
          >
            {{ cat.label }}
          </button>
        </div>
        <div class="search-wrap">
          <GInput v-model="searchKeyword" placeholder="搜尋表單名稱或代號..." style="width: 220px" />
        </div>
      </div>
    </GCard>

    <GCard title="標準行政與申請表單清單" icon="file-down" class="glass">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>表單代號</th>
              <th>分類</th>
              <th>表單名稱</th>
              <th>格式</th>
              <th>主管業務單位</th>
              <th>最新版本日期</th>
              <th class="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in filteredForms" :key="f.id">
              <td class="mono font-bold">{{ f.id }}</td>
              <td><GBadge tone="storage">{{ f.category }}</GBadge></td>
              <td><strong>{{ f.name }}</strong></td>
              <td>
                <GBadge :tone="f.ext === 'PDF' ? 'danger' : f.ext === 'Excel' ? 'primary' : 'neutral'">
                  {{ f.ext }}
                </GBadge>
              </td>
              <td>{{ f.dept }}</td>
              <td class="mono small">{{ f.updateDate }}</td>
              <td class="text-center">
                <GButton variant="secondary" size="small" icon="download">下載表單</GButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>

    <GAlert tone="neutral" icon="info">
      若該項作業已支援線上電子簽核，建議優先前往「個人資訊 -> BPM 簽核資訊」發起電子表單，以節省紙本核印時間並達成無紙化作業。
    </GAlert>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.filter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.cat-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.cat-btn {
  padding: 6px 14px;
  border: 0;
  border-radius: 8px;
  background: var(--glass-soft);
  color: var(--text-2);
  font: inherit;
  font-size: var(--fs-sm);
  cursor: pointer;
  transition: all var(--dur);
}
.cat-btn:hover {
  background: var(--glass-hover);
  color: var(--text);
}
.cat-btn.active {
  background: var(--c-primary);
  color: var(--on-primary);
  font-weight: 600;
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
</style>
