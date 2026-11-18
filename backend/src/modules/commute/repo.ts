/** 通勤調查 CpfExInfo 的讀寫(PortalSolar;測試區為 giganexus_gw_test.src_portalsolar 複本) */
import sql from 'mssql';
import type { Sources } from '../../db/sources.js';
import type { CommuteRecord, CommuteRepo, CommuteRow } from './commute.js';

interface Row {
  CPF231: string | null;
  GoogleAddress: string | null;
  latitude: string | null;
  longitude: string | null;
  TransTools: string | null;
  StartStation: string | null;
  EndStation: string | null;
  TransTools2: string | null;
  StartStation2: string | null;
  EndStation2: string | null;
  Note: string | null;
  RecTime: Date | null;
}

export class MssqlCommuteRepo implements CommuteRepo {
  constructor(
    private readonly pool: sql.ConnectionPool,
    private readonly src: Sources,
  ) {}

  private get table() {
    return this.src.table('PortalSolar', 'CpfExInfo');
  }

  async current(empNo: string): Promise<CommuteRecord | null> {
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(20), empNo)
      .query<Row>(
        `SELECT TOP 1 CPF231, GoogleAddress, latitude, longitude, TransTools, StartStation, EndStation, TransTools2, StartStation2, EndStation2, Note, RecTime
         FROM ${this.table} WHERE UserID = @emp AND IsActive = 1 ORDER BY RecTime DESC`,
      );
    const x = r.recordset[0];
    if (!x) return null;
    return {
      address: x.CPF231,
      googleAddress: x.GoogleAddress,
      latitude: x.latitude,
      longitude: x.longitude,
      transport: x.TransTools,
      startStation: x.StartStation,
      endStation: x.EndStation,
      transport2: x.TransTools2,
      startStation2: x.StartStation2,
      endStation2: x.EndStation2,
      note: x.Note,
      updatedAt: x.RecTime ? x.RecTime.toISOString() : null,
    };
  }

  async replace(row: CommuteRow): Promise<void> {
    // SERIALIZABLE:同一人同時送出(或與舊系統同時寫入)時不會留下兩筆有效資料
    const tx = new sql.Transaction(this.pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      await tx
        .request()
        .input('emp', sql.NVarChar(20), row.userId)
        .input('addr', sql.NVarChar(100), row.address)
        .input('lat', sql.NVarChar(20), row.latitude)
        .input('lng', sql.NVarChar(20), row.longitude)
        .input('gaddr', sql.NVarChar(100), row.googleAddress)
        .input('t1', sql.NVarChar(20), row.transport)
        .input('s1', sql.NVarChar(50), row.startStation)
        .input('e1', sql.NVarChar(50), row.endStation)
        .input('t2', sql.NVarChar(20), row.transport2)
        .input('s2', sql.NVarChar(50), row.startStation2)
        .input('e2', sql.NVarChar(50), row.endStation2)
        .input('note', sql.NVarChar(100), row.note)
        .query(
          `UPDATE ${this.table} SET IsActive = 0 WHERE UserID = @emp;
           INSERT INTO ${this.table} (UserID, CPF231, latitude, longitude, GoogleAddress, TransTools, StartStation, EndStation, TransTools2, StartStation2, EndStation2, Note)
           VALUES (@emp, @addr, @lat, @lng, @gaddr, @t1, @s1, @e1, @t2, @s2, @e2, @note);`,
        );
      await tx.commit();
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }
}
