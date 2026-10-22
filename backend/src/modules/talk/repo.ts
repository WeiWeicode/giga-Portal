/**
 * 3691 的 SQL Server 存取:舊表 PortalSolar Talk3691Data / Talk3691Like(來源前綴 + 參數化,D-7)與
 * portal.talk_author / portal.talk_audit(連線庫本身)。發文與屏蔽跨舊表與 portal 表,同一連線池、同一交易
 * (測試區皆在 giganexus_gw_test;正式區 PortalSolar 與 giganexus_gw 同在 220 執行個體,跨庫交易不需 DTC)。
 * portal 表的結構由 Drizzle migration 管理(db/schema.ts),這裡為了與舊表同交易改以 mssql 直接存取。
 */
import sql from 'mssql';
import type { Sources } from '../../db/sources.js';
import type { NewPost, RevealResult, TalkRepo, TalkRow } from './talk.js';

type Row = {
  sn: number;
  parentSn: number | null;
  type: string | null;
  title: string | null;
  content: string | null;
  createdAt: string | null;
  blocked: boolean | null;
  likes: number;
};

const toRow = (r: Row): TalkRow => ({
  sn: r.sn,
  parentSn: r.parentSn,
  type: r.type ?? '',
  title: r.title ?? '',
  content: r.content ?? '',
  createdAt: r.createdAt,
  blocked: r.blocked === true,
  likes: r.likes,
});

/** 列表上限(舊表約 300 則;避免異常資料量拖垮回應) */
export const LIST_LIMIT = 2000;

export class MssqlTalkRepo implements TalkRepo {
  constructor(
    private readonly pool: sql.ConnectionPool,
    private readonly src: Sources,
  ) {}

  private get data() {
    return this.src.table('PortalSolar', 'Talk3691Data');
  }
  private get likes() {
    return this.src.table('PortalSolar', 'Talk3691Like');
  }

  private select(where: string) {
    return `SELECT TOP (${LIST_LIMIT}) T.SN AS sn, T.ParentSN AS parentSn, T.TalkType AS type, T.Title AS title, T.TextContent AS content,
              CONVERT(char(19), T.CreateTime, 120) AS createdAt, T.IsBlack AS blocked, ISNULL(L.n, 0) AS likes
            FROM ${this.data} T
            LEFT JOIN (SELECT SN, COUNT(UserID) AS n FROM ${this.likes} GROUP BY SN) L ON L.SN = T.SN
            WHERE ${where}
            ORDER BY T.CreateTime DESC, T.SN DESC`;
  }

  async list(type: string | null): Promise<TalkRow[]> {
    const req = this.pool.request();
    if (type !== null) req.input('type', sql.NVarChar(20), type);
    const r = await req.query<Row>(this.select(type === null ? '1 = 1' : 'T.TalkType = @type'));
    return r.recordset.map(toRow);
  }

  async get(sn: number): Promise<TalkRow | null> {
    const r = await this.pool.request().input('sn', sql.Int, sn).query<Row>(this.select('T.SN = @sn'));
    return r.recordset[0] ? toRow(r.recordset[0]) : null;
  }

  async likedBy(empNo: string): Promise<Set<number>> {
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(10), empNo)
      .query<{ sn: number }>(`SELECT DISTINCT SN AS sn FROM ${this.likes} WHERE UserID = @emp AND SN IS NOT NULL`);
    return new Set(r.recordset.map((x) => x.sn));
  }

  async create(post: NewPost, sealAuthor: (sn: number) => { cipher: string; keyId: string }): Promise<number> {
    const tx = new sql.Transaction(this.pool);
    await tx.begin();
    try {
      // CreateTime 寫伺服器當地時間(同舊表既有資料);IsBlack 明確寫 0;mark 留 NULL(作者只存 portal.talk_author)
      const ins = await tx
        .request()
        .input('parent', sql.Int, post.parentSn)
        .input('title', sql.NVarChar(300), post.title)
        .input('content', sql.NVarChar(sql.MAX), post.content)
        .input('type', sql.NVarChar(20), post.type)
        .query<{ sn: number }>(
          `INSERT INTO ${this.data} (ParentSN, Title, TextContent, TalkType, CreateTime, IsBlack)
           OUTPUT INSERTED.SN AS sn
           VALUES (@parent, @title, @content, @type, GETDATE(), 0)`,
        );
      const sn = ins.recordset[0]!.sn;
      const sealed = sealAuthor(sn);
      await tx
        .request()
        .input('sn', sql.Int, sn)
        .input('cipher', sql.VarChar(200), sealed.cipher)
        .input('kid', sql.VarChar(20), sealed.keyId)
        .query(`INSERT INTO [portal].[talk_author] (sn, cipher, key_id) VALUES (@sn, @cipher, @kid)`);
      await tx.commit();
      return sn;
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }

  async like(sn: number, empNo: string): Promise<boolean> {
    // 每人每則一次(同舊版);以 UPDLOCK / HOLDLOCK 避免同時按兩次寫兩筆
    const r = await this.pool
      .request()
      .input('sn', sql.Int, sn)
      .input('emp', sql.NVarChar(10), empNo)
      .query(
        `INSERT INTO ${this.likes} (UserID, SN, CreateDate)
         SELECT @emp, @sn, GETDATE()
         WHERE NOT EXISTS (SELECT 1 FROM ${this.likes} WITH (UPDLOCK, HOLDLOCK) WHERE UserID = @emp AND SN = @sn)`,
      );
    return (r.rowsAffected[0] ?? 0) > 0;
  }

  async setBlocked(sn: number, blocked: boolean, byEmp: string): Promise<void> {
    const tx = new sql.Transaction(this.pool);
    await tx.begin();
    try {
      await tx
        .request()
        .input('sn', sql.Int, sn)
        .input('b', sql.Bit, blocked)
        .input('emp', sql.NVarChar(20), byEmp)
        .input('act', sql.VarChar(10), blocked ? 'block' : 'unblock')
        .query(
          `UPDATE ${this.data} SET IsBlack = @b WHERE SN = @sn;
           INSERT INTO [portal].[talk_audit] (sn, action, emp_no) VALUES (@sn, @act, @emp);`,
        );
      await tx.commit();
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }

  async author(sn: number): Promise<{ cipher: string; keyId: string } | null> {
    const r = await this.pool
      .request()
      .input('sn', sql.Int, sn)
      .query<{ cipher: string; keyId: string }>(`SELECT cipher, key_id AS keyId FROM [portal].[talk_author] WHERE sn = @sn`);
    return r.recordset[0] ?? null;
  }

  async hasLegacyMark(sn: number): Promise<boolean> {
    const r = await this.pool
      .request()
      .input('sn', sql.Int, sn)
      .query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${this.data} WHERE SN = @sn AND mark IS NOT NULL AND mark <> N''`);
    return r.recordset[0]!.n > 0;
  }

  async auditReveal(sn: number, byEmp: string, approvalNo: string, reason: string | null, result: RevealResult): Promise<void> {
    await this.pool
      .request()
      .input('sn', sql.Int, sn)
      .input('emp', sql.NVarChar(20), byEmp)
      .input('no', sql.NVarChar(50), approvalNo)
      .input('reason', sql.NVarChar(200), reason)
      .input('result', sql.VarChar(10), result)
      .query(`INSERT INTO [portal].[talk_audit] (sn, action, result, emp_no, approval_no, reason) VALUES (@sn, 'reveal', @result, @emp, @no, @reason)`);
  }
}
