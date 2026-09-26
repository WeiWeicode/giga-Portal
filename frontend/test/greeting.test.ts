import { describe, expect, it } from 'vitest';
import { greetingOf } from '../src/composables/greeting';

// home/home.feature
describe('依時段問候', () => {
  it.each([
    [8, '早安'],
    [5, '早安'],
    [11, '午安'],
    [17, '午安'],
    [18, '晚安'],
    [2, '晚安'],
  ])('%i 點 → %s', (h, g) => expect(greetingOf(h)).toBe(g));
});
