<script setup lang="ts">
/**
 * 晉升地圖與職能要求矩陣 (對齊 old_PortalSolar HRMPromoteMap.aspx)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GSelect } from '@/ui';

const selectedTrack = ref('工程研發職系');

interface PromotionStep {
  level: string;
  grade: string;
  minYears: string;
  kpiReq: string;
  courses: string[];
  hoursReq: string;
  certReq: string;
  deliverables: string;
}

const tracks: Record<string, PromotionStep[]> = {
  工程研發職系: [
    {
      level: '工程師',
      grade: 'Grade 5',
      minYears: '現職滿 1 年',
      kpiReq: '近 1 年考績達 A (85分) 以上',
      courses: ['進階實驗設計 (DOE)', '材料流變學分析', '智財專利檢索基礎'],
      hoursReq: '年度內外訓累計滿 24 小時',
      certReq: '無特定證照限制',
      deliverables: '完成 1 項新材料配方或產品製程優化專案報告',
    },
    {
      level: '高級工程師',
      grade: 'Grade 6',
      minYears: '現職滿 2 年',
      kpiReq: '近 2 年考績至少 1 次 A+ (90分) 且無 B 以下',
      courses: ['跨領域技術整合', 'TOPCon 電池關鍵技術', '研發專案管理實務 (PMP)'],
      hoursReq: '年度受訓滿 36 小時',
      certReq: '研發工程師專業認證 / ESG 碳足跡評估初級',
      deliverables: '主導 1 項跨部門量產驗證案或取得 1 篇發明專利申請',
    },
    {
      level: '資深工程師 / 專案主任',
      grade: 'Grade 7~8',
      minYears: '現職滿 3 年',
      kpiReq: '近 3 年考績累計優等，具主管推薦信',
      courses: ['領導力發展 (LDP)', '次世代太陽能電池架構', '研發智財策略布局'],
      hoursReq: '年度受訓滿 48 小時',
      certReq: '進階專業資格 / 綠色化學設計認證',
      deliverables: '完成國際客戶關鍵技術導入，或發表專利成果轉化商品化效益',
    },
  ],
  生產技術職系: [
    {
      level: '技術專員',
      grade: 'Grade 4',
      minYears: '現職滿 1 年',
      kpiReq: '年度出勤操守優良，考績 A 以上',
      courses: ['精實生產 (Lean)', '機台預防保養 TPM', '品質管制作業 SPC'],
      hoursReq: '年度受訓滿 20 小時',
      certReq: '具備特種機械操作證照',
      deliverables: '產線稼動率提升專案報告',
    },
    {
      level: '製造副課長 / 課長',
      grade: 'Grade 7~8',
      minYears: '現職滿 2 年',
      kpiReq: '近 2 年產線良率考核達標，無重大工安事件',
      courses: ['基層主管實戰訓練', 'ISO9001/45001 內部稽核員', '問題分析與解決 (8D)'],
      hoursReq: '年度受訓滿 40 小時',
      certReq: '乙級職業安全衛生管理主管證照',
      deliverables: '年度製程良率改善超過 2% 成果報告',
    },
  ],
  經營管理職系: [
    {
      level: '管理師 / 主任',
      grade: 'Grade 6~7',
      minYears: '現職滿 2 年',
      kpiReq: '考績連續 2 年 A 以上',
      courses: ['中階主管領導力', '企業財務報表分析', '職場溝通與談判協商'],
      hoursReq: '年度受訓滿 32 小時',
      certReq: '專業執照 / 專業證書',
      deliverables: '部門營運流程優化專案提案',
    },
    {
      level: '副理 / 經理',
      grade: 'Grade 9~10',
      minYears: '現職滿 3 年',
      kpiReq: '年度 KPI 目標達成率超標，經處長推薦',
      courses: ['策略思維與決策管理', '組織變革引導', '預算管理與成本控制'],
      hoursReq: '年度受訓滿 48 小時',
      certReq: '高階經營主管認證',
      deliverables: '主導組織重大革新專案並通過經營會議審查',
    },
  ],
};

const currentSteps = computed(() => tracks[selectedTrack.value] ?? []);
</script>

<template>
  <div class="promotion-map-page stack">
    <!-- 頂部指引 -->
    <GCard class="glass banner-card">
      <div class="banner-top">
        <div>
          <h4 class="m-0">集團內部雙軌職涯晉升矩陣地圖</h4>
          <span class="faint small">提供「專業技術職系」與「經營管理職系」之透明化職等晉升標準與必備條件</span>
        </div>
      </div>
    </GCard>

    <!-- 職系選擇切換 -->
    <GCard class="glass filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <label class="filter-label">選擇查詢職系</label>
          <GSelect
            v-model="selectedTrack"
            :options="[
              { label: '工程研發職系', value: '工程研發職系' },
              { label: '生產技術職系', value: '生產技術職系' },
              { label: '經營管理職系', value: '經營管理職系' },
            ]"
          />
        </div>
      </div>
    </GCard>

    <!-- 晉升矩陣卡片清單 -->
    <div class="steps-stack">
      <GCard v-for="step in currentSteps" :key="step.level" class="glass step-card">
        <div class="step-header">
          <div class="title-wrap">
            <h4 class="step-title font-bold text-primary">{{ step.level }}</h4>
            <GBadge tone="storage">{{ step.grade }}</GBadge>
          </div>
          <span class="faint small mono">年資門檻：<strong>{{ step.minYears }}</strong></span>
        </div>

        <div class="criteria-grid">
          <div class="crit-box">
            <span class="crit-label font-bold">🎯 績效考績門檻</span>
            <span class="crit-val small">{{ step.kpiReq }}</span>
          </div>
          <div class="crit-box">
            <span class="crit-label font-bold">⏱️ 受訓時數要求</span>
            <span class="crit-val small">{{ step.hoursReq }}</span>
          </div>
          <div class="crit-box">
            <span class="crit-label font-bold">📜 證照資格要求</span>
            <span class="crit-val small">{{ step.certReq }}</span>
          </div>
          <div class="crit-box">
            <span class="crit-label font-bold">💡 具體專案產出成果</span>
            <span class="crit-val small">{{ step.deliverables }}</span>
          </div>
        </div>

        <div class="courses-box">
          <span class="crit-label font-bold">📚 必要核心修習課程：</span>
          <div class="course-tags">
            <GBadge v-for="c in step.courses" :key="c" tone="healthy">
              {{ c }}
            </GBadge>
          </div>
        </div>
      </GCard>
    </div>

    <GAlert tone="neutral" icon="info">
      每年 10 月啟動年度晉升考核初審程序，各級主管可依此晉升條件矩陣對部屬進行資格檢視並提出晉升提報案。
    </GAlert>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.banner-card {
  padding: 16px 20px;
}
.banner-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.m-0 { margin: 0; }
.filter-card {
  padding: 12px 16px;
}
.filter-row {
  display: flex;
}
.filter-item {
  width: 240px;
}
.filter-label {
  display: block;
  font-size: 13px;
  color: var(--color-faint);
  margin-bottom: 4px;
}
.steps-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.step-card {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 10px;
}
.title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
.step-title {
  margin: 0;
  font-size: 17px;
}
.criteria-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}
.crit-box {
  padding: 10px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.crit-label {
  font-size: 13px;
}
.crit-val {
  color: var(--color-foreground);
  line-height: 1.4;
}
.courses-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: rgba(16, 185, 129, 0.05);
  padding: 10px 14px;
  border-radius: 6px;
}
.course-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.font-bold { font-weight: 600; }
</style>
