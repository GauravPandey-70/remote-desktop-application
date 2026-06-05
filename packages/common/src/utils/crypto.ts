// ============================================
// DeskLink — Crypto Utilities
// Key exchange helpers and hashing for signaling
// ============================================

import { randomBytes, createHash, pbkdf2Sync } from 'node:crypto';

/**
 * Generate a cryptographically random passcode.
 * @param length Number of digits (default: 6)
 * @returns Numeric passcode string (e.g., "847293")
 */
export function generatePasscode(length: number = 6): string {
  const digits: string[] = [];
  while (digits.length < length) {
    const byte = randomBytes(1)[0];
    // Reject values >= 250 to avoid modulo bias (250 = 10 * 25)
    if (byte < 250) {
      digits.push((byte % 10).toString());
    }
  }
  return digits.join('');
}

/**
 * Hash a passcode using PBKDF2-SHA256.
 * @returns Object with hash and salt (both hex-encoded)
 */
export function hashPasscode(
  passcode: string,
  salt?: string,
): { hash: string; salt: string } {
  const passSalt = salt ?? randomBytes(32).toString('hex');
  const hash = pbkdf2Sync(passcode, passSalt, 100_000, 64, 'sha256').toString('hex');
  return { hash, salt: passSalt };
}

/**
 * Verify a passcode against a stored hash.
 */
export function verifyPasscode(
  passcode: string,
  storedHash: string,
  storedSalt: string,
): boolean {
  const { hash } = hashPasscode(passcode, storedSalt);
  // Constant-time comparison to prevent timing attacks
  if (hash.length !== storedHash.length) return false;
  let mismatch = 0;
  for (let i = 0; i < hash.length; i++) {
    mismatch |= hash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Generate a unique message ID for signaling messages.
 */
export function generateMessageId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * SHA-256 hash of a string, returned as hex.
 */
export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}
