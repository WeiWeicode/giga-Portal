/**
 * 3691 全民開講(old_PortalSolar Talktalk3691.aspx(.cs);FEATURE-PLAN §5.1、PORTAL-API-PLAN D-23;docs/Gherkin/group/talk.feature)。
 * 資料:PortalSolar.dbo.Talk3691Data / Talk3691Like(與舊入口網共用,D-7)、portal.talk_author(作者密文)、portal.talk_audit(稽核)。
 *   - 瀏覽:依分類列出主題與回覆(前端組成樹狀);被屏蔽的對一般人只顯示「該發言已屏蔽」、回覆不展開(同舊版)
 *   - 發文 / 回覆:純文字(輸出一律編碼);回覆的分類沿用上層;畫面與 API 都不回傳作者
 *   - 按讚:每人每則一次;屏蔽的不能按讚 / 回覆
 *   - 屏蔽:portal.api.talk.moderate(取代寫死 5 個工號),寫稽核;管理檢視看得到被屏蔽的原文
 *   - 解碼作者:portal.api.talk.reveal + 核准文號,寫稽核(成功或失敗都記);金鑰未設定時發文與解碼回 503
 */
import { AppError } from '../../errors.js';
import type { AuthorCipher } from './author-cipher.js';

export const TALK_TYPES = ['不吐不快', '開講公告', '老王賣瓜', '馬路消息', '資訊分享', '舉手發問'] as const;
export type TalkType = (typeof TALK_TYPES)[number];

export const BLOCKED_TEXT = '該發言已屏蔽';
/** 舊表 Talk3691Like.UserID nvarchar(10) */
export const LIKE_EMP_MAX = 10;
export const TITLE_MAX = 100;
export const CONTENT_MAX = 4000;

/**
 * 並行期舊站以 Label / TreeView 原樣輸出標題與內容(不做 HTML 編碼),新站寫入時把 < > 改成全形,
 * 避免新站發文在舊站被當成 HTML 執行(同 P2-2b 問卷問答題作法;新站畫面一律文字輸出)
 */
export const neutralizeHtml = (s: string) => s.replace(/</g, '＜').replace(/>/g, '＞');

export interface TalkRow {
  sn: number;
  parentSn: number | null;
  /** 舊資料有 215 則分類空白 */
  type: string;
  title: string;
  content: string;
  /** 伺服器當地時間 yyyy-MM-dd HH:mm:ss(舊表 datetime) */
  createdAt: string | null;
  blocked: boolean;
  likes: number;
}

export interface TalkPost extends TalkRow {
  likedByMe: boolean;
}

export interface NewPost {
  parentSn: number | null;
  type: string;
  title: string;
  content: string;
}

export type RevealResult = 'ok' | 'legacy' | 'none' | 'error';

export interface TalkRepo {
  /** type = null 列出全部;依建立時間新到舊 */
  list(type: string | null): Promise<TalkRow[]>;
  get(sn: number): Promise<TalkRow | null>;
  likedBy(empNo: string): Promise<Set<number>>;
  /** 同一交易:寫 Talk3691Data(mark 留 NULL)→ 以新 SN 加密作者 → 寫 portal.talk_author;回傳新 SN */
  create(post: NewPost, sealAuthor: (sn: number) => { cipher: string; keyId: string }): Promise<number>;
  /** 回傳是否新增(已按過回 false) */
  like(sn: number, empNo: string): Promise<boolean>;
  /** 同一交易:更新 IsBlack 並寫稽核 */
  setBlocked(sn: number, blocked: boolean, byEmp: string): Promise<void>;
  author(sn: number): Promise<{ cipher: string; keyId: string } | null>;
  /** 舊站發文是否有 mark(舊 DES 密文) */
  hasLegacyMark(sn: number): Promise<boolean>;
  auditReveal(sn: number, byEmp: string, approvalNo: string, reason: string | null, result: RevealResult): Promise<void>;
}

const notFound = () => new AppError(404, 'PORTAL_TALK_NOT_FOUND', '找不到此發言');
const blockedErr = () => new AppError(409, 'PORTAL_TALK_BLOCKED', '該發言已屏蔽,不能回覆或按讚');
/** 回覆 / 按讚前往上檢查:自己或任一上層被屏蔽都不行(被屏蔽主題下的回覆在一般檢視已隱藏;資安審查 L-3) */
const ANCESTOR_LIMIT = 50;

const keyMissing = () => new AppError(503, 'PORTAL_TALK_KEY_UNAVAILABLE', '作者加密金鑰未設定,暫時不能發文或解碼');

/** 一般人看到的版本:屏蔽的遮蔽內容,其下回覆不列出(同舊版不展開) */
export function maskForViewer(rows: readonly TalkRow[]): TalkRow[] {
  const byParent = new Map<number, TalkRow[]>();
  for (const r of rows) if (r.parentSn !== null) byParent.set(r.parentSn, [...(byParent.get(r.parentSn) ?? []), r]);
  const hidden = new Set<number>();
  const hide = (sn: number) => {
    for (const c of byParent.get(sn) ?? []) {
      if (hidden.has(c.sn)) continue;
      hidden.add(c.sn);
      hide(c.sn);
    }
  };
  for (const r of rows) if (r.blocked) hide(r.sn);
  return rows.filter((r) => !hidden.has(r.sn)).map((r) => (r.blocked ? { ...r, title: BLOCKED_TEXT, content: BLOCKED_TEXT } : r));
}

