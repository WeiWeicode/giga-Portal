import { describe, expect, it } from 'vitest';
import { accountValid, consentStateText, isServiceEnded, minBid, money, normalizeAccount } from '../src/composables/services';

// docs/Gherkin/services/consent.feature、stock.feature
describe('臨時服務:同意書與集保帳號', () => {
  it('集保帳號去除 - 後須為 11 碼數字', () => {
    expect(normalizeAccount('1234-5678-901')).toBe('12345678901');
    expect(accountValid('1234-5678-901')).toBe(true);
    expect(accountValid('1234567890')).toBe(false);
    expect(accountValid('1234567890a')).toBe(false);
  });

  it('過期顯示服務已結束', () => {
    expect(consentStateText('ended', null).text).toBe('服務已結束');
    expect(consentStateText('signed', '2026-10-23').text).toContain('2026-10-23');
    expect(consentStateText('open', null).tone).toBe('info');
    expect(isServiceEnded({ code: 'PORTAL_SERVICE_ENDED' })).toBe(true);
    expect(isServiceEnded(new Error('x'))).toBe(false);
  });
});

// docs/Gherkin/services/auction.feature
describe('臨時服務:內部拍賣', () => {
  it('出價至少比目前最高價高 1000', () => {
    expect(minBid(null)).toBe(1);
    expect(minBid(10000)).toBe(11000);
    expect(money(11000)).toBe('11,000');
    expect(money(null)).toBe('—');
  });
});
