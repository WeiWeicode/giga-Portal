<script setup lang="ts">
/**
 * 湖口廠停車資訊 (對齊 old_PortalSolar GAffairs.aspx Tab5)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard } from '@/ui';

const parkingStats = [
  { label: '員工汽車車位', count: '80 格', desc: '年度抽籤專屬車位 (A區/B區)' },
  { label: '機車遮雨棚位', count: '280 格', desc: '憑機車識別證自由停放 (M區)' },
  { label: 'EV 電動車充電格', count: '6 格', desc: 'AC 7kW 慢充，限充 4 小時' },
  { label: '訪客/公務車臨停', count: '14 格', desc: '大門守衛室查驗登記後通行' },
];

const zones = [
  {
    name: 'A 區：行政大樓前側停車場 (汽車)',
    slots: 'A01 ~ A45 (共 45 格)',
    type: '汽車',
    badge: '抽籤專用',
    badgeTone: 'healthy' as const,
    rules: '限停持有 A 區藍色汽車停車證之車輛，夜班同仁日間請勿佔用。',
  },
  {
    name: 'B 區：廠房西側平面停車場 (汽車)',
    slots: 'B01 ~ B55 (共 55 格)',
    type: '汽車',
    badge: '抽籤專用',
    badgeTone: 'healthy' as const,
    rules: '包含 6 格電動車優先充電車位 (B50~B55)，充電完畢請主動移車。',
  },
  {
    name: 'M 區：廠區南側機車遮雨棚 (機車)',
    slots: 'M01 ~ M280 (共 280 格)',
    type: '機車',
    badge: '登記自由停',
    badgeTone: 'neutral' as const,
    rules: '需張貼綠色機車識別貼紙於車牌右上角，依地格整齊停放，嚴禁斜停或擋道。',
  },
  {
    name: 'V 區：警衛大門前側訪客專區 (汽車)',
    slots: 'V01 ~ V14 (共 14 格)',
    type: '訪客/公務',
    badge: '臨停審核',
    badgeTone: 'warning' as const,
    rules: '公務訪客及面試同仁專用，入廠請至守衛室換證並放置訪客停車卡於擋風玻璃。',
  },
];

const violationRules = [
  { item: '未依車格停放 / 佔用通道', penalty: '第一次開立勸導單，第二次記違規點數 1 點' },
  { item: '未張貼有效停車證 / 借用他人車證', penalty: '扣留停車證 1 個月並記違規點數 2 點' },
  { item: '佔用身障/孕婦友善車位 (無證明)', penalty: '記違規點數 2 點並通報所屬主管' },
  { item: '佔用 EV 充電車位逾時未移車', penalty: '記違規點數 1 點，累犯暫停使用充電樁權限' },
  { item: '廠區內超速 (速限 15 km/h) 或危險駕駛', penalty: '記違規點數 3 點，撤銷當年度停車權限' },
];
</script>

<template>
  <div class="ga-parking-tab stack">
    <!-- 車位總覽統計卡 -->
    <div class="stats-grid">
      <GCard v-for="st in parkingStats" :key="st.label" class="stat-card glass">
        <span class="faint small">{{ st.label }}</span>
        <strong class="stat-count mono text-primary">{{ st.count }}</strong>
        <span class="faint extra-small">{{ st.desc }}</span>
      </GCard>
    </div>

    <!-- 廠區平面分區配置圖卡 -->
    <GCard class="glass diagram-card">
      <div class="card-title-row">
        <strong>湖口廠區平面停車分區導覽</strong>
        <GBadge tone="storage">廠區限速 15 km/h</GBadge>
      </div>

      <div class="diagram-visual">
        <div class="diagram-grid">
          <div class="zone-box zone-v">
            <span class="zone-tag">守衛室 / 訪客車位 (V 區)</span>
            <span class="small faint">14 格訪客/公務車臨停</span>
          </div>
          <div class="zone-box zone-gate">
            <span class="zone-tag">廠區主要出入口閘門</span>
            <span class="extra-small">車牌辨識自動起落</span>
          </div>
          <div class="zone-box zone-a">
            <span class="zone-tag">A 棟行政大樓前停車場 (A 區)</span>
            <span class="small faint">A01 ~ A45 汽車位</span>
          </div>
          <div class="zone-box zone-main">
            <span class="zone-tag font-bold">湖口一廠 主廠房區 (生產與研發中心)</span>
          </div>
          <div class="zone-box zone-b">
            <span class="zone-tag">B 廠側邊停車場 (B 區)</span>
            <span class="small faint">B01 ~ B55 (含 6 格 EV 充電樁)</span>
          </div>
          <div class="zone-box zone-m">
            <span class="zone-tag">機車遮雨棚專區 (M 區)</span>
            <span class="small faint">M01 ~ M280 機車位 (南側專用引道)</span>
          </div>
        </div>
      </div>
    </GCard>

    <!-- 車位區域細項與規則 -->
    <div class="zones-grid">
      <GCard v-for="z in zones" :key="z.name" class="zone-card glass">
        <div class="zone-header">
          <strong>{{ z.name }}</strong>
          <GBadge :tone="z.badgeTone">{{ z.badge }}</GBadge>
        </div>
        <div class="zone-meta">
          <span class="mono faint small">配置編號：{{ z.slots }}</span>
        </div>
        <p class="zone-desc faint small">{{ z.rules }}</p>
      </GCard>
    </div>

    <!-- 停車規範與違規處理 -->
    <GCard class="glass rules-card">
      <strong class="rules-title">廠區停車管理規範與違規記點處置條例</strong>
      <table class="rules-table">
        <thead>
          <tr>
            <th style="width: 40%">違規事項</th>
            <th style="width: 60%">處置規範與處罰條款</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in violationRules" :key="r.item">
            <td class="font-bold">{{ r.item }}</td>
            <td class="small">{{ r.penalty }}</td>
          </tr>
        </tbody>
      </table>
    </GCard>

    <GAlert tone="neutral" icon="info">
      每年 11 月 1 日至 11 月 15 日開放新年度員工汽車停車位線上抽籤登記，符合資格之正式同仁可至「總務專區 > 申請專區 > 停車證」辦理。
    </GAlert>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}
.stat-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-count {
  font-size: 22px;
}
.extra-small {
  font-size: 12px;
}
.diagram-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.card-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.diagram-visual {
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: 8px;
  padding: 16px;
}
.diagram-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.zone-box {
  padding: 14px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 4px;
}
.zone-v {
  background: rgba(234, 179, 8, 0.08);
  border-color: rgba(234, 179, 8, 0.3);
}
.zone-gate {
  background: var(--color-surface-hover);
}
.zone-a {
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.3);
}
.zone-main {
  grid-column: span 3;
  padding: 24px;
  background: var(--color-surface-hover);
  font-weight: bold;
}
.zone-b {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.3);
}
.zone-m {
  grid-column: span 2;
  background: rgba(139, 92, 246, 0.08);
  border-color: rgba(139, 92, 246, 0.3);
}
.zone-tag {
  font-size: 13px;
  font-weight: 600;
}
.zones-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}
.zone-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.zone-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.rules-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}
.rules-title {
  font-size: 15px;
}
.rules-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.rules-table th,
.rules-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}
.rules-table th {
  background: var(--color-surface-hover);
  text-align: left;
}
.font-bold {
  font-weight: 600;
}
</style>
