/**
 * 溫室氣體盤查員工通勤調查(old_PortalSolar HRPDatabase03.aspx;PORTAL-API-PLAN D-10 個人基本資料只開此 Tab)。
 * 寫入 PortalSolar.dbo.CpfExInfo(與舊系統並行共用):先把本人舊資料 IsActive=0,再新增一筆(IsActive、RecTime 用表的預設值,同舊程式)。
 * 舊系統預設地址取自 TIPTOP 戶籍地址(CPF22);人事系統轉移中不讀,沒有填過的同仁地址為空白。
 */
import { AppError } from '../../errors.js';
import type { Geocoder } from '../geocode.js';

/** 通勤方式(舊下拉選單,值即寫入的文字) */
export const TRANSPORT = [
  '機車',
  '電動機車',
  '腳踏車',
  '電動腳踏車',
  '汽車',
  '電動汽車',
  '汽車(油電混和)',
  '捷運',
  '高鐵',
  '火車',
  '步行',
  '公車',
  '其他',
] as const;
/** 大眾運輸:必填起點 / 終點站 */
export const PUBLIC_TRANSPORT: readonly string[] = ['火車', '高鐵', '公車', '捷運'];

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

/** CpfExInfo 新增的一筆(欄位長度依表定義截斷) */
export interface CommuteRow {
  userId: string;
  address: string;
  latitude: string;
  longitude: string;
  googleAddress: string;
  transport: string;
  startStation: string;
  endStation: string;
  transport2: string | null;
  startStation2: string | null;
  endStation2: string | null;
  note: string;
}

export interface CommuteRepo {
  current(empNo: string): Promise<CommuteRecord | null>;
  /** 本人舊資料失效後新增一筆(同一交易) */
  replace(row: CommuteRow): Promise<void>;
}

const invalid = (field: string, message: string) => new AppError(400, 'VALIDATION_FAILED', '參數驗證失敗', [{ field, message }]);

/** 同一人兩次送出的最短間隔(避免重複送出灌爆 Google 配額與共用表;單一容器,記憶體即可) */
export const SUBMIT_INTERVAL_MS = 10_000;

export class CommuteService {
  private readonly lastSubmit = new Map<string, number>();

  constructor(
    private readonly repo: CommuteRepo,
    /** null = 未設定 Google 金鑰,不能送出 */
    private readonly geocoder: Geocoder | null,
    private readonly now: () => number = Date.now,
  ) {}

  get canSubmit(): boolean {
    return this.geocoder !== null;
  }

  current(empNo: string): Promise<CommuteRecord | null> {
    return this.repo.current(empNo);
  }

  /** 驗證規則與訊息同舊程式;地址解析不到回 422 */
  async submit(empNo: string, input: CommuteInput): Promise<CommuteRecord> {
    const address = input.address.trim();
    if (!address) throw invalid('address', '請填寫上班通勤現居地');
    if (!(TRANSPORT as readonly string[]).includes(input.transport)) throw invalid('transport', '未選取【主要通勤方式】');
    const s1 = input.startStation?.trim() ?? '';
    const e1 = input.endStation?.trim() ?? '';
    if (PUBLIC_TRANSPORT.includes(input.transport) && (!s1 || !e1)) throw invalid('startStation', '選取大眾交通工具,未填入起點/終點站');
    const t2 = input.transport2 || null;
    if (t2 !== null && !(TRANSPORT as readonly string[]).includes(t2)) throw invalid('transport2', '次要通勤方式不在選項內');
    const s2 = input.startStation2?.trim() ?? '';
    const e2 = input.endStation2?.trim() ?? '';
    if (t2 !== null && PUBLIC_TRANSPORT.includes(t2) && (!s2 || !e2)) throw invalid('startStation2', '次要通勤選取大眾交通工具,未填入起點/終點站');

    if (!this.geocoder) throw new AppError(503, 'PORTAL_GEOCODE_UNAVAILABLE', '地址定位服務未設定,暫時無法送出');
    const t = this.now();
    const last = this.lastSubmit.get(empNo);
    if (last !== undefined && t - last < SUBMIT_INTERVAL_MS) throw new AppError(429, 'PORTAL_TOO_MANY_REQUESTS', '送出太頻繁,請稍後再試');
    this.lastSubmit.set(empNo, t);

    // 地址與目前有效資料相同時沿用既有座標,不再呼叫 Google
    const prev = await this.repo.current(empNo);
    let geo: { lat: number | string; lng: number | string; formattedAddress: string } | null;
    if (prev?.address === address.slice(0, 100) && prev.latitude && prev.longitude) {
      geo = { lat: prev.latitude, lng: prev.longitude, formattedAddress: prev.googleAddress ?? '' };
    } else {
      try {
        geo = await this.geocoder.geocode(address);
      } catch {
        throw new AppError(502, 'PORTAL_GEOCODE_FAILED', '地址定位服務暫時無法使用,請稍後再試');
      }
    }
    if (!geo) throw new AppError(422, 'PORTAL_ADDRESS_UNRESOLVED', '未能解析您的地址,請確認您的地址是否正確填寫');

    await this.repo.replace({
      userId: empNo,
      address: address.slice(0, 100),
      latitude: String(geo.lat).slice(0, 20),
      longitude: String(geo.lng).slice(0, 20),
      googleAddress: geo.formattedAddress.slice(0, 100),
      transport: input.transport,
      startStation: s1.slice(0, 50),
      endStation: e1.slice(0, 50),
      // 舊程式:沒有次要通勤方式時三個欄位都寫 NULL
      transport2: t2,
      startStation2: t2 === null ? null : s2.slice(0, 50),
      endStation2: t2 === null ? null : e2.slice(0, 50),
      note: (input.note ?? '').slice(0, 100),
    });
    const saved = await this.repo.current(empNo);
    if (!saved) throw new AppError(500, 'INTERNAL_ERROR', '系統發生錯誤');
    return saved;
  }
}
