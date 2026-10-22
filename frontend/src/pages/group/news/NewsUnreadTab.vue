<script setup lang="ts">
/** 最新公告 › 未讀(Gateway 通知中心 /api/notify/feed?unread=true;舊入口網公告沒有已讀狀態,不列在此) */
import NotifyFeedList from '@/components/notify/NotifyFeedList.vue';
</script>

<template>
  <NotifyFeedList unread />
</template>
