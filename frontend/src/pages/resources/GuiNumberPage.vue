<script setup lang="ts">
/** 集團統編資訊(old_PortalSolar GUInumberInfo.aspx 靜態內容照搬;PORTAL-API-PLAN D-14) */
const usages = [
  { kind: '公司統編', use: '零用金、公司請款' },
  { kind: '福委會統編', use: '旅遊補助' },
  { kind: '不用開統編', use: '購書補助' },
];

const companies = [
  { name: '碩禾電子材料股份有限公司', address: '新竹縣湖口鄉中華路122-18號', phone: '+886-3-5981886', gui: '80433079', site: 'http://www.gigasolar.com.tw', siteName: '碩禾官網' },
  { name: '禾迅綠電股份有限公司', address: '新竹縣湖口鄉中華路122-18號', gui: '53789131' },
  { name: '碩禾電子材料(股)公司職工福利委員會', address: '新竹縣湖口鄉中華路122-18號', gui: '26127572' },
  { name: '芯和能源股份有限公司', address: '新竹縣新竹工業區工業一路3號', gui: '24369743', site: 'http://www.gee.com.tw', siteName: '芯和官網' },
];

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* 瀏覽器不允許時略過 */
  }
}
</script>

<template>
  <div class="stack gui-page">
    <GCard title="統編用途" icon="info">
      <div class="usage">
        <div v-for="u in usages" :key="u.kind" class="usage-item">
          <strong>{{ u.kind }}</strong>
          <span>{{ u.use }}</span>
        </div>
      </div>
    </GCard>
    <div class="grid grid-2">
      <GCard v-for="c in companies" :key="c.gui" :title="c.name" icon="building">
        <dl class="info">
          <dt>統編</dt>
          <dd class="mono gui">
            {{ c.gui }}
            <GButton variant="ghost" size="sm" icon="check" @click="copy(c.gui)">複製</GButton>
          </dd>
          <dt>地址</dt>
          <dd>{{ c.address }}</dd>
          <template v-if="c.phone">
            <dt>電話</dt>
            <dd class="mono">{{ c.phone }}</dd>
          </template>
          <template v-if="c.site">
            <dt>網站</dt>
            <dd>
              <a :href="c.site" target="_blank" rel="noopener">{{ c.siteName }}</a>
            </dd>
          </template>
        </dl>
      </GCard>
    </div>
  </div>
</template>

<style scoped>
.gui-page {
  --gap: 16px;
}
.usage {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.usage-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--glass-soft);
}
.info {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 8px 12px;
  margin: 0;
}
.info dt {
  color: var(--text-3);
}
.info dd {
  margin: 0;
}
.gui {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-md);
  font-weight: 700;
}
.mono {
  font-family: var(--font-mono, monospace);
}
</style>
