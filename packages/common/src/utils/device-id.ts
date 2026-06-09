// ============================================
// DeskLink — Device ID Utilities
// Generation, validation, and formatting of Device IDs
// ============================================

import { DEVICE_ID_CHARSET, DEVICE_ID_LENGTH, DEVICE_ID_PATTERN } from '../types/device';
function getRandomByte(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(1);
    crypto.getRandomValues(arr);
    return arr[0];
  }
  return Math.floor(Math.random() * 256);
}

/**
 * Generate a cryptographically random Device ID.
 * Format: DL-XXX-XXX-XX (9 chars from safe charset)
 *
 * Uses rejection sampling to avoid modulo bias.
 */
export function generateDeviceId(): string {
  const chars: string[] = [];
  const charsetLen = DEVICE_ID_CHARSET.length; // 30 chars

  while (chars.length < DEVICE_ID_LENGTH) {
    const byte = getRandomByte();
    // Reject values >= 240 to avoid modulo bias (240 = 30 * 8)
    if (byte < 240) {
      chars.push(DEVICE_ID_CHARSET[byte % charsetLen]);
    }
  }

  const raw = chars.join('');
  return `DL-${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6, 9)}`;
}

/**
 * Validate a Device ID string.
 */
export function isValidDeviceId(id: string): boolean {
  return DEVICE_ID_PATTERN.test(id);
}

/**
 * Normalize a Device ID: uppercase, trim whitespace, add dashes if missing.
 * Returns null if the input can't be normalized to a valid ID.
 */
export function normalizeDeviceId(input: string): string | null {
  const cleaned = input.trim().toUpperCase().replace(/[\s-]/g, '');

  // Check if it starts with "DL" prefix
  const raw = cleaned.startsWith('DL') ? cleaned.slice(2) : cleaned;

  if (raw.length !== DEVICE_ID_LENGTH) {
    return null;
  }

  // Verify all chars are in charset
  for (const ch of raw) {
    if (!DEVICE_ID_CHARSET.includes(ch)) {
      return null;
    }
  }

  const formatted = `DL-${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6, 9)}`;
  return isValidDeviceId(formatted) ? formatted : null;
}
