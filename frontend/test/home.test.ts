/** 首頁與集團公告的畫面邏輯(docs/Gherkin/home/home.feature、group/*.feature) */
import { describe, expect, it } from 'vitest';
import type { CalendarPdf, Dashboard, SystemLink } from '../src/api/portal';
import { defaultYear, groupLinks, isInternal, moveId, nextIndex, sectionState, todoErrors } from '../src/composables/home';

const meta = (errors: string[], unavailable: string[] = []): Dashboard['_meta'] => ({
  errors: errors.map((section) => ({ section, message: '暫時無法取得' })),
  unavailable,
});

const link = (id: number, category: string, extra: Partial<SystemLink> = {}): SystemLink => ({
  id,
  name: `系統${id}`,
  description: null,
  category,
  url: '/x',
  openMode: 'new',
  legacyDes: false,
  sort: id,
  active: true,
  ...extra,
});

describe('首頁', () => {
  it('部分區塊失敗不影響其他區塊', () => {
    const m = meta(['bpm', 'news'], ['todos.consent', 'slides']);
    expect(sectionState(m, 'bpm')).toBe('error');
    expect(sectionState(m, 'news')).toBe('error');
    expect(sectionState(m, 'secretary.links')).toBe('ok');
    expect(sectionState(m, 'slides')).toBe('unavailable');
    expect(sectionState(undefined, 'bpm')).toBe('ok');
    expect(todoErrors(meta(['bpm', 'todos.qa', 'slides']))).toEqual(['BPM', '問卷']);
  });

  it('輪播索引循環', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
    expect(nextIndex(0, 3, -1)).toBe(2);
    expect(nextIndex(0, 0)).toBe(0);
  });

  it('個人常用連結上移 / 下移', () => {
    expect(moveId([1, 2, 3], 2, -1)).toEqual([2, 1, 3]);
    expect(moveId([1, 2, 3], 2, 1)).toEqual([1, 3, 2]);
    expect(moveId([1, 2, 3], 1, -1)).toBeNull();
    expect(moveId([1, 2, 3], 3, 1)).toBeNull();
    expect(moveId([1, 2, 3], 9, 1)).toBeNull();
  });

  it('站內連結走 router、其他另開分頁', () => {
    expect(isInternal('/personal/notes')).toBe(true);
    expect(isInternal('//evil.example')).toBe(false);
    expect(isInternal('https://a.example')).toBe(false);
  });
});

describe('集團系統與行事曆', () => {
  it('依分類分組並可搜尋', () => {
    const g = groupLinks([link(1, '行政'), link(2, '福利', { name: '訂便當', legacyDes: true, url: null }), link(3, '行政', { description: 'BPM 簽核' })]);
    expect(g.map((x) => [x.category, x.items.map((i) => i.id)])).toEqual([
      ['行政', [1, 3]],
      ['福利', [2]],
    ]);
    expect(groupLinks([link(1, '行政'), link(3, '行政', { description: 'BPM 簽核' })], 'bpm').map((x) => x.items.map((i) => i.id))).toEqual([[3]]);
  });

  it('依年度切換行事曆的預設年度', () => {
    const c = (year: number): CalendarPdf => ({ year, fileId: 'f', fileName: `${year}.pdf`, updatedAt: '' });
    expect(defaultYear([c(2025), c(2026), c(2027)], 2026)).toBe(2026);
    expect(defaultYear([c(2024), c(2025)], 2026)).toBe(2025);
    expect(defaultYear([], 2026)).toBeNull();
  });
});
