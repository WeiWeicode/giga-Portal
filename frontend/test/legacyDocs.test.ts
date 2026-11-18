import { describe, expect, it } from 'vitest';
import { legacyDoc } from '../src/composables/legacyDocs';

describe('舊入口網文件連結', () => {
  it('路徑各段編碼,斜線保留', () => {
    expect(legacyDoc('Document/03_條款/加護或燒燙傷病房(無等待期) --14天.pdf')).toBe(
      `/legacy-docs/Document/03_${encodeURIComponent('條款')}/${encodeURIComponent('加護或燒燙傷病房(無等待期) --14天.pdf')}`,
    );
  });
});
