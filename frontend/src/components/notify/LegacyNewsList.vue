<script setup lang="ts">
/**
 * 舊入口網公告(ContentX,唯讀;D-21):並行期併入「最新公告」,標來源「舊入口網」,舊站下線後移除。
 * 有舊站網址時另開舊站公告頁;內容不在新站顯示(舊公告 HTML 未經過濾)。
 */
import { computed, ref } from 'vue';
import { describeError } from '@/api/gateway';
import { legacyNews } from '@/api/portal';
import { useAsync } from '@/composables/useAsync';

const PAGE_SIZE = 20;
const page = ref(1);
const q = ref('');
const { data, loading, error, reload } = useAsync(() => legacyNews({ q: q.value.trim() || undefined, page: page.value, pageSize: PAGE_SIZE }));
const pages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / PAGE_SIZE)));

function search() {
  page.value = 1;
  void reload();
}
function go(p: number) {
  page.value = p;
  void reload();
}
</script>

<template>
  <GCard title="舊入口網公告" subtitle="並行期唯讀併入,舊站下線後移除" icon="history">
    <template #actions><GBadge tone="neutral">舊入口網</GBadge></template>
    <form class="row search" @submit.prevent="search">
      <GInput v-model="q" icon="search" placeholder="搜尋公告標題" clearable />
      <GButton type="submit" size="sm" variant="secondary">搜尋</GButton>
    </form>
    <GSkeleton v-if="loading && !data" :lines="4" />
    <GEmpty v-else-if="error" compact tone="danger" icon="alert" title="暫時無法取得" :description="describeError(error)">
      <GButton size="sm" icon="refresh" @click="reload">重試</GButton>
    </GEmpty>
    <GEmpty v-else-if="!data?.items.length" compact icon="megaphone" title="沒有期間內的舊入口網公告" />
    <template v-else>
      <ul class="list">
        <li v-for="n in data.items" :key="n.id">
          <GBadge tone="neutral">{{ n.type }}</GBadge>
          <a v-if="n.url" :href="n.url" target="_blank" rel="noopener noreferrer" class="title ellipsis">{{ n.title }}</a>
          <span v-else class="title ellipsis">{{ n.title }}</span>
          <span class="xs faint date">{{ n.date ?? '—' }}</span>
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
.search {
  gap: 8px;
  margin-bottom: 10px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.list li {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.title {
  flex: 1;
  min-width: 0;
}
.date {
  flex: none;
}
.pager {
  justify-content: center;
  gap: 10px;
  margin-top: 10px;
}
</style>
