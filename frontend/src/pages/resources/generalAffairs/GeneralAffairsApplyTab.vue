<script setup lang="ts">
/**
 * 總務申請專區 (對齊 old_PortalSolar GAffairs.aspx Tab2 子分頁: 宿舍/停車證/公務車/修繕/文具)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GSelect } from '@/ui';

const currentSubTab = ref<'car' | 'dorm' | 'parking' | 'repair' | 'stationery'>('car');

// 公務車申請表單
const carForm = ref({
  date: '2026-10-15',
  startTime: '09:00',
  endTime: '17:00',
  passengers: '3',
  destination: '新竹科學園區 台灣半導體中心',
  purpose: '拜訪客戶並交付試產銀膠樣品',
});

// 文具請領項目清單
const stationeryItems = ref([
  { id: 'S01', name: '0.5mm 黑色原子筆 (支)', qty: 2, checked: true },
  { id: 'S02', name: 'A4 雙面影印紙 70g (包)', qty: 1, checked: true },
  { id: 'S03', name: '黃色便利貼 3x3 (本)', qty: 1, checked: false },
  { id: 'S04', name: '10 號訂書針 (盒)', qty: 1, checked: false },
  { id: 'S05', name: '雙面膠帶 12mm (捲)', qty: 1, checked: false },
]);

const isCarSubmitted = ref(false);
const isStationerySubmitted = ref(false);
</script>

<template>
  <div class="ga-apply-tab stack">
    <!-- 子導覽分類 -->
    <div class="sub-nav-row">
      <button
        type="button"
        class="sub-tab-btn"
        :class="{ active: currentSubTab === 'car' }"
        @click="currentSubTab = 'car'"
      >
        公務車預約 (Tab2_3)
      </button>
      <button
        type="button"
        class="sub-tab-btn"
        :class="{ active: currentSubTab === 'stationery' }"
        @click="currentSubTab = 'stationery'"
      >
        文具用品申領 (Tab2_5)
      </button>
      <button
        type="button"
        class="sub-tab-btn"
        :class="{ active: currentSubTab === 'parking' }"
        @click="currentSubTab = 'parking'"
      >
        停車證登記 (Tab2_2)
      </button>
      <button
        type="button"
        class="sub-tab-btn"
        :class="{ active: currentSubTab === 'dorm' }"
        @click="currentSubTab = 'dorm'"
      >
        員工宿舍申請 (Tab2_1)
      </button>
      <button
        type="button"
        class="sub-tab-btn"
        :class="{ active: currentSubTab === 'repair' }"
        @click="currentSubTab = 'repair'"
      >
        修繕及五金用品 (Tab2_4)
      </button>
    </div>

    <!-- 1. 公務車預約 -->
    <GCard v-if="currentSubTab === 'car'" title="公務車線上預約借用" icon="car" class="glass">
      <form class="apply-form stack" @submit.prevent="isCarSubmitted = true">
        <div class="form-grid">
          <div>
            <label class="form-label">預計用車日期</label>
            <GInput v-model="carForm.date" type="date" />
          </div>
          <div>
            <label class="form-label">用車時段</label>
            <div class="time-range">
              <GInput v-model="carForm.startTime" type="time" />
              <span class="faint">~</span>
              <GInput v-model="carForm.endTime" type="time" />
            </div>
          </div>
          <div>
            <label class="form-label">同行人數</label>
            <GInput v-model="carForm.passengers" type="number" />
          </div>
          <div>
            <label class="form-label">前往目的地</label>
            <GInput v-model="carForm.destination" placeholder="例如：新竹科學園區、桃園機場" />
          </div>
        </div>
        <div>
          <label class="form-label">公務事由與拜訪對象</label>
          <GInput v-model="carForm.purpose" placeholder="詳細說明用車公務事由" />
        </div>
        <div class="form-actions">
          <GButton type="submit" variant="primary" icon="send">送出派車申請</GButton>
        </div>
        <GAlert v-if="isCarSubmitted" tone="positive" icon="check-circle">
          公務車借用預約已送出！總務組將於每日 16:00 前完成車輛調派審核並發送派車簡訊。
        </GAlert>
      </form>
    </GCard>

    <!-- 2. 文具用品申領 -->
    <GCard v-else-if="currentSubTab === 'stationery'" title="每月常態性辦公文具線上請領" icon="edit-3" class="glass">
      <div class="stack">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th width="60" class="text-center">勾選</th>
                <th>品項代號</th>
                <th>文具品名與規格規格</th>
                <th width="150">申請領用數量</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in stationeryItems" :key="it.id">
                <td class="text-center">
                  <input v-model="it.checked" type="checkbox" />
                </td>
                <td class="mono font-bold">{{ it.id }}</td>
                <td>{{ it.name }}</td>
                <td>
                  <GInput v-model.number="it.qty" type="number" :disabled="!it.checked" style="width: 100px" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="form-actions">
          <GButton variant="primary" icon="check" @click="isStationerySubmitted = true">確認請領清單</GButton>
        </div>
        <GAlert v-if="isStationerySubmitted" tone="positive" icon="check-circle">
          文具耗材申領清單已送交總務庫存組！預計於本週五下午配送至各部門座位。
        </GAlert>
      </div>
    </GCard>

    <!-- 3. 停車證登記 -->
    <GCard v-else-if="currentSubTab === 'parking'" title="汽機車停車識別證申請與登記" icon="truck" class="glass">
      <div class="form-grid stack">
        <div><label class="form-label">車輛類別</label><GSelect :options="[{ label: '汽車停車證', value: 'car' }, { label: '機車停車證', value: 'motor' }]" /></div>
        <div><label class="form-label">車牌號碼</label><GInput placeholder="例：ABC-5678" /></div>
        <div><label class="form-label">行照所有人姓名</label><GInput placeholder="限本人、配偶或直系親屬" /></div>
        <div><label class="form-label">廠區停車場志願</label><GSelect :options="[{ label: '湖口一廠平面停車場', value: 'p1' }, { label: '湖口二廠地下停車場', value: 'p2' }]" /></div>
        <div class="form-actions"><GButton variant="primary" icon="send">送出車證申請</GButton></div>
      </div>
    </GCard>

    <!-- 4. 宿舍申請 -->
    <GCard v-else-if="currentSubTab === 'dorm'" title="員工單身宿舍床位申請" icon="home" class="glass">
      <div class="form-grid stack">
        <div><label class="form-label">戶籍地址</label><GInput placeholder="非新竹地區同仁優先分配" /></div>
        <div><label class="form-label">預計入住日期</label><GInput type="date" /></div>
        <div><label class="form-label">房型需求</label><GSelect :options="[{ label: '雙人套房', value: 'double' }, { label: '單人雅房', value: 'single' }]" /></div>
        <div class="form-actions"><GButton variant="primary" icon="send">提出宿舍申請</GButton></div>
      </div>
    </GCard>

    <!-- 5. 修繕報修 -->
    <GCard v-else title="水電設施修繕與五金用品報修" icon="wrench" class="glass">
      <div class="form-grid stack">
        <div><label class="form-label">報修地點 / 樓層</label><GInput placeholder="例：湖口一廠 3F 資訊部茶水間" /></div>
        <div><label class="form-label">損壞項目類別</label><GSelect :options="[{ label: '照明燈具損壞', value: 'light' }, { label: '空調冷氣異常', value: 'ac' }, { label: '給排水堵塞', value: 'pipe' }, { label: '門窗與五金修繕', value: 'door' }]" /></div>
        <div><label class="form-label">問題現況說明</label><GInput placeholder="請描述損壞情況與緊急程度" /></div>
        <div class="form-actions"><GButton variant="primary" icon="send">提交工務修繕單</GButton></div>
      </div>
    </GCard>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.sub-nav-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.sub-tab-btn {
  padding: 8px 16px;
  border: 0;
  border-radius: 8px;
  background: var(--glass-soft);
  color: var(--text-2);
  font: inherit;
  font-size: var(--fs-sm);
  cursor: pointer;
  transition: all var(--dur);
}
.sub-tab-btn:hover {
  background: var(--glass-hover);
  color: var(--text);
}
.sub-tab-btn.active {
  background: var(--c-primary);
  color: var(--on-primary);
  font-weight: 600;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}
.form-label {
  display: block;
  font-weight: 600;
  font-size: var(--fs-sm);
  margin-bottom: 6px;
  color: var(--text-2);
}
.time-range {
  display: flex;
  align-items: center;
  gap: 8px;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
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
