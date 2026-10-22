<script setup lang="ts">
/**
 * 問卷新增 / 編輯(old_PortalSolar QA/QuestSetting.aspx;FEATURE-PLAN §3.4;D-19、D-28)。
 *   - 對象:全集團 / 部門樹(加入時含下層展開)/ 工號清單;「理級以上 / 課級以上」改用 Gateway 職級(介面待 Gateway 提供)
 *   - 題目:單選 / 複選 / 問答、選項範本、複選上限、必填、上移 / 下移;已有作答時結構鎖定,只能改題目文字與圖片
 *   - 圖片:上傳到 giga-file-service,以題號綁定;問卷存檔後把本次上傳的檔案綁定到問卷(未綁定的暫存檔 24 小時後清除)
 */
import { computed, reactive, ref, watch } from 'vue';
import { qaBindImages, qaCreate, qaDepartments, qaDetail, qaImageUrl, qaJobTier, qaUpdate, uploadQaImage, type QaDept, type QaSurveyInput } from '@/api/portal';
import {
  addDepts,
  fromQuestion,
  moveQuestion,
  newQuestion,
  OPTION_TEMPLATES,
  parseEmpList,
  QA_DEPTS,
  QA_TYPES,
  surveyErrors,
  targetSummary,
  toQuestionInput,
  type EditQuestion,
} from '@/composables/qa';
import { toast } from '@/ui/feedback';

const props = defineProps<{ qaNo: string | null; admin: boolean }>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ saved: [qaNo: string] }>();

const form = reactive({ title: '', dept: '人力資源部', intro: '', outro: '', startDate: '', endDate: '', all: false, depts: [] as string[], empsText: '' });
const questions = ref<EditQuestion[]>([]);
const locked = ref(false);
const respondents = ref(0);
const loading = ref(false);
const saving = ref(false);
const errors = ref<string[]>([]);
/** 本次上傳、尚未綁定的圖片 */
const uploaded = ref<string[]>([]);
const uploading = ref(-1);

const depts = ref<QaDept[]>([]);
const deptQuery = ref('');
const deptName = computed(() => new Map(depts.value.map((d) => [d.code, d.name ?? d.code])));
const deptMatches = computed(() => {
  const q = deptQuery.value.trim().toLowerCase();
  if (!q) return [];
  return depts.value.filter((d) => d.code.toLowerCase().includes(q) || (d.name ?? '').toLowerCase().includes(q)).slice(0, 30);
});

const deptOptions = computed(() => {
  const list = QA_DEPTS.includes(form.dept) || !form.dept ? QA_DEPTS : [form.dept, ...QA_DEPTS];
  return list.map((d) => ({ label: d, value: d }));
});
const typeOptions = QA_TYPES.map((t) => ({ label: t.label, value: t.value }));
const templateOptions = Object.keys(OPTION_TEMPLATES).map((k) => ({ label: `帶入範本:${k}`, value: k }));

async function load() {
  errors.value = [];
  uploaded.value = [];
  deptQuery.value = '';
  loading.value = true;
  try {
    if (!depts.value.length) depts.value = (await qaDepartments()).items;
    if (!props.qaNo) {
      Object.assign(form, { title: '', dept: '人力資源部', intro: '', outro: '', startDate: '', endDate: '', all: false, depts: [], empsText: '' });
      questions.value = [newQuestion()];
      locked.value = false;
      respondents.value = 0;
      return;
    }
    const d = await qaDetail(props.admin, props.qaNo);
    Object.assign(form, {
      title: d.title,
      dept: d.dept ?? '',
      intro: d.intro,
      outro: d.outro,
      startDate: d.startDate ?? '',
      endDate: d.endDate ?? '',
      all: d.targets.all,
      depts: d.targets.depts,
      empsText: d.targets.emps.join(', '),
    });
    questions.value = d.questions.map(fromQuestion);
    locked.value = d.locked;
    respondents.value = d.respondents;
  } catch (e) {
    toast.fromError(e, '無法讀取問卷');
    open.value = false;
  } finally {
    loading.value = false;
  }
}
watch(open, (v) => v && void load(), { immediate: true });

function addDept(code: string) {
  const t = addDepts({ all: false, depts: form.depts, emps: [] }, code, depts.value);
  form.depts = t.depts;
  deptQuery.value = '';
}
const removeDept = (code: string) => (form.depts = form.depts.filter((d) => d !== code));

async function fillTier(tier: 'section' | 'manager') {
  try {
    const { emps } = await qaJobTier(tier);
    form.empsText = [...new Set([...parseEmpList(form.empsText), ...emps])].join(', ');
    toast.success(`已帶入 ${emps.length} 位`);
  } catch (e) {
    toast.fromError(e, '無法帶入職級人員');
  }
}

function applyTemplate(q: EditQuestion, key: string) {
  const t = OPTION_TEMPLATES[key];
  if (t) q.optionsText = t.join('\n');
}

