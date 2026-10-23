<script setup lang="ts">
/**
 * 電視看板設定(P7 臨時服務;FEATURE-PLAN §9;docs/Gherkin/services/tv.feature)。
 * 舊程式 TVDemoSetting.aspx 不需登入、可上傳任意檔;新站需登入 + 權限(讀 portal.svc.tv.read、維護按鈕 portal.svc.tv.edit),
 * 圖片經 giga-file-service(sourceApp / refType portal-tv,只收 jpg / png / gif / webp)。看板網址 /tv(免登入)。
 */
import { reactive, ref, watch } from 'vue';
import { describeError } from '@/api/gateway';
import { addTvImage, bindFiles, deleteTvImage, fileUrl, setTvMessage, tvSettings, updateTvImages, uploadFile, type TvImageUpdate } from '@/api/portal';
import { useAsync } from '@/composables/useAsync';
import { confirm, toast } from '@/ui/feedback';

const REF = 'portal-tv';
const ACCEPT = '.jpg,.jpeg,.png,.gif,.webp';
const { data, loading, error, reload } = useAsync(tvSettings);
const msg = reactive({ message: '', fontSize: 24 });
watch(data, (d) => d && Object.assign(msg, { message: d.message, fontSize: d.fontSize }), { immediate: true });
const saving = ref(false);
const picker = ref<HTMLInputElement | null>(null);
const boardUrl = `${import.meta.env.BASE_URL}tv`;

async function saveMessage() {
  saving.value = true;
  try {
    await setTvMessage({ message: msg.message, fontSize: Number(msg.fontSize) });
    toast.success('已更新訊息');
    await reload();
  } catch (e) {
    toast.fromError(e, '更新失敗');
  } finally {
    saving.value = false;
  }
}

async function upload(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = '';
  if (!f) return;
  if (!/\.(png|jpe?g|gif|webp)$/i.test(f.name)) return toast.error('只接受 jpg / png / gif / webp 圖片');
  try {
    const fileId = await uploadFile(REF, f);
    const added = await addTvImage({ fileId, fileName: f.name });
    await bindFiles(REF, String(added.id), [fileId]).catch(async (err) => {
      // 綁定失敗:暫存檔 24 小時後會被清除,撤回登記
      await deleteTvImage(added.id).catch(() => undefined);
      throw err;
    });
    toast.success('已新增展示照片', f.name);
    await reload();
  } catch (err) {
    toast.fromError(err, '上傳失敗');
  }
}

async function apply(items: TvImageUpdate[]) {
  try {
    await updateTvImages(items);
    await reload();
  } catch (e) {
    toast.fromError(e, '更新失敗');
  }
}
async function remove(id: number) {
  if (!(await confirm({ title: '刪除圖片', message: '確定刪除這張圖片?', confirmText: '刪除', tone: 'danger' }))) return;
  try {
    await deleteTvImage(id);
    await reload();
  } catch (e) {
    toast.fromError(e, '刪除失敗');
  }
}
</script>

