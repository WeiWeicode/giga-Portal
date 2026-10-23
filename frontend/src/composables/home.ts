/**
 * 首頁與集團公告的畫面邏輯(FEATURE-PLAN §1、§5;docs/Gherkin/home/home.feature、group/*.feature)。不做 I/O。
 *   - 區塊狀態:聚合回應 _meta.errors 的區塊顯示「暫時無法取得」,其他區塊照常(FR-4.8)
 *   - 輪播:每 5 秒切換,滑鼠移入暫停(畫面處理);索引循環
 *   - 集團系統:依分類分組;DES 跳轉系統只顯示「DES 跳轉(待重構)」(D-22)
 *   - 行事曆:年度清單與預設年度(今年;沒有今年時取最新)
 *   - 個人常用連結:上移 / 下移後的 id 順序
 */
import type { CalendarPdf, Dashboard, SystemLink } from '@/api/portal';

export type SectionState = 'ok' | 'error' | 'unavailable';

/** section 可為多個(例:個人秘書的 BPM 取自 bpm) */
export function sectionState(meta: Dashboard['_meta'] | undefined, ...sections: string[]): SectionState {
  if (!meta) return 'ok';
  if (meta.errors.some((e) => sections.includes(e.section))) return 'error';
  if (sections.every((s) => meta.unavailable.includes(s))) return 'unavailable';
  return 'ok';
}

/** 待辦區塊有任一來源失敗時的提示文字(其他待辦仍顯示) */
const TODO_SOURCES: Record<string, string> = {
  bpm: 'BPM',
  'todos.qa': '問卷',
  'todos.onboarding': '新人導覽',
  'todos.consent': '同意書',
  'todos.notes': '個人提醒',
};
export function todoErrors(meta: Dashboard['_meta'] | undefined): string[] {
  return (meta?.errors ?? []).map((e) => TODO_SOURCES[e.section]).filter((x): x is string => !!x);
}

export const SLIDE_INTERVAL_MS = 5000;
export const nextIndex = (i: number, n: number, step = 1) => (n <= 0 ? 0 : (((i + step) % n) + n) % n);

export const DES_LABEL = 'DES 跳轉(待重構)';

/** 集團系統依分類分組(維持後端排序;分類依第一次出現的順序) */
export function groupLinks(links: readonly SystemLink[], keyword = ''): { category: string; items: SystemLink[] }[] {
  const kw = keyword.trim().toLowerCase();
  const hit = (l: SystemLink) => !kw || [l.name, l.description ?? '', l.category].some((s) => s.toLowerCase().includes(kw));
  const groups = new Map<string, SystemLink[]>();
  for (const l of links.filter(hit)) groups.set(l.category, [...(groups.get(l.category) ?? []), l]);
  return [...groups].map(([category, items]) => ({ category, items }));
}

/** 預設顯示的年度:今年有就今年,否則最新的一年 */
export function defaultYear(items: readonly CalendarPdf[], thisYear: number): number | null {
  if (!items.length) return null;
  return items.some((c) => c.year === thisYear) ? thisYear : Math.max(...items.map((c) => c.year));
}

/** 個人常用連結上移 / 下移:回傳新的 id 順序;超出範圍回 null */
export function moveId(ids: readonly number[], id: number, delta: -1 | 1): number[] | null {
  const i = ids.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  const next = [...ids];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/** 站內連結(/ 開頭)走 router,其他另開分頁 */
export const isInternal = (url: string) => url.startsWith('/') && !url.startsWith('//');
