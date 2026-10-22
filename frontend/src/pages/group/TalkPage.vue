<script setup lang="ts">
/**
 * 3691 全民開講(old_PortalSolar Talktalk3691.aspx;FEATURE-PLAN §5.1、PORTAL-API-PLAN D-23;docs/Gherkin/group/talk.feature)。
 *   - 依分類樹狀列出主題與回覆;畫面不顯示作者(作者以伺服器金鑰加密,只有授權者憑核准文號解碼並留稽核)
 *   - 發文 / 回覆 / 按讚:按鈕 portal.talk.post;屏蔽與管理檢視:portal.talk.moderate;解碼作者:portal.talk.reveal
 *   - 內容是純文字:一律以文字插值輸出(舊版以 Label 原樣輸出,可存入腳本,不沿用)
 */
import { computed, reactive, ref } from 'vue';
import { can, describeError } from '@/api/gateway';
import { talkBlock, talkLike, talkPost, talkPosts, talkReveal } from '@/api/portal';
import { ALL_TYPES, buildTree, postErrors, titleOf, type TalkNode } from '@/composables/talk';
import { useAsync } from '@/composables/useAsync';
import { confirm, toast } from '@/ui/feedback';
import TalkNodeItem from './TalkNodeItem.vue';

const type = ref(ALL_TYPES);
const moderation = ref(false);
const { data, loading, error, reload } = useAsync(() => talkPosts(type.value === ALL_TYPES ? null : type.value, moderation.value));
const tree = computed(() => buildTree(data.value?.items ?? []));
const typeOptions = computed(() => [ALL_TYPES, ...(data.value?.types ?? [])].map((t) => ({ label: t, value: t })));
const postTypeOptions = computed(() => (data.value?.types ?? []).map((t) => ({ label: t, value: t })));
const canPost = computed(() => data.value?.canPost !== false);

function changeType(v: string) {
  type.value = v;
  void reload();
}
function toggleModeration() {
  moderation.value = !moderation.value;
  void reload();
}

// ── 閱讀 ──
const selected = ref<TalkNode | null>(null);
const detail = ref(false);
function select(n: TalkNode) {
  selected.value = n;
  revealed.value = null;
  detail.value = true;
}

// ── 發文 / 回覆 ──
const editor = ref(false);
const form = reactive({ parentSn: null as number | null, parentTitle: '', type: '', title: '', content: '' });
const saving = ref(false);
const formErrors = computed(() => postErrors({ reply: form.parentSn !== null, type: form.type, title: form.title, content: form.content }));
const showErrors = ref(false);

function openNew() {
  Object.assign(form, { parentSn: null, parentTitle: '', type: type.value === ALL_TYPES ? '' : type.value, title: '', content: '' });
  showErrors.value = false;
  editor.value = true;
}
function openReply(n: TalkNode) {
  Object.assign(form, { parentSn: n.sn, parentTitle: titleOf(n), type: n.type, title: '', content: '' });
  showErrors.value = false;
  detail.value = false;
  editor.value = true;
}
async function send() {
  showErrors.value = true;
  if (formErrors.value.length) return;
  saving.value = true;
  try {
    await talkPost(
      form.parentSn ? { parentSn: form.parentSn, title: form.title, content: form.content } : { type: form.type, title: form.title, content: form.content },
    );
    editor.value = false;
    toast.success(form.parentSn ? '已發佈新回應' : '已發佈新主題');
    await reload();
  } catch (e) {
    toast.fromError(e, '發佈失敗');
  } finally {
    saving.value = false;
  }
}

async function like(n: TalkNode) {
  try {
    const r = await talkLike(n.sn);
    n.likes = r.likes;
    n.likedByMe = true;
    void reload();
  } catch (e) {
    toast.fromError(e, '按讚失敗');
  }
}

async function toggleBlock(n: TalkNode) {
  const block = !n.blocked;
  if (
    !(await confirm({
      title: block ? '屏蔽發言' : '取消屏蔽',
      message: `確定${block ? '屏蔽' : '取消屏蔽'}「${titleOf(n)}」?(會留下稽核紀錄)`,
      tone: block ? 'danger' : 'primary',
    }))
  )
    return;
  try {
    await talkBlock(n.sn, block);
    detail.value = false;
    toast.success(block ? '已屏蔽' : '已取消屏蔽');
    await reload();
  } catch (e) {
    toast.fromError(e, '操作失敗');
  }
}

// ── 解碼作者(D-23)──
const revealForm = reactive({ open: false, approvalNo: '', reason: '' });
const revealed = ref<string | null>(null);
const revealing = ref(false);
function openReveal() {
  Object.assign(revealForm, { open: true, approvalNo: '', reason: '' });
}
async function reveal() {
  if (!selected.value || !revealForm.approvalNo.trim()) return toast.error('請填寫核准文號');
  revealing.value = true;
  try {
    revealed.value = (await talkReveal(selected.value.sn, revealForm.approvalNo.trim(), revealForm.reason.trim())).empNo;
    revealForm.open = false;
  } catch (e) {
    toast.fromError(e, '解碼失敗');
  } finally {
    revealing.value = false;
  }
}
</script>

