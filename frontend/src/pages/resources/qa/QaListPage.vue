<script setup lang="ts">
/**
 * 問卷調查與滿意度評估 (對齊 old_PortalSolar QA/MyQAList.aspx)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GModal, GSelect } from '@/ui';

interface SurveyItem {
  id: string;
  title: string;
  publisher: string;
  startDate: string;
  endDate: string;
  status: '待填寫' | '已完成' | '已截止';
  questionsCount: number;
}

const surveys = ref<SurveyItem[]>([
  {
    id: 'QA-2026-01',
    title: '2026 年度集團員工工作環境與滿意度綜合調查',
    publisher: '人力資源部',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    status: '待填寫',
    questionsCount: 5,
  },
  {
    id: 'QA-2026-02',
    title: '115 年度湖口廠區員工餐廳供餐與便當滿意度問卷',
    publisher: '總務安全組',
    startDate: '2026-09-15',
    endDate: '2026-10-15',
    status: '已完成',
    questionsCount: 4,
  },
  {
    id: 'QA-2026-03',
    title: '職場母性健康保護與人因危害自主檢核評估表',
    publisher: '職業安全衛生室',
    startDate: '2026-09-01',
    endDate: '2026-10-20',
    status: '待填寫',
    questionsCount: 3,
  },
  {
    id: 'QA-2025-08',
    title: '2025 年終尾牙晚會滿意度與禮品偏好調查',
    publisher: '職工福利委員會',
    startDate: '2025-12-01',
    endDate: '2025-12-25',
    status: '已截止',
    questionsCount: 6,
  },
]);

const fillModal = ref(false);
const activeSurvey = ref<SurveyItem | null>(null);

// 問卷題目模擬
const answers = ref({
  q1: '5', // 單選評分
  q2: '4',
  q3: ['彈性工時調整', '員工進修補助'], // 複選
  q4: '', // 開放回饋
});

function openSurvey(s: SurveyItem) {
  activeSurvey.value = s;
  fillModal.value = true;
}

function submitSurvey() {
  if (activeSurvey.value) {
    activeSurvey.value.status = '已完成';
  }
  fillModal.value = false;
}
</script>

<template>
  <div class="qa-list-page stack">
    <GCard class="glass banner-card">
      <div class="banner-top">
        <div>
          <h3 class="banner-title">📋 企業問卷調查與意見回饋專區</h3>
          <p class="banner-desc faint">
            您的寶貴意見是公司持續改善管理制度與工作環境的最佳動力。請依規定完成待填寫問卷，作答過程均採匿名統計分析。
          </p>
        </div>
      </div>
    </GCard>

    <!-- 問卷列表表格 -->
    <GCard class="glass table-wrapper">
      <table class="qa-table">
        <thead>
          <tr>
            <th>問卷編號</th>
            <th>調查主題名稱</th>
            <th>發起主辦單位</th>
            <th>調查起訖期間</th>
            <th class="text-center">題目數</th>
            <th class="text-center">作答狀態</th>
            <th class="text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in surveys" :key="s.id">
            <td class="mono font-bold">{{ s.id }}</td>
            <td class="font-bold">{{ s.title }}</td>
            <td>
              <GBadge tone="storage">{{ s.publisher }}</GBadge>
            </td>
            <td class="mono small faint">{{ s.startDate }} ~ {{ s.endDate }}</td>
            <td class="text-center mono">{{ s.questionsCount }} 題</td>
            <td class="text-center">
              <GBadge :tone="s.status === '待填寫' ? 'warning' : s.status === '已完成' ? 'healthy' : 'neutral'">
                {{ s.status }}
              </GBadge>
            </td>
            <td class="text-center">
              <GButton
                size="sm"
                :tone="s.status === '待填寫' ? 'primary' : 'secondary'"
                :disabled="s.status === '已截止'"
                @click="openSurvey(s)"
              >
                {{ s.status === '待填寫' ? '填寫問卷' : '檢視結果' }}
              </GButton>
            </td>
          </tr>
        </tbody>
      </table>
    </GCard>

    <!-- 填寫問卷 Modal -->
    <GModal v-model="fillModal" :title="activeSurvey?.title ?? '問卷填寫'" width="620px">
      <div v-if="activeSurvey" class="survey-form-stack">
        <GAlert tone="neutral" icon="info">
          本問卷由「{{ activeSurvey.publisher }}」主辦，統計資料僅供內部改善參考，請安心填答。
        </GAlert>

        <div class="question-block">
          <label class="q-label font-bold">1. 整體而言，您對目前部門工作氣氛與團隊協作的滿意程度？</label>
          <div class="radio-group">
            <label class="radio-label"><input v-model="answers.q1" type="radio" value="5" /> 非常滿意 (5分)</label>
            <label class="radio-label"><input v-model="answers.q1" type="radio" value="4" /> 滿意 (4分)</label>
            <label class="radio-label"><input v-model="answers.q1" type="radio" value="3" /> 普通 (3分)</label>
            <label class="radio-label"><input v-model="answers.q1" type="radio" value="2" /> 不滿意 (2分)</label>
            <label class="radio-label"><input v-model="answers.q1" type="radio" value="1" /> 非常不滿意 (1分)</label>
          </div>
        </div>

        <div class="question-block">
          <label class="q-label font-bold">2. 您對目前廠區各項辦公設施、衛生環境與餐飲供餐的滿意度？</label>
          <div class="radio-group">
            <label class="radio-label"><input v-model="answers.q2" type="radio" value="5" /> 非常滿意 (5分)</label>
            <label class="radio-label"><input v-model="answers.q2" type="radio" value="4" /> 滿意 (4分)</label>
            <label class="radio-label"><input v-model="answers.q2" type="radio" value="3" /> 普通 (3分)</label>
            <label class="radio-label"><input v-model="answers.q2" type="radio" value="2" /> 不滿意 (2分)</label>
            <label class="radio-label"><input v-model="answers.q2" type="radio" value="1" /> 非常不滿意 (1分)</label>
          </div>
        </div>

        <div class="question-block">
          <label class="q-label font-bold">3. 您希望公司未來優先加強或新增哪些員工福利政策？(可複選)</label>
          <div class="checkbox-group">
            <label class="cb-label"><input v-model="answers.q3" type="checkbox" value="彈性工時調整" /> 彈性上下班工時調配</label>
            <label class="cb-label"><input v-model="answers.q3" type="checkbox" value="員工進修補助" /> 外部專業證照進修費用補助</label>
            <label class="cb-label"><input v-model="answers.q3" type="checkbox" value="運動社團補助" /> 廠內健身運動器材與社團活動經費</label>
            <label class="cb-label"><input v-model="answers.q3" type="checkbox" value="自選式福利金" /> 彈性特約商店自選式福利點數</label>
          </div>
        </div>

        <div class="question-block">
          <label class="q-label font-bold">4. 其他具體建言或對公司未來發展的意見回饋：</label>
          <textarea
            v-model="answers.q4"
            rows="3"
            class="qa-textarea"
            placeholder="歡迎留下您的寶貴建議..."
          />
        </div>
      </div>
      <template #footer>
        <GButton variant="secondary" @click="fillModal = false">取消</GButton>
        <GButton tone="primary" @click="submitSurvey">確認送出問卷</GButton>
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
.banner-card {
  padding: 16px 20px;
}
.banner-title {
  margin: 0 0 6px 0;
  font-size: 18px;
}
.banner-desc {
  margin: 0;
  font-size: 14px;
}
.table-wrapper {
  overflow-x: auto;
  padding: 0;
}
.qa-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.qa-table th,
.qa-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border);
}
.qa-table th {
  background: var(--color-surface-hover);
  text-align: left;
  font-weight: 600;
  font-size: 13px;
}
.survey-form-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.question-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.q-label {
  font-size: 14px;
  line-height: 1.4;
}
.radio-group,
.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-left: 8px;
}
.radio-label,
.cb-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  cursor: pointer;
}
.qa-textarea {
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
}
.text-center {
  text-align: center;
}
.font-bold {
  font-weight: 600;
}
</style>
