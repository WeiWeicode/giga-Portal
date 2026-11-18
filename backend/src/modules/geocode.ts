/**
 * 地址轉經緯度(通勤調查;old_PortalSolar App_Code/GoogleMapServices.cs,PORTAL-API-PLAN D-11):
 * Google Geocoding API,region=tw、language=zh-TW。金鑰只在 portal-api(Docker secret),錯誤訊息不含網址與金鑰。
 */
export interface GeoResult {
  lat: number;
  lng: number;
  /** Google 正規化後的地址(舊系統另以經緯度反查;正向查詢的 formatted_address 即同一筆結果) */
  formattedAddress: string;
}

export interface Geocoder {
  /** 解析不到回 null;服務異常拋錯 */
  geocode(address: string): Promise<GeoResult | null>;
}

export class GeocodeError extends Error {
  override name = 'GeocodeError';
}

export class GoogleGeocoder implements Geocoder {
  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs = 5000,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async geocode(address: string): Promise<GeoResult | null> {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.search = new URLSearchParams({ address, region: 'tw', language: 'zh-TW', key: this.apiKey }).toString();
    let body: { status?: string; results?: { formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } } }[] };
    try {
      const res = await this.fetchFn(url, { signal: AbortSignal.timeout(this.timeoutMs) });
      if (!res.ok) throw new GeocodeError(`Google Geocoding HTTP ${res.status}`);
      body = (await res.json()) as typeof body;
    } catch (err) {
      if (err instanceof GeocodeError) throw err;
      throw new GeocodeError(`Google Geocoding 連線失敗:${(err as Error).name}`);
    }
    if (body.status === 'ZERO_RESULTS') return null;
    if (body.status !== 'OK') throw new GeocodeError(`Google Geocoding 回應 ${body.status ?? '(無狀態)'}`);
    const first = body.results?.[0];
    const loc = first?.geometry?.location;
    if (typeof loc?.lat !== 'number' || typeof loc.lng !== 'number') return null;
    return { lat: loc.lat, lng: loc.lng, formattedAddress: first?.formatted_address ?? '' };
  }
}
