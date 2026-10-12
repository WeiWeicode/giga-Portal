<script setup lang="ts">
/**
 * 首頁儀表板框架(FRAMEWORK-PLAN P3,對齊 GigaItApp 儀表板):
 *   - 問候橫幅(FR-4.1,資料只取自 /api/auth/me)
 *   - 最新公告:BFF 通知中心真實資料(/api/notify/feed?app=portal,/ws/notify 即時更新)
 *   - 今日出勤、待我簽核、我的假期等卡片位:M4 以聚合路由 /api/portal/dashboard 提供(FR-4.2–4.9),目前只標示「待串接」,不顯示假資料
 *   - 功能導覽:依權限與 BFF 選單設定列出可使用的功能
 */
import { computed } from 'vue';
import { can, useAuth, type PortalMe } from '@/api/gateway';
import LatestAnnouncements from '@/components/notify/LatestAnnouncements.vue';
import { dateLabel, greetingOf } from '@/composables/greeting';
import { portalMenus } from '@/router';

const auth = useAuth();
const me = computed(() => auth.me.me as PortalMe | null);
const now = new Date();
const title = computed(() => `${greetingOf(now.getHours())},${me.value?.user.name ?? ''}`);
const meta = computed(() => {
  const u = me.value?.user;
  return u ? [u.employeeNo, u.department, u.title].filter(Boolean).join(' · ') : '';
});
const groups = computed(() => portalMenus().filter((g) => g.key !== 'home'));

/** 首頁資訊卡片位(M4 聚合路由前只佔位;有該功能權限才顯示) */
const SLOTS = [
  { key: 'attendance', title: '今日出勤', icon: 'clock', permission: 'portal.query.read', to: '/personal/query' },
  { key: 'approval', title: '待我簽核', icon: 'inbox', permission: 'portal.approval.read', to: '/approval' },
  { key: 'leave', title: '我的假期', icon: 'palm', permission: 'portal.query.read', to: '/personal/query/annual-leave' },
] as const;
const slots = computed(() => SLOTS.filter((x) => can(x.permission)));
</script>

<template>
  <div class="stack home">
    <GHero :eyebrow="dateLabel(now)" :title="title" :meta="meta">
      <template #actions>
        <GButton v-can="'portal.query.read'" variant="secondary" icon="search" @click="$router.push('/personal/query')">自助查詢</GButton>
        <GButton v-can="'portal.approval.read'" variant="secondary" icon="inbox" @click="$router.push('/approval')">我的待辦</GButton>
      </template>
    </GHero>

    <div class="dash">
      <LatestAnnouncements />
      <div class="slots">
        <GCard v-for="x in slots" :key="x.key" :title="x.title" :icon="x.icon">
          <template #actions>
            <GBadge tone="neutral" dot>待串接</GBadge>
          </template>
          <GEmpty compact icon="construction" title="資料串接中" description="將於里程碑 M4 由聚合路由提供(PRD FR-4.8)">
            <RouterLink :to="x.to" class="xs">前往{{ x.title }} <GIcon name="arrow-right" :size="13" /></RouterLink>
          </GEmpty>
        </GCard>
      </div>
    </div>

    <GCard title="功能導覽" subtitle="依您的權限顯示可使用的功能" icon="grid">
      <GEmpty v-if="!groups.length" icon="lock" title="目前沒有可使用的功能" description="如需使用,請洽 IT 申請權限。" compact />
      <div v-else class="groups">
        <section v-for="g in groups" :key="g.key" class="group">
          <h4><GIcon :name="g.icon" :size="16" />{{ g.title }}</h4>
          <div class="tiles">
            <RouterLink v-for="p in g.children" :key="p.path" :to="p.path" class="tile">
              <span class="ic"><GIcon :name="p.icon ?? g.icon" :size="18" /></span>
              <span class="tt"
                >{{ p.title }}<small>{{ p.subtitle }}</small></span
              >
            </RouterLink>
          </div>
        </section>
      </div>
    </GCard>
  </div>
</template>

<style scoped>
.home {
  --gap: 20px;
}
.dash {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: 20px;
  align-items: start;
}
.slots {
  display: grid;
  gap: 20px;
}
@media (max-width: 1100px) {
  .dash {
    grid-template-columns: minmax(0, 1fr);
  }
}
.groups {
  display: grid;
  gap: 20px;
}
.group h4 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: var(--fs-sm);
  color: var(--text-2);
}
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 10px;
}
.tile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border-2);
  background: var(--glass-soft);
  color: var(--text);
  text-decoration: none;
  transition:
    background var(--dur),
    transform var(--dur) var(--ease);
}
.tile:hover {
  background: var(--glass-hover);
  transform: translateY(-1px);
  text-decoration: none;
}
.ic {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  color: var(--c-primary-text);
  background: color-mix(in srgb, var(--c-primary) calc(var(--tone-bg-alpha) * 100%), transparent);
}
.tt {
  font-weight: 600;
  line-height: 1.3;
}
.tt small {
  display: block;
  font-size: var(--fs-xs);
  font-weight: 500;
  color: var(--text-3);
}
@media (max-width: 480px) {
  .tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
