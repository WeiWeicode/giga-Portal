// drizzle-kit 設定:只用於 `npm run db:generate`(離線比對 schema 快照,不連資料庫);
// 套用 migration 一律用 `npm run db:migrate`(Drizzle migrator,紀錄表在 portal),禁止 drizzle-kit push。
// 舊庫(PortalSolar、LOS…)不在此設定內,以 mssql 參數化查詢存取。
export default {
  dialect: 'mssql',
  schema: './src/db/schema.ts',
  out: './db/migrations',
  schemaFilter: ['portal'],
  breakpoints: true,
};
