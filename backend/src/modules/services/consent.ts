/**
 * 同意書(P7 臨時服務;FEATURE-PLAN §9、D-8;docs/Gherkin/services/consent.feature)。
 * 一個頁面 /services/consent/:id 承接所有版本:
 *   - GUID 版(取代 GSMCConsentX / GSCConsentX):PortalSolar ConsentX(內文 Consent_main、期間 StartDate / EndDate 字串、
 *     對象 Kdept / Kpep)→ 簽署寫 ConsentXB(GUID、LgNo、ConfirmDate)
 *   - 編號版(取代 GSMCConsent20260814 等):portal.consent_def(期間、型式)+ ConsentCInfo(指派名單)→ 簽署寫 ConsentBInfo
 * 與舊版的刻意差異(CONFIRM-NEEDED P7):
 *   - 部門完整比對(舊版只比部門代碼第一碼,MainFormX.aspx.cs:538)、工號以逗號清單精確比對
 *   - 送出時後端檢查期間、對象與重簽(舊版只在開頁時檢查;交易內 UPDLOCK + HOLDLOCK)
 *   - 欄位驗證完才存檔;簽名圖存 file-service(portal.consent_sign),不寫網站 SignFile 目錄
 *   - 身分證只回末 4 碼(LOS EmployeeInfo.ID);舊版身分證、生日取 TIPTOP CPF_FILE(D-1 轉移中,改用 LOS)
 *   - Consent8(2021 薪資溝通信函)、GSCConsent1 / 2(已由 ConsentX GUID 版取代)、GSMCConsent20220701(已停用)不另做型式
 */
import { AppError, dataAccessDenied } from '../../errors.js';
import type { Employee } from '../../identity.js';
import { UUID_RE } from '../home/content.js';
import { sanitizeQaHtml } from '../qa/html.js';
import { csvList, depositoryAccount, escapeHtml, invalid, last4, legacyDate, periodState, plainText, serviceEnded, type PeriodState } from './common.js';

export const CONSENT_AGREE_TEXT = '我已閱讀完畢，充分了解並同意簽名。';
export const CONSENT_KINDS = ['account-survey'] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

export interface XConsentRow {
  guid: string;
  title: string;
  body: string | null;
  /** 原始字串(yyyy/MM/dd) */
  startDate: string | null;
  endDate: string | null;
  kdept: string | null;
  kpep: string | null;
}

export interface ConsentDefRow {
  consentId: number;
  kind: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  requireSign: boolean;
  active: boolean;
}

export interface ConsentEmployee {
  empNo: string;
  name: string | null;
  compFullName: string | null;
  nationalId: string | null;
  birthDate: string | null;
}

export type SignResult = { ok: true; signedAt: string } | { ok: false };

export interface ConsentRepo {
  xConsents(): Promise<XConsentRow[]>;
  xConsent(guid: string): Promise<XConsentRow | null>;
  /** 本人已簽的 GUID → 簽署日(YYYY-MM-DD) */
  xSigned(empNo: string): Promise<Map<string, string>>;
  defs(): Promise<ConsentDefRow[]>;
  /** 指派給本人的 ConsentID */
  assigned(empNo: string): Promise<number[]>;
  /** 本人已簽的 ConsentID → 簽署日 */
  bSigned(empNo: string): Promise<Map<number, string>>;
  employee(empNo: string): Promise<ConsentEmployee | null>;
  /** 交易內鎖定檢查未簽才寫入;已簽回 ok:false */
  signX(guid: string, empNo: string, signFileId: string | null): Promise<SignResult>;
  signB(consentId: number, empNo: string, itemData: string | null, signFileId: string | null): Promise<SignResult>;
}

export interface ConsentSummary {
  id: string;
  title: string;
  endDate: string | null;
}

