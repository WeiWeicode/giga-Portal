/**
 * 問卷前言 / 結語的 HTML 白名單過濾(FEATURE-PLAN §0.2「使用者 HTML 以白名單過濾後輸出」)。
 * 舊站以 CKEditor 編輯、原樣輸出(QuestView.aspx.cs:60-62),並行期新站寫入的內容也會在舊站顯示,所以**寫入前**清洗;
 * 讀出舊資料時**再清洗一次**才回給前端(前端顯示前另以 web-kit sanitizeHtml 清洗)。
 *   - 標籤:CKEditor / 一般排版會產生的結構(含 div、span、表格、清單);script / style / iframe 等連內容移除
 *   - 屬性:連結(https、mailto、站內 / 開頭)、圖片(只接受 data:image png / jpeg / gif / webp,與 file-service 檔案 API)、
 *     表格合併、style 只留顏色 / 背景色 / 對齊 / 字級
 *   白名單與 Gateway bff/src/modules/notify/html.ts 相同原則(sanitize-html,TECH-STACK 已列)。
 */
import sanitize from 'sanitize-html';

const COLOR = [/^#[0-9a-f]{3,8}$/i, /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i, /^[a-z]{3,20}$/i];
const IMG_SRC = /^(data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+|\/api\/file\/files\/[0-9a-f-]{36}\/content(\?inline=1)?)$/i;

/** 清洗後上限(字元數);QAFcontent / QAEcontent 為 nvarchar(max),上限避免單筆過大 */
export const MAX_HTML_CHARS = 200_000;

const OPTIONS: sanitize.IOptions = {
  allowedTags: [
    'p',
    'br',
    'div',
    'span',
    'h2',
    'h3',
    'h4',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'del',
    'sub',
    'sup',
    'ul',
    'ol',
    'li',
    'blockquote',
    'hr',
    'a',
    'img',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    ol: ['start'],
    '*': ['style'],
  },
  allowedStyles: {
    '*': {
      color: COLOR,
      'background-color': COLOR,
      'text-align': [/^(left|right|center|justify)$/],
      'font-size': [/^\d{1,3}(\.\d+)?(px|pt|em|rem|%)$/],
    },
  },
  allowedSchemes: ['https', 'mailto'],
  allowedSchemesByTag: { img: ['data'] },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' } }),
  },
  exclusiveFilter: (frame) => frame.tag === 'img' && !IMG_SRC.test(frame.attribs.src ?? ''),
};

/** 白名單清洗;連結只留 https、mailto 與站內路徑(不允許 // 協定相對網址) */
export function sanitizeQaHtml(html: string | null | undefined): string {
  if (!html) return '';
  const clean = sanitize(html, OPTIONS);
  return clean.replace(/<a\b([^>]*?)\shref="([^"]*)"/g, (m, pre: string, href: string) =>
    /^(https:|mailto:|\/(?!\/))/i.test(href.replace(/&amp;/g, '&')) ? m : `<a${pre}`,
  );
}
