import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// 員工入口網:子路徑 /(Gateway PRD §7.2.1;含保留路徑 /login、/register、/reset-password)
// API 一律同網域 /api/*,本機開發轉給本機 Gateway(https://localhost,開發用自簽憑證)
const GATEWAY = process.env.GATEWAY_TARGET ?? 'https://localhost';
// Gateway web-kit 尚未發佈到 Registry:以 alias 指向兄弟 repo 的原始碼(同 Gateway tools/sample-spa)
const WEB_KIT = fileURLToPath(new URL(process.env.WEB_KIT_DIR ?? '../../giga-api-gateway-bff/web-kit/src', import.meta.url));

export default defineConfig({
  base: '/',
  plugins: [vue()],
  resolve: {
    dedupe: ['vue', 'vue-router'],
    alias: {
      '@giganexus/web-kit': `${WEB_KIT}/index.ts`,
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: Number(process.env.PORT ?? 5179),
    strictPort: true,
    fs: { allow: ['.', WEB_KIT] },
    proxy: { '/api': { target: GATEWAY, changeOrigin: true, secure: false } },
  },
  test: { include: ['test/**/*.test.ts'] },
});
