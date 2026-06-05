// ============================================
// DeskLink — Redis Adapter (In-Memory Mock)
// Wraps ioredis with typed operations for session state,
// distributed locks, and pub/sub message fan-out.
// Mocked for Docker-less local development.
// ============================================

import type { Logger } from '@desklink/common';
import { EventEmitter } from 'events';

export interface RedisConfig {
  url: string;
  logger: Logger;
}

export class RedisAdapter {
  private readonly logger: Logger;
  private readonly eventEmitter = new EventEmitter();

  // In-memory data stores
  private onlineDevices = new Map<string, string>(); // deviceId -> socketId
  private sessions = new Map<string, Record<string, string>>();
  private locks = new Map<string, string>(); // lockKey -> lockValue
  private rateLimits = new Map<string, number>();

  constructor(config: RedisConfig) {
    this.logger = config.logger;
  }

  async connect(): Promise<void> {
    this.logger.info('Connected to mock in-memory Redis adapter');
  }

  async disconnect(): Promise<void> {
    this.eventEmitter.removeAllListeners();
  }

  // --- Device online status ---

  async setDeviceOnline(deviceId: string, socketId: string): Promise<void> {
    this.onlineDevices.set(deviceId, socketId);
  }

  async setDeviceOffline(deviceId: string): Promise<void> {
    this.onlineDevices.delete(deviceId);
  }

  async getDeviceSocketId(deviceId: string): Promise<string | null> {
    return this.onlineDevices.get(deviceId) ?? null;
  }

  async isDeviceOnline(deviceId: string): Promise<boolean> {
    return this.onlineDevices.has(deviceId);
  }

  async refreshDeviceHeartbeat(_deviceId: string): Promise<void> {
    // TTL is ignored in this mock
  }

  // --- Session state ---

  async createSession(sessionId: string, data: Record<string, string>): Promise<void> {
    this.sessions.set(sessionId, data);
  }

  async getSession(sessionId: string): Promise<Record<string, string> | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async updateSession(sessionId: string, updates: Record<string, string>): Promise<void> {
    const existing = this.sessions.get(sessionId) || {};
    this.sessions.set(sessionId, { ...existing, ...updates });
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  // --- Distributed lock (for session ownership) ---

  async acquireLock(lockKey: string, lockValue: string, _ttlSeconds: number): Promise<boolean> {
    if (this.locks.has(lockKey)) {
      return false;
    }
    this.locks.set(lockKey, lockValue);
    return true;
  }

  async releaseLock(lockKey: string, lockValue: string): Promise<boolean> {
    if (this.locks.get(lockKey) === lockValue) {
      this.locks.delete(lockKey);
      return true;
    }
    return false;
  }

  // --- Pub/Sub for multi-instance signaling ---

  async publish(channel: string, message: string): Promise<void> {
    this.eventEmitter.emit(channel, message);
  }

  async subscribe(channel: string, handler: (message: string) => void): Promise<void> {
    this.eventEmitter.on(channel, handler);
  }

  async unsubscribe(channel: string): Promise<void> {
    this.eventEmitter.removeAllListeners(channel);
  }

  // --- Rate limiting ---

  async incrementRateLimit(key: string, _windowSeconds: number): Promise<number> {
    const current = this.rateLimits.get(key) || 0;
    const next = current + 1;
    this.rateLimits.set(key, next);
    return next;
  }

  // --- Health check ---

  async ping(): Promise<boolean> {
    return true;
  }
}
