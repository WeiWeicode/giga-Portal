/**
 * OpenAPI 根層設定(BACKEND-GUIDE.md §6.1):x-gateway 與 x-permissions 必填。
 * 每個 operation 的 operationId、summary、description、x-permission、x-gherkin 寫在各路由的 schema。
 */
import type { SwaggerOptions } from '@fastify/swagger';

declare module 'fastify' {
  interface FastifySchema {
    /** 權限代碼(例 portal.note.read)、authenticated(登入即可)或 public(需 IT 核准) */
    'x-permission'?: string;
    /** 行為規格:Gherkin 場景文字(zh-TW 關鍵字),存入 gw.api_route.gherkin */
    'x-gherkin'?: string;
    'x-audit-level'?: 'none' | 'meta' | 'body';
    'x-timeout-ms'?: number;
    'x-gateway-path'?: string;
  }
}

/**
 * 本服務的 API 權限代碼(kind 省略 = api;讀 / 寫分開)。畫面節點(目錄 / 選單 / Tab / 按鈕)仍由
 * deploy/gateway-rbac.yaml 登記,以 includes 綁定這裡的 API 權限(BACKEND-GUIDE §6.1 v0.6)。
 * 代碼一律 portal.api.*,與畫面節點(portal.<頁>.read、Tab、按鈕)分開,避免同名不同 kind。
 */
export const PERMISSIONS: { code: string; name: string }[] = [
  { code: 'portal.api.course.read', name: '入口網 API:年度必上課程查詢' },
  { code: 'portal.api.commute.read', name: '入口網 API:通勤調查查詢' },
  { code: 'portal.api.commute.write', name: '入口網 API:通勤調查送出' },
  { code: 'portal.api.note.read', name: '入口網 API:個人提醒查詢' },
  { code: 'portal.api.note.write', name: '入口網 API:個人提醒新增 / 修改 / 刪除' },
  { code: 'portal.api.asset.read', name: '入口網 API:個人資產備註查詢' },
  { code: 'portal.api.bpm.read', name: '入口網 API:BPM 待簽核 / 我送出的 / 已簽核查詢' },
  { code: 'portal.api.directory.read', name: '入口網 API:分機表查詢' },
  { code: 'portal.api.directory.write', name: '入口網 API:更新本人分機' },
  { code: 'portal.api.job.read', name: '入口網 API:內部職缺查詢' },
  { code: 'portal.api.job.write', name: '入口網 API:內部職缺維護' },
  { code: 'portal.api.hr.read', name: '入口網 API:人資專區文件下載' },
  { code: 'portal.api.onboarding.read', name: '入口網 API:新人導覽狀態與測驗題目' },
  { code: 'portal.api.onboarding.write', name: '入口網 API:新人導覽閱讀紀錄與送出測驗' },
  { code: 'portal.api.qa.read', name: '入口網 API:我的待填問卷與填答內容' },
  { code: 'portal.api.qa.write', name: '入口網 API:送出問卷作答' },
  { code: 'portal.api.qa.edit', name: '入口網 API:問卷維護(本人建立的問卷、統計、匯出)' },
  { code: 'portal.api.qa.admin', name: '入口網 API:問卷代管(全部出題者)' },
  { code: 'portal.api.home.read', name: '入口網 API:首頁聚合' },
  { code: 'portal.api.home.edit', name: '入口網 API:首頁輪播維護' },
  { code: 'portal.api.news.read', name: '入口網 API:舊入口網公告查詢' },
  { code: 'portal.api.calendar.read', name: '入口網 API:年度行事曆查詢' },
  { code: 'portal.api.calendar.edit', name: '入口網 API:年度行事曆上傳 / 刪除' },
  { code: 'portal.api.link.read', name: '入口網 API:集團系統查詢' },
  { code: 'portal.api.link.edit', name: '入口網 API:集團系統維護' },
  { code: 'portal.api.personal-link.read', name: '入口網 API:個人常用連結查詢' },
  { code: 'portal.api.personal-link.write', name: '入口網 API:個人常用連結新增 / 修改 / 刪除' },
  { code: 'portal.api.talk.read', name: '入口網 API:3691 瀏覽' },
  { code: 'portal.api.talk.write', name: '入口網 API:3691 發文 / 回覆 / 按讚' },
  { code: 'portal.api.talk.moderate', name: '入口網 API:3691 屏蔽與管理檢視' },
  { code: 'portal.api.talk.reveal', name: '入口網 API:3691 解碼作者(需核准文號、留稽核)' },
  { code: 'portal.api.form.read', name: '入口網 API:表單下載清單' },
  { code: 'portal.api.form.edit', name: '入口網 API:表單與分類維護' },
  { code: 'portal.api.mgr.dept.read', name: '入口網 API:主管專區可選部門' },
  { code: 'portal.api.mgr.course.read', name: '入口網 API:主管專區部屬年度必上課程' },
  { code: 'portal.api.mgr.property.read', name: '入口網 API:主管專區部門資產備註' },
  { code: 'portal.api.mgr.property.edit', name: '入口網 API:主管專區修改部屬資產備註' },
  { code: 'portal.api.mgr.training.read', name: '入口網 API:年度教育訓練計畫查詢與匯出' },
  { code: 'portal.api.mgr.training.write', name: '入口網 API:年度教育訓練計畫課程維護與提交' },
  { code: 'portal.api.mgr.budget.read', name: '入口網 API:部門預算執行查詢' },
  { code: 'portal.api.mgr.budget-apply.read', name: '入口網 API:部門預算編列查詢' },
  { code: 'portal.api.mgr.budget-apply.write', name: '入口網 API:部門預算編列更新與送出' },
];

export function swaggerOptions(serviceCode: string, project: string): SwaggerOptions {
  const extensions = { 'x-gateway': { upstream: serviceCode, system: 'portal', project }, 'x-permissions': PERMISSIONS };
  return { openapi: { openapi: '3.0.3', info: { title: '員工入口網 portal-api', version: '0.1.0' }, ...extensions } };
}