const move = (i: number, d: -1 | 1) => (questions.value = moveQuestion(questions.value, i, d));
const removeQ = (i: number) => (questions.value = questions.value.filter((_, j) => j !== i));

const chooseFile = (i: number) => (document.getElementById(`qa-img-${i}`) as HTMLInputElement | null)?.click();

async function pickImage(i: number, ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) return toast.error('只接受 PNG、JPG、GIF、WebP 圖片');
  uploading.value = i;
  try {
    const fileId = await uploadQaImage(file);
    uploaded.value.push(fileId);
    const q = questions.value[i]!;
    q.image = { fileId, position: q.image?.position ?? 'after', width: q.image?.width ?? 0, height: q.image?.height ?? 0 };
  } catch (e) {
    toast.fromError(e, '圖片上傳失敗');
  } finally {
    uploading.value = -1;
  }
}

const body = (): QaSurveyInput => ({
  title: form.title.trim(),
  dept: form.dept.trim(),
  intro: form.intro,
  outro: form.outro,
  startDate: form.startDate,
  endDate: form.endDate,
  targets: { all: form.all, depts: form.all ? [] : form.depts, emps: parseEmpList(form.empsText) },
  questions: questions.value.map(toQuestionInput),
});

async function save() {
  const b = body();
  errors.value = surveyErrors(b);
  if (errors.value.length) return;
  saving.value = true;
  try {
    let qaNo = props.qaNo;
    if (qaNo) await qaUpdate(props.admin, qaNo, b);
    else qaNo = (await qaCreate(b)).qaNo;
    // 只綁定仍在使用中的新圖片(換掉的暫存檔由附件服務清除)
    const used = new Set(b.questions.map((q) => q.image?.fileId).filter(Boolean));
    const bind = uploaded.value.filter((u) => used.has(u));
    if (bind.length) await qaBindImages(qaNo, bind).catch((e) => toast.fromError(e, '問卷已儲存,但圖片綁定失敗(24 小時內請重新儲存一次)'));
    uploaded.value = [];
    toast.success(props.qaNo ? '已更新問卷' : '已新增問卷');
    open.value = false;
    emit('saved', qaNo);
  } catch (e) {
    const d = (e as { details?: { message: string }[] }).details;
    if (Array.isArray(d) && d.length) errors.value = d.map((x) => x.message);
    toast.fromError(e, '儲存失敗');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <GModal v-model:open="open" :title="qaNo ? '編輯問卷' : '新增問卷'" icon="edit" width="880px" persistent>
    <GEmpty v-if="loading" icon="clock" title="載入中…" compact />
    <form v-else class="stack editor" @submit.prevent="save">
      <GAlert v-if="locked" tone="warning" title="已有作答,題目結構已鎖定">
        已有 {{ respondents }} 人作答:不能新增 / 刪除 / 調整題目順序、題型、選項、複選上限與必填,只能修改題目文字、圖片、說明、對象與起訖日。
      </GAlert>

      <GInput v-model="form.title" label="標題" required />
      <div class="grid2">
        <GSelect v-model="form.dept" label="主辦單位" :options="deptOptions" />
        <div class="grid2">
          <GInput v-model="form.startDate" type="date" label="開始日" required />
          <GInput v-model="form.endDate" type="date" label="結束日" required />
        </div>
      </div>
      <GTextarea v-model="form.intro" label="前言" :rows="3" hint="可輸入純文字;舊問卷的 HTML 格式會保留(以白名單過濾)" />
      <GTextarea v-model="form.outro" label="結語" :rows="2" />

      <GCard title="填寫對象" :subtitle="targetSummary({ all: form.all, depts: form.depts, emps: parseEmpList(form.empsText) })" icon="users" padding="sm">
        <div class="stack">
          <GSwitch v-model="form.all" label="全集團" />
          <template v-if="!form.all">
            <div class="stack">
              <GInput v-model="deptQuery" icon="search" label="加入部門(含下層)" placeholder="輸入部門代碼或名稱搜尋" clearable />
              <div v-if="deptMatches.length" class="dept-list">
                <button v-for="d in deptMatches" :key="d.code" type="button" class="dept-item" @click="addDept(d.code)">
                  <span class="mono">{{ d.code }}</span> {{ d.name }}
                </button>
              </div>
              <div class="chips">
                <span v-for="c in form.depts" :key="c" class="chip">
                  <span class="mono">{{ c }}</span> {{ deptName.get(c) ?? '' }}
                  <button type="button" class="chip-x" :aria-label="`移除 ${c}`" @click="removeDept(c)">×</button>
                </span>
                <span v-if="!form.depts.length" class="small faint">尚未選擇部門</span>
                <GButton v-else variant="ghost" size="sm" @click="form.depts = []">清除部門</GButton>
              </div>
            </div>
          </template>
          <GTextarea v-model="form.empsText" label="對象人員(工號,以逗號或換行分隔)" :rows="2" mono />
          <div class="row tier">
            <GButton size="sm" icon="user-check" @click="fillTier('manager')">帶入理級以上</GButton>
            <GButton size="sm" icon="user-check" @click="fillTier('section')">帶入課級以上</GButton>
          </div>
        </div>
      </GCard>

      <div class="stack">
        <div v-for="(q, i) in questions" :key="i" class="qcard">
          <div class="row qhead">
            <strong class="mono">題 {{ i + 1 }}</strong>
            <span class="spacer" />
            <GButton
              size="sm"
              variant="ghost"
              icon="chevron-down"
              square
              aria-label="下移"
              :disabled="locked || i === questions.length - 1"
              @click="move(i, 1)"
            />
            <GButton size="sm" variant="ghost" icon="chevron-down" square aria-label="上移" class="up" :disabled="locked || i === 0" @click="move(i, -1)" />
            <GButton size="sm" variant="ghost" icon="trash" square aria-label="刪除題目" :disabled="locked || questions.length === 1" @click="removeQ(i)" />
          </div>
          <div class="grid2">
            <GSelect v-model="q.type" label="題型" :options="typeOptions" :disabled="locked" />
            <div class="row req">
              <GCheckbox v-model="q.required" label="必填" :disabled="locked" />
            </div>
          </div>
          <GTextarea v-model="q.text" label="題目" :rows="2" required />
          <template v-if="q.type !== 'text'">
            <GSelect v-if="!locked" :model-value="''" :options="templateOptions" placeholder="帶入選項範本…" @update:model-value="applyTemplate(q, $event)" />
            <GTextarea v-model="q.optionsText" label="選項(一行一個)" :rows="4" :disabled="locked" />
            <GInput v-if="q.type === 'multi'" v-model="q.limit" type="number" label="最多可選(空白 = 不限)" :disabled="locked" />
          </template>
          <div class="img-row">
            <template v-if="q.image">
              <img :src="qaImageUrl(q.image.fileId)" alt="題目圖片" class="thumb" />
              <GSelect
                v-model="q.image.position"
                label="位置"
                :options="[
                  { label: '題目前', value: 'before' },
                  { label: '題目後', value: 'after' },
                ]"
              />
              <GInput v-model.number="q.image.width" type="number" label="寬(px,0 = 原尺寸)" />
              <GButton size="sm" variant="ghost" icon="trash" @click="q.image = null">移除圖片</GButton>
            </template>
            <input :id="`qa-img-${i}`" class="file" type="file" accept="image/png,image/jpeg,image/gif,image/webp" @change="pickImage(i, $event)" />
            <GButton size="sm" icon="image" :loading="uploading === i" @click="chooseFile(i)">{{ q.image ? '更換圖片' : '上傳圖片' }}</GButton>
            <span v-if="q.legacyImage" class="small faint">此題有舊入口網圖片(新入口網不顯示)</span>
          </div>
        </div>
        <GButton v-if="!locked" icon="plus" @click="questions.push(newQuestion())">新增題目</GButton>
      </div>

      <GAlert v-if="errors.length" tone="danger" title="請確認以下欄位">
        <ul class="errs">
          <li v-for="m in errors" :key="m">{{ m }}</li>
        </ul>
      </GAlert>
      <div class="row modal-actions">
        <GButton @click="open = false">取消</GButton>
        <GButton type="submit" variant="primary" icon="save" :loading="saving">儲存</GButton>
      </div>
    </form>
  </GModal>
</template>

<style scoped>
.editor {
  --gap: 14px;
}
.grid2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: end;
}
@media (max-width: 640px) {
  .grid2 {
    grid-template-columns: 1fr;
  }
}
.dept-list {
  display: flex;
  flex-direction: column;
  max-height: 200px;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
}
.dept-item {
  text-align: left;
  padding: 6px 10px;
  background: none;
  border: 0;
  border-bottom: 1px solid var(--line);
  color: var(--text);
  cursor: pointer;
}
.dept-item:hover {
  background: var(--glass-hover);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  max-height: 160px;
  overflow: auto;
}
.chip {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--glass-soft);
  border: 1px solid var(--line);
  font-size: var(--fs-sm);
}
.chip-x {
  background: none;
  border: 0;
  color: var(--text-3);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}
.tier {
  gap: 8px;
  flex-wrap: wrap;
}
.qcard {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--glass-soft);
}
.qhead {
  gap: 4px;
  align-items: center;
}
.spacer {
  flex: 1;
}
.up :deep(svg) {
  transform: rotate(180deg);
}
.req {
  align-items: center;
  min-height: 40px;
}
.img-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: end;
}
.thumb {
  max-width: 120px;
  max-height: 80px;
  border-radius: 6px;
  border: 1px solid var(--line);
}
.file {
  display: none;
}
.small {
  font-size: var(--fs-sm);
}
.errs {
  margin: 0;
  padding-left: 18px;
}
.modal-actions {
  justify-content: flex-end;
  gap: 8px;
}
</style>
