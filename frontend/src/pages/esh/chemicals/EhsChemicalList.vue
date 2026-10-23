<script setup lang="ts">
/**
 * 危害性化學品清單(old_PortalSolar EHS/EHCHEMICALInfo.aspx;FEATURE-PLAN §8;docs/Gherkin/esh/chemicals.feature)。
 * 所有員工可查:申請日期區間(預設去年本月 1 日 ~ 今天)、關鍵字(名稱 / 流程序號 / CAS No.),後端分頁;成份以化學品 ID 對應。
 * 管理員(按鈕 portal.esh.chemical.edit,另須 portal-esh-admin):「由 BPM 同步」、上傳 SDS(giga-file-service,refType portal-esh-sds)。
 * 內容一律文字插值輸出(不使用 v-html)。
 */
import { computed, ref } from 'vue';
import { describeError } from '@/api/gateway';
import {
  bindFiles,
  deleteEshChemicalSds,
  eshChemicals,
  setEshChemicalSds,
  syncEshChemicals,
  uploadFile,
  type EshChemical,
  type EshRestrict,
} from '@/api/portal';
import { accept, chemicalDefaultRange, hasExt, REF, SDS_EXTENSIONS, sdsLink } from '@/composables/esh';
import { useAsync } from '@/composables/useAsync';
import { confirm, toast } from '@/ui/feedback';

const props = defineProps<{ restrict: EshRestrict }>();
const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
const range = chemicalDefaultRange(today);
const from = ref(range.from);
const to = ref(range.to);
const keyword = ref('');
const page = ref(1);
const PAGE_SIZE = 20;
const { data, loading, error, reload } = useAsync(() =>
  eshChemicals({
    restrict: props.restrict,
    from: from.value || undefined,
    to: to.value || undefined,
    keyword: keyword.value.trim() || undefined,
    page: page.value,
    pageSize: PAGE_SIZE,
  }),
);
const pages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / PAGE_SIZE)));
function search() {
  page.value = 1;
  void reload();
}
function go(p: number) {
  page.value = Math.min(Math.max(1, p), pages.value);
  void reload();
}

const detail = ref<EshChemical | null>(null);
const people = (c: EshChemical) =>
  [
    ['填表人', c.requester],
    ['申請人', c.applicant],
    ['保管人', c.keeper],
    ['使用人', c.user],
  ] as const;
const fields = (c: EshChemical) =>
  [
    ['申請廠區', c.factoryArea],
    ['申請日期', c.createDate],
    ['主管機關列管', c.restrict],
    ['購買廠商', c.vendor],
    ['廠商產品編號', c.productNumber],
    ['入場量(含預計)', [c.amount, c.unit].filter(Boolean).join(' ')],
    ['申請用途', c.purpose],
    ['入場途徑', c.path],
    ['種類', c.type],
    ['狀態', c.state],
    ['儲放場所', c.storage],
    ['場所分機', c.storageExt],
    ['未附件備註', c.noAttachmentNote],
  ] as const;

const syncing = ref(false);
async function sync() {
  if (
    !(await confirm({
      title: '由 BPM 同步',
      message: `以 ${from.value} ~ ${to.value} 的已結案化學品申報單更新清單(唯讀查 BPM;新站上傳的 SDS 不受影響)。`,
      confirmText: '同步',
    }))
  )
    return;
  syncing.value = true;
  try {
    const r = await syncEshChemicals({ from: from.value, to: to.value });
    toast.success(`同步完成:表單 ${r.forms} 張,寫入 ${r.written} 筆${r.skipped.length ? `,略過 ${r.skipped.length} 筆` : ''}`);
    if (r.skipped.length)
      toast.info(
        r.skipped
          .slice(0, 5)
          .map((s) => `${s.efId}:${s.reason}`)
          .join('\n'),
      );
    await reload();
  } catch (e) {
    toast.fromError(e, '同步失敗');
  } finally {
    syncing.value = false;
  }
}

const sdsInput = ref<HTMLInputElement | null>(null);
async function onSds(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = '';
  const c = detail.value;
  if (!f || !c) return;
  if (!hasExt(f.name, SDS_EXTENSIONS)) return toast.error(`SDS 只接受 ${SDS_EXTENSIONS.join(' / ')}`);
  try {
    const fileId = await uploadFile(REF.sds, f);
    detail.value = await setEshChemicalSds(c.efId, { fileId, fileName: f.name });
    await bindFiles(REF.sds, c.efId, [fileId]);
    toast.success('SDS 已上傳');
    await reload();
  } catch (err) {
    toast.fromError(err, 'SDS 上傳失敗');
  }
}
async function removeSds(c: EshChemical) {
  try {
    await deleteEshChemicalSds(c.efId);
    detail.value = null;
    toast.success('已移除上傳的 SDS,改顯示 BPM 附件');
    await reload();
  } catch (e) {
    toast.fromError(e, '移除失敗');
  }
}
</script>

