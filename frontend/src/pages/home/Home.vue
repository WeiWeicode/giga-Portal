<script setup lang="ts">
/**
 * 首頁(版面對齊 old_PortalSolar MainFormX:兩欄卡片 — 待辦事項、個人秘書、最新消息、公告輪播、集團動態輪播):
 *   - 問候橫幅(FR-4.1,資料只取自 /api/auth/me)
 *   - 最新消息:BFF 通知中心真實資料(/api/notify/feed?app=portal,/ws/notify 即時更新)
 *   - 待辦事項(重要通知、帳號密碼到期、年度申報…)、個人秘書(BPM 待簽核、個人系統連結)、兩個圖片輪播:
 *     M4 以聚合路由 /api/portal/dashboard 與 portal-api 提供(FR-4.2–4.9),目前只標示「待串接」,不顯示假資料
 */
import { computed } from 'vue';
import { useAuth, type PortalMe } from '@/api/gateway';
import LatestAnnouncements from '@/components/notify/LatestAnnouncements.vue';
import { dateLabel, greetingOf } from '@/composables/greeting';

const auth = useAuth();
const me = computed(() => auth.me.me as PortalMe | null);
const now = new Date();
const title = computed(() => `${greetingOf(now.getHours())},${me.value?.user.name ?? ''}`);
const meta = computed(() => {
  const u = me.value?.user;
  return u ? [u.employeeNo, u.department, u.title].filter(Boolean).join(' · ') : '';
});

/** 首頁卡片位(舊入口網的區塊;資料來源待串接) */
const TODO = { title: '待辦事項', subtitle: '重要通知、帳號密碼到期、年度申報', icon: 'check-square', tone: 'primary', source: '聚合路由 /api/portal/dashboard(HRM、AD)' };
const SECRETARY = { title: '個人秘書', subtitle: 'BPM 待簽核、個人常用系統', icon: 'inbox', tone: 'solar', source: 'BPM 待簽核數、portal-api 個人連結' };
const SLIDES = [
  { key: 'policy', title: '公告輪播', subtitle: '政策聲明、申訴管道、員工行為準則', icon: 'megaphone', source: 'portal-api 公告圖片' },
  { key: 'gallery', title: '集團動態', subtitle: '廠區與工程實績照片', icon: 'image', source: 'portal-api 圖片(附件服務)' },
] as const;
</script>

<template>
  <div class="stack home">
    <GHero :eyebrow="dateLabel(now)" :title="title" :meta="meta">
      <template #actions>
        <GButton v-can="'portal.query.read'" variant="secondary" icon="search" @click="$router.push('/personal/query')">自助查詢</GButton>
        <GButton v-can="'portal.approval.read'" variant="secondary" icon="inbox" @click="$router.push('/approval')">我的待辦</GButton>
      </template>
    </GHero>

    <div class="grid">
      <GCard :title="TODO.title" :subtitle="TODO.subtitle" :icon="TODO.icon" :tone="TODO.tone">
        <template #actions><GBadge tone="neutral" dot>待串接</GBadge></template>
        <GEmpty compact icon="construction" title="資料串接中" :description="`將於里程碑 M4 由${TODO.source}提供(PRD FR-4.8)`" />
      </GCard>
      <GCard :title="SECRETARY.title" :subtitle="SECRETARY.subtitle" :icon="SECRETARY.icon" :tone="SECRETARY.tone">
        <template #actions><GBadge tone="neutral" dot>待串接</GBadge></template>
        <GEmpty compact icon="construction" title="資料串接中" :description="`將於里程碑 M4 由${SECRETARY.source}提供`" />
      </GCard>
      <LatestAnnouncements />
      <GCard v-for="x in SLIDES" :key="x.key" :title="x.title" :subtitle="x.subtitle" :icon="x.icon">
        <template #actions><GBadge tone="neutral" dot>待串接</GBadge></template>
        <div class="slide">
          <GEmpty compact icon="image" title="圖片輪播待串接" :description="`將由${x.source}提供,每 5 秒自動切換`" />
        </div>
      </GCard>
    </div>
  </div>
</template>

<style scoped>
.home {
  --gap: 20px;
}
/* 兩欄卡片(舊入口網 col-lg-6);窄螢幕單欄 */
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  align-items: stretch;
}
.slide {
  display: grid;
  place-items: center;
  aspect-ratio: 16 / 7;
  border-radius: var(--radius-md);
  border: 1px dashed var(--glass-border-2);
  background: var(--glass-soft);
}
@media (max-width: 1100px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
