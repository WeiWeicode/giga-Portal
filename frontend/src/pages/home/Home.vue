<script setup lang="ts">
/**
 * 首頁(M1 版):問候橫幅(FR-4.1,資料只取自 /api/auth/me)與依權限列出的功能導覽。
 * 今日出勤、KPI、常用功能、待我簽核、假期、公告、行程於 M4 以聚合路由 /api/portal/dashboard 實作(FR-4.2–4.9),目前不顯示任何假資料。
 */
import { computed } from 'vue';
import { useAuth, type PortalMe } from '@/api/gateway';
import { dateLabel, greetingOf } from '@/composables/greeting';
import { buildMenu } from '@/composables/menu';
import { MENU_GROUPS, MENU_PAGES } from '@/router';

const auth = useAuth();
const me = computed(() => auth.me.me as PortalMe | null);
const now = new Date();
const title = computed(() => `${greetingOf(now.getHours())},${me.value?.user.name ?? ''}`);
const meta = computed(() => {
  const u = me.value?.user;
  return u ? [u.employeeNo, u.department, u.title].filter(Boolean).join(' · ') : '';
});
const groups = computed(() => buildMenu(MENU_GROUPS, MENU_PAGES, auth.can).filter((g) => g.key !== 'home'));
</script>

<template>
  <div class="stack home">
    <GHero :eyebrow="dateLabel(now)" :title="title" :meta="meta">
      <template #actions>
        <GButton v-can="'portal.leave.apply'" variant="secondary" icon="palm" @click="$router.push('/personal/leave')">請假申請</GButton>
        <GButton v-can="'portal.attendance.punch'" variant="secondary" icon="clock" @click="$router.push('/personal/attendance')">線上打卡</GButton>
        <GButton v-can="'bpm.approval.read'" variant="secondary" icon="inbox" @click="$router.push('/approval')">我的待辦</GButton>
      </template>
    </GHero>

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

    <GCard>
      <GEmpty
        icon="construction"
        title="首頁資訊區塊建置中"
        description="今日出勤、統計、常用功能、待我簽核、我的假期、公告與行程將於里程碑 M4 以聚合路由提供(模擬資料會標示「模擬」)。"
        compact
      />
    </GCard>
  </div>
</template>

<style scoped>
.home {
  --gap: 20px;
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
