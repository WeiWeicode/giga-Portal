<script setup lang="ts">
/**
 * 新人導覽 › 小叮嚀(old_PortalSolar HRnewPep01.aspx + HRnewPepAnw01~07.aspx;FEATURE-PLAN §3.5;docs/Gherkin/resources/onboarding.feature)
 * 內容照搬舊頁(content.ts);「我已閱讀完畢」v-can="portal.onboarding.confirm"(includes portal.api.onboarding.write),
 * 寫 PortalSolar NewPepR,同一天重複按不重複寫。
 */
import { ref } from 'vue';
import { describeError } from '@/api/gateway';
import { markOnboardingRead, onboardingStatus } from '@/api/portal';
import { useAsync } from '@/composables/useAsync';
import { toast } from '@/ui/feedback';
import { EXTRA_TIPS, FAQ, SHIFTS, TIPS, TIPS_INTRO } from './content';

const { data: status, error, reload } = useAsync(onboardingStatus);

const saving = ref(false);
async function confirmRead() {
  saving.value = true;
  try {
    status.value = await markOnboardingRead();
    toast.success('閱讀記錄成功', '接著可到「驗收區」完成新人測驗');
  } catch (e) {
    toast.fromError(e, '記錄失敗');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="stack onboarding-tips">
    <GCard title="小叮嚀" icon="bell">
      <p class="intro">{{ TIPS_INTRO }}</p>
      <ol class="tips">
        <li v-for="(t, i) in TIPS" :key="i">{{ t }}</li>
      </ol>
    </GCard>

    <GCard title="各班別出勤" icon="clock">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>班別</th>
              <th>上班時間</th>
              <th>下班時間</th>
              <th>工時</th>
              <th>休假</th>
              <th>休息時間</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in SHIFTS" :key="s.name">
              <td class="strong">{{ s.name }}</td>
              <td class="mono">{{ s.start }}</td>
              <td class="mono">{{ s.end }}</td>
              <td class="mono">{{ s.hours }}</td>
              <td>{{ s.off }}</td>
              <td>{{ s.rest }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </GCard>

    <GCard title="其他生活規範" icon="info">
      <ul class="tips">
        <li v-for="(t, i) in EXTRA_TIPS" :key="i">{{ t }}</li>
      </ul>
    </GCard>

    <GCard v-for="sec in FAQ" :key="sec.title" :title="`Q&A:${sec.title}`" icon="message">
      <dl class="faq">
        <template v-for="(it, i) in sec.items" :key="i">
          <dt>Q:{{ it.q }}</dt>
          <dd>
            <p v-for="(p, j) in it.a" :key="j">{{ j === 0 ? 'A:' : '' }}{{ p }}</p>
          </dd>
        </template>
      </dl>
      <div v-if="sec.table" class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th v-for="h in sec.table.head" :key="h">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in sec.table.rows" :key="i">
              <td v-for="(c, j) in r" :key="j" :class="{ strong: j === 0 }">{{ c }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <ul v-if="sec.notes" class="notes">
        <li v-for="(n, i) in sec.notes" :key="i">※{{ n }}</li>
      </ul>
    </GCard>

    <GCard title="閱讀確認" icon="check">
      <div class="confirm">
        <div class="state">
          <span v-if="error" class="faint">無法取得閱讀紀錄:{{ describeError(error) }} <GButton size="sm" variant="ghost" @click="reload">重試</GButton></span>
          <span v-else-if="status?.readAt"
            >最近一次閱讀:<strong class="mono">{{ status.readAt }}</strong></span
          >
          <span v-else-if="status" class="faint">尚未記錄閱讀</span>
        </div>
        <GButton v-can="'portal.onboarding.confirm'" variant="primary" icon="check" :loading="saving" @click="confirmRead">我已閱讀完畢</GButton>
      </div>
    </GCard>
  </div>
</template>

<style scoped>
.onboarding-tips {
  --gap: 16px;
}
.intro {
  margin: 0 0 12px;
  font-weight: 700;
}
.tips {
  margin: 0;
  padding-left: 1.6em;
  display: flex;
  flex-direction: column;
  gap: 6px;
  line-height: 1.6;
}
.table-wrap {
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-sm);
}
.data-table th,
.data-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  text-align: left;
}
.data-table th {
  font-weight: 600;
  color: var(--text-2);
  background: var(--glass-soft);
  white-space: nowrap;
}
.faq {
  margin: 0;
}
.faq dt {
  font-weight: 700;
  margin-top: 12px;
}
.faq dt:first-child {
  margin-top: 0;
}
.faq dd {
  margin: 4px 0 0;
  line-height: 1.6;
}
.faq dd p {
  margin: 0 0 4px;
}
.notes {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  color: var(--text-2);
  font-size: var(--fs-sm);
}
.confirm {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.mono {
  font-family: var(--font-mono, monospace);
}
.strong {
  font-weight: 700;
}
.faint {
  color: var(--text-2);
}
</style>
