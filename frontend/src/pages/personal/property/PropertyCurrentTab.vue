<script setup lang="ts">
/**
 * 個人資產明細 - 保管資產備註(PORTAL-API-PLAN D-12;docs/Gherkin/personal/assets.feature)
 * 資產清單在 TIPTOP(系統轉移中),這裡只顯示本人在舊入口網填寫的備註;唯讀。照片待附件服務舊檔對照(F4)後提供。
 */
import { describeError } from '@/api/gateway';
import { assetNotes } from '@/api/portal';
import { useAsync } from '@/composables/useAsync';

const { data, loading, error, reload } = useAsync(() => assetNotes());
</script>

<template>
  <div class="stack property-current">
    <GAlert tone="info" icon="info" title="資產系統轉移中">
      保管資產清冊暫停提供;以下為您在舊入口網對資產填寫的備註,供轉移期間參考。
    </GAlert>

    <GCard v-if="loading && !data"><GEmpty icon="clock" title="載入中…" /></GCard>
    <GCard v-else-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得資產備註" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="data && !data.items.length">
      <GEmpty icon="boxes" title="沒有資產備註" description="您未曾在舊入口網為保管資產填寫備註。" />
    </GCard>
    <GCard v-else-if="data" title="保管資產備註" icon="boxes">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>公司別</th>
              <th>財產編號</th>
              <th>附號</th>
              <th>備註</th>
              <th>照片</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(a, i) in data.items" :key="i">
              <td class="mono">{{ a.compDb ?? '—' }}</td>
              <td class="mono">
                <strong>{{ a.assetNo }}</strong>
              </td>
              <td class="mono">{{ a.assetSub ?? '—' }}</td>
              <td class="note">{{ a.note || '—' }}</td>
              <td>
                <GBadge v-if="a.hasPhoto" tone="neutral" icon="image">舊系統有照片</GBadge>
                <span v-else class="faint">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>
  </div>
</template>

<style scoped>
.property-current {
  --gap: 16px;
}
.table-wrap {
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-sm);
}
.data-table th,
.data-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
  text-align: left;
}
.data-table th {
  font-weight: 600;
  color: var(--text-2);
  background: var(--glass-soft);
}
.note {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.mono {
  font-family: var(--font-mono, monospace);
}
</style>
