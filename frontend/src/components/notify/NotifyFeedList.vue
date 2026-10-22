<script setup lang="ts">
/**
 * 最新公告頁的收件匣清單(Gateway 通知中心 /api/notify/feed?app=portal,分頁;FEATURE-PLAN §5「最新公告」)。
 * 公告在 GigaItApp 發布,入口網不另做發布頁(舊 PublicEdit 不沿用);點公告開閱讀對話框並標記已讀。
 */
import { notifyApi, type FeedItem } from '@giganexus/web-kit';
import { computed, ref } from 'vue';
import { describeError } from '@/api/gateway';
import { fmtTime } from '@/api/format';
import { levelOf, NOTIFY_APP, openFeedItem } from '@/composables/notify';
import { useAsync } from '@/composables/useAsync';

const props = defineProps<{ unread?: boolean }>();
const PAGE_SIZE = 20;
const page = ref(1);
const { data, loading, error, reload } = useAsync(() =>
  notifyApi.feed(NOTIFY_APP, { unread: props.unread || undefined, page: page.value, pageSize: PAGE_SIZE }),
);
const pages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / PAGE_SIZE)));

function go(p: number) {
  page.value = p;
  void reload();
}
async function open(item: FeedItem) {
  await openFeedItem(item);
  if (props.unread) void reload();
}
</script>

<template>
  <GCard :title="unread ? '未讀公告' : '公司公告'" subtitle="Gateway 通知中心" icon="megaphone" tone="violet">
    <GSkeleton v-if="loading && !data" :lines="5" />
    <GEmpty v-else-if="error" compact tone="danger" icon="alert" title="公告載入失敗" :description="describeError(error)">
      <GButton size="sm" icon="refresh" @click="reload">重試</GButton>
    </GEmpty>
    <GEmpty v-else-if="!data?.items.length" compact icon="megaphone" :title="unread ? '沒有未讀公告' : '目前沒有公告'" />
    <template v-else>
      <ul class="feed">
        <li v-for="a in data.items" :key="`${a.kind}-${a.id}`">
          <button type="button" class="row-btn" :class="{ unread: !a.isRead }" @click="open(a)">
            <GBadge :tone="levelOf(a.level).tone" :icon="levelOf(a.level).icon">{{ levelOf(a.level).label }}</GBadge>
            <span class="txt">
              <span class="title ellipsis">{{ a.title }}</span>
              <span class="xs faint ellipsis">{{ a.publisherTitle ?? '公告' }} · {{ fmtTime(a.at) }} · {{ a.summary }}</span>
            </span>
            <GBadge v-if="!a.isRead" tone="primary" dot>未讀</GBadge>
          </button>
        </li>
      </ul>
      <div v-if="pages > 1" class="row pager">
        <GButton size="sm" variant="ghost" icon="chevron-left" :disabled="page <= 1" @click="go(page - 1)">上一頁</GButton>
        <span class="xs faint">{{ page }} / {{ pages }}</span>
        <GButton size="sm" variant="ghost" icon-right="chevron-right" :disabled="page >= pages" @click="go(page + 1)">下一頁</GButton>
      </div>
    </template>
  </GCard>
</template>

<style scoped>
.feed {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.row-btn {
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
  cursor: pointer;
}
.row-btn:hover {
  background: var(--glass-soft);
}
.row-btn.unread {
  color: var(--text);
}
.row-btn.unread .title {
  font-weight: 700;
}
.txt {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pager {
  justify-content: center;
  gap: 10px;
  margin-top: 10px;
}
</style>
