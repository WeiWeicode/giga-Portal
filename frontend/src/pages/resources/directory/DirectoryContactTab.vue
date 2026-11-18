<script setup lang="ts">
/** 分機表、聯絡窗口 - 聯絡窗口(old_PortalSolar Contact.aspx 照搬;PORTAL-API-PLAN D-14) */
const contacts = [{ role: '連絡資訊人員', dept: '資訊服務部 S1800', name: '鄭智寬', ext: '2109', email: 'eric@gigasolar.com.tw' }];
</script>

<template>
  <div class="stack">
    <GCard v-for="c in contacts" :key="c.email" :title="c.role" icon="users">
      <dl class="info">
        <dt>單位</dt>
        <dd>{{ c.dept }}</dd>
        <dt>姓名</dt>
        <dd>{{ c.name }}</dd>
        <dt>分機</dt>
        <dd class="mono">#{{ c.ext }}</dd>
        <dt>Email</dt>
        <dd>
          <a :href="`mailto:${c.email}`">{{ c.email }}</a>
        </dd>
      </dl>
    </GCard>
  </div>
</template>

<style scoped>
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
.mono {
  font-family: var(--font-mono, monospace);
}
</style>
