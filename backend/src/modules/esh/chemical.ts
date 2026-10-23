/**
 * 危害性化學品清單(P6;FEATURE-PLAN §8 最後一列;docs/Gherkin/esh/chemicals.feature;舊程式 EHS/EHCHEMICALInfo.aspx(.cs))。
 *   - 所有員工可查(portal.api.esh.chemical.read):列管 / 不列管、申請日期區間(預設去年本月 1 日 ~ 今天,同舊版)、關鍵字
 *   - 成份子表以化學品 ID(EF_ID)對應(修正舊版以未篩選的列索引對應而錯位)
 *   - 「由 BPM 同步」:管理員按鈕(portal.esh.chemical.edit,另須 portal-esh-admin)+ 每日排程;**唯讀**查 NaNa「化學品申報單」
 *     (SHR008_、已結案),解析表單 XML 後整批在**同一個交易**內先刪後寫 ESHChemicalDataA / B / C(舊版逐筆、無交易,壞一筆即中斷)
 *     解析失敗或欄位超長的表單略過並列在結果中;同步**不覆寫**新站上傳的 SDS(portal.esh_chemical_sds)
 *   - SDS:新站上傳經 file-service(優先顯示);否則顯示 BPM 附件網址(ESHChemicalDataC.AttachmentFile,只接受 http(s))或舊站檔名
 */
import { AppError } from '../../errors.js';
import type { Employee } from '../../identity.js';
import { checkFile, requireEshRole } from './license.js';
import type { EshJobRepo, JobTrigger } from './notify.js';
import { unsafeText } from '../manager/text.js';
import { addMonths, isDate, legacyFileUrl, normEmp, safeHttpUrl, SDS_EXTENSIONS, taipeiToday } from './rules.js';
import type { FileRef } from './types.js';

export const PROCESS_ID = 'SHR008_';
export const PROCESS_NAME = '化學品申報單';
export const RESTRICT = ['列管', '不列管'] as const;
export type Restrict = (typeof RESTRICT)[number];
/** 手動同步區間上限(月) */
export const MAX_SYNC_MONTHS = 36;

/** ESHChemicalDataA 欄位與長度(nvarchar 字元數;2026-10-23 查測試區複本 sys.columns) */
export const A_COLUMNS = {
  s_RequesterID_txt: 10,
  s_Requester_txt: 10,
  s_ApplyUserName_txt: 10,
  s_DeptID_txt: 10,
  s_DeptName_txt: 20,
  d_CreateDate_txt: 10,
  s_ApplyUserID_txt: 10,
  s_UseApplyUserName_txt: 10,
  s_UseDeptID_txt: 10,
  s_UseDeptName_txt: 40,
  s_UseApplyUserID_txt: 10,
  i_Amount_txt: 40,
  s_FactoryName: 40,
  s_ProductNumber: 40,
  s_CH_ChemicalName: 200,
  s_EN_ChemicalName: 200,
  Input_StorageDept: 40,
  s_StorageNumber: 40,
  s_KeepUserName_txt: 10,
  s_KeepDeptID_txt: 10,
  s_KeepDeptName_txt: 40,
  s_KeepUserID_txt: 10,
  RB_For: 200,
  s_Reason: 200,
  RB_Attachment: 200,
  Attachment: 200,
  RB_Restrict: 10,
  RB_Path: 10,
  RB_Type: 10,
  ddl_InputUnit: 10,
  RBstate: 10,
  s_NoAttachmentPS: 100,
  ddl_FactoryArea: 40,
} as const;
export type AColumn = keyof typeof A_COLUMNS;
export const A_COLUMN_NAMES = Object.keys(A_COLUMNS) as AColumn[];

/** ESHChemicalDataB 成份欄位(XML id 後綴 1~5) */
export const B_COLUMNS = {
  s_Composition_CN: 150,
  s_Composition_EN: 150,
  s_Composition_CODE: 40,
  s_Composition_CNS: 100,
  s_Composition_Formula: 100,
  s_Composition_Rate: 100,
} as const;
export type BColumn = keyof typeof B_COLUMNS;
export const B_COLUMN_NAMES = Object.keys(B_COLUMNS) as BColumn[];
export const C_LIMITS = { AttachmentFile: 200, logicalName: 100 } as const;

