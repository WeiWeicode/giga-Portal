import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// 員工入口網:子路徑 /(Gateway PRD §7.2.1;含保留路徑 /login、/register、/reset-password)
// API 一律同網域 /api/*,開發時經 proxy 轉給測試區 Gateway(公司憑證;可用 GATEWAY_TARGET 改指其他 Gateway)
const GATEWAY = process.env.GATEWAY_TARGET ?? 'https://giganexus-test.gigasolar.com.tw';
// @giganexus/web-kit 取自公司 GitLab npm Registry(.npmrc,Token 為環境變數 GITLAB_NPM_TOKEN)
const toGateway = { target: GATEWAY, changeOrigin: true };

export default defineConfig({
  base: '/',
  plugins: [vue()],
  resolve: {
    dedupe: ['vue', 'vue-router'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: Number(process.env.PORT ?? 5179),
    strictPort: true,
    proxy: {
      '/api': toGateway,
      // 通知 WebSocket(Gateway NOTIFY-PLAN §6.4):Cookie 落在 localhost,經 proxy 帶到測試區 BFF
      '/ws/notify': { ...toGateway, ws: true },
    },
  },
  test: { include: ['test/**/*.test.ts'] },
});
