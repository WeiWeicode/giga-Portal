<script setup lang="ts">
/**
 * 新人驗收測驗 (對齊 old_PortalSolar HRnewPep05.aspx 20 題是非題)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GModal, GSelect } from '@/ui';

interface QuizItem {
  id: number;
  question: string;
  answer: '是' | '否';
  help: string;
  userAnswer?: '是' | '否' | '';
}

const quizList = ref<QuizItem[]>([
  {
    id: 1,
    question: '員工只要進出廠區及大門均需確實刷卡。',
    answer: '是',
    help: '出勤打卡為工時計算與緊急疏散清查人數之依據。',
    userAnswer: '',
  },
  {
    id: 2,
    question: '學習意願是新人試用期評核項目中的其中一項指標。',
    answer: '是',
    help: '試用期滿考核包含：工作品質、專業技能、團隊合作、學習意願與差勤。',
    userAnswer: '',
  },
  {
    id: 3,
    question: '報到工作一天後覺得不適合可以不辦離職手續，反正公司不會給薪水。',
    answer: '否',
    help: '凡有出勤事實均計薪，離職均需依法辦理移交手續以保障個人權益。',
    userAnswer: '',
  },
  {
    id: 4,
    question: '廠區內除 B 棟 6 樓指定戶外吸菸區外，全廠全面禁菸。',
    answer: '是',
    help: '吸菸區外吸菸首犯記大過乙次，再犯予以解僱。',
    userAnswer: '',
  },
  {
    id: 5,
    question: '現場生產人員進入工作場所行動電話需關機置於置物櫃。',
    answer: '是',
    help: '維持製造現場專注與落實保密防洩規範。',
    userAnswer: '',
  },
  {
    id: 6,
    question: '廠內駕駛堆高機限速每小時 20 公里。',
    answer: '否',
    help: '廠內駕駛堆高機限速為每小時 10 公里；電動板車限速 5 公里。',
    userAnswer: '',
  },
  {
    id: 7,
    question: '公司的緊急疏散避難地點在 A 棟 1 樓大廳前的空地。',
    answer: '是',
    help: '火災或地震等緊急狀況疏散請循指示前往 A 棟 1F 空地廣場清點人數。',
    userAnswer: '',
  },
  {
    id: 8,
    question: '辦公室可以食用香雞排等重口味食物。',
    answer: '否',
    help: '辦公室屬於密閉空調空間，嚴禁食用味道濃烈之重口味食物。',
    userAnswer: '',
  },
  {
    id: 9,
    question: '未領有堆高機證照或合格資格者，不得擅自操作堆高機。',
    answer: '是',
    help: '勞動法令規定危險性機械操作人員必須領有法定合格證照。',
    userAnswer: '',
  },
  {
    id: 10,
    question: '廠內電動板車行駛限速每小時 5 公里。',
    answer: '是',
    help: '電動板車限速每小時 5 公里，且車行轉彎處應減速禮讓行人。',
    userAnswer: '',
  },
  {
    id: 11,
    question: '生產線直接生產人員依規定不得擅自外出用餐。',
    answer: '是',
    help: '生產同仁應於廠區餐廳用餐，不得隨意外出。',
    userAnswer: '',
  },
  {
    id: 12,
    question: '產線休息區及置物櫃可以放置未吃完的便當與食物。',
    answer: '否',
    help: '休息區與置物櫃不可放置食物及含糖飲料，以防止蟲害並維護清潔。',
    userAnswer: '',
  },
  {
    id: 13,
    question: '嚴禁上班時間把玩個人手機或非業務網路瀏覽。',
    answer: '是',
    help: '工作時間應專注於公司業務，維持工作效率。',
    userAnswer: '',
  },
  {
    id: 14,
    question: '公司業務機密不得洩漏，亦不得詢問或探聽與自身業務無關之機密。',
    answer: '是',
    help: '簽署之保密協定（NDA）具法律約束力，離職後亦同。',
    userAnswer: '',
  },
  {
    id: 15,
    question: '可以利用公司設備或餘料製作私人物件並轉贈其他人員。',
    answer: '否',
    help: '公器嚴禁私用，不得以公款、公物或公有設備製作私人物品。',
    userAnswer: '',
  },
  {
    id: 16,
    question: '員工識別證應每日配戴於胸前，若遺失應立即向總務組通報。',
    answer: '是',
    help: '識別證代表門禁感應授權，遺失應即時掛失作廢以維廠區保安。',
    userAnswer: '',
  },
  {
    id: 17,
    question: '發生火災警報時應立即搭乘電梯迅速逃至一樓。',
    answer: '否',
    help: '火警發生時嚴禁搭乘電梯，請循安全逃生梯迅速疏散。',
    userAnswer: '',
  },
  {
    id: 18,
    question: '離職必須於法定預告期日前提出並完成資產與業務交接清冊。',
    answer: '是',
    help: '依勞基法規定提出預告並完成部門業務與總務資產交接。',
    userAnswer: '',
  },
  {
    id: 19,
    question: '遭遇職場不法侵害或霸凌時，可撥打人資專屬申訴電話 #1210。',
    answer: '是',
    help: '公司提供保密申訴調查程序，零容忍職場暴力。',
    userAnswer: '',
  },
  {
    id: 20,
    question: '廠區全面禁食檳榔及飲用含酒精成分之機能飲品（如保力達）。',
    answer: '是',
    help: '落實健康職場與安全作業環境。',
    userAnswer: '',
  },
]);

const answeredCount = computed(() => quizList.value.filter((q) => q.userAnswer !== '').length);
const isSubmitted = ref(false);
const score = ref(0);
const correctCount = ref(0);
const wrongCount = ref(0);

// 求救 Modal
const helpModal = ref(false);
const activeHelp = ref<{ title: string; text: string } | null>(null);

function showHelp(item: QuizItem) {
  activeHelp.value = {
    title: `第 ${item.id} 題 提示說明`,
    text: item.help,
  };
  helpModal.value = true;
}

function submitQuiz() {
  let correct = 0;
  quizList.value.forEach((item) => {
    if (item.userAnswer === item.answer) {
      correct++;
    }
  });
  correctCount.value = correct;
  wrongCount.value = quizList.value.length - correct;
  score.value = correct * 5;
  isSubmitted.value = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetQuiz() {
  quizList.value.forEach((item) => {
    item.userAnswer = '';
  });
  isSubmitted.value = false;
  score.value = 0;
}
</script>

<template>
  <div class="onboarding-quiz-tab stack">
    <!-- 頂部指引與評分摘要 -->
    <GCard class="glass banner-card">
      <div class="banner-top">
        <div>
          <h3 class="banner-title">新人基礎訓練自我評量測驗 (20 題是非題)</h3>
          <p class="banner-desc faint">
            經過小叮嚀導覽後，您對公司規章是否有基礎認識呢？請逐題作答是非題，滿分 100 分，及格分數為 80 分。
          </p>
        </div>
        <div class="progress-box">
          <span class="faint small">已作答進度</span>
          <strong class="mono progress-num">{{ answeredCount }} / 20 題</strong>
        </div>
      </div>

      <!-- 送出後成績看板 -->
      <div v-if="isSubmitted" class="result-banner" :class="score >= 80 ? 'pass' : 'fail'">
        <div class="score-display">
          <span class="score-label">測驗得分</span>
          <span class="score-value mono">{{ score }} 分</span>
          <GBadge :tone="score >= 80 ? 'healthy' : 'warning'">
            {{ score >= 80 ? '合格通過' : '未達標準，請再接再厲' }}
          </GBadge>
        </div>
        <div class="result-stats">
          <span>答對：<strong class="text-primary">{{ correctCount }}</strong> 題</span>
          <span>答錯：<strong class="text-danger">{{ wrongCount }}</strong> 題</span>
          <GButton size="sm" variant="secondary" @click="resetQuiz">重新測驗</GButton>
        </div>
      </div>
    </GCard>

    <!-- 測驗題目表格 -->
    <GCard class="glass table-wrapper">
      <table class="quiz-table">
        <thead>
          <tr>
            <th style="width: 50px;" class="text-center">題號</th>
            <th>測驗題目內容</th>
            <th style="width: 140px;" class="text-center">作答選項</th>
            <th style="width: 80px;" class="text-center">求救提示</th>
            <th v-if="isSubmitted" style="width: 120px;" class="text-center">測驗結果</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in quizList"
            :key="item.id"
            :class="{
              'row-wrong': isSubmitted && item.userAnswer !== item.answer,
              'row-correct': isSubmitted && item.userAnswer === item.answer,
            }"
          >
            <td class="text-center mono font-bold">{{ item.id }}</td>
            <td class="question-text">
              {{ item.question }}
              <div v-if="isSubmitted && item.userAnswer !== item.answer" class="wrong-detail extra-small">
                正確答案：<strong class="text-primary">{{ item.answer }}</strong> ｜ 解析：{{ item.help }}
              </div>
            </td>
            <td class="text-center">
              <select
                v-model="item.userAnswer"
                class="answer-select"
                :disabled="isSubmitted"
              >
                <option value="">請選擇</option>
                <option value="是">是</option>
                <option value="否">否</option>
              </select>
            </td>
            <td class="text-center">
              <GButton size="sm" variant="ghost" @click="showHelp(item)">💡 提示</GButton>
            </td>
            <td v-if="isSubmitted" class="text-center">
              <GBadge :tone="item.userAnswer === item.answer ? 'healthy' : 'warning'">
                {{ item.userAnswer === item.answer ? '正確' : '錯誤' }}
              </GBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </GCard>

    <!-- 底部操作按鈕 -->
    <div class="actions-row">
      <GButton
        tone="primary"
        size="lg"
        :disabled="isSubmitted || answeredCount < 20"
        @click="submitQuiz"
      >
        {{ isSubmitted ? '已完成送審' : '送出測驗卷並結算成績' }}
      </GButton>
      <span v-if="answeredCount < 20 && !isSubmitted" class="faint small warning-hint">
        尚有 {{ 20 - answeredCount }} 題未作答，請完成所有題目後送出。
      </span>
    </div>

    <!-- 求救提示 Modal -->
    <GModal v-model="helpModal" :title="activeHelp?.title ?? '題意求救提示'" width="450px">
      <div v-if="activeHelp" class="help-content">
        <p class="help-text">{{ activeHelp.text }}</p>
      </div>
      <template #footer>
        <GButton variant="secondary" @click="helpModal = false">明白了</GButton>
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
.banner-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.banner-title {
  margin: 0 0 6px 0;
  font-size: 18px;
}
.banner-desc {
  margin: 0;
  font-size: 14px;
}
.progress-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.progress-num {
  font-size: 20px;
  color: var(--color-primary);
}
.result-banner {
  margin-top: 16px;
  padding: 14px 18px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.result-banner.pass {
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
}
.result-banner.fail {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
}
.score-display {
  display: flex;
  align-items: center;
  gap: 12px;
}
.score-label {
  font-size: 14px;
  font-weight: 600;
}
.score-value {
  font-size: 26px;
  font-weight: 700;
}
.result-stats {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 14px;
}
.table-wrapper {
  overflow-x: auto;
  padding: 0;
}
.quiz-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.quiz-table th,
.quiz-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border);
}
.quiz-table th {
  background: var(--color-surface-hover);
  text-align: left;
  font-weight: 600;
}
.question-text {
  line-height: 1.5;
}
.answer-select {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: 14px;
  cursor: pointer;
}
.row-wrong {
  background: rgba(239, 68, 68, 0.05);
}
.row-correct {
  background: rgba(16, 185, 129, 0.05);
}
.wrong-detail {
  margin-top: 4px;
  color: var(--color-danger);
}
.actions-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.warning-hint {
  color: var(--color-warning);
}
.text-center {
  text-align: center;
}
.font-bold {
  font-weight: 600;
}
.extra-small {
  font-size: 12px;
}
.help-content {
  font-size: 15px;
  line-height: 1.6;
  padding: 8px 0;
}
</style>
