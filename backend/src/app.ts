/**
 * Fastify 應用程式(結構沿用 Gateway samples/node-backend 與 giga-file-service file-api):
 *   - 只認 X-Internal-Token(ES256、iss=giganexus-bff、aud=portal-api;BACKEND-GUIDE.md §4.2),身分放在 req.identity
 *   - dev 可設 DEV_SKIP_TOKEN=1 不驗證(本機直連);test / prod 設定即啟動失敗(config.ts)
 *   - 錯誤格式 { code, message, requestId, details? }(§5.3);GET /healthz、/readyz、/openapi.json
 *   - setupGateway:API 監控送 giga-observe、test / prod 開始服務後自動註冊 OpenAPI 草稿(§7.5)
 */
import swagger from '@fastify/swagger';
import { createTokenVerifier, errorBody, INTERNAL_TOKEN_HEADER, type DepStatus, type GatewayIdentity } from '@giganexus/backend-sdk';
import { setupGateway } from '@giganexus/backend-sdk/fastify';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.js';
import { AppError } from './errors.js';
import { swaggerOptions } from './openapi.js';
import type { CommuteService } from './modules/commute/commute.js';
import type { CourseRepo } from './modules/courses/repo.js';
import type { NoteService } from './modules/notes/notes.js';
import { assetRoutes, type AssetNoteRepo } from './routes/assets.js';
import { commuteRoutes } from './routes/commute.js';
import { courseRoutes } from './routes/courses.js';
import { meRoutes } from './routes/me.js';
import { noteRoutes } from './routes/notes.js';

declare module 'fastify' {
  interface FastifyRequest {
    identity: GatewayIdentity | null;
  }
  interface FastifyContextConfig {
    /** false:不驗證 Token(健康檢查、OpenAPI) */
    gatewayAuth?: boolean;
  }
}

/** DEV_SKIP_TOKEN 時的身分(只在 dev);工號可用 DEV_EMP 指定,方便本機以自己的資料測試 */
const devIdentity = (): GatewayIdentity => ({ sub: 'dev', emp: process.env.DEV_EMP || 'dev', name: '本機開發', cos: ['dev'], roles: ['dev'] });

export interface AppOptions {
  config: Pick<Config, 'gateway' | 'monitor' | 'logLevel' | 'devSkipToken'>;
  /** 就緒檢查:SQL Server 與各舊庫來源 */
  readiness?: () => Promise<{ ok: boolean; checks: Record<string, string> }>;
  deps?: () => Promise<DepStatus[]>;
  /** 各功能的資料存取;未提供(輸出 OpenAPI、單元測試未用到)時該 API 回 503 */
  courses?: CourseRepo | null;
  commute?: CommuteService | null;
  notes?: NoteService | null;
  assets?: AssetNoteRepo | null;
}

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const { config } = opts;
  const app = Fastify({
    logger: { level: config.logLevel, redact: ['req.headers["x-internal-token"]'] },
    // 沿用 Gateway 傳下來的 X-Request-Id,寫入每一筆日誌(§5.2)
    requestIdHeader: 'x-request-id',
  });
  const verify = createTokenVerifier({ jwksUrl: config.gateway.jwksUrl!, audience: config.gateway.serviceCode });

  await app.register(swagger, swaggerOptions(config.gateway.serviceCode, config.gateway.project));
  await app.register(setupGateway, {
    env: config.gateway,
    monitor: config.monitor,
    version: process.env.npm_package_version,
    monitorOptions: { deps: opts.deps ?? null },
  });

  app.decorateRequest('identity', null);
  app.addHook('onRequest', async (req) => {
    if (!req.routeOptions.url || req.routeOptions.config.gatewayAuth === false) return;
    if (config.devSkipToken) {
      req.identity = devIdentity();
      return;
    }
    const token = req.headers[INTERNAL_TOKEN_HEADER];
    if (typeof token !== 'string' || !token) throw new AppError(401, 'PORTAL_INTERNAL_TOKEN_INVALID', '缺少內部 Token');
    try {
      req.identity = await verify(token);
    } catch {
      // 只有 Token 驗證失敗才回 401;Gateway 收到會視為設定錯誤並告警(§5.3)
      throw new AppError(401, 'PORTAL_INTERNAL_TOKEN_INVALID', '內部 Token 無效');
    }
  });

  app.addHook('onSend', async (_req, reply) => {
    reply.removeHeader('x-powered-by');
    reply.header('x-content-type-options', 'nosniff');
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) return reply.status(err.status).send(errorBody(err.code, err.message, req.id, err.details));
    const e = err as { validation?: { instancePath: string; message?: string }[]; statusCode?: number };
    if (e.validation)
      return reply.status(400).send(
        errorBody(
          'VALIDATION_FAILED',
          '參數驗證失敗',
          req.id,
          e.validation.map((v) => ({ field: v.instancePath.replace(/^\//, '') || '(body)', message: v.message ?? '' })),
        ),
      );
    if (e.statusCode && e.statusCode < 500) return reply.status(e.statusCode).send(errorBody('VALIDATION_FAILED', '請求格式錯誤', req.id));
    req.log.error({ err }, '非預期錯誤');
    return reply.status(500).send(errorBody('INTERNAL_ERROR', '系統發生錯誤', req.id));
  });
  app.setNotFoundHandler((req, reply) => reply.status(404).send(errorBody('PORTAL_API_NOT_FOUND', '找不到此 API', req.id)));

  const noAuth = { config: { gatewayAuth: false }, schema: { hide: true } };
  app.get('/healthz', noAuth, async () => ({ status: 'ok' }));
  app.get('/readyz', noAuth, async (_req, reply) => {
    if (!opts.readiness) return { status: 'ok' };
    const r = await opts.readiness();
    return reply.status(r.ok ? 200 : 503).send({ status: r.ok ? 'ok' : 'unavailable', checks: r.checks });
  });
  app.get('/openapi.json', noAuth, async () => app.swagger());

  await app.register(meRoutes);
  await app.register(courseRoutes(opts.courses ?? null));
  await app.register(commuteRoutes(opts.commute ?? null));
  await app.register(noteRoutes(opts.notes ?? null));
  await app.register(assetRoutes(opts.assets ?? null));
  return app;
}
