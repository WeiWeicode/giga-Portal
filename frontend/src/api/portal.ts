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

export interface BpmPending {
  total: number;
  abnormal: number;
  hasAccount: boolean;
  truncated: boolean;
  items: {
    workItemName: string | null;
    subject: string | null;
    processName: string | null;
    serialNumber: string | null;
    processState: string;
    abnormal: boolean;
    createdAt: string | null;
    performUrl: string | null;
    traceUrl: string | null;
  }[];
}
export interface BpmRequested {
  total: number;
  page: number;
  pageSize: number;
  hasAccount: boolean;
  items: {
    serialNumber: string | null;
    processName: string | null;
    subject: string | null;
    processState: string;
    currentActivities: string[];
    createdAt: string | null;
    traceUrl: string | null;
  }[];
}

/** BPM 待簽核 / 我申請的未結案(NaNa 唯讀;連結開啟 BPM 原畫面) */
export const bpmPending = () => http.get<BpmPending>('/api/portal/bpm/pending');
export const bpmRequested = (page = 1, pageSize = 20) => http.get<BpmRequested>(`/api/portal/bpm/requested?page=${page}&pageSize=${pageSize}`);

export interface DirectoryEntry {
  empNo: string;
  name: string | null;
  englishName: string | null;
  dept: string | null;
  deptName: string | null;
  title: string | null;
  phone: string | null;
}
/** 分機表(PortalSolar NotesPhone,與舊入口網共用) */
export const searchDirectory = (q: string) => http.get<{ items: DirectoryEntry[]; truncated: boolean }>(`/api/portal/directory?q=${encodeURIComponent(q)}`);
export const updateMyPhone = (phone: string) => http.put<{ phone: string }>('/api/portal/directory/me/phone', { phone });

export interface Job {
  no: number;
  title: string | null;
  content: string | null;
  postedAt: string | null;
  closeAt: string | null;
  open: boolean;
}
export interface JobInput {
  title: string;
  content: string;
  /** YYYY-MM-DD */
  closeAt: string;
}
/** 內部職缺(PortalSolar EnlistTB);維護限 portal.job.edit */
export const listJobs = (all = false) => http.get<{ items: Job[] }>(`/api/portal/jobs${all ? '?all=true' : ''}`);
export const createJob = (body: JobInput) => http.post<{ no: number }>('/api/portal/jobs', body);
export const updateJob = (no: number, body: JobInput) => http.put<void>(`/api/portal/jobs/${no}`, body);
export const deleteJob = (no: number) => http.delete<void>(`/api/portal/jobs/${no}`);

export interface OnboardingStatus {
  /** 最近一次閱讀小叮嚀(YYYY-MM-DD) */
  readAt: string | null;
  /** 最近一次通過驗收測驗(YYYY-MM-DD) */
  passedAt: string | null;
}
export interface OnboardingQuiz {
  questions: { no: number; text: string }[];
  passScore: number;
}
export interface OnboardingQuizResult {
  correct: number;
  total: number;
  score: number;
  passed: boolean;
  passedAt: string | null;
}
/** 新人導覽(PortalSolar NewPepR / HRNewPtest,與舊入口網共用);標準答案只在後端,由後端計分 */
export const onboardingStatus = () => http.get<OnboardingStatus>('/api/portal/onboarding/status');
export const markOnboardingRead = () => http.post<OnboardingStatus>('/api/portal/onboarding/read', {});
export const onboardingQuiz = () => http.get<OnboardingQuiz>('/api/portal/onboarding/quiz');
export const submitOnboardingQuiz = (answers: boolean[], comment: string) =>
  http.post<OnboardingQuizResult>('/api/portal/onboarding/quiz', { answers, comment });
