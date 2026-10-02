<script setup lang="ts">
/**
 * 個人提醒與備忘錄 (對齊 old_PortalSolar PersonalNote)
 * 供同仁記錄公務交辦事項、行事提醒、重要截止日與個人筆記。
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GModal, GSelect } from '@/ui';

interface NoteItem {
  id: string;
  title: string;
  date: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  done: boolean;
  content: string;
}

const notes = ref<NoteItem[]>([
  {
    id: '1',
    title: '完成 Q3 GitLab CI/CD 自動化部署測試區驗證',
    date: '2026/10/02',
    priority: 'high',
    category: '工程研發',
    done: false,
    content: '需確認 Docker 離線快取與 Alpine musl 依賴安裝正常。',
  },
  {
    id: '2',
    title: '參加職場霸凌防制線上教育訓練課程',
    date: '2026/10/15',
    priority: 'medium',
    category: '法規必修',
    done: false,
    content: '至 E-Learning 平台收看 1 小時影片並完成線上測驗。',
  },
  {
    id: '3',
    title: '盤點辦公室與個人名下固定資產設備',
    date: '2026/10/20',
    priority: 'low',
    category: '總務行政',
    done: true,
    content: '完成 ThinkPad 筆電與 4K 螢幕標籤條碼核對。',
  },
]);

const newModal = ref(false);
const newTitle = ref('');
const newDate = ref('');
const newCategory = ref('工作交辦');
const newPriority = ref<'high' | 'medium' | 'low'>('medium');
const newContent = ref('');

const categoryOptions = [
  { label: '工作交辦', value: '工作交辦' },
  { label: '工程研發', value: '工程研發' },
  { label: '法規必修', value: '法規必修' },
  { label: '總務行政', value: '總務行政' },
  { label: '個人筆記', value: '個人筆記' },
];

const priorityOptions = [
  { label: '高優先級 (重要緊急)', value: 'high' },
  { label: '中優先級 (一般交辦)', value: 'medium' },
  { label: '低優先級 (備忘參考)', value: 'low' },
];

function addNote() {
  if (!newTitle.value) return;
  notes.value.unshift({
    id: String(Date.now()),
    title: newTitle.value,
    date: newDate.value || new Date().toISOString().slice(0, 10).replace(/-/g, '/'),
    priority: newPriority.value,
    category: newCategory.value,
    done: false,
    content: newContent.value,
  });
  newTitle.value = '';
  newContent.value = '';
  newModal.value = false;
}

function toggleDone(item: NoteItem) {
  item.done = !item.done;
}

function deleteNote(item: NoteItem) {
  notes.value = notes.value.filter((n) => n.id !== item.id);
}
</script>

<template>
  <div class="notes-page stack">
    <div class="header-actions">
      <div class="summary-info">
        <GBadge tone="storage" icon="bell">目前待辦提醒共 {{ notes.filter((n) => !n.done).length }} 項</GBadge>
      </div>
      <GButton variant="primary" icon="plus" @click="newModal = true">新增提醒備忘</GButton>
    </div>

    <div class="notes-grid">
      <GCard
        v-for="item in notes"
        :key="item.id"
        class="note-card glass"
        :class="{ completed: item.done }"
      >
        <div class="note-header">
          <div class="note-badges">
            <GBadge :tone="item.priority === 'high' ? 'danger' : item.priority === 'medium' ? 'alert' : 'neutral'">
              {{ item.priority === 'high' ? '高' : item.priority === 'medium' ? '中' : '低' }}
            </GBadge>
            <GBadge tone="storage">{{ item.category }}</GBadge>
          </div>
          <span class="mono small faint">{{ item.date }}</span>
        </div>

        <div class="note-body">
          <h4 :class="{ strikethrough: item.done }">{{ item.title }}</h4>
          <p class="content-text">{{ item.content }}</p>
        </div>

        <div class="note-footer">
          <GButton
            variant="ghost"
            size="small"
            :icon="item.done ? 'refresh-cw' : 'check'"
            @click="toggleDone(item)"
          >
            {{ item.done ? '標記未完成' : '標記完成' }}
          </GButton>
          <GButton variant="ghost" size="small" icon="trash-2" @click="deleteNote(item)">
            刪除
          </GButton>
        </div>
      </GCard>
    </div>

    <GAlert tone="neutral" icon="info">
      本提醒系統記錄僅儲存於個人帳戶，具私密性。您所設定的待辦事項亦會同步摘要顯示於入口網首頁「個人秘書」專區。
    </GAlert>

    <!-- 新增彈窗 -->
    <GModal v-model:open="newModal" title="新增個人行事提醒備忘">
      <div class="modal-form stack">
        <div>
          <label class="form-label">提醒主旨 / 待辦標題 <span class="required">*</span></label>
          <GInput v-model="newTitle" placeholder="例如：填報專案工時、繳交體檢報告" />
        </div>
        <div class="grid-two">
          <div>
            <label class="form-label">截止日期</label>
            <GInput v-model="newDate" type="date" />
          </div>
          <div>
            <label class="form-label">分類項目</label>
            <GSelect v-model="newCategory" :options="categoryOptions" />
          </div>
        </div>
        <div>
          <label class="form-label">優先級別</label>
          <GSelect v-model="newPriority" :options="priorityOptions" />
        </div>
        <div>
          <label class="form-label">備忘詳細內容</label>
          <GInput v-model="newContent" placeholder="記錄詳細說明、相關聯絡人或備註" />
        </div>
        <div class="modal-btn-row">
          <GButton variant="secondary" @click="newModal = false">取消</GButton>
          <GButton variant="primary" icon="check" @click="addNote">新增建立</GButton>
        </div>
      </div>
    </GModal>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.note-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.note-card.completed {
  opacity: 0.7;
}
.note-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.note-badges {
  display: flex;
  gap: 6px;
}
.note-body h4 {
  margin: 0 0 6px;
  font-size: var(--fs-md);
}
.note-body h4.strikethrough {
  text-decoration: line-through;
  color: var(--text-3);
}
.content-text {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--text-2);
  line-height: 1.5;
}
.note-footer {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid var(--line);
  padding-top: 8px;
  margin-top: auto;
}
.form-label {
  display: block;
  font-weight: 600;
  font-size: var(--fs-sm);
  margin-bottom: 6px;
}
.required {
  color: var(--c-danger);
}
.grid-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.modal-btn-row {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
}
.mono {
  font-family: var(--font-mono, monospace);
}
</style>
