<script setup lang="ts">
/**
 * 行事曆 › 年度清單:已上傳的年度行事曆;編輯者(按鈕 portal.calendar.edit)上傳 / 取代 / 刪除。
 * PDF 上傳到 giga-file-service(sourceApp / refType portal-calendar,需 file.object.upload),再登記年度(同年度重新上傳即取代)。
 */
import { reactive, ref } from 'vue';
import { describeError } from '@/api/gateway';
import { fmtTime } from '@/api/format';
import { bindFiles, deleteCalendar, fileUrl, listCalendars, saveCalendar, uploadFile, type CalendarPdf } from '@/api/portal';
import { useAsync } from '@/composables/useAsync';
import { confirm, toast } from '@/ui/feedback';

const { data, loading, error, reload } = useAsync(listCalendars);
const modal = ref(false);
const form = reactive({ year: String(new Date().getFullYear() + 1) });
const file = ref<File | null>(null);
const saving = ref(false);

function openUpload(c?: CalendarPdf) {
  form.year = String(c?.year ?? new Date().getFullYear() + 1);
  file.value = null;
  modal.value = true;
}
function pick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null;
  if (f && !/\.pdf$/i.test(f.name)) {
    toast.error('只接受 PDF 檔');
    (e.target as HTMLInputElement).value = '';
    return;
  }
  file.value = f;
}
async function save() {
  const year = Number(form.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return toast.error('年度需介於 2000 ~ 2100');
  if (!file.value) return toast.error('請選擇 PDF');
  saving.value = true;
  try {
    const id = await uploadFile('portal-calendar', file.value);
    await saveCalendar(year, id, file.value.name);
    await bindFiles('portal-calendar', String(year), [id]);
    modal.value = false;
    toast.success(`已上傳 ${year} 年度行事曆`);
    await reload();
  } catch (e) {
    toast.fromError(e, '上傳失敗');
  } finally {
    saving.value = false;
  }
}
async function remove(c: CalendarPdf) {
  if (!(await confirm({ title: '刪除年度行事曆', message: `確定刪除 ${c.year} 年度行事曆?`, confirmText: '刪除', tone: 'danger' }))) return;
  try {
    await deleteCalendar(c.year);
    await reload();
  } catch (e) {
    toast.fromError(e, '刪除失敗');
  }
}
</script>

<template>
  <div class="stack">
    <div class="row head">
      <GButton v-can="'portal.calendar.edit'" variant="primary" icon="upload" @click="openUpload()">上傳年度行事曆</GButton>
    </div>
    <GCard title="年度清單" icon="list">
      <GSkeleton v-if="loading && !data" :lines="3" />
      <GEmpty v-else-if="error" tone="danger" icon="alert" title="無法取得行事曆" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
      <GEmpty v-else-if="!data?.items.length" icon="calendar" title="尚未上傳年度行事曆" />
      <ul v-else class="years">
        <li v-for="c in [...data.items].reverse()" :key="c.year">
          <b class="y">{{ c.year }}</b>
          <a :href="fileUrl(c.fileId)" target="_blank" rel="noopener noreferrer" class="ellipsis name">{{ c.fileName }}</a>
          <span class="xs faint upd">更新 {{ fmtTime(c.updatedAt) }}</span>
          <span v-can="'portal.calendar.edit'" class="acts">
            <GButton size="sm" variant="ghost" square icon="upload" aria-label="重新上傳" @click="openUpload(c)" />
            <GButton size="sm" variant="ghost" square icon="trash" aria-label="刪除" @click="remove(c)" />
          </span>
        </li>
      </ul>
    </GCard>

    <GModal v-model:open="modal" title="上傳年度行事曆" icon="calendar">
      <form class="stack" @submit.prevent="save">
        <GInput v-model="form.year" type="number" label="年度" required />
        <label class="file">
          <span class="xs">PDF 檔(同年度已有則取代)</span>
          <input type="file" accept="application/pdf,.pdf" @change="pick" />
        </label>
        <div class="row acts end">
          <GButton @click="modal = false">取消</GButton>
          <GButton type="submit" variant="primary" icon="upload" :loading="saving">上傳</GButton>
        </div>
      </form>
    </GModal>
  </div>
</template>

<style scoped>
.head {
  justify-content: flex-end;
}
.years {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.years li {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.name {
  flex: 1;
  min-width: 0;
}
.upd {
  flex: none;
}
.acts {
  display: inline-flex;
  gap: 4px;
}
.end {
  justify-content: flex-end;
  gap: 8px;
}
.file {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
@media (max-width: 600px) {
  .upd {
    display: none;
  }
}
</style>
