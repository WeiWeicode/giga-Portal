/** docs/Gherkin/ui/migrating.feature(測試名稱 = 場景名稱) */
import { describe, expect, it } from 'vitest';
import { isMigrating, MIGRATING_PAGES, MigratingPage, tabComponent } from '../src/composables/migrating';

describe('人事資料「系統轉移中」', () => {
  it('整頁轉移中的頁面', () => {
    expect([...MIGRATING_PAGES].sort()).toEqual(
      [
        'portal.query.read',
        'portal.salary.read',
        'portal.annual-gains.read',
        'portal.salary-adjust.read',
        'portal.attendance-abnormal.read',
        'portal.abnormal-respond.read',
        'portal.cipher-reset.read',
      ].sort(),
    );
  });

  it('只有部分欄位來自 TIPTOP 的頁面照常顯示', () => {
    const original = () => Promise.resolve({ default: {} });
    for (const code of ['portal.profile.read', 'portal.asset.read', 'portal.ef-info.read', 'portal.note.read']) {
      expect(isMigrating(code)).toBe(false);
      expect(tabComponent(code, original)).toBe(original);
    }
    for (const code of MIGRATING_PAGES) expect(tabComponent(code, original)).toBe(MigratingPage);
  });
});
