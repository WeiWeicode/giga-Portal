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

// ───────────── 問卷調查(/api/portal/qa/*;FEATURE-PLAN §3.4、docs/Gherkin/resources/qa.feature)─────────────

export type QaQuestionType = 'single' | 'multi' | 'text';
export interface QaImage {
  /** giga-file-service 檔案 UUID */
  fileId: string;
  position: 'before' | 'after';
  width: number;
  height: number;
}
export interface QaQuestion {
  no: number;
  /** null = 舊資料題型空白(只顯示文字,不作答) */
  type: QaQuestionType | null;
  text: string;
  options: string[];
  /** 複選上限;null = 不限 */
  limit: number | null;
  required: boolean;
  image: QaImage | null;
  /** 舊站上傳的圖片(新入口網不顯示) */
  legacyImage: boolean;
}
export interface QaPendingItem {
  qaNo: string;
  title: string;
  dept: string | null;
  startDate: string | null;
  endDate: string | null;
  questionCount: number;
}
export interface QaSurveyView {
  qaNo: string;
  title: string;
  dept: string | null;
  /** 後端已白名單清洗的 HTML;顯示前再以 web-kit sanitizeHtml 清洗 */
  intro: string;
  outro: string;
  startDate: string | null;
  endDate: string | null;
  questions: QaQuestion[];
}
export interface QaAnswer {
  no: number;
  choices?: string[];
  text?: string;
}
export interface QaTargets {
  all: boolean;
  depts: string[];
  emps: string[];
}
export interface QaSurveyDetail extends QaSurveyView {
  creator: string | null;
  active: boolean;
  targets: QaTargets;
  respondents: number;
  locked: boolean;
}
export interface QaListItem {
  qaNo: string;
  title: string;
  dept: string | null;
  startDate: string | null;
  endDate: string | null;
  creator: string | null;
  active: boolean;
  questionCount: number;
  respondents: number;
  locked: boolean;
}
export interface QaQuestionInput {
  type: QaQuestionType;
  text: string;
  options?: string[];
  limit?: number | null;
  required: boolean;
  image?: QaImage | null;
}
export interface QaSurveyInput {
  title: string;
  dept: string;
  intro: string;
  outro: string;
  startDate: string;
  endDate: string;
  targets: QaTargets;
  questions: QaQuestionInput[];
}
export interface QaStats {
  qaNo: string;
  title: string;
  respondents: number;
  /** 含 hr:依人事屬性分組系統轉移中(D-18) */
  unavailable: string[];
  questions: { no: number; text: string; type: QaQuestionType | null; answered: number; items: { answer: string; count: number; percent: number }[] }[];
}
export interface QaDept {
  code: string;
  name: string | null;
  parent: string | null;
}

const qaBase = (admin: boolean) => (admin ? '/api/portal/qa/admin/surveys' : '/api/portal/qa/surveys');
const enc = encodeURIComponent;

/** 填答者 */
export const qaPending = () => http.get<{ items: QaPendingItem[] }>('/api/portal/qa/pending');
export const qaForFill = (qaNo: string) => http.get<QaSurveyView>(`/api/portal/qa/pending/${enc(qaNo)}`);
export const qaSubmit = (qaNo: string, answers: QaAnswer[]) => http.post<{ answeredAt: string }>(`/api/portal/qa/pending/${enc(qaNo)}/answers`, { answers });

/** 出題者(admin = portal.qa.admin 代管全部) */
export function qaList(admin: boolean, opts: { q?: string; current?: boolean; creator?: string; page?: number; pageSize?: number }) {
  const p = new URLSearchParams();
  if (opts.q) p.set('q', opts.q);
  if (opts.current) p.set('current', 'true');
  if (admin && opts.creator) p.set('creator', opts.creator);
  p.set('page', String(opts.page ?? 1));
  p.set('pageSize', String(opts.pageSize ?? 20));
  return http.get<{ items: QaListItem[]; total: number; page: number; pageSize: number }>(`${qaBase(admin)}?${p}`);
}
export const qaDetail = (admin: boolean, qaNo: string) => http.get<QaSurveyDetail>(`${qaBase(admin)}/${enc(qaNo)}`);
export const qaCreate = (body: QaSurveyInput) => http.post<{ qaNo: string }>('/api/portal/qa/surveys', body);
export const qaUpdate = (admin: boolean, qaNo: string, body: QaSurveyInput) => http.put<void>(`${qaBase(admin)}/${enc(qaNo)}`, body);
export const qaDelete = (admin: boolean, qaNo: string) => http.delete<void>(`${qaBase(admin)}/${enc(qaNo)}`);
export const qaCopy = (admin: boolean, qaNo: string) => http.post<{ qaNo: string }>(`${qaBase(admin)}/${enc(qaNo)}/copy`, {});
export const qaStats = (admin: boolean, qaNo: string) => http.get<QaStats>(`${qaBase(admin)}/${enc(qaNo)}/stats`);
/** 匯出 Excel:瀏覽器直接下載(GET,Cookie 驗證) */
export const qaExportUrl = (admin: boolean, qaNo: string) => `${qaBase(admin)}/${enc(qaNo)}/export`;
export const qaDepartments = () => http.get<{ items: QaDept[] }>('/api/portal/qa/org/departments');
export const qaJobTier = (tier: 'section' | 'manager') => http.get<{ emps: string[] }>(`/api/portal/qa/org/job-tier?tier=${tier}`);

/**
 * 題目圖片上傳到 giga-file-service(POST /api/file/files,需 file.object.upload;D-28)。
 * 上傳後為暫存檔,問卷存檔後要呼叫 qaBindImages 綁定,否則 24 小時後被附件服務清除(file-service API.md §2)。
 */
export async function uploadQaImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('sourceApp', 'portal-qa');
  fd.append('file', file);
  const r = await http.post<{ items?: { fileUuid: string }[] }>('/api/file/files', fd);
  const id = r.items?.[0]?.fileUuid;
  if (!id) throw new Error('附件服務沒有回傳檔案編號');
  return id;
}
/** 把本次上傳的題目圖片綁定到問卷(refType portal-qa、refNo = 問卷編號;只能綁自己上傳的) */
export const qaBindImages = (qaNo: string, uuids: string[]) =>
  http.post<{ bound: number }>('/api/file/files/bind', { uuids, refType: 'portal-qa', refNo: qaNo });
/** 題目圖片網址(file-service 預覽) */
export const qaImageUrl = (fileId: string) => `/api/file/files/${enc(fileId)}/content?inline=1`;
