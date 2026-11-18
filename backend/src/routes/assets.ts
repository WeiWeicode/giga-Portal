/**
 * 個人資產明細:備註(PORTAL-API-PLAN D-12;docs/Gherkin/personal/assets.feature)。
 * 資產清單本身在 TIPTOP(轉移中),這裡只列 PortalSolar.dbo.PersonalPropertyInfo 中本人已填的備註;唯讀。
 * 照片檔在 166(PicFile 為檔名),待 giga-file-service 舊檔對照(F4)後再提供,目前只回是否有照片。
 */
import sql from 'mssql';
import type { FastifyInstance } from 'fastify';
import type { Sources } from '../db/sources.js';
import { AppError } from '../errors.js';
import { employeeOf } from '../identity.js';

export interface AssetNote {
  compDb: string | null;
  assetNo: string;
  assetSub: string | null;
  note: string | null;
  hasPhoto: boolean;
}

export interface AssetNoteRepo {
  list(empNo: string): Promise<AssetNote[]>;
}

export class MssqlAssetNoteRepo implements AssetNoteRepo {
  constructor(
    private readonly pool: sql.ConnectionPool,
    private readonly src: Sources,
  ) {}

  async list(empNo: string): Promise<AssetNote[]> {
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(20), empNo)
      .query<{ CompDB: string | null; FAJ02: string; FAJ022: string | null; Note: string | null; PicFile: string | null }>(
        `SELECT TOP 1000 CompDB, FAJ02, FAJ022, Note, PicFile FROM ${this.src.table('PortalSolar', 'PersonalPropertyInfo')}
         WHERE UserID = @emp ORDER BY FAJ02, FAJ022`,
      );
    return r.recordset.map((x) => ({ compDb: x.CompDB, assetNo: x.FAJ02, assetSub: x.FAJ022, note: x.Note, hasPhoto: !!x.PicFile?.trim() }));
  }
}

export function assetRoutes(repo: AssetNoteRepo | null) {
  return async (app: FastifyInstance): Promise<void> => {
    app.get(
      '/v1/assets/notes',
      {
        schema: {
          operationId: 'portal.asset.notes',
          summary: '個人資產:備註',
          description: '本人在舊入口網對保管資產填寫的備註(PortalSolar PersonalPropertyInfo);資產清單在 TIPTOP,轉移中不提供。',
          'x-permission': 'portal.api.asset.read',
          'x-gherkin':
            '場景: 查看本人資產備註\n  假如 同仁曾在舊入口網為資產 A001 填寫備註\n  當 呼叫 GET /api/portal/assets/notes\n  那麼 回應該資產的備註與是否有照片',
          response: {
            200: {
              type: 'object',
              required: ['items'],
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['compDb', 'assetNo', 'assetSub', 'note', 'hasPhoto'],
                    properties: {
                      compDb: { type: ['string', 'null'] },
                      assetNo: { type: 'string' },
                      assetSub: { type: ['string', 'null'] },
                      note: { type: ['string', 'null'] },
                      hasPhoto: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      async (req) => {
        const { empNo } = employeeOf(req);
        if (!repo) throw new AppError(503, 'PORTAL_SOURCE_UNAVAILABLE', '資料來源未設定');
        return { items: await repo.list(empNo) };
      },
    );
  };
}
