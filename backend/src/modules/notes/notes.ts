/**
 * 個人提醒(P1-2;docs/Gherkin/personal/notes.feature):portal.personal_note,只有本人看得到、改得到。
 * 別人的提醒一律回 404(不透露是否存在)。
 */
import { AppError } from '../../errors.js';

export const CATEGORIES = ['工作交辦', '行事提醒', '重要截止', '個人筆記'] as const;
export const PRIORITIES = ['high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];
/** 每人上限,避免無限新增 */
export const MAX_NOTES = 500;

export interface Note {
  id: number;
  title: string;
  content: string | null;
  category: string;
  priority: Priority;
  /** YYYY-MM-DD */
  dueDate: string | null;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoteInput {
  title: string;
  content?: string | null;
  category: string;
  priority: Priority;
  dueDate?: string | null;
}
export type NotePatch = Partial<NoteInput> & { done?: boolean };

export interface NoteRepo {
  /** 未完成在前,再依到期日(空的在後)、建立時間新到舊 */
  list(empNo: string): Promise<Note[]>;
  count(empNo: string): Promise<number>;
  create(empNo: string, input: NoteInput): Promise<Note>;
  /** 只更新本人的;找不到回 null */
  update(empNo: string, id: number, patch: NotePatch): Promise<Note | null>;
  /** 只刪本人的;回傳是否刪到 */
  remove(empNo: string, id: number): Promise<boolean>;
}

const notFound = () => new AppError(404, 'PORTAL_NOTE_NOT_FOUND', '找不到此提醒');

export class NoteService {
  constructor(private readonly repo: NoteRepo) {}

  list(empNo: string): Promise<Note[]> {
    return this.repo.list(empNo);
  }

  async create(empNo: string, input: NoteInput): Promise<Note> {
    // 先數再新增不是原子操作,同一人同時送出可能略超過上限;上限只為防止無限新增,可接受
    if ((await this.repo.count(empNo)) >= MAX_NOTES) throw new AppError(409, 'PORTAL_NOTE_LIMIT', `個人提醒最多 ${MAX_NOTES} 筆,請先刪除已完成的提醒`);
    return this.repo.create(empNo, { ...input, title: input.title.trim() });
  }

  async update(empNo: string, id: number, patch: NotePatch): Promise<Note> {
    const p = patch.title === undefined ? patch : { ...patch, title: patch.title.trim() };
    return (await this.repo.update(empNo, id, p)) ?? Promise.reject(notFound());
  }

  async remove(empNo: string, id: number): Promise<void> {
    if (!(await this.repo.remove(empNo, id))) throw notFound();
  }
}
