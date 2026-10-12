<script setup lang="ts">
/**
 * 個人基本資料 - 溫室氣體盤查員工通勤調查 Tab(old_PortalSolar HRPDatabase03.aspx;docs/Gherkin/personal/commute.feature)
 * 資料:GET / PUT /api/portal/commute(與舊入口網共用 PortalSolar CpfExInfo);送出時由 portal-api 以 Google 地圖轉經緯度。
 * 送出按鈕 v-can="portal.profile.commute-edit"(includes portal.api.commute.write)。
 */
import { computed, reactive, ref, watch } from 'vue';
import { describeError } from '@/api/gateway';
import { commute, submitCommute, type CommuteInput } from '@/api/portal';
import { useAsync } from '@/composables/useAsync';
import { toast } from '@/ui/feedback';

const { data, loading, error, reload } = useAsync(() => commute());

const form = reactive<Required<CommuteInput>>({
  address: '',
  transport: '',
  startStation: '',
  endStation: '',
  transport2: '',
  startStation2: '',
  endStation2: '',
  note: '',
});
const saving = ref(false);

watch(data, (d) => {
  const r = d?.record;
  if (!r) return;
  Object.assign(form, {
    address: r.address ?? '',
    transport: r.transport ?? '',
    startStation: r.startStation ?? '',
    endStation: r.endStation ?? '',
    transport2: r.transport2 ?? '',
    startStation2: r.startStation2 ?? '',
    endStation2: r.endStation2 ?? '',
    note: r.note ?? '',
  });
});

const options = computed(() => (data.value?.transport ?? []).map((t) => ({ label: t, value: t })));
const isPublic = (t: string) => !!t && (data.value?.publicTransport ?? []).includes(t);
const updatedAt = computed(() => (data.value?.record?.updatedAt ? new Date(data.value.record.updatedAt).toLocaleDateString('zh-TW') : null));

async function submit() {
  saving.value = true;
  try {
    // 沒有次要通勤方式時不送次要欄位(後端寫入 NULL,同舊系統)
    const body: CommuteInput = form.transport2
      ? { ...form }
      : { address: form.address, transport: form.transport, startStation: form.startStation, endStation: form.endStation, note: form.note };
    await submitCommute(body);
    toast.success('資料已成功送出');
    await reload();
  } catch (e) {
    toast.fromError(e, '送出失敗');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="stack profile-commute">
    <GCard v-if="loading && !data"><GEmpty icon="clock" title="載入中…" /></GCard>
    <GCard v-else-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得通勤調查" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="data" title="溫室氣體盤查 · 員工通勤調查" :subtitle="updatedAt ? `最後填寫:${updatedAt}` : '尚未填寫'" icon="leaf">
      <form class="stack" @submit.prevent="submit">
        <GInput v-model="form.address" label="上班通勤現居地" placeholder="例:新竹縣竹北市光明六路 1 號" required />
        <p v-if="data.record?.googleAddress" class="muted small">地圖定位:{{ data.record.googleAddress }}</p>

        <div class="grid grid-3">
          <GSelect v-model="form.transport" label="主要通勤方式" :options="options" placeholder="請選擇" required />
          <GInput v-model="form.startStation" label="起點站" :required="isPublic(form.transport)" :disabled="!isPublic(form.transport)" />
          <GInput v-model="form.endStation" label="終點站" :required="isPublic(form.transport)" :disabled="!isPublic(form.transport)" />
        </div>
        <div class="grid grid-3">
          <GSelect v-model="form.transport2" label="次要通勤方式" :options="options" placeholder="無" />
          <GInput v-model="form.startStation2" label="起點站" :required="isPublic(form.transport2)" :disabled="!isPublic(form.transport2)" />
          <GInput v-model="form.endStation2" label="終點站" :required="isPublic(form.transport2)" :disabled="!isPublic(form.transport2)" />
        </div>
        <GTextarea v-model="form.note" label="備註" />

        <GAlert v-if="!data.canSubmit" tone="warning" icon="alert">地址定位服務尚未設定,暫時無法送出;請洽資訊單位。</GAlert>
        <div class="row actions">
          <GButton v-can="'portal.profile.commute-edit'" type="submit" variant="primary" icon="send" :loading="saving" :disabled="!data.canSubmit">送出</GButton>
        </div>
      </form>
    </GCard>

    <GAlert tone="info" title="通勤調查說明">
      <p class="muted">
        配合集團溫室氣體盤查,統計同仁日常上下班通勤的排放量。送出時會以地圖服務確認地址位置;搭乘火車、高鐵、公車、捷運請填寫起點與終點站。資料與舊入口網共用。
      </p>
    </GAlert>
  </div>
</template>

<style scoped>
.profile-commute {
  --gap: 16px;
}
.actions {
  justify-content: flex-end;
}
.small {
  font-size: var(--fs-sm);
  margin: -8px 0 0;
}
</style>