export interface ConsentDetail {
  id: string;
  source: 'x' | 'b';
  kind: 'consent' | ConsentKind;
  title: string;
  /** 已清洗並代入本人資料的內文(GUID 版);編號版為 null(畫面依 kind 顯示) */
  html: string | null;
  startDate: string | null;
  endDate: string | null;
  state: PeriodState | 'signed';
  signedAt: string | null;
  requireSign: boolean;
  agreeText: string;
  /** 集保帳號調查:本人資料(身分證只回末 4 碼) */
  profile: { empNo: string; name: string | null; nationalIdLast4: string | null; birthDate: string | null } | null;
}

export interface AccountSurveyFields {
  phone: string;
  homeAddress: string;
  mailAddress: string;
  account: string;
}

export interface SignInput {
  agree: boolean;
  signatureFileId?: string | null;
  fields?: AccountSurveyFields | null;
}

type Parsed = { source: 'x'; guid: string } | { source: 'b'; consentId: number };

const notFound = () => new AppError(404, 'PORTAL_CONSENT_NOT_FOUND', '找不到此同意書');
const signedAlready = () => new AppError(409, 'PORTAL_CONSENT_SIGNED', '您已簽署此同意書');

export function parseConsentId(raw: string): Parsed {
  if (UUID_RE.test(raw)) return { source: 'x', guid: raw.toLowerCase() };
  if (/^\d{1,9}$/.test(raw)) return { source: 'b', consentId: Number(raw) };
  throw notFound();
}

/** 對象:Kdept = all、部門代碼完整比對(逗號清單),或 Kpep 逗號清單含本人工號 */
export function xTargeted(row: Pick<XConsentRow, 'kdept' | 'kpep'>, empNo: string, dept: string | null): boolean {
  const depts = csvList(row.kdept);
  if (depts.includes('ALL')) return true;
  if (dept && depts.includes(dept.trim().toUpperCase())) return true;
  return csvList(row.kpep).includes(empNo.toUpperCase());
}

/** 內文代入(同舊版 Replace 順序 UserID → UserName → CompFullName);先白名單清洗再代入跳脫後的值 */
export function renderConsentBody(body: string | null, emp: ConsentEmployee | null, empNo: string): string {
  return sanitizeQaHtml(body)
    .replaceAll('UserID', escapeHtml(emp?.empNo ?? empNo))
    .replaceAll('UserName', escapeHtml(emp?.name ?? ''))
    .replaceAll('CompFullName', escapeHtml(emp?.compFullName ?? ''));
}

export class ConsentService {
  constructor(private readonly repo: ConsentRepo) {}

  /** 本人待簽(開放中、對象含本人、未簽);首頁待辦使用 */
  async pending(me: Employee, today: string): Promise<ConsentSummary[]> {
    const empNo = me.empNo.toUpperCase();
    const [xs, xSigned, defs, assigned, bSigned] = await Promise.all([
      this.repo.xConsents(),
      this.repo.xSigned(empNo),
      this.repo.defs(),
      this.repo.assigned(empNo),
      this.repo.bSigned(empNo),
    ]);
    const out: ConsentSummary[] = [];
    for (const x of xs) {
      const start = legacyDate(x.startDate);
      const end = legacyDate(x.endDate);
      if (xSigned.has(x.guid) || periodState(start, end, today) !== 'open' || !xTargeted(x, empNo, me.dept)) continue;
      out.push({ id: x.guid, title: x.title, endDate: end });
    }
    for (const d of defs) {
      if (!d.active || !isKind(d.kind) || bSigned.has(d.consentId) || !assigned.includes(d.consentId)) continue;
      if (periodState(d.startDate, d.endDate, today) !== 'open') continue;
      out.push({ id: String(d.consentId), title: d.title, endDate: d.endDate });
    }
    return out;
  }

