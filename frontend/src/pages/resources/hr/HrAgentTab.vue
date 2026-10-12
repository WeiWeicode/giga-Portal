<script setup lang="ts">
/**
 * 人資專區 - 各部門主管職務代理人(old_PortalSolar HR.aspx Tab2;PORTAL-API-PLAN D-14)
 * 名單含人員姓名,經 portal-api 驗證後下載(GET /api/portal/hr/manager-agents),不放公開目錄。
 */
const open = () => window.open('/api/portal/hr/manager-agents', '_blank', 'noopener');
</script>

<template>
  <GCard title="各部門主管職務代理人名單" subtitle="碩禾主管職務代理人名單" icon="users">
    <p class="muted">名單由人資維護;請以新分頁開啟 PDF 查看。</p>
    <GButton variant="primary" icon="external" @click="open">開啟名單 PDF</GButton>
  </GCard>
</template>
