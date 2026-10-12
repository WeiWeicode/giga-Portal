/**
 * 舊入口網文件(public/legacy-docs;PORTAL-API-PLAN D-14):路徑同舊站 Document/、Icons/,各段 URL 編碼。
 * Gateway 對所有回應送 X-Frame-Options: DENY,PDF 不能內嵌,一律以新分頁開啟;圖片可直接顯示。
 */
export const legacyDoc = (path: string) => `/legacy-docs/${path.split('/').map(encodeURIComponent).join('/')}`;

export function openLegacyDoc(path: string): void {
  window.open(legacyDoc(path), '_blank', 'noopener');
}
