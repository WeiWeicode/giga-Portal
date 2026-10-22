<script setup lang="ts">
/**
 * 首頁「最新公告」(同 GigaItApp 儀表板):收件匣最近 5 則公告(未讀加粗),經 /ws/notify 即時更新;點選開啟閱讀對話框。
 * 並行期另列舊入口網公告(ContentX,唯讀、標來源「舊入口網」,D-21;資料由首頁聚合帶入,舊站下線後移除)。
 */
import { computed } from 'vue';
import { can } from '@/api/gateway';
import { fromNow } from '@/api/format';
import type { LegacyNews } from '@/api/portal';
import type { SectionState } from '@/composables/home';
import { center, levelOf, openAnnouncement } from '@/composables/notify';

const props = withDefaults(defineProps<{ legacy?: LegacyNews[] | null; legacyState?: SectionState; legacyLoading?: boolean }>(), {
  legacy: null,
  legacyState: 'ok',
  legacyLoading: false,
});

const items = computed(() => center.items.value.filter((i) => i.kind === 'announcement').slice(0, 5));
const loading = computed(() => center.state.loading && !center.items.value.length);
const showLegacy = computed(() => props.legacyState !== 'unavailable' && (props.legacyLoading || props.legacyState === 'error' || !!props.legacy?.length));
</script>

<template>
  <GCard title="最新公告" subtitle="公司公告即時推送" icon="megaphone" tone="violet">
    <template #actions>
      <GBadge v-if="center.state.connected" tone="success" dot>即時</GBadge>
      <GBadge v-else tone="neutral" dot>連線中</GBadge>
      <RouterLink v-if="can('portal.news.read')" to="/news" class="xs">全部公告</RouterLink>
    </template>
    <GSkeleton v-if="loading" :lines="4" />
    <ul v-else-if="items.length" class="anns">
      <li v-for="a in items" :key="a.id">
        <button type="button" class="ann" :class="{ unread: !a.isRead }" @click="openAnnouncement(a.id)">
          <GBadge :tone="levelOf(a.level).tone" :icon="levelOf(a.level).icon">{{ levelOf(a.level).label }}</GBadge>
          <span class="txt">
            <span class="title ellipsis">{{ a.title }}</span>
            <span class="xs faint ellipsis">{{ a.publisherTitle ?? '公告' }} · {{ fromNow(a.at) }} · {{ a.summary }}</span>
          </span>
          <GBadge v-if="a.requireAck && !a.ackAt" tone="warning" icon="check-check">需確認</GBadge>
          <GBadge v-else-if="!a.isRead" tone="primary" dot>未讀</GBadge>
        </button>
      </li>
    </ul>
    <GEmpty v-else-if="center.state.error" compact tone="danger" icon="alert" title="公告載入失敗" :description="center.state.error" />
    <GEmpty v-else compact icon="megaphone" title="目前沒有公告" />

    <template v-if="showLegacy">
      <div class="legacy-head xs faint">舊入口網公告(唯讀)</div>
      <GSkeleton v-if="legacyLoading" :lines="2" />
      <p v-else-if="legacyState === 'error'" class="xs faint">暫時無法取得</p>
      <ul v-else class="anns">
        <li v-for="n in legacy ?? []" :key="n.id">
          <a v-if="n.url" class="ann" :href="n.url" target="_blank" rel="noopener noreferrer">
            <GBadge tone="neutral">舊入口網</GBadge>
            <span class="txt">
              <span class="title ellipsis">{{ n.title }}</span>
              <span class="xs faint ellipsis">{{ n.type }} · {{ n.date ?? '—' }}</span>
            </span>
          </a>
          <div v-else class="ann">
            <GBadge tone="neutral">舊入口網</GBadge>
            <span class="txt">
              <span class="title ellipsis">{{ n.title }}</span>
              <span class="xs faint ellipsis">{{ n.type }} · {{ n.date ?? '—' }}</span>
            </span>
          </div>
        </li>
      </ul>
    </template>
  </GCard>
</template>

<style scoped>
.anns {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ann {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: 12px;
  background: none;
  font: inherit;
  color: var(--text-2);
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}
div.ann {
  cursor: default;
}
.ann:hover {
  background: var(--glass-soft);
}
.ann.unread {
  color: var(--text);
}
.ann.unread .title {
  font-weight: 700;
}
.txt {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.legacy-head {
  margin: 12px 0 4px;
  padding-top: 10px;
  border-top: 1px solid var(--glass-border-2);
}
</style>