<template>
  <div class="stack">
    <GPageHeader title="電視看板設定" icon="monitor" eyebrow="臨時服務" description="公共螢幕的跑馬燈與輪播圖片">
      <a :href="boardUrl" target="_blank" rel="noopener noreferrer"><GButton size="sm" variant="ghost" icon="external" tabindex="-1">開啟看板</GButton></a>
    </GPageHeader>
    <GCard v-if="loading && !data"><GSkeleton :lines="5" /></GCard>
    <GCard v-else-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得看板設定" :description="describeError(error)"
        ><GButton icon="refresh" @click="reload">重試</GButton></GEmpty
      >
    </GCard>
    <template v-else-if="data">
      <GCard title="跑馬燈" icon="megaphone">
        <form class="stack" @submit.prevent="saveMessage">
          <GTextarea v-model="msg.message" label="訊息" :rows="2" />
          <GInput v-model.number="msg.fontSize" type="number" label="字級(pt,8~200)" />
          <div v-can="'portal.svc.tv.edit'" class="row"><GButton type="submit" variant="primary" icon="save" :loading="saving">更新訊息</GButton></div>
        </form>
      </GCard>

      <GCard title="新站圖片" icon="image">
        <template #actions>
          <span v-can="'portal.svc.tv.edit'">
            <input ref="picker" type="file" class="upload" :accept="ACCEPT" @change="upload" />
            <GButton size="sm" variant="primary" icon="upload" @click="picker?.click()">新增展示照片</GButton>
          </span>
        </template>
        <GEmpty v-if="!data.uploaded.length" compact icon="image" title="尚未上傳" />
        <ul class="imgs">
          <li v-for="u in data.uploaded" :key="u.id" :class="{ off: !u.active }">
            <img :src="fileUrl(u.fileId)" :alt="u.fileName" />
            <span class="xs ellipsis">{{ u.fileName }}</span>
            <span class="xs faint">順序 {{ u.sort }} · {{ u.active ? '展示' : '隱藏' }}</span>
            <span v-can="'portal.svc.tv.edit'" class="row acts">
              <GButton
                size="sm"
                variant="ghost"
                square
                icon="chevron-left"
                aria-label="提前"
                @click="apply([{ source: 'file', id: u.id, sort: Math.max(0, u.sort - 1), active: u.active }])"
              />
              <GButton
                size="sm"
                variant="ghost"
                square
                icon="chevron-right"
                aria-label="延後"
                @click="apply([{ source: 'file', id: u.id, sort: Math.min(255, u.sort + 1), active: u.active }])"
              />
              <GButton
                size="sm"
                variant="ghost"
                square
                :icon="u.active ? 'eye-off' : 'eye'"
                :aria-label="u.active ? '隱藏' : '展示'"
                @click="apply([{ source: 'file', id: u.id, sort: u.sort, active: !u.active }])"
              />
              <GButton size="sm" variant="ghost" square icon="trash" aria-label="刪除" @click="remove(u.id)" />
            </span>
          </li>
        </ul>
      </GCard>

      <GCard title="舊站圖片" subtitle="舊入口網 Document 目錄(唯讀,可切換展示與順序)" icon="folder">
        <GEmpty v-if="!data.legacy.length" compact icon="image" title="沒有舊站圖片" />
        <ul class="imgs">
          <li v-for="l in data.legacy" :key="l.path" :class="{ off: !l.active }">
            <img v-if="l.url" :src="l.url" :alt="l.path" />
            <span class="xs ellipsis">{{ l.path }}</span>
            <span class="xs faint">順序 {{ l.index ?? '—' }} · {{ l.active ? '展示' : '隱藏' }}</span>
            <span v-can="'portal.svc.tv.edit'" class="row acts">
              <GButton
                size="sm"
                variant="ghost"
                square
                icon="chevron-left"
                aria-label="提前"
                @click="apply([{ source: 'legacy', path: l.path, sort: Math.max(0, (l.index ?? 0) - 1), active: l.active }])"
              />
              <GButton
                size="sm"
                variant="ghost"
                square
                icon="chevron-right"
                aria-label="延後"
                @click="apply([{ source: 'legacy', path: l.path, sort: Math.min(255, (l.index ?? 0) + 1), active: l.active }])"
              />
              <GButton
                size="sm"
                variant="ghost"
                square
                :icon="l.active ? 'eye-off' : 'eye'"
                :aria-label="l.active ? '隱藏' : '展示'"
                @click="apply([{ source: 'legacy', path: l.path, sort: l.index ?? 0, active: !l.active }])"
              />
            </span>
          </li>
        </ul>
      </GCard>
    </template>
  </div>
</template>

<style scoped>
.upload {
  display: none;
}
.imgs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}
.imgs li {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.imgs li.off {
  opacity: 0.55;
}
.imgs img {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: var(--radius-sm);
  background: var(--glass-soft);
}
.acts {
  gap: 2px;
  flex-wrap: wrap;
}
</style>
