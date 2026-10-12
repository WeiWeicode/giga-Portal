/** 輸出本服務的 OpenAPI(不啟動服務、不連資料庫與 Gateway):npm run -s openapi > openapi.json */
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig({
  SERVICE_CODE: 'portal-api',
  GW_ENV: 'dev',
  GW_JWKS_URL: 'http://127.0.0.1/.well-known/jwks.json',
  PORTAL_DB_HOST: '-',
  PORTAL_DB_NAME: 'giganexus_gw_test',
  PORTAL_DB_USER: '-',
  PORTAL_DB_PASSWORD: '-',
  ...process.env,
});
const app = await buildApp({ config });
await app.ready();
console.log(JSON.stringify(app.swagger(), null, 2));
await app.close();
