<script setup lang="ts">
/**
 * 新人小叮嚀 (對齊 old_PortalSolar HRnewPep01.aspx)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GCard } from '@/ui';

const tipCategories = [
  {
    title: '廠區紀律與生活規範',
    badge: '嚴格遵守',
    badgeTone: 'warning' as const,
    items: [
      { text: '廠區全面禁食檳榔及飲用含酒精成分飲品。', note: '維護廠區公共環境衛生' },
      { text: '所有同仁不得在工作前飲酒，輪班主管將每日落實身心狀態確認。', note: '保障產線同仁作業安全' },
      { text: '全廠區室內嚴禁吸菸；除 B 棟 6 樓戶外指定吸菸區外，違規者依規處分。', note: '符合菸害防制法' },
      { text: '辦公區與會議室禁止食用味道濃烈之重口味食物（例如香雞排、臭豆腐）。', note: '保持優良辦公環境' },
      { text: '上班時間嚴禁把玩手機，產線人員進入無塵室或製造車間手機應關機置於置物櫃。', note: '確保工作專注與防洩密' },
    ],
  },
  {
    title: '工安防護與出勤作業',
    badge: '安全第一',
    badgeTone: 'healthy' as const,
    items: [
      { text: '同仁進出廠區、辦公室及出入廠門口，均須確實刷卡感應。', note: '落實工時紀錄與門禁控管' },
      { text: '全廠緊急疏散避難地點為「A 棟 1 樓大廳前空地廣場」。', note: '定期配合消防演練疏散' },
      { text: '未領有特種設備證照者（如堆高機、天車），嚴禁擅自操作。', note: '依法規落實合格人員操作' },
      { text: '廠內行車速限：堆高機限速 10 km/h，電動板車限速 5 km/h，汽機車限速 15 km/h。', note: '車行轉彎處請減速按鳴喇叭' },
      { text: '製造處生產同仁中午於員工餐廳用餐，產線休息區與置物櫃不可堆放食物。', note: '防止蟲害及維護清潔' },
    ],
  },
  {
    title: '資訊安全與保密防法',
    badge: '資安合規',
    badgeTone: 'storage' as const,
    items: [
      { text: '公司研發技術、配方及各項營運機密嚴格保密，不得私自複製或外流。', note: '簽署保密協議 NDA' },
      { text: '不得探聽、詢問或窺探非自身權責範圍之機密或他人薪資資訊。', note: '落實資訊分級授權' },
      { text: '個人電腦離開座位應按 Win+L 鎖定螢幕，不可與他人共用密碼。', note: '符合 ISO27001 規範' },
      { text: '不得利用公司資訊設備及原物料製作私人物品並轉贈他人。', note: '公物公用原則' },
      { text: '員工識別證應每日佩戴於胸前，遺失請立即至總務處掛失補發。', note: '門禁查驗識別必備' },
    ],
  },
  {
    title: '試用評核與人資制度',
    badge: '職涯發展',
    badgeTone: 'neutral' as const,
    items: [
      { text: '試用期考核指標包含：工作品質、專業技能、工作效率、學習意願與出勤操守。', note: '滿三個月由主管評核' },
      { text: '若遇出勤異常或病假，應於上班前 30 分鐘向主管回報並於事後填單。', note: '差勤規定' },
      { text: '薪資每月 5 日入帳（遇假日提前），若對薪資條有疑問可洽人資薪酬窗口。', note: '每月薪資加密查詢' },
      { text: '如遇不法侵害或職場騷擾，公司設有專屬保護申訴窗口 (分機 #1210)。', note: '零容忍政策' },
    ],
  },
];
</script>

<template>
  <div class="onboarding-tips-tab stack">
    <GCard class="glass banner-card">
      <div class="banner-content">
        <h3 class="banner-title">歡迎加入碩禾集團大家庭！</h3>
        <p class="banner-desc faint">
          人資部為各位新進同仁整理出以下各項重要廠區作業守則與生活指南，請詳細閱讀並確實遵守，讓您的職場生活更順暢安心！
        </p>
      </div>
    </GCard>

    <div class="categories-grid">
      <GCard v-for="cat in tipCategories" :key="cat.title" class="glass category-card">
        <div class="category-header">
          <strong>{{ cat.title }}</strong>
          <GBadge :tone="cat.badgeTone">{{ cat.badge }}</GBadge>
        </div>
        <ul class="tips-list">
          <li v-for="(item, idx) in cat.items" :key="idx" class="tip-item">
            <span class="tip-num mono">{{ idx + 1 }}.</span>
            <div class="tip-body">
              <span class="tip-text">{{ item.text }}</span>
              <span class="tip-note faint extra-small">({{ item.note }})</span>
            </div>
          </li>
        </ul>
      </GCard>
    </div>

    <GAlert tone="warning" icon="alert">
      完成小叮嚀閱讀後，請至「驗收區」進行 20 題新人是非題自我測驗，測驗成績將作為試用期人資評核參考依據。
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
  padding: 18px 20px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%);
}
.banner-title {
  margin: 0 0 6px 0;
  font-size: 18px;
  font-weight: 700;
}
.banner-desc {
  margin: 0;
  font-size: 14px;
}
.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}
.category-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 8px;
}
.tips-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tip-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13.5px;
  line-height: 1.5;
}
.tip-num {
  font-weight: bold;
  color: var(--color-primary);
  flex-shrink: 0;
}
.tip-body {
  display: flex;
  flex-direction: column;
}
.extra-small {
  font-size: 12px;
}
</style>
