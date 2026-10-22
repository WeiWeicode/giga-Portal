<script setup lang="ts">
/**
 * 首頁(版面對齊 old_PortalSolar MainFormX:兩欄卡片 — 待辦事項、個人秘書、最新公告、公告輪播、集團動態;FEATURE-PLAN §1):
 *   - 問候橫幅(FR-4.1,資料只取自 /api/auth/me)
 *   - 其餘區塊由聚合路由 GET /api/portal/dashboard 一次取得(FR-4.8;首屏只呼叫 me 與 dashboard);
 *     單一區塊失敗只該區塊顯示「暫時無法取得」(_meta.errors),其他區塊照常
 *   - 最新公告:BFF 通知中心(/api/notify/feed,/ws/notify 即時)+ 舊入口網公告唯讀併入(D-21)
 *   - 簽核不在首頁核准 / 退回,以「前往簽核」深連結到 BPM(D-24)
 */
import { computed, ref } from 'vue';
import { can, describeError, useAuth, type PortalMe } from '@/api/gateway';
import { dashboard } from '@/api/portal';
import HomeCarousel from '@/components/home/HomeCarousel.vue';
import PersonalLinksDialog from '@/components/home/PersonalLinksDialog.vue';
import SlideManageDialog from '@/components/home/SlideManageDialog.vue';
import LatestAnnouncements from '@/components/notify/LatestAnnouncements.vue';
import { dateLabel, greetingOf } from '@/composables/greeting';
import { isInternal, sectionState, todoErrors } from '@/composables/home';
import { useAsync } from '@/composables/useAsync';

const auth = useAuth();
const me = computed(() => auth.me.me as PortalMe | null);
const now = new Date();
const title = computed(() => `${greetingOf(now.getHours())},${me.value?.user.name ?? ''}`);
const meta = computed(() => {
  const u = me.value?.user;
  return u ? [u.employeeNo, u.department, u.title].filter(Boolean).join(' · ') : '';
});

const { data, loading, error, reload } = useAsync(dashboard);
const m = computed(() => data.value?._meta);
const first = computed(() => loading.value && !data.value);
const todos = computed(() => data.value?.todos.items ?? []);
const todoWarn = computed(() => todoErrors(m.value));
const bpm = computed(() => data.value?.secretary.bpm ?? null);
const bpmState = computed(() => sectionState(m.value, 'bpm'));
const links = computed(() => data.value?.secretary.links ?? []);
const linksState = computed(() => sectionState(m.value, 'secretary.links'));
const slidesState = computed(() => sectionState(m.value, 'slides'));

const linkDialog = ref(false);
const slideDialog = ref(false);
</script>

