<script setup lang="ts">
/**
 * 證照項目設定(old_PortalSolar EHS/EHItemEdit.aspx;FEATURE-PLAN §8;docs/Gherkin/esh/license.feature)。
 * 名稱不可空白、啟用中不可重名(含編輯時);有效期(月)或永久;描述 HTML 由後端白名單清洗後寫入;刪除為軟刪。
 * Logo 上傳到 giga-file-service(refType portal-esh-logo,refNo = 證照 ID),只接受圖片。維護按鈕 portal.esh.item.edit。
 */
import { reactive, ref } from 'vue';
import { sanitizeHtml } from '@giganexus/web-kit';
import { can, describeError } from '@/api/gateway';
import { bindFiles, createEshItem, deleteEshItem, deleteEshItemLogo, eshItems, setEshItemLogo, updateEshItem, uploadFile, type EshItem } from '@/api/portal';
import { accept, hasExt, LOGO_EXTENSIONS, logoSrc, monthsText, REF } from '@/composables/esh';
import { useAsync } from '@/composables/useAsync';
import { confirm, toast } from '@/ui/feedback';

const includeInactive = ref(false);
const { data, loading, error, reload } = useAsync(() => eshItems(includeInactive.value));
const keyword = ref('');
const visible = () => (data.value?.items ?? []).filter((i) => !keyword.value.trim() || i.name.toLowerCase().includes(keyword.value.trim().toLowerCase()));

const modal = ref(false);
const editing = ref<EshItem | null>(null);
const form = reactive({ name: '', months: '36', permanent: false, description: '' });
const saving = ref(false);
function open(i: EshItem | null) {
  editing.value = i;
  Object.assign(form, { name: i?.name ?? '', months: String(i?.months ?? 36), permanent: i?.permanent ?? false, description: i?.description ?? '' });
  modal.value = true;
}
async function save() {
  saving.value = true;
  try {
    const body = { name: form.name, permanent: form.permanent, months: form.permanent ? null : Number(form.months), description: form.description || null };
    if (editing.value) await updateEshItem(editing.value.id, body);
    else await createEshItem(body);
    modal.value = false;
    toast.success('已儲存');
    await reload();
  } catch (e) {
    toast.fromError(e, '儲存失敗');
  } finally {
    saving.value = false;
  }
}
async function remove(i: EshItem) {
  if (!(await confirm({ title: '刪除證照項目', message: `確定刪除「${i.name}」?(軟刪除,持證資料保留)`, confirmText: '刪除', tone: 'danger' }))) return;
  try {
    await deleteEshItem(i.id);
    await reload();
  } catch (e) {
    toast.fromError(e, '刪除失敗');
  }
}

const logoInput = ref<HTMLInputElement | null>(null);
const logoTarget = ref<EshItem | null>(null);
function pickLogo(i: EshItem) {
  logoTarget.value = i;
  logoInput.value?.click();
}
async function onLogo(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = '';
  const i = logoTarget.value;
  if (!f || !i) return;
  if (!hasExt(f.name, LOGO_EXTENSIONS)) return toast.error(`Logo 只接受 ${LOGO_EXTENSIONS.join(' / ')}`);
  try {
    // 先上傳暫存檔,登記後再以證照 ID 綁定(未綁定 24 小時後由 file-service 清除)
    const fileId = await uploadFile(REF.logo, f);
    await setEshItemLogo(i.id, { fileId, fileName: f.name });
    await bindFiles(REF.logo, String(i.id), [fileId]);
    toast.success('Logo 已上傳');
    await reload();
  } catch (err) {
    toast.fromError(err, 'Logo 上傳失敗');
  }
}
async function removeLogo(i: EshItem) {
  try {
    await deleteEshItemLogo(i.id);
    await reload();
  } catch (e) {
    toast.fromError(e, '移除 Logo 失敗');
  }
}
</script>

<template>
  <div class="stack">
    <GCard>
      <div class="row filters">
        <GInput v-model="keyword" icon="search" placeholder="搜尋證照名稱" clearable class="kw" />
        <GSwitch v-model="includeInactive" label="含已刪除" @update:model-value="reload" />
        <GButton v-can="'portal.esh.item.edit'" variant="primary" icon="plus" @click="open(null)">新增證照項目</GButton>
      </div>
    </GCard>
    <input ref="logoInput" type="file" hidden :accept="accept(LOGO_EXTENSIONS)" @change="onLogo" />

    <GCard v-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得證照項目" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="loading && !data"><GSkeleton :lines="5" /></GCard>
    <GCard v-else-if="data" title="證照項目" icon="settings">
      <GEmpty v-if="!visible().length" icon="settings" title="沒有證照項目" />
      <div v-else class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Logo</th>
              <th>證照名稱</th>
              <th>有效期</th>
              <th>描述</th>
              <th v-if="can('portal.esh.item.edit')"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in visible()" :key="i.id" :class="{ off: !i.active }">
              <td>
                <img v-if="logoSrc(i)" :src="logoSrc(i)!" alt="" class="logo" loading="lazy" />
                <span v-else class="faint">—</span>
              </td>
              <td class="wrap">{{ i.name }} <GBadge v-if="!i.active" tone="neutral">已刪除</GBadge></td>
              <td class="nowrap">{{ monthsText(i) }}</td>
              <!-- 後端已白名單清洗,顯示前再以 web-kit sanitizeHtml 清洗 -->
              <td class="desc"><div v-html="sanitizeHtml(i.description)" /></td>
              <td v-if="can('portal.esh.item.edit')">
                <span v-if="i.active" class="acts">
                  <GButton size="sm" variant="ghost" square icon="image" aria-label="上傳 Logo" @click="pickLogo(i)" />
                  <GButton v-if="i.logo" size="sm" variant="ghost" square icon="x" aria-label="移除 Logo" @click="removeLogo(i)" />
                  <GButton size="sm" variant="ghost" square icon="edit" aria-label="編輯" @click="open(i)" />
                  <GButton size="sm" variant="ghost" square icon="trash" aria-label="刪除" @click="remove(i)" />
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>

    <GModal v-model:open="modal" :title="editing ? '編輯證照項目' : '新增證照項目'" icon="settings" width="640px">
      <form class="stack" @submit.prevent="save">
        <GInput v-model="form.name" label="證照名稱(50 字內)" required />
        <div class="row filters">
          <GInput v-model="form.months" type="number" label="有效期(月)" :disabled="form.permanent" class="sel" />
          <GCheckbox v-model="form.permanent" label="永久有效" />
        </div>
        <GTextarea v-model="form.description" label="描述(可用 HTML,儲存時只保留安全的標籤)" :rows="6" />
        <div class="row end">
          <GButton @click="modal = false">取消</GButton>
          <GButton v-can="'portal.esh.item.edit'" type="submit" variant="primary" icon="check" :loading="saving">儲存</GButton>
        </div>
      </form>
    </GModal>
  </div>
</template>

<style scoped src="../esh.css"></style>
<style scoped>
.logo {
  width: 40px;
  height: 46px;
  object-fit: contain;
}
.desc {
  min-width: 240px;
  max-width: 480px;
  overflow-wrap: anywhere;
}
.desc > div {
  max-height: 120px;
  overflow: auto;
}
</style>
