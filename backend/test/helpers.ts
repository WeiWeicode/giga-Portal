/** 測試共用:測試用 JWKS 與內部 Token、建立 app(不連資料庫與 Gateway;資料存取以記憶體假物件取代) */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { FastifyInstance } from 'fastify';
import { buildApp, type AppOptions } from '../src/app.js';
import { loadConfig } from '../src/config.js';

export const DB_ENV = {
  GW_BASE_URL: 'https://gw.example',
  PORTAL_DB_HOST: 'h',
  PORTAL_DB_NAME: 'giganexus_gw_test',
  PORTAL_DB_USER: 'portal_app',
  PORTAL_DB_PASSWORD: 'x',
};

export interface TestApp {
  app: FastifyInstance;
  /** 簽發 aud=portal-api 的內部 Token */
  token: (claims?: Record<string, unknown>) => Promise<string>;
  close: () => Promise<void>;
}

export async function testApp(opts: Omit<AppOptions, 'config'> = {}): Promise<TestApp> {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test', alg: 'ES256', use: 'sig' };
  const jwks = http.createServer((_req, res) => res.setHeader('content-type', 'application/json').end(JSON.stringify({ keys: [jwk] })));
  await new Promise<void>((r) => jwks.listen(0, '127.0.0.1', r));
  const jwksUrl = `http://127.0.0.1:${(jwks.address() as AddressInfo).port}/.well-known/jwks.json`;
  const config = loadConfig({ GW_ENV: 'dev', SERVICE_CODE: 'portal-api', LOG_LEVEL: 'silent', ...DB_ENV, GW_JWKS_URL: jwksUrl });
  const app = await buildApp({ config, ...opts });
  const token = (claims: Record<string, unknown> = { sub: '1', emp: 'S112009', name: '測試員', dept: 'S1800' }) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'ES256', kid: 'test' })
      .setIssuer('giganexus-bff')
      .setAudience('portal-api')
      .setExpirationTime('60s')
      .sign(privateKey);
  return {
    app,
    token,
    close: async () => {
      await app.close();
      jwks.close();
    },
  };
}
