<script setup lang="ts">
/**
 * 未讀公告分頁 (對齊 old_PortalSolar 未讀公告提示)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GModal } from '@/ui';
import type { NewsItem } from './NewsAllTab.vue';

const unreadNews = ref<NewsItem[]>([
  {
    id: 'NEWS-202610-01',
    pinned: true,
    title: '【重要宣導】115 年度全廠區秋季消防逃生避難綜合實兵演練通知',
    category: '工安環衛',
    dept: '職業安全衛生室',
    date: '2026-10-02',
    views: 342,
    unread: true,
    content: `各位同仁好：
為強化廠區緊急應變防救災機制，確保全體同仁生命財產安全，安衛室訂於下週三 (10/08) 下午 14:00 辦理全廠消防疏散演練。
演練重點：
1. 聽到警報聲響起時，請立即停止手上非緊急工作，依循安全逃生標示前往 A 棟 1F 大廳前廣場集合。
2. 疏散過程嚴禁搭乘電梯，請走各區安全逃生梯並聽從樓層避難引導人員指揮。
3. 現場將示範 ABC 乾粉滅火器操作（拉、瞄、壓、掃）與室內消防栓射水操作。
請各部門主管落實點名回報人數。`,
    attachment: '115年度秋季消防演練各棟避難動線圖.pdf',
  },
  {
    id: 'NEWS-202609-05',
    title: '【法遵宣導】嚴正重申職場不法侵害零容忍政策與書面聲明',
    category: '人事法遵',
    dept: '人力資源部',
    date: '2026-09-25',
    views: 198,
    unread: true,
    content: `各位同仁好：
碩禾集團致力打造安全、尊嚴、友善的零歧視職場環境。任何形式之職場霸凌、言語暴力、性騷擾或權力濫用行為皆為公司嚴格禁止。
公司設有完整之保密申訴調查機制，如遭遇任何不法侵害，請隨時向人資專屬申訴窗口 (分機 #1210 或 HR@gigasolar.com.tw) 提出反映。`,
  },
]);

const detailModal = ref(false);
const activeNews = ref<NewsItem | null>(null);

function viewDetail(item: NewsItem) {
  activeNews.value = item;
  detailModal.value = true;
  item.unread = false;
  unreadNews.value = unreadNews.value.filter((n) => n.id !== item.id);
}

function markAllAsRead() {
  unreadNews.value = [];
}
</script>

<template>
  <div class="news-unread-tab stack">
    <!-- 頂部操作列 -->
    <div class="top-action-row">
      <div class="count-badge-wrap">
        <span>您目前有</span>
        <strong class="mono text-primary font-bold">{{ unreadNews.length }}</strong>
        <span>則未讀公告</span>
      </div>
      <GButton v-if="unreadNews.length > 0" variant="secondary" size="sm" @click="markAllAsRead">
        ✓ 全部標為已讀
      </GButton>
    </div>

    <!-- 未讀列表表格 -->
    <GCard v-if="unreadNews.length > 0" class="glass table-wrapper">
      <table class="news-table">
        <thead>
          <tr>
            <th style="width: 70px;" class="text-center">狀態</th>
            <th style="width: 110px;">分類</th>
            <th>公告主題</th>
            <th style="width: 140px;">發布單位</th>
            <th style="width: 110px;">發布日期</th>
            <th style="width: 80px;" class="text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in unreadNews" :key="item.id" class="row-unread">
            <td class="text-center">
              <GBadge tone="warning">未讀</GBadge>
            </td>
            <td>
              <GBadge tone="storage">{{ item.category }}</GBadge>
            </td>
            <td class="title-cell" @click="viewDetail(item)">
              <span class="news-title font-bold">{{ item.title }}</span>
              <span v-if="item.attachment" class="faint extra-small attach-tag">📎 附檔</span>
            </td>
            <td class="small">{{ item.dept }}</td>
            <td class="mono small faint">{{ item.date }}</td>
            <td class="text-center">
              <GButton size="sm" tone="primary" @click="viewDetail(item)">閱讀</GButton>
            </td>
          </tr>
        </tbody>
      </table>
    </GCard>

    <!-- 全部已讀狀態 -->
    <GCard v-else class="glass empty-box">
      <div class="empty-content">
        <span class="empty-icon">🎉</span>
        <h4 class="empty-title">太棒了！您已閱讀完全部公司最新公告。</h4>
        <p class="empty-desc faint small">若需回顧歷史消息或規章，可隨時切換至「全部」頁籤查詢。</p>
      </div>
    </GCard>

    <!-- 公告詳細 Modal -->
    <GModal v-model="detailModal" :title="activeNews?.title ?? '公告詳情'" width="680px">
      <div v-if="activeNews" class="modal-news-stack">
        <div class="meta-banner">
          <div class="meta-tag-row">
            <GBadge tone="storage">{{ activeNews.category }}</GBadge>
            <span class="faint small">發布單位：<strong>{{ activeNews.dept }}</strong></span>
            <span class="mono faint small">日期：{{ activeNews.date }}</span>
          </div>
        </div>

        <div class="news-content-body">
          <pre class="content-pre">{{ activeNews.content }}</pre>
        </div>

        <div v-if="activeNews.attachment" class="attachment-box">
          <span class="font-bold small">📎 附件檔案下載：</span>
          <a href="#" class="attach-link text-primary small" @click.prevent>
            {{ activeNews.attachment }}
          </a>
        </div>
      </div>
      <template #footer>
        <GButton variant="secondary" @click="detailModal = false">關閉</GButton>
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
.top-action-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.count-badge-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}
.table-wrapper {
  overflow-x: auto;
  padding: 0;
}
.news-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.news-table th,
.news-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}
.news-table th {
  background: var(--color-surface-hover);
  text-align: left;
  font-weight: 600;
  font-size: 13px;
}
.row-unread {
  background: rgba(59, 130, 246, 0.04);
}
.title-cell {
  cursor: pointer;
}
.news-title:hover {
  color: var(--color-primary);
  text-decoration: underline;
}
.attach-tag {
  margin-left: 6px;
}
.empty-box {
  padding: 40px 20px;
  text-align: center;
}
.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.empty-icon {
  font-size: 36px;
}
.empty-title {
  margin: 0;
  font-size: 16px;
}
.empty-desc {
  margin: 0;
}
.modal-news-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.meta-banner {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
}
.meta-tag-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.news-content-body {
  padding: 4px 0;
}
.content-pre {
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 14.5px;
  line-height: 1.6;
  margin: 0;
  color: var(--color-foreground);
}
.attachment-box {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.attach-link {
  text-decoration: underline;
}
.text-center {
  text-align: center;
}
.font-bold {
  font-weight: 600;
}
.extra-small {
  font-size: 12px;
}
</style>
