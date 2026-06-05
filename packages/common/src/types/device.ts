// ============================================
// DeskLink — Device Types
// Device registration, identification, and status
// ============================================

export type OsType = 'windows' | 'macos';

export interface Device {
  id: string;
  deviceId: string;
  name: string;
  osType: OsType;
  osVersion: string;
  agentVersion: string;
  publicKey: string;
  ownerId: string | null;
  orgId: string | null;
  lastIp: string | null;
  isOnline: boolean;
  lastSeen: string;
  createdAt: string;
}

export interface DeviceRegistration {
  deviceId: string;
  name: string;
  osType: OsType;
  osVersion: string;
  agentVersion: string;
  publicKey: string;
}

export interface DeviceSummary {
  deviceId: string;
  name: string;
  osType: OsType;
  isOnline: boolean;
  lastSeen: string;
}

/**
 * Device ID format: DL-XXX-XXX-XX
 * 9 alphanumeric characters grouped for readability.
 * Charset excludes confusing characters: 0/O, 1/I/L
 */
export const DEVICE_ID_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const DEVICE_ID_LENGTH = 9;
export const DEVICE_ID_PATTERN = /^DL-[23456789A-HJ-NP-Z]{3}-[23456789A-HJ-NP-Z]{3}-[23456789A-HJ-NP-Z]{2}$/;
