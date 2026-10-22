/**
 * 3691 作者工號加密(PORTAL-API-PLAN D-23;FEATURE-PLAN §5.1):
 *   - AES-256-GCM,金鑰 32 bytes 只從 secret / 環境變數讀(TALK_AUTHOR_KEY[_FILE],config.ts),程式與資料庫都不存金鑰
 *   - AAD 綁定文章 SN(`talk3691:<SN>`):密文搬到別篇文章無法解開
 *   - 每次加密隨機 12 bytes IV;密文 = base64(iv || ciphertext || tag),連同 keyId 存 portal.talk_author(換金鑰時舊密文仍可依 keyId 找到金鑰)
 * 舊站 Talk3691Data.mark 為舊程式寫死金鑰的 DES 密文,新站不解碼(CONFIRM-NEEDED P3)。
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

export interface AuthorKey {
  id: string;
  key: Buffer;
}

export class AuthorKeyError extends Error {
  override name = 'AuthorKeyError';
}

/** 解析 base64 金鑰(必須剛好 32 bytes) */
export function parseAuthorKey(id: string, base64: string): AuthorKey {
  if (!/^[A-Za-z0-9_-]{1,20}$/.test(id)) throw new AuthorKeyError(`TALK_AUTHOR_KEY_ID 格式不合法(英數字、- _,最多 20 字):${id}`);
  const key = Buffer.from(base64.trim(), 'base64');
  if (key.length !== 32) throw new AuthorKeyError('TALK_AUTHOR_KEY 必須是 32 bytes 的 base64(例:openssl rand -base64 32)');
  return { id, key };
}

const aad = (sn: number) => Buffer.from(`talk3691:${sn}`, 'utf8');

export class AuthorCipher {
  private readonly keys: Map<string, Buffer>;

  /** current:加密用;others:只用來解開以前的金鑰加密的資料 */
  constructor(
    private readonly current: AuthorKey,
    others: readonly AuthorKey[] = [],
  ) {
    this.keys = new Map([...others, current].map((k) => [k.id, k.key]));
  }

  get keyId(): string {
    return this.current.id;
  }

  encrypt(sn: number, empNo: string): { cipher: string; keyId: string } {
    const iv = randomBytes(IV_LEN);
    const c = createCipheriv(ALG, this.current.key, iv);
    c.setAAD(aad(sn));
    const body = Buffer.concat([c.update(empNo, 'utf8'), c.final()]);
    return { cipher: Buffer.concat([iv, body, c.getAuthTag()]).toString('base64'), keyId: this.current.id };
  }

  /** 解不開(金鑰不符、密文遭竄改、SN 不符)時丟出例外,不回傳半成品 */
  decrypt(sn: number, cipher: string, keyId: string): string {
    const key = this.keys.get(keyId);
    if (!key) throw new AuthorKeyError(`找不到金鑰 ${keyId}`);
    const raw = Buffer.from(cipher, 'base64');
    if (raw.length < IV_LEN + TAG_LEN + 1) throw new AuthorKeyError('密文格式錯誤');
    const d = createDecipheriv(ALG, key, raw.subarray(0, IV_LEN));
    d.setAAD(aad(sn));
    d.setAuthTag(raw.subarray(raw.length - TAG_LEN));
    return Buffer.concat([d.update(raw.subarray(IV_LEN, raw.length - TAG_LEN)), d.final()]).toString('utf8');
  }
}
