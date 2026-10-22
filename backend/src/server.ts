/**
 * 啟動:連 SQL Server(giganexus_gw[_test],帳號 portal_app),開始服務後由 setupGateway 依部署區在背景自動註冊 API
 * (dev 不註冊,test / prod 寫入 Gateway 草稿)。舊庫來源不可讀時仍啟動,由 /readyz 與監控心跳回報。
 */
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb, openPool, probeSources } from './db/client.js';
import { CommuteService } from './modules/commute/commute.js';
import { MssqlCommuteRepo } from './modules/commute/repo.js';
import { MssqlCourseRepo } from './modules/courses/repo.js';
import { BpmService } from './modules/bpm/bpm.js';
import { NanaBpmRepo } from './modules/bpm/nana-repo.js';
import { GoogleGeocoder } from './modules/geocode.js';
import { DrizzleNoteRepo } from './modules/notes/drizzle-repo.js';
import { NoteService } from './modules/notes/notes.js';
import { MssqlAssetNoteRepo } from './routes/assets.js';
import { MssqlDirectoryRepo } from './routes/directory.js';
import { MssqlJobRepo } from './routes/jobs.js';
import { MssqlOnboardingRepo } from './routes/onboarding.js';
import { QaService } from './modules/qa/qa.js';
import { MssqlQaRepo } from './modules/qa/repo.js';

const config = loadConfig();
const pool = await openPool(config.sql, { appName: 'giganexus-portal-api' });

type Check = { name: string; ok: boolean; latencyMs: number | null; message?: string };

/** SQL Server 本身(監控心跳只用這個,不探測舊庫來源) */
async function sqlCheck(): Promise<Check> {
  const t0 = performance.now();
  try {
    await pool.request().query('SELECT 1');
    return { name: 'sql', ok: true, latencyMs: Math.round(performance.now() - t0) };
  } catch (err) {
    return { name: 'sql', ok: false, latencyMs: null, message: (err as Error).message };
  }
}

/** 就緒檢查:SQL Server 與每個舊庫來源 */
async function checks(): Promise<Check[]> {
  const sql = await sqlCheck();
  if (!sql.ok) return [sql];
  const sources = (await probeSources(pool, config.sources)).map(([key, error]) => ({
    name: `src:${key}`,
    ok: error === null,
    latencyMs: null,
    ...(error ? { message: error } : {}),
  }));
  return [sql, ...sources];
}

// BPM NaNa 連線延遲到第一次查詢,連不上不影響啟動
const bpmRepo = config.bpm ? new NanaBpmRepo(config.bpm.sql) : null;
const geocoder = config.googleMapsApiKey ? new GoogleGeocoder(config.googleMapsApiKey) : null;
const app = await buildApp({
  config,
  courses: new MssqlCourseRepo(pool, config.sources),
  commute: new CommuteService(new MssqlCommuteRepo(pool, config.sources), geocoder),
  // 測試區開啟 SQL 2012 語法檢查(正式區不檢查,避免額外負擔)
  notes: new NoteService(new DrizzleNoteRepo(createDb(pool, config.gateway.gwEnv !== 'prod'))),
  assets: new MssqlAssetNoteRepo(pool, config.sources),
  bpm: bpmRepo && config.bpm ? new BpmService(bpmRepo, config.bpm.webUrl) : null,
  directory: new MssqlDirectoryRepo(pool, config.sources),
  jobs: new MssqlJobRepo(pool, config.sources),
  onboarding: new MssqlOnboardingRepo(pool, config.sources),
  // 職級快速帶入待 Gateway 提供職級查詢介面(CONFIRM-NEEDED P2-2b),目前回 503
  qa: new QaService(new MssqlQaRepo(pool, config.sources)),
  readiness: async () => {
    const c = await checks();
    return { ok: c.every((x) => x.ok), checks: Object.fromEntries(c.map((x) => [x.name, x.ok ? 'ok' : `error: ${x.message}`])) };
  },
  // 監控心跳只回報 SQL 本身;各來源狀態看 /readyz
  deps: async () => {
    const { name, ok, latencyMs } = await sqlCheck();
    return [{ name, ok, latencyMs }];
  },
});
await app.listen({ host: config.host, port: config.port });
app.log.info(
  {
    gwEnv: config.gateway.gwEnv,
    serviceCode: config.gateway.serviceCode,
    sourceMode: config.sourceMode,
    monitor: config.monitor.enabled,
    geocode: geocoder !== null,
    bpm: config.bpm?.sql.server ?? null,
  },
  '服務已啟動',
);

for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    // close 會一併送出監控緩衝(最多等 3 秒)
    void app
      .close()
      .then(() => Promise.all([pool.close(), bpmRepo?.close()]))
      .then(() => process.exit(0));
  });
