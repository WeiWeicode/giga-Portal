<script setup lang="ts">
/**
 * 登入前頁面的外框(登入、註冊、忘記密碼、維護頁、無權限頁):左側品牌面板 + 右側表單卡片;窄螢幕只顯示卡片。
 * 右上角提供風格與明暗切換(PRD FR-6.3–6.4)。
 */
import { useRoute } from 'vue-router';

const route = useRoute();
</script>

<template>
  <div class="auth">
    <div class="corner">
      <GStyleToggle />
    </div>

    <section class="brand-panel" aria-hidden="true">
      <div class="brand">
        <GLogo :size="46" />
        <div>
          <strong>GigaNexus</strong>
          <span>碩禾集團 · 員工入口網</span>
        </div>
      </div>
      <div class="pitch">
        <h1>一個帳號,<br />連接集團所有系統</h1>
        <p>出勤、假期、簽核、公告與各應用,都從這裡開始。</p>
        <ul>
          <li><GIcon name="sun" :size="18" />綠能產業的每日工作入口</li>
          <li><GIcon name="shield" :size="18" />AD 或本機帳號單一登入</li>
          <li><GIcon name="grid" :size="18" />依權限切換員工入口網與 IT 管理系統</li>
        </ul>
      </div>
      <p class="foot">© 碩禾集團 資訊服務部</p>
    </section>

    <main class="form-col">
      <div class="card glass glass-edge">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="route.path" />
          </Transition>
        </RouterView>
      </div>
    </main>
  </div>
</template>

<style scoped>
.auth {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  min-height: 100vh;
}
.corner {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2;
}
.brand-panel {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  margin: 16px 0 16px 16px;
  padding: 36px 44px;
  border-radius: var(--radius-xl);
  background: var(--grad-hero);
  color: var(--on-hero);
  overflow: hidden;
  position: relative;
}
/* 橫幅上的光點與網格:只在玻璃風格顯示(--card-glow-opacity) */
.brand-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(360px 360px at 85% 12%, var(--hero-glow-1), transparent 70%), radial-gradient(420px 420px at 10% 95%, var(--hero-glow-2), transparent 70%);
  opacity: var(--card-glow-opacity);
  pointer-events: none;
}
.brand-panel > * {
  position: relative;
}
.brand {
  display: flex;
  align-items: center;
  gap: 14px;
}
.brand div {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}
.brand strong {
  font-size: var(--fs-xl);
}
.brand span {
  font-size: var(--fs-sm);
  opacity: 0.85;
}
.pitch h1 {
  font-size: 40px;
  line-height: 1.2;
  letter-spacing: -0.02em;
}
.pitch p {
  margin: 16px 0 28px;
  font-size: var(--fs-lg);
  opacity: 0.9;
}
.pitch ul {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.pitch li {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 550;
}
.pitch li :deep(.g-icon) {
  padding: 7px;
  box-sizing: content-box;
  border-radius: 10px;
  background: var(--on-hero-soft);
}
.foot {
  margin: 0;
  font-size: var(--fs-xs);
  opacity: 0.75;
}
.form-col {
  display: grid;
  place-items: center;
  padding: 72px 24px 32px;
}
.card {
  width: min(440px, 100%);
  padding: 32px;
  border-radius: var(--radius-xl);
}
@media (max-width: 960px) {
  .auth {
    grid-template-columns: minmax(0, 1fr);
  }
  .brand-panel {
    display: none;
  }
  .form-col {
    padding: 72px 16px 24px;
  }
  .card {
    padding: 24px 20px;
  }
}
</style>
