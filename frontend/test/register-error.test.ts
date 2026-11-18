import { ApiError } from '@giganexus/web-kit';
import { describe, expect, it } from 'vitest';
import { isAccountExists } from '../src/api/gateway';

// 註冊:此工號已有帳號時引導回登入 / 忘記密碼(Gateway PRD §8.1.1 REGISTRATION_ACCOUNT_EXISTS)
describe('isAccountExists', () => {
  it('只有 REGISTRATION_ACCOUNT_EXISTS 才算已有帳號', () => {
    expect(isAccountExists(new ApiError(409, 'REGISTRATION_ACCOUNT_EXISTS', '此工號可能已有帳號,請直接登入或使用忘記密碼', 'r1'))).toBe(true);
    expect(isAccountExists(new ApiError(403, 'REGISTRATION_NOT_ALLOWED', '無法註冊,請聯絡 IT', 'r2'))).toBe(false);
    expect(isAccountExists(new TypeError('Failed to fetch'))).toBe(false);
    expect(isAccountExists(undefined)).toBe(false);
  });
});
