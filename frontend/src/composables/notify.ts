/**
 * 通知中心(Gateway NOTIFY-PLAN §6.5):收件匣狀態與連線由 web-kit useNotifyCenter 管理,本檔只放入口網的畫面共用狀態(同 GigaItApp)。
 *   - center:本系統(app = portal)的收件匣;AppLayout 的 NotifyHost 登入後 start()
 *   - reader:全站唯一的公告閱讀對話框(鈴鐺、首頁最新公告卡都用 openAnnouncement 開啟)
 */
import { notifyApi, useNotifyCenter, type AnnouncementDetail, type FeedItem } from '@giganexus/web-kit';
import '@giganexus/web-kit/src/notify-content.css';
import { reactive } from 'vue';

export const NOTIFY_APP = 'portal' as const;
export const center = useNotifyCenter(NOTIFY_APP);

export const LEVEL: Record<string, { label: string; tone: string; icon: string }> = {
  info: { label: '一般', tone: 'info', icon: 'info' },
  important: { label: '重要', tone: 'warning', icon: 'alert-circle' },
  urgent: { label: '緊急', tone: 'danger', icon: 'alert' },
};
export const levelOf = (l: string | null | undefined) => LEVEL[l ?? 'info'] ?? LEVEL.info!;

export const STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: '草稿', tone: 'neutral' },
  scheduled: { label: '排程中', tone: 'info' },
  published: { label: '已發布', tone: 'success' },
  revoked: { label: '已撤回', tone: 'danger' },
};

export const CHANNEL_LABEL: Record<string, string> = { portal: '入口網', itapp: 'GigaItApp', agent: '端點 Agent', email: 'Email' };

export const reader = reactive({
  open: false,
  id: null as number | null,
  detail: null as AnnouncementDetail | null,
  loading: false,
  error: null as unknown,
});

/** 開啟公告閱讀對話框並標記已讀(需確認的公告要按「已閱讀」才算確認) */
export async function openAnnouncement(id: number): Promise<void> {
  reader.open = true;
  reader.id = id;
  reader.detail = null;
  reader.error = null;
  reader.loading = true;
  try {
    const d = await notifyApi.get(id);
    if (reader.id !== id) return;
    reader.detail = d;
    if (!d.myReceipt?.readAt) await center.markRead({ kind: 'announcement', id }).catch(() => undefined);
  } catch (e) {
    if (reader.id === id) reader.error = e;
  } finally {
    if (reader.id === id) reader.loading = false;
  }
}

/** 點收件匣項目:公告開對話框;個人通知標為已讀,有連結就前往 */
export async function openFeedItem(item: FeedItem): Promise<void> {
  if (item.kind === 'announcement') return openAnnouncement(item.id);
  if (!item.isRead) await center.markRead(item).catch(() => undefined);
  if (item.linkUrl) location.assign(item.linkUrl);
}
