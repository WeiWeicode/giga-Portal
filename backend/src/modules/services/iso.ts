/**
 * ISO 文件庫(P7 臨時服務,唯讀;FEATURE-PLAN §9;docs/Gherkin/services/iso.feature)。
 * 舊程式 ISOInfo.aspx(.cs):以 sa 連 190 NaNa,查檢視 v_ISO_Docs_Clause_Solar / v_ISO_Docs_Clause_ALL 與 Documents、ISOFile、
 * ISODocCmItem、DocCmItem_RefDoc、Doc_Level;SQL 字串拼接(搜尋框可注入)。新站:
 *   - 唯讀帳號 portal_bpm_ro(授權 db/dba/06-bpm-readonly-p7.sql,**未在 191 實測**,來源待確認 CONFIRM-NEEDED P7),參數化查詢
 *   - 條文分類排除「合約」「矽晶材料」開頭(同舊版);文件只列現行有效(validTo 空白或未過期)
 *   - 檔案連結 = ISO_DOC_BASE_URL/<文件編號>/<版本>/<檔名>(舊版 http://10.10.130.190/ISO2;文件編號含 4-4 用原檔,其餘副檔名換 .pdf,同舊版)
 */
import { AppError } from '../../errors.js';

export interface IsoDocRow {
  docNo: string;
  docName: string;
  levelId: string | null;
}

export interface IsoDocVersion {
  docNo: string;
  docName: string;
  displayVersion: string | null;
  version: string | null;
  clauseName: string | null;
  validFrom: string | null;
  validTo: string | null;
  levelId: string | null;
}

export interface IsoFile {
  physicalName: string;
  extensionType: string | null;
}

export interface IsoSource {
  clauses(): Promise<string[]>;
  byClause(clause: string): Promise<IsoDocRow[]>;
  search(q: string): Promise<IsoDocRow[]>;
  /** 現行有效版本(displayVersion 新到舊) */
  current(docNo: string): Promise<IsoDocVersion | null>;
  /** 任一版本(參考 / 上下階文件用,同舊版 v_ISO_Docs_Clause_ALL) */
  latestAny(docNo: string): Promise<IsoDocVersion | null>;
  file(docNo: string, version: string): Promise<IsoFile | null>;
  references(docNo: string, displayVersion: string): Promise<{ docNo: string; docName: string }[]>;
  uppers(docNo: string, displayVersion: string): Promise<{ docNo: string; docName: string }[]>;
  lowers(docNo: string, displayVersion: string): Promise<{ docNo: string; docName: string }[]>;
}

export interface IsoLink {
  docNo: string;
  docName: string;
  displayVersion: string | null;
  url: string | null;
}

export interface IsoDetail extends IsoDocVersion {
  url: string | null;
  references: IsoLink[];
  uppers: IsoLink[];
  lowers: IsoLink[];
}

const DOC_NO = /^[\p{L}\p{N} ._()-]{1,60}$/u;
const SEGMENT = /^[^\\/\u0000-\u001f?#]{1,200}$/;

export class IsoService {
  constructor(
    private readonly src: IsoSource | null,
    private readonly baseUrl: string | null,
  ) {}

  private need(): IsoSource {
    if (!this.src) throw new AppError(503, 'PORTAL_SOURCE_UNAVAILABLE', 'ISO 文件來源未設定(資料來源待確認)');
    return this.src;
  }

  /** 檔名規則同舊版:文件編號含 4-4 用原檔名,其餘把副檔名換成 .pdf */
  fileUrl(docNo: string, version: string | null, f: IsoFile | null): string | null {
    if (!this.baseUrl || !version || !f) return null;
    const ext = f.extensionType?.trim();
    const name =
      docNo.includes('4-4') || !ext ? f.physicalName : f.physicalName.replace(new RegExp(`\\.${ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '.pdf');
    if (![docNo, version, name].every((s) => SEGMENT.test(s) && s !== '..' && s !== '.')) return null;
    return `${this.baseUrl}/${[docNo, version, name].map(encodeURIComponent).join('/')}`;
  }

  clauses(): Promise<string[]> {
    return this.need().clauses();
  }

  async docs(opts: { clause?: string; q?: string }): Promise<IsoDocRow[]> {
    const s = this.need();
    const q = opts.q?.trim();
    if (q) return s.search(q);
    const clause = opts.clause?.trim();
    if (!clause) throw new AppError(400, 'VALIDATION_FAILED', '請選擇條文分類或輸入關鍵字');
    return s.byClause(clause);
  }

  private async link(r: { docNo: string; docName: string }): Promise<IsoLink> {
    const s = this.need();
    const v = await s.latestAny(r.docNo);
    const f = v?.version ? await s.file(r.docNo, v.version) : null;
    return { docNo: r.docNo, docName: r.docName, displayVersion: v?.displayVersion ?? null, url: this.fileUrl(r.docNo, v?.version ?? null, f) };
  }

  async detail(docNo: string): Promise<IsoDetail> {
    if (!DOC_NO.test(docNo)) throw new AppError(404, 'PORTAL_ISO_NOT_FOUND', '找不到此文件');
    const s = this.need();
    const v = await s.current(docNo);
    if (!v) throw new AppError(404, 'PORTAL_ISO_NOT_FOUND', '找不到此文件或已失效');
    const dv = v.displayVersion ?? '';
    const [f, refs, ups, lows] = await Promise.all([
      v.version ? s.file(docNo, v.version) : Promise.resolve(null),
      s.references(docNo, dv),
      s.uppers(docNo, dv),
      s.lowers(docNo, dv),
    ]);
    const all = await Promise.all([refs, ups, lows].map((list) => Promise.all(list.slice(0, 50).map((r) => this.link(r)))));
    return { ...v, url: this.fileUrl(docNo, v.version, f), references: all[0]!, uppers: all[1]!, lowers: all[2]! };
  }
}
