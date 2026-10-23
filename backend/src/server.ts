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
import { ContentService } from './modules/home/content.js';
import { DashboardService } from './modules/home/dashboard.js';
import { DrizzleContentRepo } from './modules/home/drizzle-repo.js';
import { MssqlHomeLegacyRepo } from './modules/home/legacy-repo.js';
import { DrizzleLinkRepo } from './modules/links/drizzle-repo.js';
import { LinkService } from './modules/links/links.js';
import { AuthorCipher } from './modules/talk/author-cipher.js';
import { MssqlTalkRepo } from './modules/talk/repo.js';
import { TalkService } from './modules/talk/talk.js';
import { DrizzleFormRepo } from './modules/forms/drizzle-repo.js';
import { FormService } from './modules/forms/forms.js';
import { BudgetService } from './modules/manager/budget.js';
import { MssqlBudgetRepo } from './modules/manager/budget-repo.js';
import { MssqlDeptSource, ScopeService } from './modules/manager/scope.js';
import { ManagerStaffService, MssqlStaffRepo } from './modules/manager/staff.js';
import { MssqlTrainingRepo } from './modules/manager/training-repo.js';
import { TrainingService } from './modules/manager/training.js';
import { EshChemicalService } from './modules/esh/chemical.js';
import { MssqlChemicalRepo, NanaChemicalSource } from './modules/esh/chemical-repo.js';
import { DrizzleEshRepo } from './modules/esh/drizzle-repo.js';
import { EshLicenseService } from './modules/esh/license.js';
import { DryRunMailer, EshNotifyService, GatewayNotifyMailer } from './modules/esh/notify.js';
import { MssqlEshRepo } from './modules/esh/repo.js';
import { dailyAt, EshScheduler, weeklyAt } from './modules/esh/scheduler.js';

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
// 測試區開啟 SQL 2012 語法檢查(正式區不檢查,避免額外負擔)
const db = createDb(pool, config.gateway.gwEnv !== 'prod');
const bpm = bpmRepo && config.bpm ? new BpmService(bpmRepo, config.bpm.webUrl, config.bpmCompanies) : null;
const notes = new NoteService(new DrizzleNoteRepo(db));
const onboarding = new MssqlOnboardingRepo(pool, config.sources);
const qa = new QaService(new MssqlQaRepo(pool, config.sources));
const content = new ContentService(new DrizzleContentRepo(db));
const links = new LinkService(new DrizzleLinkRepo(db));
const homeLegacy = new MssqlHomeLegacyRepo(pool, config.sources, config.legacyPortalUrl);
// 3691 作者金鑰只從 secret 讀(D-23);未設定時可瀏覽、不能發文 / 解碼
const talkCipher = config.talkKeys ? new AuthorCipher(config.talkKeys.current, config.talkKeys.old) : null;
// P5 主管專區:部門範圍(Token 部門含下層,LOS 部門樹快取)
const scopes = new ScopeService(new MssqlDeptSource(pool, config.sources));
// P6 ESH:寄送預設 dry-run(只寫紀錄);gateway 模式才呼叫 Gateway 通知中心(10/26 前不寄信)
const eshRepo = new MssqlEshRepo(pool, config.sources);
const eshFiles = new DrizzleEshRepo(db);
const eshLicense = new EshLicenseService(eshRepo, eshFiles, config.legacyPortalUrl);
const eshMailer = config.esh.notifyMode === 'gateway' ? new GatewayNotifyMailer(config.gateway.gatewayUrl!, config.gateway.apiKey!) : new DryRunMailer();
const eshNotify = new EshNotifyService(eshRepo, eshFiles, eshMailer, eshLicense);
const chemicalSource = config.bpm ? new NanaChemicalSource(config.bpm.sql) : null;
const eshChemical = new EshChemicalService(new MssqlChemicalRepo(pool, config.sources), eshFiles, chemicalSource, eshFiles, {
  sdsBaseUrl: config.esh.sdsBaseUrl,
  legacyPortalUrl: config.legacyPortalUrl,
  syncMonths: config.esh.chemicalSyncMonths,
});
const app = await buildApp({
  config,
  courses: new MssqlCourseRepo(pool, config.sources),
  commute: new CommuteService(new MssqlCommuteRepo(pool, config.sources), geocoder),
  notes,
  assets: new MssqlAssetNoteRepo(pool, config.sources),
  bpm,
  directory: new MssqlDirectoryRepo(pool, config.sources),
  jobs: new MssqlJobRepo(pool, config.sources),
  onboarding,
  // 職級快速帶入待 Gateway 提供職級查詢介面(CONFIRM-NEEDED P2-2b),目前回 503
  qa,
  dashboard: new DashboardService({ bpm, qa, onboarding, hireDates: homeLegacy, notes, links, news: homeLegacy, content }),
  content,
  legacyNews: homeLegacy,
  links,
  talk: new TalkService(new MssqlTalkRepo(pool, config.sources), talkCipher),
  forms: new FormService(new DrizzleFormRepo(db)),
  manager: {
    scopes,
    staff: new ManagerStaffService(new MssqlStaffRepo(pool, config.sources), scopes),
    training: new TrainingService(new MssqlTrainingRepo(pool, config.sources), scopes),
    budget: new BudgetService(new MssqlBudgetRepo(pool, config.sources), config.budget),
  },
  esh: { license: eshLicense, notify: eshNotify, chemical: eshChemical },
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
// ESH 排程(程序內;run_key 唯一保證同一期只執行一次)
const eshScheduler = config.esh.schedule
  ? new EshScheduler(
      [
        { name: 'esh-notify', due: weeklyAt(config.esh.notifyWeekday, config.esh.notifyHour), run: () => eshNotify.runScheduled() },
        ...(chemicalSource ? [{ name: 'esh-chemical-sync', due: dailyAt(config.esh.chemicalSyncHour), run: () => eshChemical.syncScheduled() }] : []),
      ],
      app.log,
    )
  : null;
eshScheduler?.start();
app.log.info(
  {
    gwEnv: config.gateway.gwEnv,
    serviceCode: config.gateway.serviceCode,
    sourceMode: config.sourceMode,
    monitor: config.monitor.enabled,
    geocode: geocoder !== null,
    bpm: config.bpm?.sql.server ?? null,
    bpmCompanies: config.bpmCompanies,
    talkKey: config.talkKeys?.current.id ?? null,
    legacyPortalUrl: config.legacyPortalUrl,
    esh: { notifyMode: config.esh.notifyMode, schedule: config.esh.schedule },
  },
  '服務已啟動',
);

for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    // close 會一併送出監控緩衝(最多等 3 秒)
    eshScheduler?.stop();
    void app
      .close()
      .then(() => Promise.all([pool.close(), bpmRepo?.close(), chemicalSource?.close()]))
      .then(() => process.exit(0));
  });
