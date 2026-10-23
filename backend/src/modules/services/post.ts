/**
 * 中華郵政寄件登記(P7 臨時服務;FEATURE-PLAN §9;docs/Gherkin/services/post.feature)。
 * 舊程式 ChunghwaPost.aspx(.cs):MisDb SendMailLog(郵資 MailMoney / 掛號號碼 CallMailNo 由總務在其他系統填寫)。
 *   - 清單:寄件人(SenderID)= 本人、IsActive = 1、寄件日期在區間內(同舊版)
 *   - 寄件人以工號精確選擇在職員工(LOS EmployeeInfo,LeaveDate 空白);舊版以 LIKE 模糊比對取第一筆
 *   - 修改 / 作廢只能動寄件人 = 本人的登記;修改不可變更寄件人(資安審查 M4:避免改掛到他人後兩邊都看不到);
 *     有郵資後不可改 / 作廢(交易內檢查;舊版修改只在開啟編輯時檢查)
 *   - 新增可代他人登記(同舊版,總務以寄件人追蹤費用;是否限制為本人列 CONFIRM-NEEDED P7)
 *   - 欄位驗證完才寫入;文字只當純文字(拒收 < > 與控制字元)
 */
import { AppError, dataAccessDenied } from '../../errors.js';
import type { Employee } from '../../identity.js';
import { invalid, plainText } from './common.js';

/** 寄件類別(同舊頁下拉選單) */
export const MAIL_TYPES = ['限掛', '掛號', '雙掛號', '快捷', 'EMS', '便利1號袋', '便利2號袋', '便利3號袋', '平信'] as const;

export interface PostItem {
  sn: number;
  senderId: string;
  senderName: string | null;
  sendDate: string | null;
  dept: string | null;
  receiver: string | null;
  zip: string | null;
  mailType: string | null;
  callMailNo: string | null;
  mailMoney: string | null;
  mailReturnMoney: string | null;
  /** 已有郵資,不可修改 / 作廢 */
  locked: boolean;
}

export interface PostInput {
  senderId: string;
  dept: string;
  receiver: string;
  zip: string;
  sendDate: string;
  mailType: string;
}

export interface Sender {
  empNo: string;
  name: string;
  dept: string | null;
}

export type PostWriteResult = 'ok' | 'not-found' | 'forbidden' | 'locked';

export interface PostRepo {
  list(empNo: string, from: string, to: string): Promise<PostItem[]>;
  /** 在職員工:工號精確比對 */
  activeEmployee(empNo: string): Promise<Sender | null>;
  /** 在職員工搜尋(工號開頭或姓名包含),最多 limit 筆 */
  searchEmployees(q: string, limit: number): Promise<Sender[]>;
  create(input: PostInput & { senderName: string }): Promise<number>;
  /** 交易內鎖定該筆:寄件人須為 owner、MailMoney 空白 */
  update(sn: number, owner: string, input: PostInput & { senderName: string }): Promise<PostWriteResult>;
  void(sn: number, owner: string): Promise<PostWriteResult>;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s: string) => DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);
/** 查詢區間上限(天) */
export const POST_MAX_RANGE_DAYS = 400;

export class PostService {
  constructor(private readonly repo: PostRepo) {}

  async list(me: Employee, from: string, to: string): Promise<PostItem[]> {
    if (!validDate(from) || !validDate(to) || from > to) throw invalid('from', '查詢日期區間錯誤');
    if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > POST_MAX_RANGE_DAYS) throw invalid('from', `查詢區間最多 ${POST_MAX_RANGE_DAYS} 天`);
    return this.repo.list(me.empNo.toUpperCase(), from, to);
  }

  async senders(q: string): Promise<Sender[]> {
    const v = q.trim();
    if (!v) return [];
    return this.repo.searchEmployees(v, 20);
  }

  private async normalize(input: PostInput): Promise<PostInput & { senderName: string }> {
    const senderId = input.senderId.trim().toUpperCase();
    const sender = /^[A-Z0-9]{1,20}$/.test(senderId) ? await this.repo.activeEmployee(senderId) : null;
    if (!sender) throw invalid('senderId', '填寫之寄件人未在職,會無法追蹤費用');
    const dept = input.dept.trim().toUpperCase();
    if (!/^[A-Z0-9]{1,20}$/.test(dept)) throw invalid('dept', '費用部門請填部門代碼');
    const receiver = plainText('receiver', '收件人', input.receiver, 100);
    const zip = input.zip.trim();
    if (!/^[0-9A-Za-z-]{3,20}$/.test(zip)) throw invalid('zip', '郵遞區號格式錯誤');
    if (!validDate(input.sendDate)) throw invalid('sendDate', '寄件日期格式錯誤');
    if (!(MAIL_TYPES as readonly string[]).includes(input.mailType)) throw invalid('mailType', '寄件類別未選取');
    return { senderId, senderName: sender.name, dept, receiver, zip, sendDate: input.sendDate, mailType: input.mailType };
  }

  async create(input: PostInput): Promise<{ sn: number }> {
    return { sn: await this.repo.create(await this.normalize(input)) };
  }

  async update(me: Employee, sn: number, input: PostInput): Promise<void> {
    const owner = me.empNo.toUpperCase();
    if (input.senderId.trim().toUpperCase() !== owner) throw invalid('senderId', '修改時不可變更寄件人');
    check(await this.repo.update(sn, owner, await this.normalize(input)), '修改');
  }

  async void(me: Employee, sn: number): Promise<void> {
    check(await this.repo.void(sn, me.empNo.toUpperCase()), '作廢');
  }
}

function check(r: PostWriteResult, action: string): void {
  if (r === 'not-found') throw new AppError(404, 'PORTAL_POST_NOT_FOUND', '找不到此寄件登記');
  if (r === 'forbidden') throw dataAccessDenied('只能修改或作廢自己的寄件登記');
  if (r === 'locked') throw new AppError(409, 'PORTAL_POST_LOCKED', `已有郵資資訊,不能${action}`);
}
