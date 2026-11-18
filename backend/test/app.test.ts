/**
 * portal-api 骨架:docs/Gherkin/api/skeleton.feature(測試名稱 = 場景名稱)。不連資料庫與 Gateway。
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { Sources } from '../src/db/sources.js';

const CODE = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+){2,}$/;
const DB = {
  GW_BASE_URL: 'https://gw.example',
  PORTAL_DB_HOST: 'h',
  PORTAL_DB_NAME: 'giganexus_gw_test',
  PORTAL_DB_USER: 'portal_app',
  PORTAL_DB_PASSWORD: 'x',
};

let app: FastifyInstance;
let jwks: http.Server;
let sign: (claims: Record<string, unknown>, aud?: string) => Promise<string>;

before(async () => {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test', alg: 'ES256', use: 'sig' };
  jwks = http.createServer((_req, res) => res.setHeader('content-type', 'application/json').end(JSON.stringify({ keys: [jwk] })));
  await new Promise<void>((r) => jwks.listen(0, '127.0.0.1', r));
  const jwksUrl = `http://127.0.0.1:${(jwks.address() as AddressInfo).port}/.well-known/jwks.json`;
  sign = (claims, aud = 'portal-api') =>
    new SignJWT(claims).setProtectedHeader({ alg: 'ES256', kid: 'test' }).setIssuer('giganexus-bff').setAudience(aud).setExpirationTime('60s').sign(privateKey);
  app = await buildApp({ config: loadConfig({ GW_ENV: 'dev', SERVICE_CODE: 'portal-api', LOG_LEVEL: 'silent', ...DB, GW_JWKS_URL: jwksUrl }) });
});

after(async () => {
  await app.close();
  jwks.close();
});

const get = (url: string, token?: string) => app.inject({ url, headers: token ? { 'x-internal-token': token, 'x-request-id': 'req-1' } : {} });

describe('portal-api 骨架', () => {
  it('健康檢查不需內部 Token', async () => {
    assert.equal((await get('/healthz')).statusCode, 200);
  });

  it('缺少或對象不符的內部 Token 回 401', async () => {
    const res = await get('/v1/me');
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().code, 'PORTAL_INTERNAL_TOKEN_INVALID');
    assert.equal((await get('/v1/me', await sign({ sub: '1', emp: 'S112009' }, 'file-api'))).statusCode, 401);
  });

  it('取得目前登入者的身分', async () => {
    const token = await sign({ sub: '1', emp: 'S112009', name: '測試員', dept: 'S1800', cos: ['GSMC'] });
    const res = await get('/v1/me', token);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { empNo: 'S112009', name: '測試員', dept: 'S1800', companies: ['GSMC'] });
    assert.ok(!res.body.includes(token));
  });

  it('系統對系統的呼叫不能當成員工身分', async () => {
    const res = await get('/v1/me', await sign({ sub: 'client:abc', amr: 'api_key' }));
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.json(), { code: 'PORTAL_DATA_ACCESS_DENIED', message: '此 API 只提供員工本人使用', requestId: 'req-1' });
  });

  it('每個 API 都列在 OpenAPI 並有說明與 Gherkin', async () => {
    const doc = (await get('/openapi.json')).json();
    assert.deepEqual(doc['x-gateway'], { upstream: 'portal-api', system: 'portal', project: 'giga-Portal' });
    const declared = new Set(doc['x-permissions'].map((p: { code: string }) => p.code));
    const ops = Object.values(doc.paths as Record<string, Record<string, Record<string, unknown>>>).flatMap((p) => Object.values(p));
    assert.ok(ops.length > 0);
    for (const op of ops) {
      const id = String(op.operationId);
      assert.match(id, CODE, `operationId 格式:${id}`);
      assert.ok(op.summary, `${id} 缺少 summary`);
      assert.ok(typeof op.description === 'string' && op.description.length <= 1000, `${id} 缺少 description`);
      assert.ok(typeof op['x-gherkin'] === 'string' && /^場景[::]/m.test(op['x-gherkin']), `${id} 缺少 x-gherkin 場景`);
      const perm = op['x-permission'] as string;
      assert.ok(perm === 'public' || perm === 'authenticated' || declared.has(perm), `${id} 的 x-permission 未列在 x-permissions:${perm}`);
    }
    assert.equal(doc.paths['/healthz'], undefined);
  });
});

describe('舊庫來源前綴', () => {
  const cases: [mode: 'copy' | 'legacy', key: 'PortalSolar' | 'LearnDB.learn', table: string, expected: string][] = [
    ['copy', 'PortalSolar', 'CpfExInfo', '[giganexus_gw_test].[src_portalsolar].[CpfExInfo]'],
    ['copy', 'LearnDB.learn', 'TB_COURSE_FORM', '[giganexus_gw_test].[src_learndb_learn].[TB_COURSE_FORM]'],
    ['legacy', 'PortalSolar', 'CpfExInfo', '[PortalSolar].[dbo].[CpfExInfo]'],
    ['legacy', 'LearnDB.learn', 'TB_COURSE_FORM', '[LearnDB].[learn].[TB_COURSE_FORM]'],
  ];
  it('測試區讀複本、正式區讀原庫', () => {
    for (const [mode, key, table, expected] of cases) assert.equal(Sources.fromEnv(mode, 'giganexus_gw_test', {}).table(key, table), expected);
  });

  it('個別來源可覆寫前綴', () => {
    const s = Sources.fromEnv('copy', 'giganexus_gw_test', { PORTAL_SRC_SAFETY: 'Safety.dbo' });
    assert.equal(s.table('Safety', 'T'), '[Safety].[dbo].[T]');
    assert.equal(s.table('LOS', 'EmployeeInfo'), '[giganexus_gw_test].[src_los].[EmployeeInfo]');
  });

  it('不合法的前綴或表名讓啟動 / 查詢失敗', () => {
    assert.throws(
      () => loadConfig({ GW_ENV: 'dev', SERVICE_CODE: 'portal-api', ...DB, PORTAL_SRC_PORTALSOLAR: 'PortalSolar.dbo;DROP TABLE x' }),
      /PORTAL_SRC_PORTALSOLAR/,
    );
    assert.throws(() => Sources.fromEnv('copy', 'giganexus_gw_test', {}).table('PortalSolar', 'x]; DROP TABLE y--'), /資料表名稱/);
  });

  it('正式區不可使用複本模式', () => {
    const keyFile = path.join(mkdtempSync(path.join(tmpdir(), 'portal-api-')), 'gw_api_key');
    writeFileSync(keyFile, 'k');
    const prod = { GW_ENV: 'prod', SERVICE_CODE: 'portal-api', GW_API_KEY_FILE: keyFile, SERVICE_ADVERTISE_URL: 'http://portal-api:51271' };
    assert.throws(() => loadConfig({ ...prod, ...DB, PORTAL_SRC_MODE: 'copy' }), /正式區不可使用/);
  });

  it('DEV_SKIP_TOKEN 只能監聽本機', () => {
    assert.throws(() => loadConfig({ GW_ENV: 'dev', SERVICE_CODE: 'portal-api', ...DB, DEV_SKIP_TOKEN: '1', HOST: '0.0.0.0' }), /只能監聽本機/);
    assert.equal(loadConfig({ GW_ENV: 'dev', SERVICE_CODE: 'portal-api', ...DB, DEV_SKIP_TOKEN: '1' }).devSkipToken, true);
  });

  it('dev / test 預設讀複本', () => {
    assert.equal(loadConfig({ GW_ENV: 'dev', SERVICE_CODE: 'portal-api', ...DB }).sourceMode, 'copy');
  });
});
