/**
 * 首頁圖片輪播與年度行事曆 PDF(FEATURE-PLAN §1「公告輪播 / 集團動態」、§5「行事曆」;docs/Gherkin/home/home.feature、group/calendar.feature)。
 * 檔案本體由前端上傳到 giga-file-service(D-25 同模式),portal-api 只存 UUID 與顯示設定;不寫網站目錄、不寫死檔名。
 */
import { AppError } from '../../errors.js';
import { isSafeUrl } from '../links/links.js';

export const SLIDE_KINDS = ['policy', 'gallery'] as const;
export type SlideKind = (typeof SLIDE_KINDS)[number];

/** file-service 檔案 UUID */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;

export interface Slide {
  id: number;
  kind: SlideKind;
  title: string;
  fileId: string;
  linkUrl: string | null;
  /** YYYY-MM-DD;null = 不限 */
  startDate: string | null;
  endDate: string | null;
  sort: number;
  active: boolean;
}
export type SlideInput = Omit<Slide, 'id'>;

export interface CalendarPdf {
  year: number;
  fileId: string;
  fileName: string;
  updatedAt: string;
}

export interface ContentRepo {
  /** all = false 只列啟用中(不管日期);依 kind、sort、id */
  slides(all: boolean): Promise<Slide[]>;
  createSlide(input: SlideInput, byEmp: string): Promise<Slide>;
  updateSlide(id: number, input: SlideInput, byEmp: string): Promise<Slide | null>;
  deleteSlide(id: number): Promise<boolean>;

  calendars(): Promise<CalendarPdf[]>;
  /** 同年度已有則取代 */
  upsertCalendar(year: number, fileId: string, fileName: string, byEmp: string): Promise<CalendarPdf>;
  deleteCalendar(year: number): Promise<boolean>;
}

const slideNotFound = () => new AppError(404, 'PORTAL_SLIDE_NOT_FOUND', '找不到此輪播圖片');

/** 今天在起訖日內(空白 = 不限) */
export const slideVisible = (s: Pick<Slide, 'active' | 'startDate' | 'endDate'>, today: string) =>
  s.active && (!s.startDate || s.startDate <= today) && (!s.endDate || s.endDate >= today);

export class ContentService {
  constructor(private readonly repo: ContentRepo) {}

  private normalizeSlide(input: SlideInput): SlideInput {
    if (!UUID_RE.test(input.fileId)) throw new AppError(400, 'VALIDATION_FAILED', '圖片檔案編號格式錯誤');
    const linkUrl = input.linkUrl?.trim() || null;
    if (linkUrl && !isSafeUrl(linkUrl)) throw new AppError(400, 'VALIDATION_FAILED', '連結必須是 http(s):// 開頭或站內路徑(/ 開頭)');
    if (input.startDate && input.endDate && input.endDate < input.startDate) throw new AppError(400, 'VALIDATION_FAILED', '結束日不可早於開始日');
    return { ...input, title: input.title.trim(), fileId: input.fileId.toLowerCase(), linkUrl };
  }

  /** 首頁顯示:今天在期間內、依種類分組 */
  async visibleSlides(today: string): Promise<Record<SlideKind, Slide[]>> {
    const rows = (await this.repo.slides(false)).filter((s) => slideVisible(s, today));
    return { policy: rows.filter((s) => s.kind === 'policy'), gallery: rows.filter((s) => s.kind === 'gallery') };
  }

  allSlides(): Promise<Slide[]> {
    return this.repo.slides(true);
  }

  createSlide(input: SlideInput, byEmp: string): Promise<Slide> {
    return this.repo.createSlide(this.normalizeSlide(input), byEmp);
  }

  async updateSlide(id: number, input: SlideInput, byEmp: string): Promise<Slide> {
    return (await this.repo.updateSlide(id, this.normalizeSlide(input), byEmp)) ?? Promise.reject(slideNotFound());
  }

  async deleteSlide(id: number): Promise<void> {
    if (!(await this.repo.deleteSlide(id))) throw slideNotFound();
  }

  calendars(): Promise<CalendarPdf[]> {
    return this.repo.calendars();
  }

  upsertCalendar(year: number, fileId: string, fileName: string, byEmp: string): Promise<CalendarPdf> {
    if (!UUID_RE.test(fileId)) throw new AppError(400, 'VALIDATION_FAILED', 'PDF 檔案編號格式錯誤');
    const name = fileName.trim();
    if (!/\.pdf$/i.test(name)) throw new AppError(400, 'VALIDATION_FAILED', '年度行事曆只接受 PDF');
    return this.repo.upsertCalendar(year, fileId.toLowerCase(), name, byEmp);
  }

  async deleteCalendar(year: number): Promise<void> {
    if (!(await this.repo.deleteCalendar(year))) throw new AppError(404, 'PORTAL_CALENDAR_NOT_FOUND', '此年度沒有行事曆');
  }
}
