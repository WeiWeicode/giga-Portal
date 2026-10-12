<script setup lang="ts">
/** 總務專區 - 申請專區(old_PortalSolar GAffairs.aspx Tab2 照搬;PORTAL-API-PLAN D-14)。舊頁「宿舍」子頁籤已註解隱藏,不搬 */
import { legacyDoc } from '@/composables/legacyDocs';

const sections: { key: string; title: string; lines: string[]; image?: string }[] = [
  { key: 'parking', title: '停車證', lines: ['欲申請汽、機車停車證請上 Easyflow GP 申請,步驟如下:'], image: 'Icons/aff001.JPG' },
  {
    key: 'car',
    title: '公務車',
    lines: [
      '※ 請至資源預約系統內申請借用。',
      '※ 為使公務車能得到充分的利用,請借用人如果更改行程,不需借用公務車,一定要提早做取消的動作,以免影響他人權益。',
      '※ 取消時間說明:當日借用起始時間前一小時內取消借用。',
      '※ 若出車後中途回廠,則兩小時內需再出廠,但鑰匙需先歸還,出車前再領取,超過兩小時以上則請警衛先做歸還,欲使用時再借車。',
      '※ 未做取消的動作罰則:',
      '罰則 A:公務車借用後未使用者,限制公務車借用一個月。',
      '罰則 B:未提早取消借用公務車者,限制公務車借用二週。',
      '※ 公務車鑰匙由警衛室保管,若超過借用時間 30 分鐘仍未領取鑰匙出車或領取鑰匙未出車者,除取消該次借用權益並通知 MIS 部門以罰則 B 處理。',
      '※「行車記錄器」於車輛起動時,將會自動錄影。車輛停駛不用時,將會自動切斷錄影。同仁借用車輛時,請確認行車記錄器為正常運作。若有故障,請通知公共事務課。',
      '※ 請各使用人配合,謝謝。',
    ],
  },
  {
    key: 'repair',
    title: '修繕及五金用品',
    lines: ['※ 請至 Notes 入口公共事務系統內申請。', '※ 填寫完送出後需經由部門主管簽核完畢之後才會通知總務進行處理。', '※ 若是申請例如燈泡、電池等等請繳回舊品。'],
    image: 'Icons/aff003.JPG',
  },
  {
    key: 'stationery',
    title: '文具用品',
    lines: [
      '※ 將所需文具告知助理,並將舊品繳回,各部門助理統整完該部門當月需申請項目後,統一於當月十號以前上 Easy Flow GP 填單申請。',
      '※ 若無在申請品項內之需求文具,助理則另外填工作聯繫單申請並說明原因。',
      '※ 若超過當月十號請於下個月再統一申請,如果是急需用品,請助理填寫工作聯繫單申請,則額外辦理。',
      '※ 主管簽核完成後,總務單位會統整並經由行政部主管同意後統一叫貨,貨到時即通知各單位領取。',
      '※ 若無繳回舊品者,則不能申請新品,請各單位注意,並請各部門助理協助回收。',
    ],
  },
];
</script>

<template>
  <div class="stack ga-apply">
    <GCard v-for="s in sections" :key="s.key" :title="s.title" icon="file-check">
      <p v-for="(l, i) in s.lines" :key="i" class="line">{{ l }}</p>
      <img v-if="s.image" class="shot" :src="legacyDoc(s.image)" :alt="`${s.title}申請步驟`" loading="lazy" />
    </GCard>
  </div>
</template>

<style scoped>
.ga-apply {
  --gap: 16px;
}
.line {
  margin: 0 0 6px;
  line-height: 1.6;
}
.shot {
  display: block;
  max-width: 100%;
  margin-top: 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
}
</style>
