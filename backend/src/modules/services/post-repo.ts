/** 中華郵政寄件登記資料存取(modules/services/post.ts):MisDb SendMailLog(寫入)、LOS EmployeeInfo(在職寄件人) */
import sql from 'mssql';
import type { Sources } from '../../db/sources.js';
import { likeEscape } from '../home/legacy-repo.js';
import type { PostInput, PostItem, PostRepo, PostWriteResult, Sender } from './post.js';

type Row = {
  SN: number;
  SenderID: string | null;
  SenderName: string | null;
  d: string | null;
  Dept: string | null;
  Receiver: string | null;
  MailAreaNo: string | null;
  MailType: string | null;
  CallMailNo: string | null;
  MailMoney: string | null;
  MailReturnMoney: string | null;
};
const t = (s: string | null) => s?.trim() || null;

export class MssqlPostRepo implements PostRepo {
  constructor(
    private readonly pool: sql.ConnectionPool,
    private readonly src: Sources,
  ) {}

  private get log() {
    return this.src.table('MisDb', 'SendMailLog');
  }
  private get emp() {
    return this.src.table('LOS', 'EmployeeInfo');
  }

  async list(empNo: string, from: string, to: string): Promise<PostItem[]> {
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(40), empNo)
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
      .query<Row>(
        `SELECT SN, SenderID, SenderName, CONVERT(char(10), SendDate, 23) AS d, Dept, Receiver, MailAreaNo, MailType, CallMailNo, MailMoney, MailReturnMoney
         FROM ${this.log} WHERE UPPER(LTRIM(RTRIM(SenderID))) = @emp AND IsActive = 1 AND SendDate BETWEEN @from AND @to ORDER BY SendDate DESC, SN DESC`,
      );
    return r.recordset.map((x) => ({
      sn: x.SN,
      senderId: (x.SenderID ?? '').trim().toUpperCase(),
      senderName: t(x.SenderName),
      sendDate: x.d,
      dept: t(x.Dept),
      receiver: t(x.Receiver),
      zip: t(x.MailAreaNo),
      mailType: t(x.MailType),
      callMailNo: t(x.CallMailNo),
      mailMoney: t(x.MailMoney),
      mailReturnMoney: t(x.MailReturnMoney),
      locked: !!t(x.MailMoney),
    }));
  }

  async activeEmployee(empNo: string): Promise<Sender | null> {
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(20), empNo)
      .query<{ UserID: string; UserName: string | null; EFDept: string | null }>(
        `SELECT TOP 1 UserID, UserName, EFDept FROM ${this.emp} WHERE UPPER(LTRIM(RTRIM(UserID))) = @emp AND LeaveDate IS NULL`,
      );
    const x = r.recordset[0];
    return x ? { empNo: x.UserID.trim().toUpperCase(), name: x.UserName?.trim() || x.UserID.trim(), dept: t(x.EFDept) } : null;
  }

  async searchEmployees(q: string, limit: number): Promise<Sender[]> {
    const r = await this.pool
      .request()
      .input('id', sql.NVarChar(40), `${likeEscape(q.toUpperCase())}%`)
      .input('name', sql.NVarChar(100), `%${likeEscape(q)}%`)
      .input('lim', sql.Int, limit)
      .query<{ UserID: string; UserName: string | null; EFDept: string | null }>(
        `SELECT TOP (@lim) UserID, UserName, EFDept FROM ${this.emp}
         WHERE LeaveDate IS NULL AND (UPPER(UserID) LIKE @id OR UserName LIKE @name) ORDER BY UserID`,
      );
    return r.recordset.map((x) => ({ empNo: x.UserID.trim().toUpperCase(), name: x.UserName?.trim() || x.UserID.trim(), dept: t(x.EFDept) }));
  }

  private bind(req: sql.Request, i: PostInput & { senderName: string }): sql.Request {
    return req
      .input('sid', sql.NVarChar(40), i.senderId)
      .input('sname', sql.NVarChar(40), i.senderName.slice(0, 40))
      .input('date', sql.Date, i.sendDate)
      .input('dept', sql.NVarChar(20), i.dept)
      .input('rcv', sql.NVarChar(100), i.receiver)
      .input('zip', sql.NVarChar(20), i.zip)
      .input('type', sql.NVarChar(10), i.mailType);
  }

  async create(i: PostInput & { senderName: string }): Promise<number> {
    const r = await this.bind(this.pool.request(), i).query<{ sn: number }>(
      `INSERT INTO ${this.log} (SenderID, SenderName, SendDate, Dept, Receiver, MailAreaNo, MailType, IsActive) OUTPUT INSERTED.SN AS sn
       VALUES (@sid, @sname, @date, @dept, @rcv, @zip, @type, 1)`,
    );
    return r.recordset[0]!.sn;
  }

  private async guarded(sn: number, owner: string, write: (tx: sql.Transaction) => Promise<void>): Promise<PostWriteResult> {
    const tx = new sql.Transaction(this.pool);
    await tx.begin();
    try {
      const r = await new sql.Request(tx)
        .input('sn', sql.Int, sn)
        .query<{ SenderID: string | null; MailMoney: string | null; IsActive: boolean | null }>(
          `SELECT SenderID, MailMoney, IsActive FROM ${this.log} WITH (UPDLOCK, HOLDLOCK) WHERE SN = @sn`,
        );
      const row = r.recordset[0];
      let result: PostWriteResult = 'ok';
      if (!row || row.IsActive !== true) result = 'not-found';
      else if ((row.SenderID ?? '').trim().toUpperCase() !== owner) result = 'forbidden';
      else if (t(row.MailMoney)) result = 'locked';
      if (result === 'ok') await write(tx);
      await tx.commit();
      return result;
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }

  async update(sn: number, owner: string, i: PostInput & { senderName: string }): Promise<PostWriteResult> {
    return this.guarded(sn, owner, async (tx) => {
      await this.bind(new sql.Request(tx), i)
        .input('sn', sql.Int, sn)
        .query(
          `UPDATE ${this.log} SET SenderID = @sid, SenderName = @sname, SendDate = @date, Dept = @dept, Receiver = @rcv, MailType = @type, MailAreaNo = @zip WHERE SN = @sn`,
        );
    });
  }

  async void(sn: number, owner: string): Promise<PostWriteResult> {
    return this.guarded(sn, owner, async (tx) => {
      await new sql.Request(tx).input('sn', sql.Int, sn).query(`UPDATE ${this.log} SET IsActive = 0 WHERE SN = @sn`);
    });
  }
}