<template>
  <div class="stack talk">
    <GAlert tone="info" icon="shield">
      本看板不顯示發言者;留言者身分採加密方式處理,須經核准並填寫核准文號後方得調閱,每次調閱皆留有稽核紀錄。請理性發言,勿涉及人身攻擊或個人隱私。
    </GAlert>

    <div class="row head">
      <GSelect :model-value="type" :options="typeOptions" class="type" @update:model-value="changeType" />
      <span class="row tools">
        <GButton v-if="can('portal.talk.moderate')" size="sm" variant="ghost" :icon="moderation ? 'eye-off' : 'eye'" @click="toggleModeration">
          {{ moderation ? '一般檢視' : '管理檢視' }}
        </GButton>
        <GButton v-can="'portal.talk.post'" variant="primary" icon="plus" :disabled="!canPost" @click="openNew">新主題</GButton>
      </span>
    </div>
    <GAlert v-if="data && !canPost" tone="warning" icon="alert">作者加密金鑰尚未設定,暫時不能發文(瀏覽不受影響)。</GAlert>

    <GCard v-if="loading && !data"><GSkeleton :lines="6" /></GCard>
    <GCard v-else-if="error">
      <GEmpty tone="danger" icon="alert" title="無法取得討論串" :description="describeError(error)">
        <GButton icon="refresh" @click="reload">重試</GButton>
      </GEmpty>
    </GCard>
    <GCard v-else-if="!tree.length"><GEmpty icon="message" title="這個分類還沒有發言" /></GCard>
    <template v-else>
      <GCard v-for="n in tree" :key="n.sn" padding="sm">
        <div class="meta xs faint">
          <GBadge v-if="n.type" tone="neutral">{{ n.type }}</GBadge>
          <span>回覆 {{ n.replyCount }}</span>
        </div>
        <ul class="tree">
          <TalkNodeItem :node="n" @select="select" />
        </ul>
      </GCard>
    </template>

    <!-- 閱讀 -->
    <GModal v-model:open="detail" :title="selected ? titleOf(selected) : ''" icon="message" width="640px">
      <div v-if="selected" class="stack">
        <div class="meta xs faint">
          <GBadge v-if="selected.type" tone="neutral">{{ selected.type }}</GBadge>
          <span>{{ selected.createdAt ?? '' }}</span>
          <GBadge v-if="selected.blocked" tone="danger">已屏蔽</GBadge>
        </div>
        <p class="content">{{ selected.content }}</p>
        <GAlert v-if="revealed" tone="warning" icon="key">發言者工號:{{ revealed }}(已記錄本次調閱)</GAlert>
        <div class="row acts">
          <span class="xs faint likes"><GIcon name="thumbs-up" /> {{ selected.likes }}</span>
          <GButton
            v-if="!selected.blocked"
            v-can="'portal.talk.post'"
            size="sm"
            variant="ghost"
            icon="thumbs-up"
            :disabled="selected.likedByMe"
            @click="like(selected)"
          >
            {{ selected.likedByMe ? '已按讚' : '按讚' }}
          </GButton>
          <GButton
            v-if="!selected.blocked"
            v-can="'portal.talk.post'"
            size="sm"
            variant="secondary"
            icon="message"
            :disabled="!canPost"
            @click="openReply(selected)"
          >
            回覆
          </GButton>
          <GButton v-can="'portal.talk.moderate'" size="sm" variant="ghost" :icon="selected.blocked ? 'unlock' : 'lock'" @click="toggleBlock(selected)">
            {{ selected.blocked ? '取消屏蔽' : '屏蔽發言' }}
          </GButton>
          <GButton v-can="'portal.talk.reveal'" size="sm" variant="danger" icon="key" @click="openReveal">解碼作者</GButton>
        </div>
      </div>
    </GModal>

    <!-- 發文 / 回覆 -->
    <GModal v-model:open="editor" :title="form.parentSn ? '新回覆' : '新主題'" icon="edit" width="640px">
      <form class="stack" @submit.prevent="send">
        <p v-if="form.parentSn" class="xs faint">回覆:{{ form.parentTitle }}(分類沿用「{{ form.type || '未分類' }}」)</p>
        <GSelect v-else v-model="form.type" label="分類" :options="postTypeOptions" placeholder="請選擇分類" required />
        <GInput v-model="form.title" :label="form.parentSn ? '標題(選填)' : '標題'" :required="!form.parentSn" />
        <GTextarea v-model="form.content" label="內容(純文字)" :rows="8" required />
        <ul v-if="showErrors && formErrors.length" class="errs xs">
          <li v-for="e in formErrors" :key="e">{{ e }}</li>
        </ul>
        <div class="row end">
          <GButton @click="editor = false">取消</GButton>
          <GButton type="submit" variant="primary" icon="send" :loading="saving">送出</GButton>
        </div>
      </form>
    </GModal>

    <!-- 解碼作者 -->
    <GModal v-model:open="revealForm.open" title="解碼作者" icon="key" tone="danger">
      <form class="stack" @submit.prevent="reveal">
        <GAlert tone="warning" icon="alert">解碼作者須事先取得核准;本次操作(含核准文號、理由、操作者、時間)會寫入稽核紀錄。</GAlert>
        <GInput v-model="revealForm.approvalNo" label="核准文號" required />
        <GInput v-model="revealForm.reason" label="理由(選填)" />
        <div class="row end">
          <GButton @click="revealForm.open = false">取消</GButton>
          <GButton type="submit" variant="danger" icon="key" :loading="revealing">解碼</GButton>
        </div>
      </form>
    </GModal>
  </div>
</template>

<style scoped>
.head {
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.type {
  min-width: 180px;
}
.tools {
  gap: 8px;
}
.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.tree {
  margin: 0;
  padding: 0;
}
.content {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.7;
}
.acts {
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.likes {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-right: auto;
}
.end {
  justify-content: flex-end;
  gap: 8px;
}
.errs {
  margin: 0;
  padding-left: 18px;
  color: var(--c-danger);
}
</style>
