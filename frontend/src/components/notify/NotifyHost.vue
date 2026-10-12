<script setup lang="ts">
/**
 * 通知的全站掛載點(AppLayout 內,登入後才存在):
 *   - 啟動收件匣連線(web-kit useNotifyCenter,/ws/notify?app=portal)
 *   - 新公告:一般 / 重要 → Toast;緊急或需確認 → 直接開閱讀對話框;分頁在背景時 web-kit 另跳 Windows 通知(已授權時)
 *   - 公告閱讀對話框:需確認已閱讀的公告,按「已閱讀」才能關閉
 */
import { sanitizeHtml } from '@giganexus/web-kit';
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { describeError } from '@/api/gateway';
import { fmtTime } from '@/api/format';
import { center, levelOf, openAnnouncement, reader } from '@/composables/notify';
import { toast } from '@/ui';

const offs: (() => void)[] = [];
onMounted(() => {
  center.start();
  offs.push(
    center.onArrive((m, how) => {
      if (m.type === 'announcement') {
        if (how.dialog) void openAnnouncement(m.announcementId);
        else toast.info(`${levelOf(m.level).label}公告:${m.title}`, m.summary || '點右上角鈴鐺查看');
      } else toast.info(m.title, m.body);
    }),
    center.onRevoked((id) => {
      if (reader.open && reader.id === id) {
        reader.open = false;
        toast.warning('此公告已被發布人撤回');
      }
    }),
  );
  center.setDesktopClickHandler((m) => (m.type === 'announcement' ? void openAnnouncement(m.announcementId) : undefined));
});
onBeforeUnmount(() => {
  offs.forEach((f) => f());
  center.setDesktopClickHandler(null);
});

const d = computed(() => reader.detail);
const lv = computed(() => levelOf(d.value?.level));
/** 需確認且尚未確認:對話框不可直接關閉 */
const mustAck = computed(() => !!d.value?.requireAck && !d.value.myReceipt?.ackAt);
const body = computed(() => (d.value ? sanitizeHtml(d.value.bodyHtml) : ''));

async function ack() {
  if (!d.value) return;
  try {
    await center.ack(d.value.announcementId);
    d.value.myReceipt = { readAt: d.value.myReceipt?.readAt ?? new Date().toISOString(), ackAt: new Date().toISOString() };
    reader.open = false;
    toast.success('已確認閱讀');
  } catch (e) {
    toast.fromError(e, '確認失敗');
  }
}
</script>

<template>
  <GModal
    v-model:open="reader.open"
    :title="d?.title ?? '公告'"
    :subtitle="d ? `${d.publisherTitle ?? '公告'} · ${fmtTime(d.publishAt)}` : undefined"
    :icon="lv.icon"
    :tone="lv.tone"
    width="720px"
    :persistent="mustAck"
  >
    <GSkeleton v-if="reader.loading" :lines="6" />
    <GEmpty v-else-if="reader.error" compact tone="danger" icon="alert" title="公告載入失敗" :description="describeError(reader.error)" />
    <div v-else-if="d" class="stack" style="--gap: 14px">
      <div class="row" style="--gap: 6px">
        <GBadge :tone="lv.tone" :icon="lv.icon">{{ lv.label }}</GBadge>
        <GBadge v-if="d.requireAck" :tone="d.myReceipt?.ackAt ? 'success' : 'warning'" icon="check-check">
          {{ d.myReceipt?.ackAt ? `已確認 ${fmtTime(d.myReceipt.ackAt)}` : '需確認已閱讀' }}
        </GBadge>
        <GBadge v-if="d.expireAt" tone="neutral" icon="clock">到期 {{ fmtTime(d.expireAt) }}</GBadge>
      </div>
      <!-- 內文:BFF 已白名單清洗,顯示前再以 web-kit sanitizeHtml 清洗一次 -->
      <div class="gn-notify-content reader-body" v-html="body" />
      <a v-if="d.linkUrl" :href="d.linkUrl" target="_blank" rel="noopener noreferrer" class="small"> <GIcon name="external" :size="14" /> 相關連結 </a>
    </div>
    <template #footer>
      <GButton v-if="mustAck" icon="check-check" :disabled="!d" @click="ack">已閱讀</GButton>
      <GButton v-else variant="secondary" @click="reader.open = false">關閉</GButton>
    </template>
  </GModal>
</template>

<style scoped>
.reader-body {
  max-height: min(60vh, 640px);
  overflow-y: auto;
  padding-right: 4px;
  font-size: var(--fs-md);
}
</style>