export interface Component {
  item: number;
  cn: string | null;
  en: string | null;
  code: string | null;
  cas: string | null;
  formula: string | null;
  rate: string | null;
}

/** 同步寫入的一筆化學品申報 */
export interface ChemicalRecord {
  efId: string;
  a: Record<AColumn, string>;
  components: (Record<BColumn, string> & { item: number })[];
  sds: { url: string; logicalName: string } | null;
}

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
export const decodeXml = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (_m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? '';
  });

/**
 * 解析 BPM 表單欄位 XML(FormInstance.fieldValues):取有 id 屬性的葉節點文字(同舊版 InnerText);巢狀節點(附件清單)略過。
 * 不使用 XML 函式庫:BPM 產生的格式固定,只需要 <tag id="x" ...>文字</tag>。
 */
export function parseFieldValues(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<([A-Za-z_][\w.-]*)\b([^<>]*?)(?:\/>|>([^<]*)<\/\1\s*>)/g;
  for (const m of xml.matchAll(re)) {
    const id = /\bid\s*=\s*"([^"]*)"/.exec(m[2] ?? '')?.[1];
    if (!id || Object.hasOwn(out, id)) continue;
    out[id] = decodeXml(m[3] ?? '').trim();
  }
  return out;
}

/** 代碼轉中文(同舊版 EHCHEMICALInfo.aspx.cs:196-238) */
export function convertCodes(f: Record<string, string>): Record<string, string> {
  const g = (k: string) => f[k] ?? '';
  const map = (v: string, m: Record<string, string>) => m[v] ?? v;
  return {
    ...f,
    RB_Restrict: g('RB_Restrict') === '0' ? '不列管' : '列管',
    RB_For: g('RB_For') === '2' ? `其他${g('s_Reason')}` : map(g('RB_For'), { '0': '實驗室使用', '1': '原物料使用' }),
    RB_Path: map(g('RB_Path'), { '0': '廠商送樣', '1': '小量自行採購', '2': '大量採購購入' }),
    RB_Type: map(g('RB_Type'), { '0': '純物質', '1': '混合物' }),
    RBstate: map(g('RBstate'), { '0': '固體', '1': '液體', '2': '氣體' }),
  };
}

/**
 * 舊站以 asp:Label 原樣輸出這些欄位(資安審查 M1):半形 < > 改為全形 ＜ ＞(保留「>95%」等濃度寫法的意思),控制字元另行拒收
 */
export const legacySafe = (s: string) => s.replace(/</g, '＜').replace(/>/g, '＞');

export interface BpmChemicalForm {
  serialNumber: string;
  fieldValues: string;
  doc: { logicalName: string | null; physicalName: string | null; extension: string | null } | null;
}

export type BuildResult = { ok: true; record: ChemicalRecord } | { ok: false; efId: string; reason: string };

