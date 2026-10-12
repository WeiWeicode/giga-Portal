/**
 * BpmRepo 的 NaNa 實作(唯讀帳號 portal_bpm_ro,只有 Users、LocalToDoWorkItem、WorkItem、ProcessInstance 的 SELECT;
 * backend/db/dba/03-create-bpm-readonly.sql)。比照 giga-file-service file-api 的 NanaBpmRepo:
 *   - 連線延遲到第一次查詢才建立,NaNa 連不上不影響 portal-api 啟動;失敗後下次查詢重連
 *   - NaNa 的 OID 為 char(32) 會補空白,一律 RTRIM;參數用 varchar(與 char 欄位比對不會讓索引失效);ntext 欄位轉 nvarchar(主旨截至 1000 字);
 *     datetime 為台灣時間,以字串取出再標 +08:00
 */
import sql from 'mssql';
import type { SqlConfig } from '../../config.js';
import { ABNORMAL_STATE, TODO_LIMIT, TODO_STATES, type BpmRepo, type BpmUser, type RequestedRow, type TodoRow } from './bpm.js';

const twTime = (s: string | null) => (s ? new Date(`${s}+08:00`).toISOString() : null);
const states = [...TODO_STATES, ABNORMAL_STATE].join(', ');

export class NanaBpmRepo implements BpmRepo {
  private readonly pool: sql.ConnectionPool;
  private connecting: Promise<sql.ConnectionPool> | null = null;

  constructor(cfg: SqlConfig) {
    this.pool = new sql.ConnectionPool({
      server: cfg.server,
      port: cfg.port,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      connectionTimeout: 10_000,
      // NaNa 慢時不要長時間佔住連線池(上限 4)
      requestTimeout: 15_000,
      pool: { min: 0, max: 4, idleTimeoutMillis: 30_000 },
      options: { encrypt: false, trustServerCertificate: true, appName: 'giganexus-portal-bpm', useUTC: true, enableArithAbort: true },
    });
  }

  private async ready(): Promise<sql.ConnectionPool> {
    if (this.pool.connected) return this.pool;
    this.connecting ??= this.pool.connect().finally(() => (this.connecting = null));
    return this.connecting;
  }

  async user(empNo: string): Promise<BpmUser | null> {
    const pool = await this.ready();
    // 逐字元比對(不分大小寫的定序會讓 s112009 對到 S112009);只認在職且唯一的一筆,0 或多筆都視為沒有帳號
    const r = await pool
      .request()
      .input('id', sql.VarChar(50), empNo)
      .query<{ oid: string; id: string }>(
        'SELECT TOP 2 RTRIM(OID) AS oid, RTRIM(id) AS id FROM dbo.Users WHERE id COLLATE Latin1_General_BIN2 = @id AND leaveDate IS NULL',
      );
    return r.recordset.length === 1 ? r.recordset[0]! : null;
  }

  async todos(userOid: string): Promise<TodoRow[]> {
    const pool = await this.ready();
    const r = await pool
      .request()
      .input('uoid', sql.VarChar(64), userOid)
      .query<{
        wi: string;
        workItemName: string | null;
        ws: number;
        subject: string | null;
        processName: string | null;
        serialNumber: string | null;
        poid: string | null;
        ps: number | null;
        createdTime: string | null;
      }>(
        `SELECT TOP ${TODO_LIMIT + 1} RTRIM(T.workItemOID) AS wi, CAST(W.workItemName AS nvarchar(255)) AS workItemName, W.currentState AS ws,
                CAST(T.subject AS nvarchar(1000)) AS subject, CAST(T.processInstanceName AS nvarchar(255)) AS processName,
                PI.serialNumber, RTRIM(PI.OID) AS poid, PI.currentState AS ps,
                CONVERT(varchar(19), T.createdTime, 126) AS createdTime
         FROM dbo.LocalToDoWorkItem AS T
         INNER JOIN dbo.WorkItem AS W ON T.workItemOID = W.OID
         LEFT JOIN dbo.ProcessInstance AS PI ON W.contextOID = PI.contextOID
         WHERE T.userOID = @uoid AND W.currentState IN (${states})
         ORDER BY T.createdTime DESC, T.workItemOID`,
      );
    return r.recordset.map((x) => ({
      workItemOid: x.wi,
      workItemName: x.workItemName,
      workItemState: x.ws,
      subject: x.subject,
      processName: x.processName,
      serialNumber: x.serialNumber,
      processOid: x.poid,
      processState: x.ps,
      createdAt: twTime(x.createdTime),
    }));
  }

  async requested(userOid: string, offset: number, limit: number): Promise<{ total: number; rows: RequestedRow[] }> {
    const pool = await this.ready();
    const where = 'PI.requesterOID = @uoid AND PI.currentState = 1';
    const r = await pool
      .request()
      .input('uoid', sql.VarChar(64), userOid)
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, limit)
      .query(
        `SELECT COUNT(*) AS total FROM dbo.ProcessInstance AS PI WHERE ${where};
         SELECT RTRIM(PI.OID) AS poid, RTRIM(PI.contextOID) AS coid, PI.serialNumber,
                CAST(PI.processInstanceName AS nvarchar(255)) AS processName, CAST(PI.subject AS nvarchar(1000)) AS subject,
                PI.currentState AS ps, CONVERT(varchar(19), PI.createdTime, 126) AS createdTime
         FROM dbo.ProcessInstance AS PI WHERE ${where}
         ORDER BY PI.createdTime DESC, PI.OID OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      );
    const sets = r.recordsets as unknown as [
      { total: number }[],
      {
        poid: string;
        coid: string;
        serialNumber: string | null;
        processName: string | null;
        subject: string | null;
        ps: number | null;
        createdTime: string | null;
      }[],
    ];
    return {
      total: sets[0][0]?.total ?? 0,
      rows: sets[1].map((x) => ({
        processOid: x.poid,
        contextOid: x.coid,
        serialNumber: x.serialNumber,
        processName: x.processName,
        subject: x.subject,
        processState: x.ps,
        createdAt: twTime(x.createdTime),
      })),
    };
  }

  async openActivities(contextOids: string[]): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    if (!contextOids.length) return result;
    const pool = await this.ready();
    const req = pool.request();
    const marks = contextOids.map((oid, i) => {
      req.input(`c${i}`, sql.VarChar(64), oid);
      return `@c${i}`;
    });
    const r = await req.query<{ coid: string; name: string | null }>(
      `SELECT RTRIM(contextOID) AS coid, CAST(workItemName AS nvarchar(255)) AS name FROM dbo.WorkItem
       WHERE contextOID IN (${marks.join(', ')}) AND currentState IN (${TODO_STATES.join(', ')})`,
    );
    for (const x of r.recordset) {
      if (!x.name) continue;
      const names = result.get(x.coid) ?? [];
      if (!names.includes(x.name)) names.push(x.name);
      result.set(x.coid, names);
    }
    return result;
  }

  async close(): Promise<void> {
    await this.pool.close();
  }
}
