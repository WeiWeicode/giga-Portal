<script setup lang="ts">
/**
 * 內部拍賣(P7 臨時服務;FEATURE-PLAN §9;docs/Gherkin/services/auction.feature)。
 * 舊程式 GSMC_Auction.aspx:期間內的拍賣品(ContentX 購物台)與出價;出價 ≥ 目前最高價 + 1,000(後端交易內檢查);
 * 出價人只對本人與管理員(portal.svc.auction.admin)顯示;管理員可刪除出價、匯出。
 */
import { reactive, ref } from 'vue';
import { sanitizeHtml } from '@giganexus/web-kit';
import { can, describeError } from '@/api/gateway';
import { auctionExportUrl, deleteBid, listAuction, placeBid, type AuctionBid, type AuctionItem } from '@/api/portal';
import { money } from '@/composables/services';
import { useAsync } from '@/composables/useAsync';
import { confirm, toast } from '@/ui/feedback';

const admin = ref(false);
const { data, loading, error, reload } = useAsync(() => listAuction(admin.value));
const amounts = reactive<Record<string, string>>({});
const busy = ref<string | null>(null);

function toggleAdmin() {
  admin.value = !admin.value;
  void reload();
}
async function bid(item: AuctionItem) {
  const amount = Number(String(amounts[item.id] ?? '').replace(/,/g, ''));
  if (!Number.isInteger(amount) || amount < 1) return toast.error('出價金額有誤,請填入數字');
  if (amount < item.minBid) return toast.error(`出價至少 ${money(item.minBid)}`, '競標出價至少比目前最高價高 1,000');
  if (!(await confirm({ title: '確認出價', message: `確定對「${item.title}」出價 ${money(amount)} 元?`, confirmText: '出價' }))) return;
  busy.value = item.id;
  try {
    await placeBid(item.id, amount);
    amounts[item.id] = '';
    toast.success('已成功出價!');
  } catch (e) {
    toast.fromError(e, '出價失敗');
  } finally {
    busy.value = null;
    await reload();
  }
}
async function remove(item: AuctionItem, b: AuctionBid) {
  if (!b.key) return;
  if (
    !(await confirm({
      title: '刪除出價',
      message: `確定刪除 ${b.empNo ?? ''} ${b.name ?? ''} 的出價 ${money(b.amount)}?`,
      confirmText: '刪除',
      tone: 'danger',
    }))
  )
    return;
  try {
    await deleteBid(item.id, b.key);
    toast.success('已刪除出價');
    await reload();
  } catch (e) {
    toast.fromError(e, '刪除失敗');
  }
}
const who = (b: AuctionBid) => (b.empNo ? `${b.name ?? ''}(${b.empNo})${b.mine ? ' · 我' : ''}` : '其他同仁');
</script>

<template>
  <div class="stack">
    <GPageHeader title="內部拍賣" icon="award" eyebrow="臨時服務" description="期間內的拍賣品;出價須比目前最高價至少高 1,000 元">
      <GButton v-if="can('portal.svc.auction.admin')" size="sm" variant="ghost" :icon="admin ? 'eye-off' : 'eye'" @click="toggleAdmin">
        {{ admin ? '一般檢視' : '管理檢視' }}
      </GButton>
      <GButton size="sm" variant="ghost" icon="refresh" @click="reload">重新整理</GButton>
    </GPageHeader>

    <GCard v-if="loading && !data"><GSkeleton :lines="5" /></GCard>
    <GCard v-else-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得拍賣品" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="!data?.items.length"><GEmpty icon="package" title="服務已結束" description="目前沒有進行中的拍賣" /></GCard>
    <template v-else>
      <GCard v-for="item in data.items" :key="item.id" :title="item.title" icon="package">
        <template #actions>
          <a v-if="admin" :href="auctionExportUrl(item.id)" rel="noopener noreferrer"
            ><GButton size="sm" variant="ghost" icon="download" tabindex="-1">匯出</GButton></a
          >
        </template>
        <p class="xs faint">期間 {{ item.startDate ?? '不限' }} ~ {{ item.endDate ?? '不限' }} · 出價 {{ item.bidCount }} 筆</p>
        <!-- 內文:後端已白名單清洗,顯示前再以 web-kit sanitizeHtml 清洗一次 -->
        <div v-if="item.html" class="doc" v-html="sanitizeHtml(item.html)" />
        <div class="row price">
          <span
            >目前最高價 <b class="hi">{{ money(item.highest) }}</b></span
          >
          <span class="xs faint">最低出價 {{ money(item.minBid) }}</span>
        </div>
        <form v-can="'portal.svc.auction.bid'" class="row bid" @submit.prevent="bid(item)">
          <GInput v-model="amounts[item.id]" type="number" :placeholder="`至少 ${item.minBid}`" />
          <GButton type="submit" variant="primary" icon="send" :loading="busy === item.id">出價</GButton>
        </form>
        <ul v-if="item.bids.length" class="bids">
          <li v-for="(b, i) in item.bids" :key="b.key ?? `${b.time}-${i}`" :class="{ mine: b.mine }">
            <span class="amt">{{ money(b.amount) }}</span>
            <span class="xs">{{ who(b) }}</span>
            <span class="xs faint">{{ b.time }}</span>
            <GButton v-if="admin && b.key" size="sm" variant="ghost" square icon="trash" aria-label="刪除出價" @click="remove(item, b)" />
          </li>
        </ul>
      </GCard>
    </template>
  </div>
</template>

<style scoped>
.doc {
  line-height: 1.7;
  overflow-x: auto;
  margin: 8px 0;
}
.price {
  gap: 16px;
  align-items: baseline;
  margin: 8px 0;
}
.hi {
  font-size: var(--fs-lg);
  color: var(--c-primary-text);
}
.bid {
  gap: 8px;
  max-width: 360px;
}
.bids {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: grid;
  gap: 4px;
}
.bids li {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
}
.bids li.mine {
  background: var(--glass-soft);
}
.amt {
  min-width: 90px;
  font-variant-numeric: tabular-nums;
}
</style>
