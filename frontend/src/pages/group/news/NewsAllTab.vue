<script setup lang="ts">
/**
 * 最新公告 › 全部(FEATURE-PLAN §5「最新公告」):Gateway 通知中心公告(發布在 GigaItApp)+ 舊入口網公告唯讀併入(D-21)。
 * 入口網不另做發布頁(舊 PublicEdit 任何人可發、可存腳本,不沿用)。
 */
import { can } from '@/api/gateway';
import LegacyNewsList from '@/components/notify/LegacyNewsList.vue';
import NotifyFeedList from '@/components/notify/NotifyFeedList.vue';
</script>

<template>
  <div class="stack">
    <NotifyFeedList />
    <LegacyNewsList v-if="can('portal.api.news.read')" />
  </div>
</template>
