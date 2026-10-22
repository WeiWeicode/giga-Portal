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

/** BPM 申請人與送出時間(P4) */
export interface BpmRequester {
  requesterId: string | null;
  requesterName: string | null;
  submittedAt: string | null;
}
export interface BpmPending {
  /** D-29:本人公司是否適用 BPM(碩禾系);false 時清單一律為空 */
  applicable: boolean;
  total: number;
  abnormal: number;
  hasAccount: boolean;
  truncated: boolean;
  items: ({
    workItemName: string | null;
    subject: string | null;
    processName: string | null;
    serialNumber: string | null;
    processState: string;
    abnormal: boolean;
    createdAt: string | null;
    performUrl: string | null;
    traceUrl: string | null;
  } & BpmRequester)[];
}
export type BpmRequestedState = 'open' | 'all';
export interface BpmRequested {
  applicable: boolean;
  state: BpmRequestedState;
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

export interface BpmHandled {
  applicable: boolean;
  total: number;
  page: number;
  pageSize: number;
  hasAccount: boolean;
  items: ({
    workItemName: string | null;
    completedAt: string | null;
    serialNumber: string | null;
    processName: string | null;
    subject: string | null;
    processState: string;
    currentActivities: string[];
    traceUrl: string | null;
  } & BpmRequester)[];
}

/** BPM 待簽核 / 我送出的 / 已簽核(NaNa 唯讀;簽核以深連結開啟 BPM 原畫面,D-24) */
export const bpmPending = () => http.get<BpmPending>('/api/portal/bpm/pending');
export const bpmRequested = (page = 1, pageSize = 20, state: BpmRequestedState = 'open') =>
  http.get<BpmRequested>(`/api/portal/bpm/requested?page=${page}&pageSize=${pageSize}&state=${state}`);
export const bpmHandled = (page = 1, pageSize = 20) => http.get<BpmHandled>(`/api/portal/bpm/handled?page=${page}&pageSize=${pageSize}`);

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

// ───────────── P3 首頁聚合與集團公告(FEATURE-PLAN §1、§5;docs/Gherkin/home/home.feature、group/*.feature)─────────────

/** 上傳到 giga-file-service(POST /api/file/files,需 file.object.upload);回傳檔案 UUID(暫存,需再綁定) */
export async function uploadFile(sourceApp: string, file: File): Promise<string> {
  const fd = new FormData();
  fd.append('sourceApp', sourceApp);
  fd.append('file', file);
  const r = await http.post<{ items?: { fileUuid: string }[] }>('/api/file/files', fd);
  const id = r.items?.[0]?.fileUuid;
  if (!id) throw new Error('附件服務沒有回傳檔案編號');
  return id;
}
/** 綁定暫存檔到單據(file-service API.md §2;未綁定 24 小時後被清除) */
export const bindFiles = (refType: string, refNo: string, uuids: string[]) => http.post<{ bound: number }>('/api/file/files/bind', { uuids, refType, refNo });
/** file-service 預覽 / 下載網址(Gateway 送 X-Frame-Options DENY,PDF 以新分頁開啟) */
export const fileUrl = (fileId: string) => `/api/file/files/${enc(fileId)}/content?inline=1`;
/** file-service 下載(附件形式,Content-Disposition 帶原檔名;P4 表單下載) */
export const fileDownloadUrl = (fileId: string) => `/api/file/files/${enc(fileId)}/content`;

export type TodoKind = 'bpm-pending' | 'bpm-unclosed' | 'qa' | 'onboarding-read' | 'onboarding-quiz' | 'note';
export interface TodoItem {
  kind: TodoKind;
  title: string;
  count: number | null;
  date: string | null;
  /** 站內路徑 */
  to: string | null;
  /** 外部連結(BPM) */
  href: string | null;
}
export interface PersonalLink {
  id: number;
  name: string;
  url: string;
  sort: number;
}
export interface LegacyNews {
  id: string;
  title: string;
  type: string;
  date: string | null;
  /** 舊入口網公告頁;未設定舊站網址時為 null */
  url: string | null;
}
export type SlideKind = 'policy' | 'gallery';
export interface Slide {
  id: number;
  kind: SlideKind;
  title: string;
  fileId: string;
  linkUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  sort: number;
  active: boolean;
}
export type SlideInput = Omit<Slide, 'id'>;
export interface Dashboard {
  todos: { items: TodoItem[] };
  secretary: {
    bpm: { pending: number; abnormal: number; unclosed: number; hasAccount: boolean; homeUrl: string } | null;
    links: PersonalLink[] | null;
  };
  news: { total: number; items: LegacyNews[] } | null;
  slides: { policy: Slide[]; gallery: Slide[] } | null;
  /** errors:失敗的區塊(bpm、todos.qa、todos.onboarding、todos.notes、secretary.links、news、slides);unavailable:未設定 / 未實作 */
  _meta: { errors: { section: string; message: string }[]; unavailable: string[] };
}

/** 首頁聚合(FR-4.8:首屏只呼叫 /api/auth/me 與本支) */
export const dashboard = () => http.get<Dashboard>('/api/portal/dashboard');

/** 舊入口網公告(D-21 唯讀併入,標來源「舊入口網」) */
export function legacyNews(opts: { q?: string; page?: number; pageSize?: number } = {}) {
  const p = new URLSearchParams();
  if (opts.q) p.set('q', opts.q);
  p.set('page', String(opts.page ?? 1));
  p.set('pageSize', String(opts.pageSize ?? 20));
  return http.get<{ items: LegacyNews[]; total: number; page: number; pageSize: number }>(`/api/portal/news/legacy?${p}`);
}

/** 首頁輪播維護(portal.home.edit) */
export const listSlides = () => http.get<{ items: Slide[] }>('/api/portal/home/slides');
export const createSlide = (body: SlideInput) => http.post<Slide>('/api/portal/home/slides', body);
export const updateSlide = (id: number, body: SlideInput) => http.put<Slide>(`/api/portal/home/slides/${id}`, body);
export const deleteSlide = (id: number) => http.delete<void>(`/api/portal/home/slides/${id}`);

/** 個人常用連結(本人) */
export const listPersonalLinks = () => http.get<{ items: PersonalLink[] }>('/api/portal/personal-links');
export const createPersonalLink = (body: { name: string; url: string }) => http.post<PersonalLink>('/api/portal/personal-links', body);
export const updatePersonalLink = (id: number, body: { name: string; url: string }) => http.put<PersonalLink>(`/api/portal/personal-links/${id}`, body);
export const deletePersonalLink = (id: number) => http.delete<void>(`/api/portal/personal-links/${id}`);
export const reorderPersonalLinks = (ids: number[]) => http.put<{ items: PersonalLink[] }>('/api/portal/personal-links/order', { ids });

export interface CalendarPdf {
  year: number;
  fileId: string;
  fileName: string;
  updatedAt: string;
}
/** 年度行事曆 PDF(編輯者上傳 file-service 後登記;portal.calendar.edit) */
export const listCalendars = () => http.get<{ items: CalendarPdf[] }>('/api/portal/calendar');
export const saveCalendar = (year: number, fileId: string, fileName: string) => http.put<CalendarPdf>(`/api/portal/calendar/${year}`, { fileId, fileName });
export const deleteCalendar = (year: number) => http.delete<void>(`/api/portal/calendar/${year}`);

export interface SystemLink {
  id: number;
  name: string;
  description: string | null;
  category: string;
  /** legacyDes 時一律 null(D-22) */
  url: string | null;
  openMode: 'new' | 'same';
  legacyDes: boolean;
  sort: number;
  active: boolean;
}
export type SystemLinkInput = Omit<SystemLink, 'id'>;
/** 集團系統(portal.links.edit 維護) */
export const listSystemLinks = (admin = false) => http.get<{ items: SystemLink[] }>(admin ? '/api/portal/links/admin' : '/api/portal/links');
export const createSystemLink = (body: SystemLinkInput) => http.post<SystemLink>('/api/portal/links', body);
export const updateSystemLink = (id: number, body: SystemLinkInput) => http.put<SystemLink>(`/api/portal/links/${id}`, body);
export const deleteSystemLink = (id: number) => http.delete<void>(`/api/portal/links/${id}`);

export interface TalkPost {
  sn: number;
  parentSn: number | null;
  type: string;
  title: string;
  content: string;
  /** 伺服器當地時間 yyyy-MM-dd HH:mm:ss */
  createdAt: string | null;
  blocked: boolean;
  likes: number;
  likedByMe: boolean;
}
export interface TalkList {
  items: TalkPost[];
  types: string[];
  /** false:作者加密金鑰未設定,不能發文 */
  canPost: boolean;
}
/** 3691 全民開講(作者不回傳;moderation = portal.talk.moderate 管理檢視) */
export const talkPosts = (type: string | null, moderation = false) =>
  http.get<TalkList>(`/api/portal/talk/${moderation ? 'moderation/' : ''}posts${type ? `?type=${enc(type)}` : ''}`);
export const talkPost = (body: { parentSn?: number | null; type?: string; title?: string; content: string }) =>
  http.post<{ sn: number }>('/api/portal/talk/posts', body);
export const talkLike = (sn: number) => http.post<{ likes: number }>(`/api/portal/talk/posts/${sn}/like`, {});
export const talkBlock = (sn: number, blocked: boolean) => http.put<void>(`/api/portal/talk/posts/${sn}/block`, { blocked });
export const talkReveal = (sn: number, approvalNo: string, reason: string) =>
  http.post<{ sn: number; empNo: string }>(`/api/portal/talk/posts/${sn}/reveal`, { approvalNo, reason });

// ───────────── P4 表單下載(FEATURE-PLAN §4、D-25;docs/Gherkin/approval/forms.feature)─────────────

export interface FormCategory {
  id: number;
  name: string;
  sort: number;
}
export interface FormDoc {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  fileId: string;
  fileName: string;
  sort: number;
  active: boolean;
  updatedAt: string;
}
export type FormDocInput = Omit<FormDoc, 'id' | 'updatedAt'>;
export interface FormCatalog {
  categories: FormCategory[];
  items: FormDoc[];
}
/** admin = true:維護清單(含停用,需 portal.forms.edit) */
export const listForms = (admin = false) => http.get<FormCatalog>(admin ? '/api/portal/forms/admin' : '/api/portal/forms');
export const createForm = (body: FormDocInput) => http.post<FormDoc>('/api/portal/forms', body);
export const updateForm = (id: number, body: FormDocInput) => http.put<FormDoc>(`/api/portal/forms/${id}`, body);
export const deleteForm = (id: number) => http.delete<void>(`/api/portal/forms/${id}`);
export const createFormCategory = (body: { name: string; sort: number }) => http.post<FormCategory>('/api/portal/forms/categories', body);
export const updateFormCategory = (id: number, body: { name: string; sort: number }) => http.put<FormCategory>(`/api/portal/forms/categories/${id}`, body);
export const deleteFormCategory = (id: number) => http.delete<void>(`/api/portal/forms/categories/${id}`);
