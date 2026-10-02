<script setup lang="ts">
/**
 * 3691 全民開講 (對齊 old_PortalSolar Talktalk3691.aspx)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GModal, GSelect } from '@/ui';

interface TalkPost {
  id: string;
  category: '不吐不快' | '開講公告' | '老王賣瓜' | '馬路消息' | '資訊分享' | '舉手發問';
  title: string;
  author: string;
  date: string;
  likes: number;
  replies: number;
  content: string;
  comments: Array<{
    author: string;
    date: string;
    content: string;
  }>;
}

const posts = ref<TalkPost[]>([
  {
    id: 'TALK-001',
    category: '不吐不快',
    title: '湖口廠區下班尖峰時段中興路大門交通動線改善建議',
    author: '熱心同仁 (匿名)',
    date: '2026-10-02 08:30',
    likes: 24,
    replies: 5,
    content:
      '每天下午 17:30 下班時，廠區大門口因為左轉中華路的車流經常回堵至廠內停車場，希望能與交通隊協調延長下班尖峰綠燈秒數，或是請守衛在路口協助指揮引導分流，謝謝總務與安衛主管！',
    comments: [
      { author: '總務組 張專員', date: '2026-10-02 09:15', content: '收到建議！總務組已聯繫新竹縣警局交通組現場會勘，並將於下週起安排尖峰引導哨。' },
      { author: '製造處 同事', date: '2026-10-02 09:30', content: '推！真的塞很久，感謝提出！' },
    ],
  },
  {
    id: 'TALK-002',
    category: '資訊分享',
    title: '【軟體技巧】VS Code 與 Copilot 在內網環境開發的小技巧彙整',
    author: '資訊服務部 王大明',
    date: '2026-10-01 16:40',
    likes: 38,
    replies: 3,
    content:
      '最近很多同仁詢問內網如何順暢使用 AI 輔助開發，我在內部知識庫寫了一篇設定 Proxy 與 SSL 憑證的指南，歡迎有興趣的同仁前往技術 Wiki 參考討論！',
    comments: [
      { author: '研發處 軟體工程師', date: '2026-10-01 17:05', content: '太實用了，馬上照著設定成功！' },
    ],
  },
  {
    id: 'TALK-003',
    category: '老王賣瓜',
    title: '恭喜先進材料研發團隊 TOPCon 銀膠配方榮獲國際綠能專利認證！',
    author: '研發技術處',
    date: '2026-09-30 14:20',
    likes: 65,
    replies: 8,
    content:
      '歷經兩年團隊日夜研發與產線試產，本處自主開發之次世代 N 型電池超細線導電漿料已正式通過美國與歐盟專利核准！感謝全體團隊的努力與製造處大力配合！',
    comments: [
      { author: '總經理室', date: '2026-09-30 15:00', content: '恭喜研發團隊！碩禾的驕傲，大家辛苦了！' },
      { author: '業務營業處', date: '2026-09-30 15:30', content: '歐美客戶詢問度爆表，太棒了！' },
    ],
  },
  {
    id: 'TALK-004',
    category: '舉手發問',
    title: '請問廠區福委會特約商店最新折扣手冊哪裡可以索取？',
    author: '新進同仁小美',
    date: '2026-09-28 11:10',
    likes: 12,
    replies: 2,
    content:
      '剛報到不久的新人想請問各位前輩，湖口周邊有哪些特約餐飲店有打折？有電子版手冊可以下載嗎？',
    comments: [
      { author: '福委會專員', date: '2026-09-28 11:45', content: '歡迎新同仁！可至「集團系統 > 福委會」或人資福利專區下載特約店家 PDF 清單喔！' },
    ],
  },
]);

const currentCategory = ref<string>('全部文件');
const categories = ['全部文件', '不吐不快', '開講公告', '老王賣瓜', '馬路消息', '資訊分享', '舉手發問'];

const filteredPosts = computed(() => {
  if (currentCategory.value === '全部文件') return posts.value;
  return posts.value.filter((p) => p.category === currentCategory.value);
});

// 新增貼文 Modal
const newPostModal = ref(false);
const newPostForm = ref({
  category: '不吐不快',
  title: '',
  content: '',
  isAnonymous: false,
});

function openNewPost() {
  newPostForm.value = {
    category: '不吐不快',
    title: '',
    content: '',
    isAnonymous: false,
  };
  newPostModal.value = true;
}

function submitNewPost() {
  if (!newPostForm.value.title || !newPostForm.value.content) return;
  posts.value.unshift({
    id: `TALK-${String(posts.value.length + 1).padStart(3, '0')}`,
    category: newPostForm.value.category as any,
    title: newPostForm.value.title,
    author: newPostForm.value.isAnonymous ? '熱心同仁 (匿名)' : '王大明 (V112001)',
    date: new Date().toISOString().slice(0, 16).replace('T', ' '),
    likes: 1,
    replies: 0,
    content: newPostForm.value.content,
    comments: [],
  });
  newPostModal.value = false;
}

// 貼文詳情與留言 Modal
const viewModal = ref(false);
const activePost = ref<TalkPost | null>(null);
const newCommentText = ref('');

function openPostDetail(post: TalkPost) {
  activePost.value = post;
  newCommentText.value = '';
  viewModal.value = true;
}

function addLike(post: TalkPost) {
  post.likes++;
}

function submitComment() {
  if (!activePost.value || !newCommentText.value.trim()) return;
  activePost.value.comments.push({
    author: '王大明 (V112001)',
    date: new Date().toISOString().slice(0, 16).replace('T', ' '),
    content: newCommentText.value.trim(),
  });
  activePost.value.replies++;
  newCommentText.value = '';
}
</script>

<template>
  <div class="talk-page stack">
    <div class="talk-layout">
      <!-- 左側邊欄：分類選擇與申訴管道 -->
      <div class="side-panel">
        <GCard class="glass category-card">
          <strong class="side-title font-bold">主題分類</strong>
          <div class="cat-buttons">
            <button
              v-for="cat in categories"
              :key="cat"
              type="button"
              class="cat-btn"
              :class="{ active: currentCategory === cat }"
              @click="currentCategory = cat"
            >
              {{ cat }}
            </button>
          </div>
        </GCard>

        <!-- 友善防侵害申訴小卡 (原版特色) -->
        <GCard class="glass report-card">
          <strong class="report-title font-bold text-primary">🛡️ 不法侵害諮詢 / 申訴管道</strong>
          <p class="report-desc faint extra-small">
            公司致力維護零霸凌職場環境，提供同仁完全保密的申訴管道：
          </p>
          <div class="report-item">
            <span class="report-label">申訴專線：</span>
            <strong class="mono">03-5981886 # 1210</strong>
          </div>
          <div class="report-item">
            <span class="report-label">申訴信箱：</span>
            <a href="mailto:HR@gigasolar.com.tw" class="mono text-primary mail-link">HR@gigasolar.com.tw</a>
          </div>
        </GCard>
      </div>

      <!-- 右側主區域：操作列與貼文列表 -->
      <div class="main-content stack">
        <GCard class="glass top-action-card">
          <div class="action-row">
            <div class="feed-title-wrap">
              <strong class="feed-title font-bold">3691 全民開講交流看板</strong>
              <span class="faint small">（目前顯示：{{ currentCategory }}）</span>
            </div>
            <GButton tone="primary" @click="openNewPost">+ 發表新主題</GButton>
          </div>
        </GCard>

        <div class="posts-list">
          <GCard
            v-for="p in filteredPosts"
            :key="p.id"
            class="glass post-card"
            @click="openPostDetail(p)"
          >
            <div class="post-header">
              <div class="post-title-row">
                <GBadge tone="storage">{{ p.category }}</GBadge>
                <h4 class="post-title">{{ p.title }}</h4>
              </div>
              <span class="mono faint extra-small">{{ p.date }}</span>
            </div>

            <p class="post-snippet faint small">{{ p.content }}</p>

            <div class="post-footer">
              <span class="faint small">發布者：{{ p.author }}</span>
              <div class="post-interactions" @click.stop>
                <button type="button" class="like-btn" @click="addLike(p)">
                  👍 讚 <span class="mono">{{ p.likes }}</span>
                </button>
                <span class="faint small">💬 {{ p.replies }} 則回覆</span>
              </div>
            </div>
          </GCard>
        </div>
      </div>
    </div>

    <!-- 發表新主題 Modal -->
    <GModal v-model="newPostModal" title="發表新主題" width="560px">
      <div class="new-post-stack">
        <div>
          <label class="form-label">選擇主題分類</label>
          <GSelect
            v-model="newPostForm.category"
            :options="[
              { label: '不吐不快', value: '不吐不快' },
              { label: '開講公告', value: '開講公告' },
              { label: '老王賣瓜', value: '老王賣瓜' },
              { label: '馬路消息', value: '馬路消息' },
              { label: '資訊分享', value: '資訊分享' },
              { label: '舉手發問', value: '舉手發問' },
            ]"
          />
        </div>

        <div>
          <label class="form-label">文章主題名稱 *</label>
          <GInput v-model="newPostForm.title" placeholder="請填寫具體的主題名稱" />
        </div>

        <div>
          <label class="form-label">內容全文 *</label>
          <textarea
            v-model="newPostForm.content"
            rows="5"
            class="talk-textarea"
            placeholder="請理性發言，友善溝通，共同維護優質交流空間..."
          />
        </div>

        <div class="anonymous-toggle">
          <label class="toggle-label">
            <input v-model="newPostForm.isAnonymous" type="checkbox" />
            以匿名方式發布（隱藏個人工號與姓名）
          </label>
        </div>
      </div>
      <template #footer>
        <GButton variant="secondary" @click="newPostModal = false">取消</GButton>
        <GButton tone="primary" @click="submitNewPost">送出發文</GButton>
      </template>
    </GModal>

    <!-- 貼文詳細與留言討論 Modal -->
    <GModal v-model="viewModal" :title="activePost?.title ?? '主題討論'" width="680px">
      <div v-if="activePost" class="view-post-stack">
        <div class="post-detail-header">
          <div class="header-tags">
            <GBadge tone="storage">{{ activePost.category }}</GBadge>
            <span class="faint small">作者：{{ activePost.author }}</span>
            <span class="mono faint small">時間：{{ activePost.date }}</span>
          </div>
          <button type="button" class="like-btn" @click="addLike(activePost)">
            👍 讚 <span class="mono">{{ activePost.likes }}</span>
          </button>
        </div>

        <div class="post-detail-content">
          <p class="content-text">{{ activePost.content }}</p>
        </div>

        <!-- 回覆串 -->
        <div class="comments-section">
          <strong class="comments-title">💬 討論回覆 ({{ activePost.comments.length }})</strong>
          <div class="comments-list">
            <div v-for="(c, idx) in activePost.comments" :key="idx" class="comment-box">
              <div class="comment-header">
                <strong class="small font-bold">{{ c.author }}</strong>
                <span class="mono faint extra-small">{{ c.date }}</span>
              </div>
              <p class="comment-text small">{{ c.content }}</p>
            </div>
            <div v-if="activePost.comments.length === 0" class="text-center faint p-2 small">
              目前尚無人回覆，快來搶頭香吧！
            </div>
          </div>

          <!-- 撰寫回覆 -->
          <div class="reply-input-box">
            <textarea
              v-model="newCommentText"
              rows="2"
              class="reply-textarea"
              placeholder="撰寫您的回覆..."
            />
            <div class="reply-btn-row">
              <GButton size="sm" tone="primary" :disabled="!newCommentText.trim()" @click="submitComment">
                送出回覆
              </GButton>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <GButton variant="secondary" @click="viewModal = false">關閉</GButton>
      </template>
    </GModal>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.talk-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 16px;
}
@media (max-width: 768px) {
  .talk-layout {
    grid-template-columns: 1fr;
  }
}
.side-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.category-card,
.report-card {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.side-title {
  font-size: 14px;
}
.cat-buttons {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cat-btn {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  text-align: left;
  font-size: 13.5px;
  cursor: pointer;
  color: var(--color-foreground);
  transition: all 0.15s;
}
.cat-btn:hover {
  background: var(--color-surface-hover);
}
.cat-btn.active {
  background: var(--color-surface-hover);
  border-color: var(--color-border);
  font-weight: 600;
  color: var(--color-primary);
}
.report-card {
  border-left: 3px solid #3b82f6;
}
.report-title {
  font-size: 13.5px;
}
.report-desc {
  line-height: 1.4;
  margin: 0;
}
.report-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}
.report-label {
  color: var(--color-faint);
}
.mail-link {
  text-decoration: underline;
}
.top-action-card {
  padding: 12px 18px;
}
.action-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.feed-title {
  font-size: 16px;
}
.posts-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.post-card {
  padding: 16px 18px;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.post-card:hover {
  border-color: var(--color-primary);
}
.post-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}
.post-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.post-title {
  margin: 0;
  font-size: 15.5px;
}
.post-snippet {
  margin: 0;
  line-height: 1.5;
  color: var(--color-foreground);
}
.post-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--color-border);
  padding-top: 8px;
}
.post-interactions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.like-btn {
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 12.5px;
  cursor: pointer;
}
.like-btn:hover {
  color: var(--color-primary);
}
.new-post-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.form-label {
  display: block;
  font-size: 13px;
  color: var(--color-faint);
  margin-bottom: 4px;
}
.talk-textarea,
.reply-textarea {
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
}
.anonymous-toggle {
  display: flex;
  align-items: center;
}
.toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  cursor: pointer;
}
.view-post-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.post-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 10px;
}
.header-tags {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.content-text {
  font-size: 15px;
  line-height: 1.6;
  margin: 0;
}
.comments-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px solid var(--color-border);
  padding-top: 14px;
}
.comments-title {
  font-size: 14px;
}
.comments-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
}
.comment-box {
  padding: 8px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.comment-header {
  display: flex;
  justify-content: space-between;
}
.comment-text {
  margin: 0;
  line-height: 1.4;
}
.reply-input-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}
.reply-btn-row {
  display: flex;
  justify-content: flex-end;
}
.font-bold {
  font-weight: 600;
}
.extra-small {
  font-size: 12px;
}
.text-center {
  text-align: center;
}
</style>
