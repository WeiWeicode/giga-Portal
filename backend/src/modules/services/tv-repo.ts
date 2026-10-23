/** 電視看板資料存取(modules/services/tv.ts):PortalSolar TVShowInfo / TVImgInfo(舊表)、portal.tv_image(新站圖片) */
import sql from 'mssql';
import type { Sources } from '../../db/sources.js';
import type { LegacyTvImage, NewTvImage, TvMessage, TvRepo } from './tv.js';

const NEW = '[portal].[tv_image]';
type NewRow = { id: number | string; file_id: string; file_name: string; sort: number; active: boolean };
const toNew = (x: NewRow): NewTvImage => ({ id: Number(x.id), fileId: x.file_id, fileName: x.file_name, sort: x.sort, active: x.active });

export class MssqlTvRepo implements TvRepo {
  constructor(
    private readonly pool: sql.ConnectionPool,
    private readonly src: Sources,
  ) {}

  private t = (name: string) => this.src.table('PortalSolar', name);

  async message(): Promise<TvMessage | null> {
    const r = await this.pool
      .request()
      .query<{ Message: string | null; Fontsize: number | null }>(
        `SELECT TOP 1 Message, Fontsize FROM ${this.t('TVShowInfo')} WHERE IsActive = 1 ORDER BY _Index`,
      );
    const x = r.recordset[0];
    return x ? { message: x.Message ?? '', fontSize: x.Fontsize ?? 24 } : null;
  }

  async setMessage(m: TvMessage): Promise<void> {
    const tx = new sql.Transaction(this.pool);
    await tx.begin();
    try {
      const req = () => new sql.Request(tx).input('m', sql.NVarChar(500), m.message).input('f', sql.Int, m.fontSize);
      // 同舊版:更新全部列(舊表只有 1 列;舊看板讀 IsActive = 1 的列)
      const r = await req().query(`UPDATE ${this.t('TVShowInfo')} WITH (UPDLOCK, HOLDLOCK) SET Message = @m, Fontsize = @f`);
      if (!(r.rowsAffected[0] ?? 0)) await req().query(`INSERT INTO ${this.t('TVShowInfo')} (_Index, Fontsize, Message, IsActive) VALUES (1, @f, @m, 1)`);
      await tx.commit();
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }

  async legacyImages(): Promise<LegacyTvImage[]> {
    const r = await this.pool
      .request()
      .query<{ ImgPath: string | null; _Index: number | null; IsActive: boolean | null }>(
        `SELECT ImgPath, _Index, IsActive FROM ${this.t('TVImgInfo')} WHERE ImgPath IS NOT NULL AND ImgPath <> N'' ORDER BY _Index`,
      );
    return r.recordset.map((x) => ({ path: x.ImgPath!, index: x._Index, active: x.IsActive === true }));
  }

  async newImages(): Promise<NewTvImage[]> {
    const r = await this.pool.request().query<NewRow>(`SELECT id, file_id, file_name, sort, active FROM ${NEW} ORDER BY sort, id`);
    return r.recordset.map(toNew);
  }

  async addImage(fileId: string, fileName: string, sort: number, byEmp: string): Promise<NewTvImage> {
    const r = await this.pool
      .request()
      .input('f', sql.VarChar(36), fileId)
      .input('n', sql.NVarChar(200), fileName)
      .input('s', sql.Int, sort)
      .input('by', sql.NVarChar(20), byEmp)
      .query<NewRow>(
        `INSERT INTO ${NEW} (file_id, file_name, sort, active, created_by, updated_by) OUTPUT INSERTED.id, INSERTED.file_id, INSERTED.file_name, INSERTED.sort, INSERTED.active
         VALUES (@f, @n, @s, 1, @by, @by)`,
      );
    return toNew(r.recordset[0]!);
  }

  async updateLegacy(path: string, index: number, active: boolean): Promise<number> {
    const r = await this.pool
      .request()
      .input('p', sql.NVarChar(1000), path)
      .input('i', sql.TinyInt, index)
      .input('a', sql.Bit, active)
      .query(`UPDATE ${this.t('TVImgInfo')} SET _Index = @i, IsActive = @a WHERE ImgPath = @p`);
    return r.rowsAffected[0] ?? 0;
  }

  async updateNew(id: number, sort: number, active: boolean, byEmp: string): Promise<boolean> {
    const r = await this.pool
      .request()
      .input('id', sql.BigInt, id)
      .input('s', sql.Int, sort)
      .input('a', sql.Bit, active)
      .input('by', sql.NVarChar(20), byEmp)
      .query(`UPDATE ${NEW} SET sort = @s, active = @a, updated_by = @by, updated_at = sysutcdatetime() WHERE id = @id`);
    return (r.rowsAffected[0] ?? 0) > 0;
  }

  async deleteNew(id: number): Promise<boolean> {
    const r = await this.pool.request().input('id', sql.BigInt, id).query(`DELETE FROM ${NEW} WHERE id = @id`);
    return (r.rowsAffected[0] ?? 0) > 0;
  }
}
