import { createApp } from 'vue';
import App from './App.vue';
import { initTheme } from './composables/theme';
import { router } from './router';
import ui from './ui';

// 登入、CSRF、401 自動 Refresh 由 Gateway web-kit 處理(api/gateway.ts);路由守衛見 router.ts
initTheme();

createApp(App).use(router).use(ui).mount('#app');