<template>
  <div class="stack">
    <GCard>
      <form class="row filters" @submit.prevent="search">
        <GInput v-model="from" type="date" label="申請日期(起)" class="sel" />
        <GInput v-model="to" type="date" label="申請日期(迄)" class="sel" />
        <GInput v-model="keyword" icon="search" label="關鍵字" placeholder="化學品名稱 / 流程序號 / CAS No." clearable class="kw" />
        <GButton type="submit" variant="primary" icon="search" :loading="loading">查詢</GButton>
        <GButton v-can="'portal.esh.chemical.edit'" icon="refresh-cw" :loading="syncing" @click="sync">由 BPM 同步</GButton>
      </form>
    </GCard>
    <input ref="sdsInput" type="file" hidden :accept="accept(SDS_EXTENSIONS)" @change="onSds" />

    <GCard v-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得化學品清單" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="loading && !data"><GSkeleton :lines="6" /></GCard>
    <GCard v-else-if="data" :title="`${restrict}化學品(${data.total})`" icon="alert-triangle">
      <GEmpty v-if="!data.items.length" icon="box" title="查無化學品申報" />
      <div v-else class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>申請日期</th>
              <th>廠區</th>
              <th>化學品名稱</th>
              <th>種類 / 狀態</th>
              <th>使用部門</th>
              <th>儲放場所</th>
              <th>成份(CAS No. / 濃度)</th>
              <th>SDS</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in data.items" :key="c.efId">
              <td class="nowrap">{{ c.createDate ?? '—' }}</td>
              <td class="nowrap">{{ c.factoryArea ?? '—' }}</td>
              <td class="wrap">
                {{ c.chemicalName ?? '—' }}<br /><span class="xs faint">{{ c.chemicalNameEn ?? '' }}</span>
              </td>
              <td class="nowrap">{{ [c.type, c.state].filter(Boolean).join(' / ') || '—' }}</td>
              <td class="wrap">{{ c.user.deptName ?? c.user.dept ?? '—' }}</td>
              <td class="wrap">{{ c.storage ?? '—' }}</td>
              <td class="wrap">
                <div v-for="p in c.components" :key="p.item">
                  {{ p.cn ?? '' }} <span class="mono">{{ p.cas ?? '' }}</span> {{ p.rate ?? '' }}
                </div>
                <span v-if="!c.components.length" class="faint">—</span>
              </td>
              <td class="wrap">
                <template v-if="sdsLink(c.sds)">
                  <a v-if="sdsLink(c.sds)!.href" :href="sdsLink(c.sds)!.href!" target="_blank" rel="noopener noreferrer">{{ sdsLink(c.sds)!.name }}</a>
                  <span v-else class="faint">{{ sdsLink(c.sds)!.name }}</span>
                </template>
                <span v-else class="faint">—</span>
              </td>
              <td><GButton size="sm" variant="ghost" icon="eye" @click="detail = c">明細</GButton></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="pages > 1" class="row pager">
        <GButton size="sm" icon="chevron-left" :disabled="page <= 1" @click="go(page - 1)">上一頁</GButton>
        <span class="small">第 {{ page }} / {{ pages }} 頁</span>
        <GButton size="sm" :disabled="page >= pages" @click="go(page + 1)">下一頁</GButton>
      </div>
    </GCard>

    <GModal
      :open="!!detail"
      :title="detail ? `${detail.efId} ${detail.chemicalName ?? ''}` : ''"
      icon="alert-triangle"
      width="820px"
      @update:open="(v: boolean) => !v && (detail = null)"
    >
      <div v-if="detail" class="stack">
        <div class="grid2">
          <div v-for="[k, val] in fields(detail)" :key="k">
            <span class="xs faint">{{ k }}</span>
            <div class="wrap">{{ val || '—' }}</div>
          </div>
        </div>
        <div class="grid2">
          <div v-for="[k, p] in people(detail)" :key="k">
            <span class="xs faint">{{ k }}</span>
            <div class="wrap">
              {{ [p.id, p.name].filter(Boolean).join(' ') || '—' }}{{ p.deptName || p.dept ? `(${[p.dept, p.deptName].filter(Boolean).join(' ')})` : '' }}
            </div>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>成份(中文)</th>
                <th>成份(英文)</th>
                <th>登錄碼</th>
                <th>CAS No.</th>
                <th>化學式</th>
                <th>濃度</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in detail.components" :key="p.item">
                <td class="wrap">{{ p.cn ?? '' }}</td>
                <td class="wrap">{{ p.en ?? '' }}</td>
                <td>{{ p.code ?? '' }}</td>
                <td class="mono">{{ p.cas ?? '' }}</td>
                <td>{{ p.formula ?? '' }}</td>
                <td>{{ p.rate ?? '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="row filters">
          <span class="small">SDS:</span>
          <template v-if="sdsLink(detail.sds)">
            <a v-if="sdsLink(detail.sds)!.href" :href="sdsLink(detail.sds)!.href!" target="_blank" rel="noopener noreferrer">{{ sdsLink(detail.sds)!.name }}</a>
            <span v-else class="faint">{{ sdsLink(detail.sds)!.name }}</span>
            <GBadge v-if="detail.sds?.kind === 'file'" tone="primary">新站上傳</GBadge>
          </template>
          <span v-else class="faint">沒有 SDS</span>
          <GButton v-can="'portal.esh.chemical.edit'" size="sm" icon="upload" @click="sdsInput?.click()">上傳 SDS</GButton>
          <GButton v-if="detail.sds?.kind === 'file'" v-can="'portal.esh.chemical.edit'" size="sm" variant="ghost" icon="x" @click="removeSds(detail)"
            >移除上傳的 SDS</GButton
          >
        </div>
      </div>
    </GModal>
  </div>
</template>

<style scoped src="../esh.css"></style>
<style scoped>
.pager {
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
}
</style>
