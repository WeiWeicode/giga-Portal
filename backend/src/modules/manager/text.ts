/**
 * 主管專區寫入舊表的文字檢查:舊站(並行期,D-7)以 Label 等原樣輸出,< > 不收;控制字元與 Unicode 雙向 / 零寬字元不收(視覺欺騙)。
 * 多行欄位(課程大綱、備註)允許換行與 Tab。
 */
const BIDI = '[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]';
const LINE = new RegExp(`[\u0000-\u001f\u007f<>]|${BIDI}`);
const MULTI = new RegExp(`[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]|${BIDI}`);

export const unsafeText = (s: string, multiline = false) => (multiline ? MULTI : LINE).test(s);
export const UNSAFE_MESSAGE = '不可含 < > 或控制字元';
