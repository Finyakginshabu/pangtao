import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  comparePassword,
  generateSessionToken,
  hashSessionToken,
} from '../../server/src/utils/hash.util.js';

describe('Auth Utility & Pure Service Unit Tests (U)', () => {
  it('hashes passwords using bcrypt with salt rounds >= 12', async () => {
    const raw = 'SuperSecret123!';
    const hash = await hashPassword(raw);

    expect(hash).toMatch(/^\$2[aby]\$1[2-9]\$/);
    const matches = await comparePassword(raw, hash);
    expect(matches).toBe(true);

    const wrongMatches = await comparePassword('WrongPassword', hash);
    expect(wrongMatches).toBe(false);
  });

  it('generates 32-byte cryptographically secure session tokens in hex', () => {
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();

    expect(token1.length).toBe(64); // 32 bytes = 64 hex characters
    expect(token2.length).toBe(64);
    expect(token1).not.toBe(token2);
  });

  it('computes deterministic SHA-256 hashes of session tokens', () => {
    const token = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const hash1 = hashSessionToken(token);
    const hash2 = hashSessionToken(token);

    expect(hash1.length).toBe(64);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(token);
  });
});