<template>
  <div class="stack home">
    <GHero :eyebrow="dateLabel(now)" :title="title" :meta="meta">
      <template #actions>
        <GButton v-can="'portal.query.read'" variant="secondary" icon="search" @click="$router.push('/personal/query')">自助查詢</GButton>
        <GButton v-can="'portal.approval.read'" variant="secondary" icon="inbox" @click="$router.push('/approval')">我的待辦</GButton>
      </template>
    </GHero>

    <GAlert v-if="error && !data" tone="danger" icon="alert">
      首頁資料暫時無法取得:{{ describeError(error) }}
      <GButton size="sm" variant="ghost" icon="refresh" @click="reload">重試</GButton>
    </GAlert>

    <div class="grid">
      <!-- 待辦事項 -->
      <GCard title="待辦事項" subtitle="BPM 簽核、問卷、新人導覽、今日提醒" icon="check-square" tone="primary">
        <GSkeleton v-if="first" :lines="4" />
        <GEmpty v-else-if="!data" compact tone="danger" icon="alert" title="暫時無法取得" />
        <template v-else>
          <ul v-if="todos.length" class="todos">
            <li v-for="(t, i) in todos" :key="`${t.kind}-${i}`">
              <GIcon name="chevron-right" />
              <RouterLink v-if="t.to" :to="t.to" class="ellipsis">{{ t.title }}</RouterLink>
              <span v-else class="ellipsis">{{ t.title }}</span>
              <span v-if="t.date && t.kind === 'qa'" class="xs faint">截止 {{ t.date }}</span>
              <a v-if="t.href" :href="t.href" target="_blank" rel="noopener noreferrer" class="xs go">前往簽核</a>
            </li>
          </ul>
          <GEmpty v-else-if="!todoWarn.length" compact icon="check-circle" title="無重要事項" />
          <p v-if="todoWarn.length" class="xs warn">部分待辦暫時無法取得:{{ todoWarn.join('、') }}</p>
        </template>
      </GCard>

      <!-- 個人秘書 -->
      <GCard title="個人秘書" subtitle="BPM 簽核、個人常用連結" icon="inbox" tone="solar">
        <template #actions>
          <GButton v-can="'portal.home.link-edit'" size="sm" variant="ghost" icon="edit" @click="linkDialog = true">常用連結</GButton>
        </template>
        <GSkeleton v-if="first" :lines="4" />
        <template v-else>
          <div class="bpm">
            <template v-if="bpmState === 'error' || (!data && !loading)">
              <span class="xs faint">BPM 簽核資訊暫時無法取得</span>
            </template>
            <template v-else-if="bpmState === 'unavailable'">
              <!-- 未設定 BPM,或本人公司不在碩禾系清單(D-29) -->
              <span class="xs faint">BPM 簽核資訊不適用</span>
            </template>
            <template v-else-if="bpm && !bpm.hasAccount">
              <span class="xs faint">查無您的 BPM 帳號</span>
            </template>
            <template v-else-if="bpm">
              <div class="nums">
                <span
                  >BPM 待簽核 <b>{{ bpm.pending }}</b> 筆</span
                >
                <span
                  >未結案 <b>{{ bpm.unclosed }}</b> 筆</span
                >
                <span v-if="bpm.abnormal" class="xs warn">異常關卡 {{ bpm.abnormal }} 筆</span>
              </div>
              <div class="row acts">
                <GButton v-if="can('portal.ef-info.read')" size="sm" variant="secondary" icon="list" @click="$router.push('/personal/ef-info')">檢視</GButton>
                <a :href="bpm.homeUrl" target="_blank" rel="noopener noreferrer" class="xs go">前往 BPM</a>
              </div>
            </template>
          </div>
          <div class="links">
            <div class="xs faint">個人常用連結</div>
            <p v-if="linksState === 'error'" class="xs faint">暫時無法取得</p>
            <ul v-else-if="links.length" class="link-list">
              <li v-for="l in links" :key="l.id">
                <RouterLink v-if="isInternal(l.url)" :to="l.url">{{ l.name }}</RouterLink>
                <a v-else :href="l.url" target="_blank" rel="noopener noreferrer">{{ l.name }}</a>
              </li>
            </ul>
            <p v-else class="xs faint">尚未設定常用連結</p>
          </div>
        </template>
      </GCard>

      <LatestAnnouncements :legacy="data?.news?.items ?? null" :legacy-state="sectionState(m, 'news')" :legacy-loading="first" />

      <HomeCarousel
        title="公告輪播"
        subtitle="政策聲明、申訴管道、員工行為準則"
        icon="megaphone"
        :slides="data?.slides?.policy ?? []"
        :state="slidesState"
        :loading="first"
      >
        <template #actions>
          <GButton v-can="'portal.home.edit'" size="sm" variant="ghost" icon="edit" @click="slideDialog = true">維護</GButton>
        </template>
      </HomeCarousel>
      <HomeCarousel title="集團動態" subtitle="廠區與工程實績照片" icon="image" :slides="data?.slides?.gallery ?? []" :state="slidesState" :loading="first" />
    </div>

    <PersonalLinksDialog v-model:open="linkDialog" @changed="reload" />
    <SlideManageDialog v-model:open="slideDialog" @changed="reload" />
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
.todos,
.link-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.todos li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.go {
  flex: none;
  margin-left: auto;
}
.warn {
  color: var(--c-warning);
  margin: 8px 0 0;
}
.bpm {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--glass-border-2);
}
.nums {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  align-items: baseline;
}
.acts {
  gap: 10px;
  align-items: center;
}
.links {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 12px;
}
.link-list {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 6px 14px;
}
@media (max-width: 1100px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
