<script setup lang="ts">
/**
 * 聯絡窗口與緊急通報 (對齊 old_PortalSolar Contact.aspx)
 */
import { ref } from 'vue';
import { GAlert, GBadge, GButton, GCard } from '@/ui';

const contactSections = [
  {
    category: '資訊服務與系統支援 (IT HelpDesk)',
    tone: 'storage' as const,
    contacts: [
      {
        name: '鄭智寬 (資訊專員)',
        role: '電腦軟硬體、門禁卡機、印表機報修',
        dept: '資訊服務部 S1800',
        ext: '# 2109',
        phone: '03-5981886 分機 2109',
        email: 'eric@gigasolar.com.tw',
        hours: '週一至週五 08:30 - 17:30',
      },
      {
        name: '王大明 (系統工程師)',
        role: 'ERP、BPM 電子簽核、Portal 帳號權限',
        dept: '資訊服務部 S1800',
        ext: '# 2120',
        phone: '03-5981886 分機 2120',
        email: 'daming@gigasolar.com.tw',
        hours: '週一至週五 08:30 - 17:30',
      },
    ],
  },
  {
    category: '24 小時廠區守衛與緊急應變',
    tone: 'warning' as const,
    contacts: [
      {
        name: '湖口一廠 守衛室 (大門警衛)',
        role: '廠區出入放行、外賓換證、夜間緊急事件通報',
        dept: '安衛總務組',
        ext: '# 1110',
        phone: '03-5981886 分機 1110 / 0910-123456',
        email: 'security-hk1@gigasolar.com.tw',
        hours: '24 小時全年無休',
      },
      {
        name: '湖口二廠 守衛室 (警衛中心)',
        role: '二廠貨物進出、大宗原物料槽車過磅引導',
        dept: '安衛總務組',
        ext: '# 2110',
        phone: '03-5981998 分機 2110',
        email: 'security-hk2@gigasolar.com.tw',
        hours: '24 小時全年無休',
      },
    ],
  },
  {
    category: '健康中心與勞工安全衛生 (EHS)',
    tone: 'healthy' as const,
    contacts: [
      {
        name: '廠護健康中心 (駐廠護理師)',
        role: '工傷急救包紮、健康檢查諮詢、母性哺乳室借用',
        dept: '環境安全衛生室',
        ext: '# 1120 / # 1121',
        phone: '03-5981886 分機 1120',
        email: 'nurse@gigasolar.com.tw',
        hours: '週一至週五 08:00 - 17:00 (駐廠醫師：每週三下午)',
      },
      {
        name: '職安管理師 (林管理師)',
        role: '工安事故通報、危害性化學品 SDS 諮詢',
        dept: '環境安全衛生室',
        ext: '# 1119',
        phone: '03-5981886 分機 1119',
        email: 'safety@gigasolar.com.tw',
        hours: '週一至週五 08:30 - 17:30',
      },
    ],
  },
  {
    category: '人力資源與員工福利 (HR)',
    tone: 'neutral' as const,
    contacts: [
      {
        name: '張專員 (差勤假勤)',
        role: '打卡異常審核、請假單據、加班費計算諮詢',
        dept: '人力資源部',
        ext: '# 1210',
        phone: '03-5981886 分機 1210',
        email: 'hr@gigasolar.com.tw',
        hours: '週一至週五 08:30 - 17:30',
      },
      {
        name: '李專員 (福利與保險)',
        role: '員工團保加退保、醫療理賠申請、福委會補助',
        dept: '人力資源部',
        ext: '# 1212',
        phone: '03-5981886 分機 1212',
        email: 'benefits@gigasolar.com.tw',
        hours: '週一至週五 08:30 - 17:30',
      },
    ],
  },
  {
    category: '總務維修與行政服務 (GA)',
    tone: 'neutral' as const,
    contacts: [
      {
        name: '陳專員 (行政服務)',
        role: '公務車預約派車、停車證發放、文具申領',
        dept: '總務安全組',
        ext: '# 2150',
        phone: '03-5981886 分機 2150',
        email: 'ga@gigasolar.com.tw',
        hours: '週一至週五 08:30 - 17:30',
      },
      {
        name: '工務維修班',
        role: '水電空調檢修、照明燈具更換、辦公傢俱修繕',
        dept: '總務安全組',
        ext: '# 2155',
        phone: '03-5981886 分機 2155',
        email: 'facility@gigasolar.com.tw',
        hours: '週一至週五 08:00 - 17:00',
      },
    ],
  },
];
</script>

<template>
  <div class="contact-tab stack">
    <!-- 各分類聯絡人卡片 -->
    <div v-for="sec in contactSections" :key="sec.category" class="section-group">
      <div class="section-title-row">
        <strong>{{ sec.category }}</strong>
        <GBadge :tone="sec.tone">服務窗口</GBadge>
      </div>

      <div class="contacts-grid">
        <GCard v-for="c in sec.contacts" :key="c.name" class="glass contact-card">
          <div class="card-header-row">
            <strong class="contact-name">{{ c.name }}</strong>
            <span class="ext-badge mono font-bold text-primary">{{ c.ext }}</span>
          </div>
          <span class="contact-role small">{{ c.role }}</span>
          <div class="meta-list faint small">
            <div><strong>所屬部門：</strong>{{ c.dept }}</div>
            <div><strong>直撥電話：</strong><span class="mono">{{ c.phone }}</span></div>
            <div>
              <strong>電子信箱：</strong>
              <a :href="`mailto:${c.email}`" class="mono text-primary mail-link">{{ c.email }}</a>
            </div>
            <div><strong>服務時間：</strong>{{ c.hours }}</div>
          </div>
        </GCard>
      </div>
    </div>

    <!-- 廠區總機代表號彙整 -->
    <GCard class="glass trunk-card">
      <strong class="trunk-title">🏢 集團各廠區總機與公司代表號一覽</strong>
      <div class="trunk-grid">
        <div class="trunk-item">
          <span class="trunk-label">碩禾電子材料 (湖口一廠)</span>
          <strong class="mono trunk-tel">+886-3-5981886</strong>
        </div>
        <div class="trunk-item">
          <span class="trunk-label">碩禾電子材料 (湖口二廠)</span>
          <strong class="mono trunk-tel">+886-3-5981998</strong>
        </div>
        <div class="trunk-item">
          <span class="trunk-label">國碩科技 (總部)</span>
          <strong class="mono trunk-tel">+886-3-5985888</strong>
        </div>
        <div class="trunk-item">
          <span class="trunk-label">禾迅綠電 (新豐廠)</span>
          <strong class="mono trunk-tel">+886-3-5592888</strong>
        </div>
      </div>
    </GCard>

    <GAlert tone="warning" icon="alert">
      緊急事故（火警、重大工傷、化學品洩漏）請第一時間通報守衛室 (分機 #1110) 及健康中心 (分機 #1120)，並啟動緊急疏散程序。
    </GAlert>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.section-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 6px;
}
.contacts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 14px;
}
.contact-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
}
.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.contact-name {
  font-size: 15px;
}
.ext-badge {
  font-size: 16px;
}
.contact-role {
  color: var(--color-foreground);
  line-height: 1.4;
}
.meta-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}
.mail-link {
  text-decoration: underline;
}
.trunk-card {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.trunk-title {
  font-size: 15px;
}
.trunk-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}
.trunk-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.trunk-label {
  font-size: 13px;
  color: var(--color-faint);
}
.trunk-tel {
  font-size: 16px;
  color: var(--color-primary);
}
.font-bold {
  font-weight: 600;
}
</style>
