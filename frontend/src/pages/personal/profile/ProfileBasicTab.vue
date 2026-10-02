<script setup lang="ts">
/**
 * 個人基本資料 - 基本資料 Tab
 * 對應 old_PortalSolar/HRPDataBase.aspx (Tab1)
 */
import { ref } from 'vue';

const basic = ref({
  empNo: 'S112009',
  name: '王大明',
  gender: '男',
  birthDate: '1988/05/12',
  idNo: 'A123456789',
  birthPlace: '台北市',
  maritalStatus: '已婚',
  military: '役畢',
  dependentsCount: '2',
  empType: '正式',
  education: '大學',
  school: '國立台灣大學',
  major: '資訊工程學系',
  gradDate: '2010/06/30',
  mobilePhone: '0912-345-678',
  homePhone: '02-2345-6789',
  commAddress: '新竹市科學園區研發一路1號',
  legalAddress: '台北市大安區新生南路一段100號',
  company: '碩禾電子材料股份有限公司',
  factory: '新竹廠',
  dept: '資訊管理處 (IT)',
  title: '資深軟體工程師',
  grade: '7 等',
  shift: '常日班 (08:30-17:30)',
  probationPassed: '是',
  probationEndDate: '2020/06/01',
  reinstatementDate: '—',
  remarks: '一般正式員工',
});
</script>

<template>
  <div class="stack profile-basic">
    <!-- 頂部操作與提醒 -->
    <GCard>
      <div class="row header-bar">
        <div>
          <h3 class="strong">個人基本資料</h3>
          <p class="muted small">在職個人資料、學歷、聯絡方式與職務組織資訊</p>
        </div>
        <div class="spacer" />
        <GButton variant="secondary" icon="edit">前往申請修改</GButton>
      </div>
    </GCard>

    <!-- 基本識別資料 -->
    <GCard title="基本識別與身份" icon="user">
      <div class="grid grid-3">
        <GInput v-model="basic.empNo" label="員工代號" disabled />
        <GInput v-model="basic.name" label="員工姓名" disabled />
        <GInput v-model="basic.gender" label="性別" disabled />
        <GInput v-model="basic.birthDate" label="出生日期" disabled />
        <GInput v-model="basic.idNo" label="身份證字號" disabled />
        <GInput v-model="basic.birthPlace" label="出生地" disabled />
        <GInput v-model="basic.maritalStatus" label="婚姻狀況" disabled />
        <GInput v-model="basic.military" label="役別" disabled />
        <GInput v-model="basic.dependentsCount" label="扶養人數" disabled />
      </div>
    </GCard>

    <!-- 職務與組織 -->
    <GCard title="職務與組織配置" icon="building">
      <div class="grid grid-3">
        <GInput v-model="basic.company" label="公司別" disabled />
        <GInput v-model="basic.factory" label="廠別" disabled />
        <GInput v-model="basic.dept" label="部門代號" disabled />
        <GInput v-model="basic.title" label="職稱代號" disabled />
        <GInput v-model="basic.grade" label="職等" disabled />
        <GInput v-model="basic.shift" label="所屬班別" disabled />
        <GInput v-model="basic.empType" label="正式臨時" disabled />
        <GInput v-model="basic.probationPassed" label="是否試用期滿" disabled />
        <GInput v-model="basic.probationEndDate" label="試用期滿日" disabled />
        <GInput v-model="basic.reinstatementDate" label="復職日期" disabled />
      </div>
    </GCard>

    <!-- 學歷與專長 -->
    <GCard title="學歷背景" icon="award">
      <div class="grid grid-4">
        <GInput v-model="basic.education" label="學歷代號" disabled />
        <GInput v-model="basic.school" label="畢業學校" disabled />
        <GInput v-model="basic.major" label="主修科系" disabled />
        <GInput v-model="basic.gradDate" label="畢業日期" disabled />
      </div>
    </GCard>

    <!-- 聯絡方式 -->
    <GCard title="聯絡地址與電話" icon="phone">
      <div class="grid grid-2">
        <GInput v-model="basic.mobilePhone" label="通訊電話(手機)" disabled />
        <GInput v-model="basic.homePhone" label="戶籍電話" disabled />
        <GInput v-model="basic.commAddress" label="通訊地址" disabled />
        <GInput v-model="basic.legalAddress" label="戶籍地址" disabled />
      </div>
    </GCard>

    <!-- 備註與補充 -->
    <GCard title="其他資訊" icon="info">
      <div class="grid grid-1">
        <GInput v-model="basic.remarks" label="備註" disabled />
      </div>
      <template #footer>
        <div class="row foot-actions">
          <span class="muted small">如需變更個人通訊或戶籍資料，請點擊右方按鈕送出申請。</span>
          <div class="spacer" />
          <GButton variant="primary" icon="edit">前往申請修改</GButton>
        </div>
      </template>
    </GCard>
  </div>
</template>

<style scoped>
.profile-basic {
  --gap: 16px;
}
.header-bar {
  padding: 6px 4px;
}
.foot-actions {
  width: 100%;
}
</style>
