/** 通勤調查 GET / PUT /v1/commute(docs/Gherkin/personal/commute.feature;modules/commute/commute.ts) */
import type { FastifyInstance } from 'fastify';
import { AppError } from '../errors.js';
import { employeeOf } from '../identity.js';
import { PUBLIC_TRANSPORT, TRANSPORT, type CommuteInput, type CommuteService } from '../modules/commute/commute.js';

const str = (max: number) => ({ type: 'string', maxLength: max }) as const;
const nullable = { type: ['string', 'null'] } as const;

const recordSchema = {
  type: 'object',
  properties: {
    address: nullable,
    googleAddress: nullable,
    latitude: nullable,
    longitude: nullable,
    transport: nullable,
    startStation: nullable,
    endStation: nullable,
    transport2: nullable,
    startStation2: nullable,
    endStation2: nullable,
    note: nullable,
    updatedAt: nullable,
  },
} as const;

export function commuteRoutes(service: CommuteService | null) {
  const need = () => {
    if (!service) throw new AppError(503, 'PORTAL_SOURCE_UNAVAILABLE', '資料來源未設定');
    return service;
  };
  return async (app: FastifyInstance): Promise<void> => {
    app.get(
      '/v1/commute',
      {
        schema: {
          operationId: 'portal.commute.get',
          summary: '通勤調查:目前資料與選項',
          description: '本人最新一筆有效的溫室氣體盤查通勤調查(PortalSolar CpfExInfo)、通勤方式選項,以及目前能否送出(地址定位服務是否設定)。',
          'x-permission': 'portal.api.commute.read',
          'x-gherkin': '場景: 查看本人通勤調查\n  假如 同仁曾填寫通勤調查\n  當 呼叫 GET /api/portal/commute\n  那麼 回應最新一筆有效資料與通勤方式選項',
          response: {
            200: {
              type: 'object',
              required: ['record', 'transport', 'publicTransport', 'canSubmit'],
              properties: {
                record: { anyOf: [recordSchema, { type: 'null' }] },
                transport: { type: 'array', items: { type: 'string' } },
                publicTransport: { type: 'array', items: { type: 'string' } },
                canSubmit: { type: 'boolean' },
              },
            },
          },
        },
      },
      async (req) => {
        const { empNo } = employeeOf(req);
        const s = need();
        return { record: await s.current(empNo), transport: [...TRANSPORT], publicTransport: [...PUBLIC_TRANSPORT], canSubmit: s.canSubmit };
      },
    );

    app.put<{ Body: CommuteInput }>(
      '/v1/commute',
      {
        schema: {
          operationId: 'portal.commute.submit',
          summary: '通勤調查:送出',
          description: '驗證通勤方式與起訖站,以 Google 地圖將地址轉為經緯度後,將本人舊資料設為失效並新增一筆(與舊入口網共用 CpfExInfo)。地址解析不到回 422。',
          'x-permission': 'portal.api.commute.write',
          'x-audit-level': 'meta',
          'x-gherkin':
            '場景: 送出通勤調查\n  假如 同仁填寫地址與主要通勤方式「機車」\n  當 呼叫 PUT /api/portal/commute\n  那麼 回應 200,舊資料失效並新增一筆含經緯度的資料',
          body: {
            type: 'object',
            required: ['address', 'transport'],
            additionalProperties: false,
            properties: {
              address: str(100),
              transport: str(20),
              startStation: str(50),
              endStation: str(50),
              transport2: str(20),
              startStation2: str(50),
              endStation2: str(50),
              note: str(100),
            },
          },
          response: { 200: recordSchema },
        },
      },
      async (req) => {
        const { empNo } = employeeOf(req);
        return need().submit(empNo, req.body);
      },
    );
  };
}
