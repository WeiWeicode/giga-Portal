<script setup lang="ts">
/** 頁首鈴鐺(同 GigaItApp):未讀數徽章;點開顯示最近 10 則(公告與個人通知),可全部標為已讀、前往最新公告 */
import { computed, ref } from 'vue';
import { can } from '@/api/gateway';
import { fromNow } from '@/api/format';
import { center, levelOf, openFeedItem } from '@/composables/notify';
import { toast } from '@/ui';

const open = ref(false);
const items = computed(() => center.items.value.slice(0, 10));
const unread = computed(() => center.unread.value);

function pick(i: (typeof items.value)[number]) {
  open.value = false;
  void openFeedItem(i);
}
async function readAll() {
  try {
    await center.markAllRead();
  } catch (e) {
    toast.fromError(e, '標記已讀失敗');
  }
}
</script>

<template>
  <div class="bell" @keydown.esc="open = false">
    <GButton
      variant="ghost"
      square
      :icon="unread ? 'bell-ring' : 'bell'"
      :aria-label="unread ? `通知(${unread} 則未讀)` : '通知'"
      :aria-expanded="open"
      @click="open = !open"
    />
    <span v-if="unread" class="count" aria-hidden="true">{{ unread > 99 ? '99+' : unread }}</span>
    <Transition name="pop">
      <div v-if="open" class="panel glass glass-edge" role="dialog" aria-label="通知">
        <header class="head">
          <strong>通知</strong>
          <GBadge v-if="center.state.connected" tone="success" dot>即時</GBadge>
          <GBadge v-else tone="neutral" dot>重新連線中</GBadge>
          <span class="spacer" />
          <GButton v-if="unread" size="sm" variant="ghost" icon="check-check" @click="readAll">全部已讀</GButton>
        </header>
        <ul v-if="items.length" class="list">
          <li v-for="i in items" :key="`${i.kind}-${i.id}`">
            <button type="button" class="item" :class="{ unread: !i.isRead }" @click="pick(i)">
              <span class="dot" :class="`tone-${levelOf(i.level).tone}`" />
              <span class="txt">
                <span class="title ellipsis">{{ i.title }}</span>
                <span class="sum ellipsis faint">{{ i.summary }}</span>
                <span class="xs faint">
                  {{ i.kind === 'announcement' ? (i.publisherTitle ?? '公告') : '通知' }} · {{ fromNow(i.at) }}
                  <template v-if="i.requireAck && !i.ackAt"> · <b class="need">需確認</b></template>
                </span>
              </span>
            </button>
          </li>
        </ul>
        <GEmpty v-else compact icon="bell" title="沒有通知" />
        <footer v-if="can('portal.news.read')" class="foot">
          <RouterLink to="/news" class="small" @click="open = false">前往最新公告 <GIcon name="arrow-right" :size="14" /></RouterLink>
        </footer>
      </div>
    </Transition>
    <div v-if="open" class="scrim" @click="open = false" />
  </div>
</template>

<style scoped>
.bell {
  position: relative;
}
.count {
  position: absolute;
  top: 2px;
  right: 0;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--c-danger);
  color: var(--on-primary);
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
  pointer-events: none;
}
.panel {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  z-index: 30;
  width: min(380px, calc(100vw - 32px));
  background: var(--glass-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
}
.list {
  list-style: none;
  margin: 0;
  padding: 6px;
  max-height: 420px;
  overflow-y: auto;
}
.item {
  display: flex;
  gap: 10px;
  width: 100%;
  padding: 10px;
  border: 0;
  border-radius: 10px;
  background: none;
  font: inherit;
  color: var(--text-2);
  text-align: left;
  cursor: pointer;
}
.item:hover {
  background: var(--glass-soft);
}
.item.unread {
  color: var(--text);
}
.item.unread .title {
  font-weight: 700;
}
.dot {
  flex: none;
  width: 8px;
  height: 8px;
  margin-top: 7px;
  border-radius: 50%;
  background: var(--tone);
  opacity: 0.35;
}
.item.unread .dot {
  opacity: 1;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--tone) 22%, transparent);
}
.txt {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.sum {
  font-size: var(--fs-sm);
}
.need {
  color: var(--c-warning);
}
.foot {
  padding: 10px 14px;
  border-top: 1px solid var(--line);
  text-align: right;
}
.scrim {
  position: fixed;
  inset: 0;
  z-index: 25;
}
.pop-enter-active,
.pop-leave-active {
  transition: all 180ms var(--ease);
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
</style>
