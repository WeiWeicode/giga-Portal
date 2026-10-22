<script setup lang="ts">
/** 3691 討論串的一個節點(遞迴顯示回覆);內容一律文字插值輸出,不用 v-html */
import type { TalkNode } from '@/composables/talk';
import { titleOf } from '@/composables/talk';

defineProps<{ node: TalkNode; depth?: number }>();
const emit = defineEmits<{ select: [node: TalkNode] }>();
</script>

<template>
  <li class="node">
    <button type="button" class="head" :class="{ blocked: node.blocked }" @click="emit('select', node)">
      <span class="title ellipsis">{{ titleOf(node) }}</span>
      <span v-if="node.blocked" class="xs tag">已屏蔽</span>
      <span v-if="node.likes" class="xs faint likes"><GIcon name="thumbs-up" /> {{ node.likes }}</span>
      <span class="xs faint">{{ node.createdAt?.slice(0, 16) ?? '' }}</span>
    </button>
    <ul v-if="node.replies.length" class="replies">
      <TalkNodeItem v-for="r in node.replies" :key="r.sn" :node="r" :depth="(depth ?? 0) + 1" @select="(n) => emit('select', n)" />
    </ul>
  </li>
</template>

<style scoped>
.node {
  list-style: none;
}
.head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 10px;
  border: 0;
  border-radius: 10px;
  background: none;
  font: inherit;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  min-width: 0;
}
.head:hover {
  background: var(--glass-soft);
}
.head.blocked .title {
  color: var(--c-danger, var(--text-3));
}
.title {
  flex: 1;
  min-width: 0;
}
.likes {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.tag {
  color: var(--c-danger, var(--text-3));
}
.replies {
  margin: 0;
  padding: 0 0 0 18px;
  border-left: 1px solid var(--glass-border-2);
}
</style>
