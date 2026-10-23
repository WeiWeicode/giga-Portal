/** ESH 新表的 SQL Server 存取(Drizzle;schema portal 的 esh_license_logo、esh_license_doc、esh_chemical_sds、esh_job_run、esh_notify_log) */
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import type { PortalDatabase } from '../../db/client.js';
import { eshChemicalSds, eshJobRun, eshLicenseDoc, eshLicenseLogo, eshNotifyLog, utcNow } from '../../db/schema.js';
import type { ChemicalSdsRepo } from './chemical.js';
import type { EshJobRepo, JobName, JobRun, NotifyLogEntry } from './notify.js';
import type { EshFileRepo, FileRef, HolderDoc } from './types.js';

const isDuplicateKey = (err: unknown) => {
  const e = err as { number?: number; cause?: { number?: number } };
  return [2601, 2627].includes(e.number ?? e.cause?.number ?? 0);
};

const toRun = (r: typeof eshJobRun.$inferSelect): JobRun => ({
  id: r.id,
  job: r.job as JobRun['job'],
  trigger: r.trigger as JobRun['trigger'],
  runKey: r.runKey,
  requestedBy: r.requestedBy,
  scope: r.scope,
  status: r.status as JobRun['status'],
  summary: r.summary,
  startedAt: r.startedAt.toISOString(),
  finishedAt: r.finishedAt?.toISOString() ?? null,
});

export class DrizzleEshRepo implements EshFileRepo, ChemicalSdsRepo, EshJobRepo {
  constructor(private readonly db: PortalDatabase) {}

  // ───── Logo / 證照影本 ─────
  async logos(licenseIds: number[]): Promise<Map<number, FileRef>> {
    if (!licenseIds.length) return new Map();
    const rows = await this.db
      .select()
      .from(eshLicenseLogo)
      .where(inArray(eshLicenseLogo.licenseId, licenseIds.slice(0, 2000)));
    return new Map(rows.map((r) => [r.licenseId, { fileId: r.fileId, fileName: r.fileName }]));
  }

  async setLogo(licenseId: number, file: FileRef, byEmp: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(eshLicenseLogo).where(eq(eshLicenseLogo.licenseId, licenseId));
      await tx.insert(eshLicenseLogo).values({ licenseId, fileId: file.fileId, fileName: file.fileName, updatedBy: byEmp });
    });
  }

  async deleteLogo(licenseId: number): Promise<boolean> {
    return (await this.db.delete(eshLicenseLogo).output({ id: eshLicenseLogo.licenseId }).where(eq(eshLicenseLogo.licenseId, licenseId))).length > 0;
  }

  async docs(holderIds: number[]): Promise<HolderDoc[]> {
    const out: HolderDoc[] = [];
    for (let i = 0; i < holderIds.length; i += 1000) {
      const rows = await this.db
        .select()
        .from(eshLicenseDoc)
        .where(inArray(eshLicenseDoc.holderId, holderIds.slice(i, i + 1000)))
        .orderBy(eshLicenseDoc.holderId, eshLicenseDoc.id);
      for (const r of rows) out.push({ id: r.id, holderId: r.holderId, fileId: r.fileId, fileName: r.fileName, createdAt: r.createdAt.toISOString() });
    }
    return out;
  }

  async addDoc(holderId: number, empNo: string, file: FileRef, byEmp: string): Promise<HolderDoc> {
    const [r] = await this.db.insert(eshLicenseDoc).output().values({ holderId, empNo, fileId: file.fileId, fileName: file.fileName, createdBy: byEmp });
    return { id: r!.id, holderId: r!.holderId, fileId: r!.fileId, fileName: r!.fileName, createdAt: r!.createdAt.toISOString() };
  }

  async deleteDoc(holderId: number, docId: number): Promise<boolean> {
    const r = await this.db
      .delete(eshLicenseDoc)
      .output({ id: eshLicenseDoc.id })
      .where(and(eq(eshLicenseDoc.id, docId), eq(eshLicenseDoc.holderId, holderId)));
    return r.length > 0;
  }

  // ───── SDS ─────
  async sds(efIds: string[]): Promise<Map<string, FileRef>> {
    if (!efIds.length) return new Map();
    const rows = await this.db
      .select()
      .from(eshChemicalSds)
      .where(inArray(eshChemicalSds.efId, efIds.slice(0, 2000)));
    return new Map(rows.map((r) => [r.efId, { fileId: r.fileId, fileName: r.fileName }]));
  }

  async setSds(efId: string, file: FileRef, byEmp: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(eshChemicalSds).where(eq(eshChemicalSds.efId, efId));
      await tx.insert(eshChemicalSds).values({ efId, fileId: file.fileId, fileName: file.fileName, updatedBy: byEmp });
    });
  }

  async deleteSds(efId: string): Promise<boolean> {
    return (await this.db.delete(eshChemicalSds).output({ id: eshChemicalSds.efId }).where(eq(eshChemicalSds.efId, efId))).length > 0;
  }

  // ───── 工作紀錄 ─────
  async start(run: { job: JobName; trigger: JobRun['trigger']; runKey: string; requestedBy: string | null; scope: string }): Promise<number | null> {
    try {
      const [r] = await this.db
        .insert(eshJobRun)
        .output({ id: eshJobRun.id })
        .values({ ...run, scope: run.scope.slice(0, 500), status: 'running' });
      return r!.id;
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      // 同一期上次執行失敗:改回執行中並重跑(資安審查 L6);其他狀態視為已執行
      const [r] = await this.db
        .update(eshJobRun)
        .set({ status: 'running', summary: null, finishedAt: null, startedAt: utcNow, requestedBy: run.requestedBy })
        .output()
        .where(and(eq(eshJobRun.runKey, run.runKey), eq(eshJobRun.status, 'failed')));
      return r?.id ?? null;
    }
  }

  async finish(id: number, status: 'ok' | 'failed', summary: string): Promise<void> {
    await this.db
      .update(eshJobRun)
      .set({ status, summary: summary.slice(0, 500), finishedAt: utcNow })
      .where(eq(eshJobRun.id, id));
  }

  async addLogs(entries: NotifyLogEntry[]): Promise<void> {
    for (let i = 0; i < entries.length; i += 100)
      await this.db.insert(eshNotifyLog).values(entries.slice(i, i + 100).map((e) => ({ ...e, message: e.message?.slice(0, 200) ?? null })));
  }

  async recentRuns(job: JobName, limit: number): Promise<JobRun[]> {
    const rows = await this.db
      .select()
      .from(eshJobRun)
      .where(eq(eshJobRun.job, job))
      .orderBy(desc(eshJobRun.startedAt), desc(eshJobRun.id))
      .offset(0)
      .fetch(limit);
    return rows.map(toRun);
  }

  async manualRunsSince(job: JobName, since: Date): Promise<JobRun[]> {
    const rows = await this.db
      .select()
      .from(eshJobRun)
      .where(and(eq(eshJobRun.job, job), eq(eshJobRun.trigger, 'manual'), gte(eshJobRun.startedAt, since)));
    return rows.map(toRun);
  }

  async logs(runId: number): Promise<(NotifyLogEntry & { createdAt: string })[]> {
    const rows = await this.db.select().from(eshNotifyLog).where(eq(eshNotifyLog.runId, runId)).orderBy(eshNotifyLog.id);
    return rows.map((r) => ({
      runId: r.runId,
      kind: r.kind as NotifyLogEntry['kind'],
      empNo: r.empNo,
      company: r.company,
      itemCount: r.itemCount,
      status: r.status as NotifyLogEntry['status'],
      message: r.message,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
