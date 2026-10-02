<script setup lang="ts">
/**
 * 全部公告分頁 (對齊 old_PortalSolar MainFormX 最新消息與公司公告)
 */
import { computed, ref } from 'vue';
import { GAlert, GBadge, GButton, GCard, GInput, GModal, GSelect } from '@/ui';

export interface NewsItem {
  id: string;
  pinned?: boolean;
  title: string;
  category: '全體公告' | '行政總務' | '人事法遵' | '工安環衛' | 'IT系統維護';
  dept: string;
  date: string;
  views: number;
  unread: boolean;
  content: string;
  attachment?: string;
}

const newsList = ref<NewsItem[]>([
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
    id: 'NEWS-202610-02',
    pinned: true,
    title: '【IT維護公告】週末集團核心網路骨幹交換機韌體升級與停機通知',
    category: 'IT系統維護',
    dept: '資訊服務部',
    date: '2026-10-01',
    views: 285,
    unread: false,
    content: `各位同仁好：
資訊服務部將於 2026/10/04 (週日) 00:00 ~ 06:00 進行湖口一廠核心網路設備例行韌體升級與資安弱點修補作業。
影響範圍：
- 作業期間全廠內網、Wi-Fi、ERP 系統、Portal 入口網與 VPN 連線將暫時中斷。
- 郵件伺服器於維護期間暫停收發，外部來信將於系統恢復後陸續投遞完成。
請各位同仁提早儲存作業資料並關閉連線，造成不便敬請見諒。`,
  },
  {
    id: 'NEWS-202609-08',
    title: '【福委會】2026 年度員工秋季自強活動（宜蘭二日遊）報名開跑！',
    category: '全體公告',
    dept: '職工福利委員會',
    date: '2026-09-28',
    views: 520,
    unread: false,
    content: `各位同仁好：
一年一度的秋季員工自強活動即日起開放線上報名！
本次行程為「宜蘭太平山見晴懷古步道與礁溪溫泉休閒二日遊」，福委會全額補助在職員工旅費，並提供眷屬自費優惠名額。
活動梯次：
第一梯次：2026/10/24 (六) ~ 10/25 (日)
第二梯次：2026/11/07 (六) ~ 11/08 (日)
詳細行程與報名表請至福委會專區查看。`,
    attachment: '2026秋季自強活動行程簡章與報名須知.pdf',
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
  {
    id: 'NEWS-202609-01',
    title: '【總務公告】115 年第四季常態性文具用品線上請領截止時程提醒',
    category: '行政總務',
    dept: '總務安全組',
    date: '2026-09-20',
    views: 160,
    unread: false,
    content: `各部門文具管理窗口請注意：
第四季文具用品常態申領即日起開放至 9 月 30 日 17:00 截止，請各部門秘書彙整同仁需求後至「總務專區 > 申請專區 > 文具用品」送出，預計於 10 月 5 日統一發放。`,
  },
]);

const searchKeyword = ref('');
const categoryFilter = ref('');

const filteredList = computed(() => {
  return newsList.value.filter((item) => {
    const matchCat = !categoryFilter.value || item.category === categoryFilter.value;
    const kw = searchKeyword.value.toLowerCase().trim();
    const matchKw =
      !kw ||
      item.title.toLowerCase().includes(kw) ||
      item.dept.toLowerCase().includes(kw) ||
      item.content.toLowerCase().includes(kw);
    return matchCat && matchKw;
  });
});

const detailModal = ref(false);
const activeNews = ref<NewsItem | null>(null);

function viewDetail(item: NewsItem) {
  item.unread = false;
  activeNews.value = item;
  detailModal.value = true;
}
</script>

<template>
  <div class="news-all-tab stack">
    <!-- 篩選列 -->
    <GCard class="glass filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <label class="filter-label">公告關鍵字檢索</label>
          <GInput v-model="searchKeyword" placeholder="搜尋公告標題、主旨內容、發布單位..." />
        </div>
        <div class="filter-item filter-select">
          <label class="filter-label">公告分類</label>
          <GSelect
            v-model="categoryFilter"
            :options="[
              { label: '全部分類', value: '' },
              { label: '全體公告', value: '全體公告' },
              { label: '行政總務', value: '行政總務' },
              { label: '人事法遵', value: '人事法遵' },
              { label: '工安環衛', value: '工安環衛' },
              { label: 'IT系統維護', value: 'IT系統維護' },
            ]"
          />
        </div>
      </div>
    </GCard>

    <!-- 公告表格 -->
    <GCard class="glass table-wrapper">
      <table class="news-table">
        <thead>
          <tr>
            <th style="width: 70px;" class="text-center">狀態</th>
            <th style="width: 110px;">分類</th>
            <th>公告主題</th>
            <th style="width: 140px;">發布單位</th>
            <th style="width: 110px;">發布日期</th>
            <th style="width: 80px;" class="text-right">點閱數</th>
            <th style="width: 80px;" class="text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filteredList" :key="item.id" :class="{ 'row-unread': item.unread }">
            <td class="text-center">
              <GBadge v-if="item.pinned" tone="danger">置頂</GBadge>
              <GBadge v-else-if="item.unread" tone="warning">未讀</GBadge>
              <span v-else class="faint extra-small">已讀</span>
            </td>
            <td>
              <GBadge tone="storage">{{ item.category }}</GBadge>
            </td>
            <td class="title-cell">
              <span class="news-title font-bold" @click="viewDetail(item)">
                {{ item.title }}
              </span>
              <span v-if="item.attachment" class="faint extra-small attach-tag">📎 附檔</span>
            </td>
            <td class="small">{{ item.dept }}</td>
            <td class="mono small faint">{{ item.date }}</td>
            <td class="mono text-right small faint">{{ item.views }} 次</td>
            <td class="text-center">
              <GButton size="sm" variant="ghost" @click="viewDetail(item)">閱讀</GButton>
            </td>
          </tr>
          <tr v-if="filteredList.length === 0">
            <td colspan="7" class="text-center faint p-4">查無符合條件之公告消息</td>
          </tr>
        </tbody>
      </table>
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
.filter-card {
  padding: 12px 16px;
}
.filter-row {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.filter-item {
  flex: 1;
  min-width: 220px;
}
.filter-select {
  max-width: 200px;
}
.filter-label {
  display: block;
  font-size: 13px;
  color: var(--color-faint);
  margin-bottom: 4px;
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
.text-right {
  text-align: right;
}
.font-bold {
  font-weight: 600;
}
.extra-small {
  font-size: 12px;
}
</style>
