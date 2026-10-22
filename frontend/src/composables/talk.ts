/**
 * 3691 全民開講的畫面邏輯(old_PortalSolar Talktalk3691.aspx;FEATURE-PLAN §5.1;docs/Gherkin/group/talk.feature)。不做 I/O。
 * API 回傳扁平清單(parentSn),這裡組成樹狀:主題新到舊、回覆舊到新(同舊版 TreeView);找不到上層的回覆(上層被遮蔽或不同分類)當成主題顯示。
 * 內容一律以文字插值輸出(Vue 自動編碼),不使用 v-html。
 */
import type { TalkPost } from '@/api/portal';

export interface TalkNode extends TalkPost {
  replies: TalkNode[];
  /** 本則與所有回覆的總數(不含本則) */
  replyCount: number;
}

export const ALL_TYPES = '全部文件';
export const UNTITLED = '(無標題)';

export function buildTree(posts: readonly TalkPost[]): TalkNode[] {
  const nodes = new Map<number, TalkNode>(posts.map((p) => [p.sn, { ...p, replies: [], replyCount: 0 }]));
  const roots: TalkNode[] = [];
  for (const n of nodes.values()) {
    const parent = n.parentSn !== null ? nodes.get(n.parentSn) : undefined;
    if (parent && parent !== n) parent.replies.push(n);
    else roots.push(n);
  }
  const byTime = (a: TalkNode, b: TalkNode) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.sn - b.sn;
  const finish = (n: TalkNode, seen: Set<number>): number => {
    seen.add(n.sn);
    n.replies = n.replies.filter((r) => !seen.has(r.sn)).sort(byTime);
    n.replyCount = n.replies.reduce((s, r) => s + 1 + finish(r, seen), 0);
    return n.replyCount;
  };
  const seen = new Set<number>();
  roots.sort((a, b) => byTime(b, a));
  for (const r of roots) finish(r, seen);
  return roots;
}

export const titleOf = (p: Pick<TalkPost, 'title'>) => p.title.trim() || UNTITLED;

/** 新主題 / 回覆的前端檢查(後端會再檢查一次) */
export function postErrors(f: { reply: boolean; type: string; title: string; content: string }): string[] {
  const e: string[] = [];
  if (!f.reply && !f.type) e.push('請選擇分類');
  if (!f.reply && !f.title.trim()) e.push('請填寫標題');
  if (f.title.length > 100) e.push('標題最多 100 字');
  if (!f.content.trim()) e.push('請填寫內容');
  if (f.content.length > 4000) e.push('內容最多 4000 字');
  return e;
}