/** 一張 BPM 表單 → 寫入舊表的資料;欄位超過舊表長度時整張略過(不截斷,避免寫入錯誤資料) */
export function buildRecord(form: BpmChemicalForm, sdsBaseUrl: string | null): BuildResult {
  const efId = form.serialNumber.trim();
  if (!/^[A-Za-z0-9_]{1,40}$/.test(efId)) return { ok: false, efId, reason: '流程序號格式不符' };
  let fields: Record<string, string>;
  try {
    fields = convertCodes(parseFieldValues(form.fieldValues));
  } catch (err) {
    return { ok: false, efId, reason: `表單內容無法解析:${(err as Error).message}` };
  }
  if (!fields.s_RequesterID_txt) return { ok: false, efId, reason: '表單沒有填表人(舊版同樣不列出)' };
  const a = {} as Record<AColumn, string>;
  for (const col of A_COLUMN_NAMES) {
    const v = legacySafe(fields[col] ?? '');
    if (v.length > A_COLUMNS[col]) return { ok: false, efId, reason: `欄位 ${col} 超過 ${A_COLUMNS[col]} 字` };
    if (unsafeText(v, true)) return { ok: false, efId, reason: `欄位 ${col} 含控制字元` };
    a[col] = v;
  }
  const components: ChemicalRecord['components'] = [];
  for (let i = 1; i <= 5; i++) {
    if (!(fields[`s_Composition_CN${i}`] ?? '').trim()) continue;
    const c = { item: i } as Record<BColumn, string> & { item: number };
    for (const col of B_COLUMN_NAMES) {
      const v = legacySafe(fields[`${col}${i}`] ?? '');
      if (v.length > B_COLUMNS[col]) return { ok: false, efId, reason: `成份 ${i} 欄位 ${col} 超過 ${B_COLUMNS[col]} 字` };
      if (unsafeText(v, true)) return { ok: false, efId, reason: `成份 ${i} 欄位 ${col} 含控制字元` };
      c[col] = v;
    }
    components.push(c);
  }
  let sds: ChemicalRecord['sds'] = null;
  const d = form.doc;
  if (d?.physicalName && sdsBaseUrl) {
    const url = `${sdsBaseUrl}/${encodeURIComponent(d.physicalName.trim())}${d.extension ? `.${encodeURIComponent(d.extension.trim())}` : ''}`;
    const logicalName = legacySafe((d.logicalName ?? '').trim()).slice(0, C_LIMITS.logicalName);
    if (unsafeText(logicalName)) return { ok: false, efId, reason: 'SDS 檔名含控制字元' };
    if (url.length <= C_LIMITS.AttachmentFile) sds = { url, logicalName };
  }
  return { ok: true, record: { efId, a, components, sds } };
}

// ───── 查詢 ─────
export interface ChemicalRow {
  efId: string;
  a: Partial<Record<AColumn, string | null>>;
  attachmentFile: string | null;
  logicalName: string | null;
}

export interface ChemicalQuery {
  restrict: Restrict;
  /** yyyy/MM/dd(同舊表 d_CreateDate_txt 格式) */
  from: string;
  to: string;
  keyword: string | null;
  page: number;
  pageSize: number;
}

export interface ChemicalRepo {
  list(q: ChemicalQuery): Promise<{ total: number; items: ChemicalRow[] }>;
  get(efId: string): Promise<ChemicalRow | null>;
  components(efIds: string[]): Promise<Map<string, Component[]>>;
  /** 同一交易:逐筆先刪 A / B / C 再寫入;任一句失敗全部回復 */
  replace(records: ChemicalRecord[]): Promise<void>;
}

export interface ChemicalSdsRepo {
  sds(efIds: string[]): Promise<Map<string, FileRef>>;
  setSds(efId: string, file: FileRef, byEmp: string): Promise<void>;
  deleteSds(efId: string): Promise<boolean>;
}

export interface ChemicalSource {
  /** NaNa 唯讀:化學品申報單、已結案、建立時間在 [from, to](台灣時間日期) */
  forms(from: string, to: string): Promise<BpmChemicalForm[]>;
}

export type SdsView =
  { kind: 'file'; fileId: string; fileName: string } | { kind: 'url'; url: string; name: string } | { kind: 'legacy'; url: string | null; name: string };

export interface ChemicalView {
  efId: string;
  restrict: string | null;
  factoryArea: string | null;
  createDate: string | null;
  chemicalName: string | null;
  chemicalNameEn: string | null;
  vendor: string | null;
  productNumber: string | null;
  amount: string | null;
  unit: string | null;
  purpose: string | null;
  path: string | null;
  type: string | null;
  state: string | null;
  storage: string | null;
  storageExt: string | null;
  noAttachmentNote: string | null;
  requester: { id: string | null; name: string | null };
  applicant: { id: string | null; name: string | null; dept: string | null; deptName: string | null };
  keeper: { id: string | null; name: string | null; dept: string | null; deptName: string | null };
  /** 使用人(修正舊版詳細頁把使用部門放在使用人欄位) */
  user: { id: string | null; name: string | null; dept: string | null; deptName: string | null };
  components: Component[];
  sds: SdsView | null;
}

