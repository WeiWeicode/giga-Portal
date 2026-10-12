/**
 * portal-api(/api/portal/*,經 Gateway BFF;docs/API.md §3.0)。型別與後端 OpenAPI 一致,頁面不直接 fetch。
 */
import { http } from './gateway';

export type CourseStatus = 'done' | 'missing' | 'na';
export interface CourseResult {
  key: string;
  name: string;
  category: 'safety' | 'general';
  status: CourseStatus;
  hours?: number;
  minHours?: number;
}
export interface RequiredCourses {
  year: number;
  eligible: boolean;
  inYear: boolean;
  deduction: number;
  courses: CourseResult[];
}

/** 年度必上課程(本人) */
export const requiredCourses = (year?: number) => http.get<RequiredCourses>(`/api/portal/courses/required${year ? `?year=${year}` : ''}`);

export interface CommuteRecord {
  address: string | null;
  googleAddress: string | null;
  latitude: string | null;
  longitude: string | null;
  transport: string | null;
  startStation: string | null;
  endStation: string | null;
  transport2: string | null;
  startStation2: string | null;
  endStation2: string | null;
  note: string | null;
  updatedAt: string | null;
}
export interface CommuteInfo {
  record: CommuteRecord | null;
  transport: string[];
  publicTransport: string[];
  canSubmit: boolean;
}
export interface CommuteInput {
  address: string;
  transport: string;
  startStation?: string;
  endStation?: string;
  transport2?: string;
  startStation2?: string;
  endStation2?: string;
  note?: string;
}

/** 溫室氣體盤查通勤調查:目前資料與選項 / 送出(與舊入口網共用資料) */
export const commute = () => http.get<CommuteInfo>('/api/portal/commute');
export const submitCommute = (body: CommuteInput) => http.put<CommuteRecord>('/api/portal/commute', body);

export type NotePriority = 'high' | 'medium' | 'low';
export interface Note {
  id: number;
  title: string;
  content: string | null;
  category: string;
  priority: NotePriority;
  dueDate: string | null;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface NoteInput {
  title: string;
  content?: string | null;
  category: string;
  priority: NotePriority;
  dueDate?: string | null;
}

/** 個人提醒(本人;portal.personal_note) */
export const listNotes = () => http.get<{ items: Note[] }>('/api/portal/notes');
export const createNote = (body: NoteInput) => http.post<Note>('/api/portal/notes', body);
export const updateNote = (id: number, body: Partial<NoteInput> & { done?: boolean }) => http.patch<Note>(`/api/portal/notes/${id}`, body);
export const deleteNote = (id: number) => http.delete<void>(`/api/portal/notes/${id}`);

export interface AssetNote {
  compDb: string | null;
  assetNo: string;
  assetSub: string | null;
  note: string | null;
  hasPhoto: boolean;
}
/** 個人資產備註(舊入口網填寫的 PortalSolar PersonalPropertyInfo;資產清單在 TIPTOP 轉移中) */
export const assetNotes = () => http.get<{ items: AssetNote[] }>('/api/portal/assets/notes');
