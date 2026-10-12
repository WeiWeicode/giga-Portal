<script setup lang="ts">
/**
 * 分機表(old_PortalSolar ExtensionTable.aspx、ExtansionUp.aspx;docs/Gherkin/resources/directory.feature)
 * 查詢:1–2 個關鍵字(逗號或空白分隔);更新本人分機按鈕 v-can="portal.directory.edit"(includes portal.api.directory.write)。
 */
import { ref } from 'vue';
import { describeError } from '@/api/gateway';
import { searchDirectory, updateMyPhone, type DirectoryEntry } from '@/api/portal';
import { toast } from '@/ui/feedback';

const q = ref('');
const items = ref<DirectoryEntry[] | null>(null);
const truncated = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);

async function search() {
  if (q.value.trim().length < 2) {
    error.value = '請輸入至少 2 個字';
    items.value = null;
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const r = await searchDirectory(q.value.trim());
    items.value = r.items;
    truncated.value = r.truncated;
  } catch (e) {
    error.value = describeError(e);
  } finally {
    loading.value = false;
  }
}

const phone = ref('');
const saving = ref(false);
async function savePhone() {
  if (!phone.value.trim()) return;
  saving.value = true;
  try {
    const r = await updateMyPhone(phone.value.trim());
    toast.success('分機已更新', `新分機 ${r.phone}`);
    phone.value = '';
    if (items.value) await search();
  } catch (e) {
    toast.fromError(e, '更新失敗');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="stack directory">
    <GCard title="查詢分機" icon="search">
      <form class="row search" @submit.prevent="search">
        <GInput v-model="q" placeholder="部門、工號、姓名、職稱或分機(至少 2 字);兩個關鍵字以逗號或空白分隔" icon="search" />
        <GButton type="submit" variant="primary" icon="search" :loading="loading">查詢</GButton>
      </form>
    </GCard>

    <GCard v-if="error"><GEmpty tone="danger" icon="alert" title="查詢失敗" :description="error" /></GCard>
    <GCard v-else-if="items && !items.length"><GEmpty icon="search" title="查無符合的同仁" /></GCard>
    <GCard v-else-if="items" :title="`查詢結果 ${items.length} 筆`" icon="phone">
      <GAlert v-if="truncated" tone="info" icon="info">結果超過 200 筆,只顯示前 200 筆,請加上第二個關鍵字縮小範圍。</GAlert>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>部門</th>
              <th>工號</th>
              <th>姓名</th>
              <th>英文名</th>
              <th>職稱</th>
              <th>分機</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in items" :key="p.empNo">
              <td>
                <span class="mono">{{ p.dept ?? '' }}</span> {{ p.deptName ?? '' }}
              </td>
              <td class="mono">{{ p.empNo }}</td>
              <td>{{ p.name ?? '—' }}</td>
              <td>{{ p.englishName ?? '—' }}</td>
              <td>{{ p.title ?? '—' }}</td>
              <td class="mono strong">{{ p.phone ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>

    <GCard v-can="'portal.directory.edit'" title="更新我的分機" icon="edit">
      <form class="row search" @submit.prevent="savePhone">
        <GInput v-model="phone" placeholder="例:2109" />
        <GButton type="submit" icon="check" :loading="saving">更新</GButton>
      </form>
    </GCard>
  </div>
</template>

<style scoped>
.directory {
  --gap: 16px;
}
.search {
  gap: 10px;
  align-items: flex-end;
}
.search > :first-child {
  flex: 1;
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
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  text-align: left;
}
.data-table th {
  font-weight: 600;
  color: var(--text-2);
  background: var(--glass-soft);
}
.mono {
  font-family: var(--font-mono, monospace);
}
.strong {
  font-weight: 700;
}
</style>