export interface SyncResult {
  runId: number;
  from: string;
  to: string;
  forms: number;
  written: number;
  skipped: { efId: string; reason: string }[];
}

const toSlash = (iso: string) => iso.replaceAll('-', '/');
const v = (s: string | null | undefined) => (s ?? '').trim() || null;

export class EshChemicalService {
  private syncing = false;

  constructor(
    private readonly repo: ChemicalRepo,
    private readonly files: ChemicalSdsRepo,
    private readonly source: ChemicalSource | null,
    private readonly jobs: EshJobRepo,
    private readonly opts: { sdsBaseUrl: string | null; legacyPortalUrl: string | null; syncMonths: number },
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** 預設區間:去年本月 1 日 ~ 今天(同舊版) */
  defaultRange(): { from: string; to: string } {
    const today = taipeiToday(this.now());
    return { from: `${addMonths(today, -12).slice(0, 8)}01`, to: today };
  }

  private view(row: ChemicalRow, components: Component[], sds: FileRef | undefined): ChemicalView {
    const a = row.a;
    let sdsView: SdsView | null = null;
    if (sds) sdsView = { kind: 'file', ...sds };
    else if (v(row.attachmentFile)) {
      const url = safeHttpUrl(row.attachmentFile);
      const name = v(row.logicalName) ?? row.attachmentFile!.split('/').pop()!;
      sdsView = url
        ? { kind: 'url', url, name }
        : /^[a-z]+:/i.test(row.attachmentFile!.trim())
          ? null
          : { kind: 'legacy', url: legacyFileUrl(this.opts.legacyPortalUrl, 'SDS', row.attachmentFile), name };
    }
    return {
      efId: row.efId,
      restrict: v(a.RB_Restrict),
      factoryArea: v(a.ddl_FactoryArea),
      createDate: v(a.d_CreateDate_txt),
      chemicalName: v(a.s_CH_ChemicalName),
      chemicalNameEn: v(a.s_EN_ChemicalName),
      vendor: v(a.s_FactoryName),
      productNumber: v(a.s_ProductNumber),
      amount: v(a.i_Amount_txt),
      unit: v(a.ddl_InputUnit),
      purpose: v(a.RB_For),
      path: v(a.RB_Path),
      type: v(a.RB_Type),
      state: v(a.RBstate),
      storage: v(a.Input_StorageDept),
      storageExt: v(a.s_StorageNumber),
      noAttachmentNote: v(a.s_NoAttachmentPS),
      requester: { id: v(a.s_RequesterID_txt), name: v(a.s_Requester_txt) },
      applicant: { id: v(a.s_ApplyUserID_txt), name: v(a.s_ApplyUserName_txt), dept: v(a.s_DeptID_txt), deptName: v(a.s_DeptName_txt) },
      keeper: { id: v(a.s_KeepUserID_txt), name: v(a.s_KeepUserName_txt), dept: v(a.s_KeepDeptID_txt), deptName: v(a.s_KeepDeptName_txt) },
      user: { id: v(a.s_UseApplyUserID_txt), name: v(a.s_UseApplyUserName_txt), dept: v(a.s_UseDeptID_txt), deptName: v(a.s_UseDeptName_txt) },
      components,
      sds: sdsView,
    };
  }

  private async views(rows: ChemicalRow[]): Promise<ChemicalView[]> {
    const ids = rows.map((r) => r.efId);
    const [comps, sds] = await Promise.all([this.repo.components(ids), this.files.sds(ids)]);
    return rows.map((r) => this.view(r, comps.get(r.efId) ?? [], sds.get(r.efId)));
  }

  async list(q: { restrict: Restrict; from?: string; to?: string; keyword?: string; page?: number; pageSize?: number }) {
    const d = this.defaultRange();
    const from = q.from ?? d.from;
    const to = q.to ?? d.to;
    if (!isDate(from) || !isDate(to) || from > to) throw new AppError(400, 'VALIDATION_FAILED', '日期區間錯誤');
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const r = await this.repo.list({ restrict: q.restrict, from: toSlash(from), to: toSlash(to), keyword: q.keyword?.trim() || null, page, pageSize });
    return { from, to, total: r.total, page, pageSize, items: await this.views(r.items) };
  }

  async get(efId: string): Promise<ChemicalView> {
    const row = await this.repo.get(efId);
    if (!row) throw new AppError(404, 'PORTAL_ESH_CHEMICAL_NOT_FOUND', '找不到此化學品申報');
    return (await this.views([row]))[0]!;
  }

  // ───── 管理員 ─────
  async setSds(emp: Employee, efId: string, file: FileRef): Promise<ChemicalView> {
    requireEshRole(emp);
    if (!(await this.repo.get(efId))) throw new AppError(404, 'PORTAL_ESH_CHEMICAL_NOT_FOUND', '找不到此化學品申報');
    await this.files.setSds(efId, checkFile(file, SDS_EXTENSIONS), normEmp(emp.empNo));
    return this.get(efId);
  }

  async deleteSds(emp: Employee, efId: string): Promise<void> {
    requireEshRole(emp);
    if (!(await this.files.deleteSds(efId))) throw new AppError(404, 'PORTAL_ESH_CHEMICAL_NOT_FOUND', '此化學品沒有新站上傳的 SDS');
  }

  async syncManual(emp: Employee, range: { from?: string; to?: string }): Promise<SyncResult> {
    requireEshRole(emp);
    const d = this.defaultRange();
    const from = range.from ?? d.from;
    const to = range.to ?? d.to;
    if (!isDate(from) || !isDate(to) || from > to) throw new AppError(400, 'VALIDATION_FAILED', '日期區間錯誤');
    if (addMonths(from, MAX_SYNC_MONTHS) < to) throw new AppError(400, 'VALIDATION_FAILED', `同步區間最多 ${MAX_SYNC_MONTHS} 個月`);
    const r = await this.sync('manual', `chemical-manual-${this.now().getTime()}-${normEmp(emp.empNo)}`, from, to, normEmp(emp.empNo));
    if (!r) throw new AppError(409, 'PORTAL_ESH_SYNC_RUNNING', '同步執行中,請稍後再試');
    return r;
  }

  /** 每日排程:同步最近 syncMonths 個月(已結案的表單可能晚於建立月份才結案) */
  async syncScheduled(): Promise<SyncResult | null> {
    const today = taipeiToday(this.now());
    return this.sync('schedule', `chemical-daily-${today}`, addMonths(today, -this.opts.syncMonths), today, null);
  }

  private async sync(trigger: JobTrigger, runKey: string, from: string, to: string, by: string | null): Promise<SyncResult | null> {
    if (!this.source) throw new AppError(503, 'PORTAL_SOURCE_UNAVAILABLE', 'BPM 資料來源未設定');
    if (this.syncing) return null;
    this.syncing = true;
    try {
      const runId = await this.jobs.start({ job: 'chemical-sync', trigger, runKey, requestedBy: by, scope: '' });
      if (runId === null) return null;
      try {
        const forms = await this.source.forms(from, to);
        const records: ChemicalRecord[] = [];
        const skipped: SyncResult['skipped'] = [];
        const seen = new Set<string>();
        for (const f of forms) {
          const r = buildRecord(f, this.opts.sdsBaseUrl);
          if (!r.ok) skipped.push({ efId: r.efId, reason: r.reason });
          else if (!seen.has(r.record.efId)) {
            seen.add(r.record.efId);
            records.push(r.record);
          }
        }
        await this.repo.replace(records);
        await this.jobs.finish(runId, 'ok', `${from}~${to};表單 ${forms.length},寫入 ${records.length},略過 ${skipped.length}`);
        return { runId, from, to, forms: forms.length, written: records.length, skipped };
      } catch (err) {
        await this.jobs.finish(runId, 'failed', (err as Error).message.slice(0, 500)).catch(() => undefined);
        throw err;
      }
    } finally {
      this.syncing = false;
    }
  }

  async runs(emp: Employee, limit = 10) {
    requireEshRole(emp);
    return this.jobs.recentRuns('chemical-sync', limit);
  }
}