  async detail(me: Employee, rawId: string, today: string): Promise<ConsentDetail> {
    const empNo = me.empNo.toUpperCase();
    const p = parseConsentId(rawId);
    if (p.source === 'x') {
      const x = await this.repo.xConsent(p.guid);
      if (!x) throw notFound();
      if (!xTargeted(x, empNo, me.dept)) throw dataAccessDenied('此同意書不適用於您');
      const [signed, emp] = await Promise.all([this.repo.xSigned(empNo), this.repo.employee(empNo)]);
      const start = legacyDate(x.startDate);
      const end = legacyDate(x.endDate);
      const signedAt = signed.get(x.guid) ?? null;
      return {
        id: x.guid,
        source: 'x',
        kind: 'consent',
        title: x.title,
        // 尚未開放時不回內文(資安審查 L6)
        html: periodState(start, end, today) === 'not-started' ? null : renderConsentBody(x.body, emp, empNo),
        startDate: start,
        endDate: end,
        state: signedAt ? 'signed' : periodState(start, end, today),
        signedAt,
        requireSign: true,
        agreeText: CONSENT_AGREE_TEXT,
        profile: null,
      };
    }
    const d = await this.def(p.consentId);
    if (!(await this.repo.assigned(empNo)).includes(d.consentId)) throw dataAccessDenied('此同意書不適用於您');
    const [signed, emp] = await Promise.all([this.repo.bSigned(empNo), this.repo.employee(empNo)]);
    const signedAt = signed.get(d.consentId) ?? null;
    return {
      id: String(d.consentId),
      source: 'b',
      kind: d.kind as ConsentKind,
      title: d.title,
      html: null,
      startDate: d.startDate,
      endDate: d.endDate,
      state: signedAt ? 'signed' : periodState(d.startDate, d.endDate, today),
      signedAt,
      requireSign: d.requireSign,
      agreeText: CONSENT_AGREE_TEXT,
      profile: { empNo, name: emp?.name ?? me.name, nationalIdLast4: last4(emp?.nationalId), birthDate: emp?.birthDate ?? null },
    };
  }

  /** 送出:期間 → 對象 → 勾選 / 簽名 / 欄位驗證 → 交易內擋重簽後寫入 */
  async sign(me: Employee, rawId: string, input: SignInput, today: string): Promise<{ signedAt: string; accountLast4: string | null }> {
    const detail = await this.detail(me, rawId, today);
    if (detail.state === 'signed') throw signedAlready();
    if (detail.state !== 'open') throw serviceEnded(detail.state === 'not-started' ? '同意書尚未開放' : '服務已結束');
    if (input.agree !== true) throw invalid('agree', '未勾選確認同意,為確保您的權利請詳細閱讀後勾選');
    const fileId = input.signatureFileId?.trim().toLowerCase() || null;
    if (detail.requireSign && !fileId) throw invalid('signatureFileId', '請完成線上簽名');
    if (fileId && !UUID_RE.test(fileId)) throw invalid('signatureFileId', '簽名檔編號格式錯誤');
    const empNo = me.empNo.toUpperCase();
    if (detail.source === 'x') {
      const r = await this.repo.signX(detail.id, empNo, fileId);
      if (!r.ok) throw signedAlready();
      return { signedAt: r.signedAt, accountLast4: null };
    }
    let itemData: string | null = null;
    let accountLast4: string | null = null;
    if (detail.kind === 'account-survey') {
      const f = input.fields;
      if (!f) throw invalid('fields', '請填寫聯絡資料與集保帳號');
      // ItemData 以 ; 分隔(同舊格式),欄位內不可有 ;
      const semi = /;/;
      const phone = plainText('fields.phone', '聯絡電話', f.phone, 40, { extra: semi });
      const home = plainText('fields.homeAddress', '戶籍地址', f.homeAddress, 200, { extra: semi });
      const mail = plainText('fields.mailAddress', '通訊地址', f.mailAddress, 200, { extra: semi });
      const account = depositoryAccount('fields.account', f.account);
      itemData = [phone, home, mail, account].join(';');
      accountLast4 = account.slice(-4);
    }
    const r = await this.repo.signB(Number(detail.id), empNo, itemData, fileId);
    if (!r.ok) throw signedAlready();
    return { signedAt: r.signedAt, accountLast4 };
  }

  private async def(id: number): Promise<ConsentDefRow> {
    const d = (await this.repo.defs()).find((x) => x.consentId === id);
    if (!d || !d.active || !isKind(d.kind)) throw notFound();
    return d;
  }
}

const isKind = (k: string): k is ConsentKind => (CONSENT_KINDS as readonly string[]).includes(k);