export class TalkService {
  constructor(
    private readonly repo: TalkRepo,
    private readonly cipher: AuthorCipher | null,
  ) {}

  get canPost(): boolean {
    return this.cipher !== null;
  }

  private async withLikes(empNo: string, rows: TalkRow[]): Promise<TalkPost[]> {
    const liked = await this.repo.likedBy(empNo);
    return rows.map((r) => ({ ...r, likedByMe: liked.has(r.sn) }));
  }

  /** 一般檢視 */
  async list(empNo: string, type: string | null): Promise<TalkPost[]> {
    return this.withLikes(empNo, maskForViewer(await this.repo.list(type)));
  }

  /** 管理檢視(portal.api.talk.moderate):含被屏蔽的原文與其回覆 */
  async listForModerator(empNo: string, type: string | null): Promise<TalkPost[]> {
    return this.withLikes(empNo, await this.repo.list(type));
  }

  async post(empNo: string, input: { parentSn?: number | null; type?: string; title?: string; content: string }): Promise<{ sn: number }> {
    if (!this.cipher) throw keyMissing();
    const cipher = this.cipher;
    const title = neutralizeHtml((input.title ?? '').trim());
    const content = neutralizeHtml(input.content.trim());
    if (!content) throw new AppError(400, 'VALIDATION_FAILED', '內容不可空白');
    let type: string;
    let parentSn: number | null = null;
    if (input.parentSn) {
      const parent = await this.repo.get(input.parentSn);
      if (!parent) throw notFound();
      await this.assertNotBlocked(parent);
      // 回覆的分類沿用上層且不可改(同舊版 EditTypeList.Enabled = false)
      type = parent.type;
      parentSn = parent.sn;
    } else {
      if (!input.type || !(TALK_TYPES as readonly string[]).includes(input.type)) throw new AppError(400, 'VALIDATION_FAILED', '請選擇分類');
      if (!title) throw new AppError(400, 'VALIDATION_FAILED', '新主題需要標題');
      type = input.type;
    }
    const sn = await this.repo.create({ parentSn, type, title, content }, (newSn) => cipher.encrypt(newSn, empNo));
    return { sn };
  }

  async like(empNo: string, sn: number): Promise<{ likes: number }> {
    if (empNo.length > LIKE_EMP_MAX) throw new AppError(400, 'VALIDATION_FAILED', '工號長度超過舊表欄位');
    const row = await this.repo.get(sn);
    if (!row) throw notFound();
    await this.assertNotBlocked(row);
    await this.repo.like(sn, empNo);
    return { likes: (await this.repo.get(sn))?.likes ?? row.likes };
  }

  private async assertNotBlocked(row: TalkRow): Promise<void> {
    let cur: TalkRow | null = row;
    for (let i = 0; cur && i < ANCESTOR_LIMIT; i++) {
      if (cur.blocked) throw blockedErr();
      cur = cur.parentSn !== null && cur.parentSn !== cur.sn ? await this.repo.get(cur.parentSn) : null;
    }
  }

  async setBlocked(byEmp: string, sn: number, blocked: boolean): Promise<void> {
    if (!(await this.repo.get(sn))) throw notFound();
    await this.repo.setBlocked(sn, blocked, byEmp);
  }

  /**
   * 解碼作者(D-23):先確認文章存在,再依資料來源解碼;每次嘗試都寫稽核(含失敗)。
   * 舊站發文(只有舊 DES mark)新站不解碼,回 409 PORTAL_TALK_AUTHOR_LEGACY。
   */
  async reveal(byEmp: string, sn: number, approvalNo: string, reason: string | null): Promise<{ sn: number; empNo: string }> {
    if (!this.cipher) throw keyMissing();
    const no = approvalNo.trim();
    if (!no) throw new AppError(400, 'VALIDATION_FAILED', '請填寫核准文號');
    const why = reason?.trim() || null;
    if (!(await this.repo.get(sn))) {
      // 不存在的 SN 也留紀錄(避免無痕探測)
      await this.repo.auditReveal(sn, byEmp, no, why, 'none');
      throw notFound();
    }
    const sealed = await this.repo.author(sn);
    if (!sealed) {
      const legacy = await this.repo.hasLegacyMark(sn);
      await this.repo.auditReveal(sn, byEmp, no, why, legacy ? 'legacy' : 'none');
      throw legacy
        ? new AppError(409, 'PORTAL_TALK_AUTHOR_LEGACY', '此發言來自舊入口網,作者以舊方式加密,新入口網不解碼')
        : new AppError(404, 'PORTAL_TALK_AUTHOR_NOT_FOUND', '此發言沒有作者資料');
    }
    // 解碼(純運算)後先寫稽核才回應:成功或失敗都留有紀錄
    let empNo: string | null = null;
    try {
      empNo = this.cipher.decrypt(sn, sealed.cipher, sealed.keyId);
    } catch {
      empNo = null;
    }
    await this.repo.auditReveal(sn, byEmp, no, why, empNo === null ? 'error' : 'ok');
    if (empNo === null) throw new AppError(500, 'PORTAL_TALK_AUTHOR_DECRYPT_FAILED', '作者資料無法解碼(金鑰不符或資料毀損)');
    return { sn, empNo };
  }
}
