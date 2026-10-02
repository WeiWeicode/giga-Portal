<script setup lang="ts">
/**
 * 內部職缺申請 (對齊 old_PortalSolar JobOpening.aspx)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GModal, GSelect } from '@/ui';

interface JobOpening {
  id: string;
  title: string;
  dept: string;
  location: string;
  headcount: number;
  postDate: string;
  deadline: string;
  requirements: string[];
  description: string;
  contact: string;
  status: '熱門急徵' | '開放申請' | '即將截止';
}

const jobs = ref<JobOpening[]>([
  {
    id: 'JOB-2026-001',
    title: '資深全端系統架構師 (Portal / Gateway)',
    dept: '資訊服務部',
    location: '湖口一廠 3F',
    headcount: 1,
    postDate: '2026-09-20',
    deadline: '2026-10-31',
    status: '熱門急徵',
    contact: '資訊部 林協理 (# 2100) / 人資部 張專員 (# 1210)',
    requirements: [
      '具備 3 年以上 Vue 3 / TypeScript / Node.js 系統開發實務經驗。',
      '熟悉 Docker 容器化部屬、CI/CD 自動化建置及微服務架構。',
      '具備良好的跨部門溝通能力與問題排查技術熱忱。',
    ],
    description: '負責集團單一入口 (GigaNexus) 新一代前端與 BFF 微服務架構重構，規劃與推動企業系統雲原生現代化轉型。',
  },
  {
    id: 'JOB-2026-002',
    title: '太陽能導電銀鋁漿研發工程師',
    dept: '先進材料研發處',
    location: '湖口一廠 研發實驗室',
    headcount: 2,
    postDate: '2026-09-15',
    deadline: '2026-11-15',
    status: '開放申請',
    contact: '研發處 黃副總 (# 3300) / 人資部 張專員 (# 1210)',
    requirements: [
      '化學工程、材料科學或光電材料相關研究所碩士以上學歷。',
      '熟悉金屬粉末表面處理、高分子黏著劑配方合成與網印流變特性測試。',
      '具備太陽能電池 N 型 TOPCon 或異質結 (HJT) 漿料開發經驗者尤佳。',
    ],
    description: '進行新世代高效太陽能電池正面超細線印刷導電漿料配方調配、燒結特性測試與客戶端產線試印驗證。',
  },
  {
    id: 'JOB-2026-003',
    title: '智慧電站綠能維運主管 (O&M Manager)',
    dept: '禾迅綠電 維運事業部',
    location: '新豐廠 / 外勤案場巡檢',
    headcount: 1,
    postDate: '2026-09-01',
    deadline: '2026-10-15',
    status: '即將截止',
    contact: '維運部 鄧經理 (# 4100) / 人資部 張專員 (# 1210)',
    requirements: [
      '大專以上電機、電子工程相關科系畢，持有乙級以上室內配線或電匠證照。',
      '具備 3 年以上高低壓太陽能發電系統或儲能案場運轉維護經驗。',
      '具備小型客貨車駕照，能配合定期巡檢台灣各縣市電廠案場。',
    ],
    description: '負責地面型及屋頂型太陽能案場遠端監控、逆變器異常排查、預防性定期保養計劃規劃與台電併聯申報。',
  },
  {
    id: 'JOB-2026-004',
    title: '職業安全衛生資深管理師',
    dept: '職業安全衛生室',
    location: '湖口一廠 / 二廠',
    headcount: 1,
    postDate: '2026-09-25',
    deadline: '2026-11-30',
    status: '開放申請',
    contact: '安衛室 何主任 (# 1119) / 人資部 張專員 (# 1210)',
    requirements: [
      '持有「乙級職業安全衛生管理員」或「甲種職業安全衛生業務主管」證照。',
      '熟悉 ISO45001 / ISO14001 職業安全衛生與環境管理系統推展。',
      '具備製造業毒性化學物質申報、作業環境監測與工傷防制三年以上經驗。',
    ],
    description: '規劃與推行全廠工安防護計畫、外包商施工安全管制、消防演練、化學品 SDS 定期更新與年度安衛教育訓練。',
  },
]);

const searchKeyword = ref('');
const deptFilter = ref('');

const filteredJobs = computed(() => {
  return jobs.value.filter((j) => {
    const matchDept = !deptFilter.value || j.dept === deptFilter.value;
    const kw = searchKeyword.value.toLowerCase().trim();
    const matchKw =
      !kw ||
      j.title.toLowerCase().includes(kw) ||
      j.dept.toLowerCase().includes(kw) ||
      j.description.toLowerCase().includes(kw);
    return matchDept && matchKw;
  });
});

const detailModal = ref(false);
const activeJob = ref<JobOpening | null>(null);
const applySubmitted = ref(false);

function viewJob(j: JobOpening) {
  activeJob.value = j;
  applySubmitted.value = false;
  detailModal.value = true;
}

function handleApply() {
  applySubmitted.value = true;
}
</script>

<template>
  <div class="job-opening-page stack">
    <!-- 頂部轉調宣導 Banner -->
    <GCard class="glass promo-banner">
      <div class="promo-content">
        <h3 class="promo-title">🌟 集團內部人才交流與轉調管道</h3>
        <p class="promo-desc faint">
          碩禾集團鼓勵優秀同仁多元跨界發展。在現職服務滿一年以上且近年度考績優良者，均可透過內部應徵管道申請集團內部轉調，發展更廣闊的職涯舞臺！
        </p>
      </div>
    </GCard>

    <!-- 搜尋過濾列 -->
    <GCard class="glass filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <label class="filter-label">職缺關鍵字檢索</label>
          <GInput v-model="searchKeyword" placeholder="搜尋職缺名稱、工作內容、專業技能需求..." />
        </div>
        <div class="filter-item filter-select">
          <label class="filter-label">招聘部門</label>
          <GSelect
            v-model="deptFilter"
            :options="[
              { label: '全部部門', value: '' },
              { label: '資訊服務部', value: '資訊服務部' },
              { label: '先進材料研發處', value: '先進材料研發處' },
              { label: '禾迅綠電 維運事業部', value: '禾迅綠電 維運事業部' },
              { label: '職業安全衛生室', value: '職業安全衛生室' },
            ]"
          />
        </div>
      </div>
    </GCard>

    <!-- 職缺列表卡片 -->
    <div class="jobs-grid">
      <GCard v-for="j in filteredJobs" :key="j.id" class="glass job-card">
        <div class="job-top">
          <div class="job-header">
            <h4 class="job-title">{{ j.title }}</h4>
            <GBadge :tone="j.status === '熱門急徵' ? 'warning' : j.status === '即將截止' ? 'danger' : 'healthy'">
              {{ j.status }}
            </GBadge>
          </div>
          <span class="faint small">{{ j.dept }} ｜ {{ j.location }} ｜ 需求人數: {{ j.headcount }} 名</span>
        </div>

        <p class="job-summary faint small">{{ j.description }}</p>

        <div class="job-bottom">
          <span class="mono extra-small faint">申請截止日：{{ j.deadline }}</span>
          <GButton size="sm" tone="primary" @click="viewJob(j)">檢視詳情與應徵</GButton>
        </div>
      </GCard>
    </div>

    <!-- 職缺詳情與申請 Modal -->
    <GModal v-model="detailModal" :title="activeJob?.title ?? '職缺詳細資訊'" width="650px">
      <div v-if="activeJob" class="modal-job-stack">
        <div class="job-meta-row">
          <div><strong>招聘單位：</strong>{{ activeJob.dept }}</div>
          <div><strong>工作地點：</strong>{{ activeJob.location }}</div>
          <div><strong>截止日期：</strong><span class="mono">{{ activeJob.deadline }}</span></div>
        </div>

        <div class="job-sec">
          <strong class="sec-title">工作職責與工作內容：</strong>
          <p class="sec-text small">{{ activeJob.description }}</p>
        </div>

        <div class="job-sec">
          <strong class="sec-title">職務資格與技能條件：</strong>
          <ul class="req-list small">
            <li v-for="(r, idx) in activeJob.requirements" :key="idx">{{ r }}</li>
          </ul>
        </div>

        <div class="job-sec">
          <strong class="sec-title">應徵洽詢窗口：</strong>
          <span class="small faint">{{ activeJob.contact }}</span>
        </div>

        <div v-if="applySubmitted" class="applied-alert">
          <GAlert tone="healthy" icon="check">
            內部轉調意向申請已成功送出！人資專員將於 3 個工作天內主動與您聯繫並安排面談。
          </GAlert>
        </div>
      </div>
      <template #footer>
        <GButton variant="secondary" @click="detailModal = false">關閉</GButton>
        <GButton v-if="!applySubmitted" tone="primary" @click="handleApply">提出內部轉調申請</GButton>
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
.promo-banner {
  padding: 18px 20px;
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%);
}
.promo-title {
  margin: 0 0 6px 0;
  font-size: 18px;
}
.promo-desc {
  margin: 0;
  font-size: 14px;
}
.filter-card {
  padding: 12px 16px;
}
.filter-row {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.filter-item {
  flex: 1;
  min-width: 220px;
}
.filter-select {
  max-width: 220px;
}
.filter-label {
  display: block;
  font-size: 13px;
  color: var(--color-faint);
  margin-bottom: 4px;
}
.jobs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}
.job-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 18px;
}
.job-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}
.job-title {
  margin: 0 0 4px 0;
  font-size: 16px;
}
.job-summary {
  line-height: 1.5;
  margin: 0;
}
.job-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--color-border);
  padding-top: 10px;
}
.modal-job-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.job-meta-row {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--color-border);
  font-size: 14px;
}
.job-sec {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sec-title {
  font-size: 14px;
}
.sec-text {
  margin: 0;
  line-height: 1.5;
}
.req-list {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.applied-alert {
  margin-top: 8px;
}
.extra-small {
  font-size: 12px;
}
</style>
