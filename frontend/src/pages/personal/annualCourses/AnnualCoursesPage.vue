<script setup lang="ts">
/**
 * 年度必上課程 (對齊 old_PortalSolar PersonalAnnualCurse.aspx)
 * 供同仁檢視本年度環安衛、工安法規、資訊安全、誠信經營等必修訓練課程完成進度。
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GProgress, GStatCard } from '@/ui';

const employee = {
  dept: 'V1420 資訊服務部',
  empNo: 'V112001',
  name: '蔣佳緯',
  title: '資深全端工程師',
  year: '2026 年度',
  deductionPoints: 0,
  activeStatus: '在職',
};

interface CourseItem {
  id: string;
  name: string;
  category: string;
  requiredHours: number;
  status: 'passed' | 'pending';
  completionDate?: string;
  deadline: string;
  score?: number;
}

const courses: CourseItem[] = [
  { id: 'C01', name: '自衛消防編組訓練', category: '環安工安', requiredHours: 4, status: 'passed', completionDate: '2026/03/15', deadline: '2026/12/31', score: 95 },
  { id: 'C02', name: '危害通識與化學品安全', category: '環安工安', requiredHours: 3, status: 'passed', completionDate: '2026/04/10', deadline: '2026/12/31', score: 90 },
  { id: 'C03', name: '基層主管安全衛生管理', category: '管理專業', requiredHours: 2, status: 'passed', completionDate: '2026/05/20', deadline: '2026/12/31', score: 100 },
  { id: 'C04', name: 'SCBA 空氣呼吸防護具操作', category: '特殊作業', requiredHours: 2, status: 'passed', completionDate: '2026/06/18', deadline: '2026/12/31', score: 92 },
  { id: 'C05', name: 'ESH 永續專題報告', category: '環安工安', requiredHours: 2, status: 'passed', completionDate: '2026/07/05', deadline: '2026/12/31', score: 88 },
  { id: 'C06', name: '企業資訊安全防護與社交工程宣導', category: '資訊安全', requiredHours: 3, status: 'passed', completionDate: '2026/08/12', deadline: '2026/12/31', score: 100 },
  { id: 'C07', name: '營業秘密保護及反詐欺防制', category: '法規法遵', requiredHours: 2, status: 'passed', completionDate: '2026/09/02', deadline: '2026/12/31', score: 95 },
  { id: 'C08', name: '職場性騷擾防治及友善職場教育', category: '性平法規', requiredHours: 2, status: 'passed', completionDate: '2026/09/15', deadline: '2026/12/31', score: 96 },
  { id: 'C09', name: '職場霸凌防制與申訴管道', category: '友善職場', requiredHours: 1, status: 'pending', deadline: '2026/11/30' },
  { id: 'C10', name: '職場霸凌防制 (主管篇)', category: '管理法遵', requiredHours: 1, status: 'pending', deadline: '2026/11/30' },
  { id: 'C11', name: '職場霸凌調查小組運作規範', category: '管理法遵', requiredHours: 1, status: 'passed', completionDate: '2026/08/25', deadline: '2026/12/31', score: 90 },
  { id: 'C12', name: 'HSF 無有害物質通識課程', category: '品質保證', requiredHours: 2, status: 'passed', completionDate: '2026/07/22', deadline: '2026/12/31', score: 94 },
];
</script>

<template>
  <div class="annual-courses-page stack">
    <!-- 個人基本卡 -->
    <GCard title="同仁受訓受測資格概況" icon="user" class="glass">
      <div class="profile-grid">
        <div class="grid-cell"><span class="k">受訓同仁</span><span class="v font-bold">{{ employee.name }} ({{ employee.empNo }})</span></div>
        <div class="grid-cell"><span class="k">所屬部門</span><span class="v">{{ employee.dept }}</span></div>
        <div class="grid-cell"><span class="k">職稱</span><span class="v">{{ employee.title }}</span></div>
        <div class="grid-cell"><span class="k">考訓年度</span><span class="v mono font-bold text-primary">{{ employee.year }}</span></div>
        <div class="grid-cell"><span class="k">未完訓扣分</span><span class="v mono text-success">{{ employee.deductionPoints }} 分</span></div>
        <div class="grid-cell"><span class="k">在職狀態</span><span class="v"><GBadge tone="storage">{{ employee.activeStatus }}</GBadge></span></div>
      </div>
    </GCard>

    <div class="grid-stats">
      <GStatCard label="年度必修總門檻" value="12 門課" tone="neutral" icon="award" meta="法定 25 訓練時數" />
      <GStatCard label="已完訓通過門數" value="10 門課" tone="primary" icon="check" meta="完訓率 83.3%" />
      <GStatCard label="尚待完訓門數" value="2 門課" tone="alert" icon="clock" meta="請於 11/30 前完訓" />
      <GStatCard label="平均測驗成績" value="93.8 分" tone="primary" icon="trending-up" meta="成績合格" />
    </div>

    <!-- 課程清單 -->
    <GCard title="年度全員必修課程進度明細" icon="check-square" class="glass">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>課程代號</th>
              <th>課程名稱</th>
              <th>所屬領域</th>
              <th>時數</th>
              <th>測驗分數</th>
              <th>完訓日期</th>
              <th>截止期限</th>
              <th>受訓狀態</th>
              <th class="text-center">數位學習入口</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in courses" :key="c.id">
              <td class="mono font-bold">{{ c.id }}</td>
              <td><strong>{{ c.name }}</strong></td>
              <td><GBadge tone="neutral">{{ c.category }}</GBadge></td>
              <td class="mono">{{ c.requiredHours }}h</td>
              <td class="mono font-bold" :class="c.score ? 'text-primary' : 'faint'">
                {{ c.score ? `${c.score} 分` : '-' }}
              </td>
              <td class="mono small">{{ c.completionDate || '-' }}</td>
              <td class="mono small">{{ c.deadline }}</td>
              <td>
                <GBadge :tone="c.status === 'passed' ? 'primary' : 'alert'">
                  {{ c.status === 'passed' ? '合格' : '待受訓' }}
                </GBadge>
              </td>
              <td class="text-center">
                <GButton
                  v-if="c.status === 'pending'"
                  variant="primary"
                  size="small"
                  icon="play"
                >
                  開始上課
                </GButton>
                <span v-else class="text-success small">已合格通過</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>

    <GAlert tone="neutral" icon="info">
      依職業安全衛生法與勞動部法規，年度必修課程為全員法定義務。未於年度截止前完成並通過線上測驗者，將列入個人年度績效評核扣分項目。
    </GAlert>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.profile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.grid-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--glass-soft);
}
.grid-cell .k {
  font-size: var(--fs-xs);
  color: var(--text-3);
}
.grid-cell .v {
  font-size: var(--fs-sm);
  color: var(--text);
}
.grid-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
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
.text-success {
  color: #10b981;
}
</style>
