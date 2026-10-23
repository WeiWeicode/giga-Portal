<script setup lang="ts">
/**
 * ISO 文件庫(P7 臨時服務,唯讀;FEATURE-PLAN §9;docs/Gherkin/services/iso.feature)。
 * 舊程式 ISOInfo.aspx:條文分類 → 文件清單 → 文件明細(現行版本、檔案連結、參考 / 上階 / 下階文件);關鍵字查詢。
 * 資料來源為 BPM NaNa 檢視(來源待確認,CONFIRM-NEEDED P7):未授權時顯示「資料來源待確認」。
 */
import { computed, ref } from 'vue';
import { describeError } from '@/api/gateway';
import { isoClauses, isoDoc, isoDocs, type IsoDetail, type IsoDoc } from '@/api/portal';
import { useAsync } from '@/composables/useAsync';
import { toast } from '@/ui/feedback';

const { data: clauses, loading, error, reload } = useAsync(isoClauses);
const unavailable = computed(() => (error.value as { code?: string } | null)?.code === 'PORTAL_SOURCE_UNAVAILABLE');
const clause = ref('');
const keyword = ref('');
const docs = ref<IsoDoc[] | null>(null);
const detail = ref<IsoDetail | null>(null);
const busy = ref(false);
const options = computed(() => [{ label: '選擇條文分類', value: '' }, ...(clauses.value?.items ?? []).map((c) => ({ label: c, value: c }))]);

async function run(o: { clause?: string; q?: string }) {
  busy.value = true;
  detail.value = null;
  try {
    docs.value = (await isoDocs(o)).items;
  } catch (e) {
    toast.fromError(e, '查詢失敗');
  } finally {
    busy.value = false;
  }
}
function pickClause(v: string) {
  clause.value = v;
  if (v) void run({ clause: v });
}
async function open(docNo: string) {
  busy.value = true;
  try {
    detail.value = await isoDoc(docNo);
  } catch (e) {
    toast.fromError(e, '無法開啟文件');
  } finally {
    busy.value = false;
  }
}
const columns = [
  { key: 'docNo', label: '文件編號', mono: true },
  { key: 'docName', label: '文件名稱' },
  { key: 'levelId', label: '階層', hideSm: true },
];
</script>

<template>
  <div class="stack">
    <GPageHeader title="ISO 文件庫" icon="book-open" eyebrow="臨時服務" description="現行有效的 ISO 文件(唯讀)" />
    <GCard v-if="loading && !clauses"><GSkeleton :lines="4" /></GCard>
    <GCard v-else-if="error">
      <GEmpty
        :tone="unavailable ? 'neutral' : 'danger'"
        :icon="unavailable ? 'database' : 'alert'"
        :title="unavailable ? '資料來源待確認' : '無法取得 ISO 文件'"
        :description="unavailable ? 'ISO 文件來源(BPM 文件系統)尚未開放查詢,請洽 IT' : describeError(error)"
      >
        <GButton v-if="!unavailable" icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <template v-else>
      <GCard>
        <div class="row head">
          <GSelect :model-value="clause" :options="options" class="clause" @update:model-value="pickClause(String($event))" />
          <form class="row" @submit.prevent="keyword.trim() && run({ q: keyword })">
            <GInput v-model="keyword" icon="search" placeholder="文件名稱、條文、編號" clearable />
            <GButton type="submit" icon="search" :loading="busy">查詢</GButton>
          </form>
        </div>
      </GCard>

      <GCard v-if="detail" :title="`${detail.docNo} ${detail.docName}`" icon="file-text">
        <template #actions><GButton size="sm" variant="ghost" icon="chevron-left" @click="detail = null">返回清單</GButton></template>
        <dl class="kv">
          <dt>版本</dt>
          <dd>{{ detail.displayVersion ?? '—' }}</dd>
          <dt>條文</dt>
          <dd>{{ detail.clauseName ?? '—' }}</dd>
          <dt>生效 / 失效</dt>
          <dd>{{ detail.validFrom ?? '—' }} ~ {{ detail.validTo ?? '不限' }}</dd>
          <dt>文件階層</dt>
          <dd>{{ detail.levelId ?? '—' }}</dd>
          <dt>文件檔</dt>
          <dd>
            <a v-if="detail.url" :href="detail.url" target="_blank" rel="noopener noreferrer">開啟文件</a>
            <span v-else class="faint">無檔案連結</span>
          </dd>
        </dl>
        <div
          v-for="g in [
            { title: '參考文件', items: detail.references },
            { title: '上階文件', items: detail.uppers },
            { title: '下階文件', items: detail.lowers },
          ]"
          :key="g.title"
          class="rel"
        >
          <h4 class="sm">{{ g.title }}</h4>
          <p v-if="!g.items.length" class="xs faint">無</p>
          <ul v-else>
            <li v-for="r in g.items" :key="r.docNo">
              <a v-if="r.url" :href="r.url" target="_blank" rel="noopener noreferrer">{{ r.docNo }} {{ r.docName }}</a>
              <span v-else>{{ r.docNo }} {{ r.docName }}</span>
              <span v-if="r.displayVersion" class="xs faint"> 版本 {{ r.displayVersion }}</span>
            </li>
          </ul>
        </div>
      </GCard>
      <GCard v-else-if="docs" title="文件清單" icon="list">
        <GTable :columns="columns" :rows="docs" row-key="docNo" clickable empty-title="查無文件" @row-click="open($event.docNo)" />
      </GCard>
    </template>
  </div>
</template>

<style scoped>
.head {
  gap: 12px;
  flex-wrap: wrap;
}
.clause {
  min-width: 220px;
}
.kv {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 16px;
  margin: 0 0 12px;
}
.kv dt {
  color: var(--text-2);
}
.kv dd {
  margin: 0;
}
.rel ul {
  margin: 4px 0 12px;
  padding-left: 18px;
}
</style>
