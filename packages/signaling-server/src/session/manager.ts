// ============================================
// DeskLink — Session Manager
// Manages session lifecycle in Redis.
// ============================================

import { v4 as uuidv4 } from 'uuid';
import type { Logger } from '@desklink/common';
import type { RedisAdapter } from '../redis/adapter';

export interface CreateSessionParams {
  hostDeviceId: string;
  clientDeviceId: string;
  clientIp: string;
}

export interface SessionData {
  id: string;
  hostDeviceId: string;
  clientDeviceId: string;
  clientIp: string;
  status: string;
  connectionType: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: string;
  qualityMetrics: string;
}

export class SessionManager {
  constructor(
    private readonly redis: RedisAdapter,
    private readonly logger: Logger,
  ) {}

  /**
   * Create a new session and acquire a distributed lock.
   */
  async createSession(params: CreateSessionParams): Promise<string> {
    const sessionId = uuidv4();
    const lockKey = `session:${params.hostDeviceId}:${params.clientDeviceId}`;
    const lockValue = sessionId;

    // Acquire lock to prevent duplicate sessions between the same pair
    const acquired = await this.redis.acquireLock(lockKey, lockValue, 300); // 5 min TTL
    if (!acquired) {
      this.logger.warn('Session lock already held', {
        hostDeviceId: params.hostDeviceId,
        clientDeviceId: params.clientDeviceId,
      });
      // Allow anyway — the existing session might be stale
    }

    await this.redis.createSession(sessionId, {
      id: sessionId,
      hostDeviceId: params.hostDeviceId,
      clientDeviceId: params.clientDeviceId,
      clientIp: params.clientIp,
      status: 'connecting',
      connectionType: '',
      startedAt: new Date().toISOString(),
      endedAt: '',
      durationSeconds: '0',
      qualityMetrics: '{}',
    });

    this.logger.info('Session created', {
      sessionId,
      hostDeviceId: params.hostDeviceId,
      clientDeviceId: params.clientDeviceId,
    });

    return sessionId;
  }

  /**
   * Get session data.
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const data = await this.redis.getSession(sessionId);
    return data as SessionData | null;
  }

  /**
   * Update session fields.
   */
  async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void> {
    const stringUpdates: Record<string, string> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        stringUpdates[key] = String(value);
      }
    }
    await this.redis.updateSession(sessionId, stringUpdates);
  }

  /**
   * End a session and release the lock.
   */
  async endSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    await this.updateSession(sessionId, {
      status: 'disconnected',
      endedAt: new Date().toISOString(),
    });

    // Release the pair lock
    const lockKey = `session:${session.hostDeviceId}:${session.clientDeviceId}`;
    await this.redis.releaseLock(lockKey, sessionId);

    this.logger.info('Session ended', { sessionId });
  }
}
