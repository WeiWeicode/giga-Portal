import { describe, expect, it } from 'vitest';
import { safeRedirect } from '../src/composables/redirect';

// auth/login.feature
describe('redirect 只接受同網域相對路徑', () => {
  it.each([
    ['/it/', '/it/'],
    ['/personal/leave', '/personal/leave'],
    ['/news?page=2#top', '/news?page=2#top'],
    ['https://evil.com', '/'],
    ['//evil.com', '/'],
    ['/\\evil.com', '/'],
    ['/\t/evil.com', '/'],
    ['javascript:alert(1)', '/'],
    ['', '/'],
    [undefined, '/'],
    [['/a', '/b'], '/'],
  ])('%j → %s', (raw, expected) => {
    expect(safeRedirect(raw)).toBe(expected);
  });
});
