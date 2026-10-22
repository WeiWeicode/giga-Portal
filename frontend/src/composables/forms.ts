/** 表單下載畫面邏輯(P4;FEATURE-PLAN §4、D-25;docs/Gherkin/approval/forms.feature) */
import type { FormCatalog, FormDoc } from '@/api/portal';

/** 與後端 FORM_EXTENSIONS 一致(file-service 另有自己的白名單與檔頭檢查) */
export const FORM_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'] as const;
export const FORM_ACCEPT = FORM_EXTENSIONS.map((e) => `.${e}`).join(',');

export function formExt(fileName: string): string | null {
  const m = /\.([A-Za-z0-9]+)$/.exec(fileName.trim());
  const ext = m?.[1]?.toLowerCase();
  return ext && (FORM_EXTENSIONS as readonly string[]).includes(ext) ? ext : null;
}

/** 顯示用的檔案類型標籤 */
export function formKind(fileName: string): string {
  const ext = formExt(fileName);
  if (!ext) return '檔案';
  if (ext === 'pdf') return 'PDF';
  if (ext.startsWith('doc') || ext === 'odt') return 'Word';
  if (ext.startsWith('xls') || ext === 'ods') return 'Excel';
  return 'PowerPoint';
}

export interface FormGroup {
  id: number;
  name: string;
  items: FormDoc[];
}

/** 依分類分組並以關鍵字篩選(名稱、說明、檔名;不分大小寫);category = 'all' 顯示全部;沒有表單的分類不列 */
export function groupForms(catalog: FormCatalog | null, category: number | 'all', keyword: string): FormGroup[] {
  if (!catalog) return [];
  const kw = keyword.trim().toLowerCase();
  const hit = (f: FormDoc) => !kw || [f.name, f.description ?? '', f.fileName].some((s) => s.toLowerCase().includes(kw));
  return catalog.categories
    .filter((c) => category === 'all' || c.id === category)
    .map((c) => ({ id: c.id, name: c.name, items: catalog.items.filter((f) => f.categoryId === c.id && hit(f)) }))
    .filter((g) => g.items.length > 0);
}
