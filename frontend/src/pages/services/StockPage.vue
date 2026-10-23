<script setup lang="ts">
/**
 * 員工持股會滿 3 年領回確認(P7 臨時服務;FEATURE-PLAN §9;docs/Gherkin/services/stock.feature)。
 * 舊程式 EmployeeStockOwnershipCheck.aspx:只列本人;今年自提持股可領回才能送出(後端檢查);每年度一筆;集保帳號只顯示末 4 碼。
 */
import { computed, ref } from 'vue';
import { describeError } from '@/api/gateway';
import { decideStock, stockView, type StockView } from '@/api/portal';
import { accountValid, isServiceEnded, money } from '@/composables/services';
import { useAsync } from '@/composables/useAsync';
import { confirm, toast } from '@/ui/feedback';

const { data, loading, error, reload } = useAsync(stockView);
const account = ref('');
const saving = ref(false);
const history = computed(() => (data.value?.history ?? []).map((r, i) => ({ ...r, key: `${r.annual}-${r.stockType ?? ''}-${i}` })));
const self = computed(() => data.value?.current.find((r) => r.selfProvided) ?? null);
const decisionText = (d: StockView['decision']) => (!d ? '—' : d.doBack === 'Y' ? `領回 ${money(d.backStockNo)} 股` : '不領回');

const columns = [
  { key: 'annual', label: '執行年度' },
  { key: 'stockType', label: '持股類別' },
  { key: 'joinDate', label: '入會年月', hideSm: true },
  { key: 'backDate', label: '可領年月' },
  { key: 'totalStockNo', label: '總持股數', align: 'right' as const },
  { key: 'backStockNo', label: '可領股數', align: 'right' as const },
  { key: 'decision', label: '回覆' },
];

async function submit(doBack: boolean) {
  if (doBack && !accountValid(account.value)) return toast.error('未填入集保帳號共 11 碼');
  const ok = await confirm({
    title: doBack ? '確定領回' : '確定不領回',
    message: doBack ? '確定領回自提 20% 持股嗎?送出後不可更改。' : '確定不領回嗎?送出後不可更改。',
    confirmText: '確定',
  });
  if (!ok) return;
  saving.value = true;
  try {
    data.value = await decideStock({ doBack, account: doBack ? account.value : null });
    account.value = '';
    toast.success('已送出');
  } catch (e) {
    if (isServiceEnded(e)) await reload();
    toast.fromError(e, '送出失敗');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="stack">
    <GPageHeader title="員工持股會滿 3 年領回確認" icon="coin" eyebrow="臨時服務" />
    <GCard v-if="loading && !data"><GSkeleton :lines="5" /></GCard>
    <GCard v-else-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得持股資料" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <template v-else-if="data">
      <GAlert v-if="!data.open" tone="neutral" title="服務已結束">{{ data.year }} 年度沒有您的持股領回資料</GAlert>
      <GCard v-else :title="`${data.year} 年度`" icon="coin">
        <GTable :columns="columns" :rows="data.current" row-key="stockType" :page-size="0">
          <template #cell-totalStockNo="{ row }">{{ money(row.totalStockNo) }}</template>
          <template #cell-backStockNo="{ row }">{{ money(row.backStockNo) }}</template>
          <template #cell-decision="{ row }">{{ row.selfProvided ? decisionText(data.decision) : '—' }}</template>
        </GTable>
        <GAlert v-if="data.decision" tone="success" title="已回覆" class="mt">
          {{ decisionText(data.decision) }}<template v-if="data.decision.accountLast4">,集保帳號末 4 碼 {{ data.decision.accountLast4 }}</template> ({{
            data.decision.confirmTime
          }})
        </GAlert>
        <form v-else-if="data.canDecide && self" class="stack mt" @submit.prevent="submit(true)">
          <GInput
            v-model="account"
            label="集保帳號(11 碼,領回時必填)"
            autocomplete="off"
            :error="account && !accountValid(account) ? '集保帳號為 11 碼數字' : null"
          />
          <div v-can="'portal.svc.stock.submit'" class="row">
            <GButton type="submit" variant="primary" icon="check" :loading="saving">領回 {{ money(self.backStockNo) }} 股</GButton>
            <GButton variant="ghost" icon="x" :disabled="saving" @click="submit(false)">不領回</GButton>
          </div>
        </form>
        <p v-else class="xs faint mt">今年度沒有可領回的自提持股</p>
      </GCard>

      <GCard title="歷年紀錄" icon="clock">
        <GTable :columns="columns" :rows="history" row-key="key" :page-size="10" empty-title="沒有歷年紀錄">
          <template #cell-totalStockNo="{ row }">{{ money(row.totalStockNo) }}</template>
          <template #cell-backStockNo="{ row }">{{ money(row.backStockNo) }}</template>
          <template #cell-decision="{ row }">{{ decisionText(row.decision) }}</template>
        </GTable>
      </GCard>
    </template>
  </div>
</template>

<style scoped>
.mt {
  margin-top: 12px;
}
</style>
