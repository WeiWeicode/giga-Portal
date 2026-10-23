/**
 * 訓練計畫匯出(舊 ELlessionplan.aspx.cs SendSampleExcel:套用寫死的「Document\2024年度教育訓練計劃表單.xls」範本)。
 * 新版不依賴範本檔:年度取自 ELClassAnnual(標題「<民國年>年度教育訓練計畫 部門 <部門>」),欄位對應舊範本的填寫欄。
 * 儲存格一律寫成文字或數字(不寫公式)。
 */
import ExcelJS from 'exceljs';
import type { PlanDept } from './training-repo.js';
import type { PlanCourse } from './training-rules.js';

export const TRAINING_COLUMNS = [
  '部門',
  '類別',
  '子類',
  '性質',
  '課程名稱',
  '大綱',
  '時數',
  '訓練單位 / 講師',
  '參加部門',
  '第一季',
  '第二季',
  '第三季',
  '第四季',
  '不定期',
  '實施方式',
  '講師費',
  '雜費',
  '報名費',
  '合計',
  '評核方式',
] as const;

const seasonsOf = (s: string | null) => new Set((s ?? '').split(/[,\s]+/).filter(Boolean));

export function trainingFileName(year: number, dept: string): string {
  return `${dept.replace(/[^A-Za-z0-9_-]/g, '_')}_${year - 1911}年度教育訓練計劃`;
}

export async function buildTrainingWorkbook(year: number, dept: PlanDept, courses: readonly PlanCourse[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GigaNexus portal-api';
  const ws = wb.addWorksheet('教育訓練計畫');
  ws.addRow([`${year - 1911}年度教育訓練計畫 部門 ${dept.code}${dept.name ? ` ${dept.name}` : ''}`]).font = { bold: true, size: 16 };
  ws.mergeCells(1, 1, 1, TRAINING_COLUMNS.length);
  ws.addRow([...TRAINING_COLUMNS]).font = { bold: true };
  for (const c of courses) {
    const s = seasonsOf(c.season);
    const mark = (k: string) => (s.has(k) ? 'V' : '');
    ws.addRow([
      c.dept,
      c.classType ?? '',
      c.subType ?? '',
      c.classWhere ?? '',
      c.className ?? '',
      c.agenda ?? '',
      c.hour ?? 0,
      [c.teacherUnit, c.teacherName].filter(Boolean).join('/'),
      c.joinDept ?? '',
      mark('1'),
      mark('2'),
      mark('3'),
      mark('4'),
      mark('不定期'),
      c.onType ?? '',
      c.cost1 ?? 0,
      c.cost3 ?? 0,
      c.cost2 ?? 0,
      c.cost ?? 0,
      c.testType ?? '',
    ]);
  }
  ws.columns.forEach((col, i) => (col.width = [10, 10, 16, 8, 30, 40, 8, 24, 20][i] ?? 10));
  ws.views = [{ state: 'frozen', ySplit: 2 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** 下載檔名:ASCII 後備名 + RFC 5987 UTF-8 名稱 */
export const trainingDisposition = (name: string) => `attachment; filename="training-plan.xlsx"; filename*=UTF-8''${encodeURIComponent(`${name}.xlsx`)}`;
