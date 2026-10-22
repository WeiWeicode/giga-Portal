/**
 * 首頁用到的舊庫資料(唯讀,來源前綴 + 參數化):
 *   - 舊入口網公告 ContentX(D-21:並行期唯讀併入「最新公告」,標來源「舊入口網」;舊站下線後移除)
 *     條件同 old_PortalSolar MainFormX.aspx.cs:61(home.feature「最新消息清單」):PublicContentX / NotesPublic 兩種、
 *     StartDate <= 今天、EndDate >= 今天或空字串、類型 最新消息 / 環安公告 / 集團Notes公告、未下架、
 *     Notes 公告對象為空或含「碩禾全體」「禾迅全體」「芯和全體」(日期為 yyyy/MM/dd 字串,與舊程式同樣以字串比較)
 *   - 到職日:LOS EmployeeInfo.JobDate(人事主檔 TIPTOP 轉移中,D-1;LOS 為 220 上的同步表,以它代替,CONFIRM-NEEDED P3)
 */
import sql from 'mssql';
import type { Sources } from '../../db/sources.js';

export interface LegacyNews {
  /** ContentX.GUID */
  id: string;
  title: string;
  type: string;
  /** YYYY-MM-DD(由 StartDate 字串轉換,轉不出為 null) */
  date: string | null;
  /** 舊站連結;未設定 LEGACY_PORTAL_URL 或路徑不合格為 null */
  url: string | null;
}

export interface LegacyNewsRepo {
  list(opts: { today: string; q?: string; offset: number; limit: number }): Promise<{ total: number; items: LegacyNews[] }>;
}

export interface HireDateRepo {
  /** YYYY-MM-DD;查無為 null */
  hireDate(empNo: string): Promise<string | null>;
}

export const LEGACY_NEWS_TYPES = ['最新消息', '環安公告', '集團Notes公告'] as const;
/** 舊程式寫死的 Notes 公告對象(MainFormX.aspx.cs:61) */
export const LEGACY_NOTES_AUDIENCES = ['碩禾全體', '禾迅全體', '芯和全體'] as const;

/** 舊 ContentX 路徑只接受兩種格式,避免組出其他網址 */
const PATH_RE = /^(?:PublicContentX\.aspx\?GUID=[0-9A-Za-z-]{1,50}|NotesPublic\/(?!.*\.\.)[A-Za-z0-9_.-]{1,60})$/;

export function legacyNewsUrl(base: string | null, path: string | null): string | null {
  if (!base || !path || !PATH_RE.test(path)) return null;
  return `${base}/html/${path}`;
}

/** LIKE 參數跳脫 % _ [ */
export const likeEscape = (s: string) => s.replace(/[[%_]/g, (c) => `[${c}]`);

type NewsRow = { id: string | null; title: string | null; type: string | null; date: string | null; path: string | null };

export class MssqlHomeLegacyRepo implements LegacyNewsRepo, HireDateRepo {
  constructor(
    private readonly pool: sql.ConnectionPool,
    private readonly src: Sources,
    /** 舊入口網網站根網址(例 http://10.10.130.166/PortalSolar),不含結尾 / */
    private readonly legacyBase: string | null,
  ) {}

  async list(opts: { today: string; q?: string; offset: number; limit: number }): Promise<{ total: number; items: LegacyNews[] }> {
    const X = this.src.table('PortalSolar', 'ContentX');
    const P = this.src.table('Notes', 'PublicNoticeInfo');
    const req = this.pool.request().input('today', sql.NVarChar(50), opts.today).input('off', sql.Int, opts.offset).input('lim', sql.Int, opts.limit);
    LEGACY_NEWS_TYPES.forEach((t, i) => req.input(`t${i}`, sql.NVarChar(50), t));
    LEGACY_NOTES_AUDIENCES.forEach((a, i) => req.input(`a${i}`, sql.NVarChar(60), `%.${a}%`));
    const q = opts.q?.trim();
    if (q) req.input('q', sql.NVarChar(120), `%${likeEscape(q)}%`);
    // 舊程式以 LEFT JOIN 過濾(Notes 公告編號 = ContentX 第 13~20 字);改寫成 EXISTS 避免同編號多筆時重複列
    const noticeNo = `CASE WHEN SUBSTRING(X.ContentX, 1, 11) = N'NotesPublic' THEN SUBSTRING(X.ContentX, 13, 8) ELSE N'' END`;
    const audience = LEGACY_NOTES_AUDIENCES.map((_, i) => `P.L_Item1 LIKE @a${i}`).join(' OR ');
    const where = `
      (X.ContentX LIKE N'PublicContentX.aspx%' OR X.ContentX LIKE N'NotesPublic%')
      AND (X.EndDate >= @today OR X.EndDate = N'') AND X.StartDate <= @today
      AND X.ContentType IN (${LEGACY_NEWS_TYPES.map((_, i) => `@t${i}`).join(', ')})
      AND (X.UpDown <> N'Down' OR X.UpDown IS NULL)
      AND (NOT EXISTS (SELECT 1 FROM ${P} P WHERE P.No = ${noticeNo})
           OR EXISTS (SELECT 1 FROM ${P} P WHERE P.No = ${noticeNo} AND (P.L_Item1 IS NULL OR ${audience})))
      ${q ? 'AND X.indexContent LIKE @q' : ''}`;
    const r = await req.query<NewsRow & { total: number }>(
      `SELECT COUNT(*) AS total FROM ${X} X WHERE ${where};
       SELECT X.GUID AS id, X.indexContent AS title, X.ContentType AS type,
              CONVERT(char(10), TRY_CONVERT(date, X.StartDate, 111), 23) AS date, X.ContentX AS path
       FROM ${X} X WHERE ${where}
       ORDER BY X.StartDate DESC, X.Pubtime DESC, X.GUID
       OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY;`,
    );
    const sets = r.recordsets as unknown as [{ total: number }[], NewsRow[]];
    return {
      total: sets[0][0]?.total ?? 0,
      items: sets[1].map((x) => ({
        id: x.id ?? '',
        title: x.title ?? '(無標題)',
        type: x.type ?? '',
        date: x.date,
        url: legacyNewsUrl(this.legacyBase, x.path),
      })),
    };
  }

  async hireDate(empNo: string): Promise<string | null> {
    // 同一工號可能有多筆(複職 / 轉調);優先取在職中的最新到職日
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(50), empNo)
      .query<{ d: string | null }>(
        `SELECT TOP 1 CONVERT(char(10), JobDate, 23) AS d FROM ${this.src.table('LOS', 'EmployeeInfo')}
         WHERE UserID = @emp AND JobDate IS NOT NULL
         ORDER BY CASE WHEN LeaveDate IS NULL THEN 0 ELSE 1 END, JobDate DESC`,
      );
    return r.recordset[0]?.d ?? null;
  }
}
