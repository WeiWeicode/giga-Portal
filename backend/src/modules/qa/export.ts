/**
 * 作答明細 Excel(FEATURE-PLAN §3.4;舊 MyQAList.aspx.cs:208-364 匯出 .xls)。
 * 欄位:部門、工號、姓名、題號、題目、答案、填答時間;人事屬性(性別、年齡…)系統轉移中不匯出(D-18)。
 * 儲存格一律寫成文字(不寫公式),避免答案以 = 開頭時被當成公式。
 */
import ExcelJS from 'exceljs';
import type { ExportRow } from './qa.js';

export const EXPORT_COLUMNS = ['部門', '工號', '姓名', '題號', '題目', '答案', '填答時間'] as const;

export async function buildAnswerWorkbook(title: string, rows: readonly ExportRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GigaNexus portal-api';
  const ws = wb.addWorksheet('作答明細');
  ws.columns = [
    { header: EXPORT_COLUMNS[0], key: 'dept', width: 18 },
    { header: EXPORT_COLUMNS[1], key: 'empNo', width: 12 },
    { header: EXPORT_COLUMNS[2], key: 'name', width: 12 },
    { header: EXPORT_COLUMNS[3], key: 'no', width: 8 },
    { header: EXPORT_COLUMNS[4], key: 'question', width: 40 },
    { header: EXPORT_COLUMNS[5], key: 'answer', width: 40 },
    { header: EXPORT_COLUMNS[6], key: 'answeredAt', width: 20 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows)
    ws.addRow({
      dept: r.dept ?? '',
      empNo: r.empNo,
      name: r.name ?? '',
      no: r.no,
      question: r.question ?? '',
      answer: r.answer ?? '',
      answeredAt: r.answeredAt ?? '',
    });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  wb.title = title;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** 下載檔名:去掉檔名不允許的字元,ASCII 後備名 + RFC 5987 UTF-8 名稱 */
export function contentDisposition(title: string): string {
  const name = `${title.replace(/[\\/:*?"<>|\r\n\t]/g, '_').slice(0, 100) || 'survey'}.xlsx`;
  return `attachment; filename="survey.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
