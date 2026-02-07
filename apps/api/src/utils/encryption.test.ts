import { describe, it, expect, vi, beforeAll } from 'vitest';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

// Test the encryption logic directly without importing the env-dependent module
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function encrypt(plaintext: string, key: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

function decrypt(ciphertext: Buffer, key: Buffer): string {
  const iv = ciphertext.subarray(0, IV_LENGTH);
  const authTag = ciphertext.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = ciphertext.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

describe('encryption', () => {
  const key = Buffer.from(
    'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
    'hex',
  );

  it('should encrypt and decrypt a string', () => {
    const plaintext = 'Hello, World!';
    const encrypted = encrypt(plaintext, key);
    const decrypted = decrypt(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  it('should encrypt and decrypt empty string', () => {
    const encrypted = encrypt('', key);
    const decrypted = decrypt(encrypted, key);
    expect(decrypted).toBe('');
  });

  it('should encrypt and decrypt unicode characters', () => {
    const plaintext = 'Emma Smith — 日本語 — émojis 🎉';
    const encrypted = encrypt(plaintext, key);
    const decrypted = decrypt(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for the same plaintext', () => {
    const plaintext = 'test data';
    const encrypted1 = encrypt(plaintext, key);
    const encrypted2 = encrypt(plaintext, key);
    expect(encrypted1.equals(encrypted2)).toBe(false);
  });

  it('should produce ciphertext longer than plaintext (IV + auth tag)', () => {
    const plaintext = 'short';
    const encrypted = encrypt(plaintext, key);
    // IV (12) + auth tag (16) + ciphertext (>= plaintext length)
    expect(encrypted.length).toBeGreaterThan(28);
  });

  it('should fail to decrypt with wrong key', () => {
    const plaintext = 'secret';
    const encrypted = encrypt(plaintext, key);
    const wrongKey = randomBytes(32);
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  it('should fail to decrypt tampered data', () => {
    const plaintext = 'secret';
    const encrypted = encrypt(plaintext, key);
    // Tamper with a byte
    encrypted[20] = encrypted[20]! ^ 0xff;
    expect(() => decrypt(encrypted, key)).toThrow();
  });
});
