/** ESH 證照管理與危害性化學品畫面邏輯(docs/Gherkin/esh/*.feature) */
import { describe, expect, it } from 'vitest';
import type { EshDashboardItem, EshHolder } from '../src/api/portal';
import {
  chemicalDefaultRange,
  dashboardCounts,
  docHref,
  filterDashboard,
  filterHolders,
  hasExt,
  logoSrc,
  monthsText,
  notifySummary,
  previewNextDate,
  sdsLink,
  statusText,
  DOC_EXTENSIONS,
} from '../src/composables/esh';

const item = (over: Partial<EshDashboardItem>): EshDashboardItem => ({
  licenseId: 1,
  name: 'x',
  months: 36,
  permanent: false,
  description: '',
  logo: null,
  legacyLogoUrl: null,
  required: 1,
  valid: 1,
  ratio: 100,
  ok: true,
  notes: null,
  ...over,
});
const holder = (over: Partial<EshHolder>): EshHolder => ({
  id: 1,
  licenseId: 7,
  licenseName: '急救人員',
  months: 36,
  permanent: false,
  company: '碩禾',
  empNo: 'S300001',
  name: '王小明',
  dept: 'S4130',
  trainingDate: null,
  gatDate: null,
  retrainDate: null,
  nextTrainingDate: '2026-11-30',
  notifyDays: 90,
  active: true,
  inService: true,
  daysLeft: 38,
  status: 'notify',
  docs: [],
  ...over,
});

describe('ESH 證照', () => {
  it('公司證照符合度:篩選與計數', () => {
    const items = [item({ licenseId: 1 }), item({ licenseId: 2, ok: false }), item({ licenseId: 3, ok: false })];
    expect(dashboardCounts(items)).toEqual({ all: 3, ng: 2, ok: 1 });
    expect(filterDashboard(items, 'ng').map((i) => i.licenseId)).toEqual([2, 3]);
    expect(filterDashboard(items, 'ok').map((i) => i.licenseId)).toEqual([1]);
    expect(logoSrc({ logo: { fileId: 'abc', fileName: 'a.png' }, legacyLogoUrl: 'http://old/x.png' })).toBe('/api/file/files/abc/content?inline=1');
    expect(logoSrc({ logo: null, legacyLogoUrl: 'http://old/x.png' })).toBe('http://old/x.png');
    expect(monthsText({ months: null, permanent: true })).toBe('永久');
  });

  it('人員證照狀態文字', () => {
    expect(statusText(holder({}))).toBe('需通知(剩 38 天)');
    expect(statusText(holder({ status: 'expired', daysLeft: -23 }))).toBe('已失效(逾 23 天)');
    expect(statusText(holder({ status: 'ok', daysLeft: 400 }))).toBe('有效');
    expect(statusText(holder({ status: 'left', active: false }))).toBe('已刪除 · 已離職');
  });

  it('人員清單篩選', () => {
    const rows = [holder({ id: 1 }), holder({ id: 2, licenseId: 8, licenseName: '堆高機', empNo: 'S1', name: '李' })];
    expect(filterHolders(rows, '堆高').map((h) => h.id)).toEqual([2]);
    expect(filterHolders(rows, '', '7').map((h) => h.id)).toEqual([1]);
    expect(filterHolders(rows, 's3000').map((h) => h.id)).toEqual([1]);
  });

  it('下次複訓日預覽與後端規則一致', () => {
    expect(previewNextDate(['2026-09-01', '2026-10-02', ''], 36, false)).toBe('2029-10-01');
    expect(previewNextDate(['2024-01-31'], 1, false)).toBe('2024-02-28');
    expect(previewNextDate(['2020-01-01'], null, true)).toBe('2100-01-01');
    expect(previewNextDate([null, undefined], 36, false)).toBeNull();
    expect(previewNextDate(['2020-01-01'], 0, false)).toBeNull();
  });

  it('證照影本與 SDS 連結', () => {
    expect(docHref({ kind: 'file', id: 1, fileId: 'u', fileName: 'a.pdf' })).toBe('/api/file/files/u/content?inline=1');
    expect(docHref({ kind: 'legacy', fileName: 'a.pdf', url: null })).toBeNull();
    expect(sdsLink({ kind: 'url', url: 'http://bpm/a.pdf', name: 'a.pdf' })).toEqual({ href: 'http://bpm/a.pdf', name: 'a.pdf', legacy: false });
    expect(sdsLink(null)).toBeNull();
    expect(hasExt('證照.PDF', DOC_EXTENSIONS)).toBe(true);
    expect(hasExt('a.pdf.exe', DOC_EXTENSIONS)).toBe(false);
  });

  it('通知結果與化學品預設區間', () => {
    expect(notifySummary({ runId: 1, mode: 'dry-run', total: 3, counts: { queued: 0, skipped: 0, 'dry-run': 3, duplicate: 0, failed: 0 } })).toBe(
      '模擬寄送:共 3 封(模擬(未寄出) 3)',
    );
    expect(chemicalDefaultRange('2026-10-23')).toEqual({ from: '2025-10-01', to: '2026-10-23' });
  });
});
