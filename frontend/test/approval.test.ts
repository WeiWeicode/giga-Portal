/** 待我簽核與表單下載的畫面邏輯(docs/Gherkin/approval/approval.feature、forms.feature) */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FormCatalog, FormDoc } from '../src/api/portal';
import { bpmBlocker, fmtBpmTime, openBpmLink, requesterLabel, safeBpmUrl } from '../src/composables/bpm';
import { formExt, formKind, groupForms } from '../src/composables/forms';

describe('待我簽核', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('前往簽核只開 http(s) 連結', () => {
    const open = vi.fn();
    vi.stubGlobal('window', { open });
    expect(openBpmLink('http://10.10.130.191:8080/NaNaWeb/GP/PerformWorkFromMail?hdnWorkItemOID=1')).toBe(true);
    expect(open).toHaveBeenCalledWith('http://10.10.130.191:8080/NaNaWeb/GP/PerformWorkFromMail?hdnWorkItemOID=1', '_blank', 'noopener');
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', '//evil', 'not a url', null, undefined, '']) {
      expect(openBpmLink(bad)).toBe(false);
      expect(safeBpmUrl(bad)).toBeNull();
    }
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('非碩禾系與沒有帳號的提示', () => {
    expect(bpmBlocker(null)).toBeNull();
    expect(bpmBlocker({ applicable: false, hasAccount: false })).toBe('not-applicable');
    expect(bpmBlocker({ applicable: true, hasAccount: false })).toBe('no-account');
    expect(bpmBlocker({ applicable: true, hasAccount: true })).toBeNull();
  });

  it('申請人與時間顯示', () => {
    expect(requesterLabel({ requesterId: 'S090005', requesterName: '王小明' })).toBe('王小明(S090005)');
    expect(requesterLabel({ requesterId: 'S090005', requesterName: null })).toBe('S090005');
    expect(requesterLabel({ requesterId: null, requesterName: null })).toBe('—');
    expect(fmtBpmTime(null)).toBe('—');
    expect(fmtBpmTime('2026-10-12T01:00:00.000Z')).toContain('09:00:00');
  });
});

const doc = (id: number, categoryId: number, name: string, extra: Partial<FormDoc> = {}): FormDoc => ({
  id,
  categoryId,
  name,
  description: null,
  fileId: '0bc59e51-9188-4e5d-87eb-6467d178efdd',
  fileName: `${name}.docx`,
  sort: 0,
  active: true,
  updatedAt: '2026-10-23T00:00:00.000Z',
  ...extra,
});

describe('表單下載', () => {
  const catalog: FormCatalog = {
    categories: [
      { id: 2, name: '總務', sort: 1 },
      { id: 1, name: '人事', sort: 2 },
      { id: 3, name: '空分類', sort: 3 },
    ],
    items: [doc(10, 1, '請假單', { description: '紙本備用' }), doc(11, 1, '加班單', { fileName: 'OT.PDF' }), doc(12, 2, '停車證申請')],
  };

  it('依分類分組、沒有表單的分類不列', () => {
    expect(groupForms(catalog, 'all', '').map((g) => [g.name, g.items.map((f) => f.id)])).toEqual([
      ['總務', [12]],
      ['人事', [10, 11]],
    ]);
    expect(groupForms(catalog, 1, '').map((g) => g.name)).toEqual(['人事']);
    expect(groupForms(null, 'all', '')).toEqual([]);
  });

  it('關鍵字比對名稱、說明、檔名', () => {
    expect(groupForms(catalog, 'all', '紙本')[0]!.items.map((f) => f.id)).toEqual([10]);
    expect(groupForms(catalog, 'all', 'ot.pdf')[0]!.items.map((f) => f.id)).toEqual([11]);
    expect(groupForms(catalog, 'all', '不存在')).toEqual([]);
  });

  it('檔案類型', () => {
    expect([formKind('a.PDF'), formKind('a.docx'), formKind('a.ods'), formKind('a.pptx'), formKind('a.exe')]).toEqual([
      'PDF',
      'Word',
      'Excel',
      'PowerPoint',
      '檔案',
    ]);
    expect(formExt('a.pdf.exe')).toBeNull();
    expect(formExt(' 表.XLSX ')).toBe('xlsx');
  });
});
