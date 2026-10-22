/** 3691 全民開講的畫面邏輯(docs/Gherkin/group/talk.feature) */
import { describe, expect, it } from 'vitest';
import type { TalkPost } from '../src/api/portal';
import { buildTree, postErrors, titleOf } from '../src/composables/talk';

const p = (sn: number, parentSn: number | null, createdAt: string, extra: Partial<TalkPost> = {}): TalkPost => ({
  sn,
  parentSn,
  type: '舉手發問',
  title: `T${sn}`,
  content: '',
  createdAt,
  blocked: false,
  likes: 0,
  likedByMe: false,
  ...extra,
});

describe('3691 全民開講', () => {
  it('瀏覽討論串:主題新到舊、回覆舊到新', () => {
    const tree = buildTree([
      p(1, null, '2026-01-01 00:00:00'),
      p(2, 1, '2026-01-03 00:00:00'),
      p(3, 1, '2026-01-02 00:00:00'),
      p(4, 3, '2026-01-04 00:00:00'),
      p(5, null, '2026-02-01 00:00:00'),
      p(6, 99, '2026-01-05 00:00:00'),
    ]);
    expect(tree.map((n) => n.sn)).toEqual([5, 6, 1]);
    const first = tree.find((n) => n.sn === 1)!;
    expect(first.replies.map((n) => n.sn)).toEqual([3, 2]);
    expect(first.replies[0]!.replies.map((n) => n.sn)).toEqual([4]);
    expect(first.replyCount).toBe(3);
  });

  it('自我參照的資料不會無限遞迴', () => {
    const tree = buildTree([p(1, 1, '2026-01-01 00:00:00'), p(2, 3, '2026-01-01 00:00:00'), p(3, 2, '2026-01-01 00:00:00')]);
    expect(tree.map((n) => n.sn)).toContain(1);
  });

  it('無標題顯示(無標題)', () => {
    expect(titleOf({ title: '  ' })).toBe('(無標題)');
    expect(titleOf({ title: '問題' })).toBe('問題');
  });

  it('發文欄位驗證', () => {
    expect(postErrors({ reply: false, type: '', title: '', content: '' })).toEqual(['請選擇分類', '請填寫標題', '請填寫內容']);
    expect(postErrors({ reply: true, type: '', title: '', content: '回覆' })).toEqual([]);
    expect(postErrors({ reply: false, type: '舉手發問', title: 'x'.repeat(101), content: 'x'.repeat(4001) })).toEqual(['標題最多 100 字', '內容最多 4000 字']);
  });
});
