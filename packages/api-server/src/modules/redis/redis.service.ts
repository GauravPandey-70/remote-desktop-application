import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis | null;
  private readonly fallbackStore = new Map<string, string>();

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.client = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          retryStrategy: (times) => {
            if (times > 3) {
              this.logger.warn('Redis connection failed too many times. Falling back to in-memory store.');
              this.client = null;
              return null; // Stop retrying
            }
            return Math.min(times * 100, 2000);
          },
        });

        this.client.on('error', (err) => {
          this.logger.error('Redis error', err.message);
          this.client = null;
        });

        this.client.on('connect', () => {
          this.logger.log('Successfully connected to Redis');
        });
      } catch (err: any) {
        this.logger.error('Failed to initialize Redis client', err.message);
        this.client = null;
      }
    } else {
      this.logger.warn('REDIS_URL not configured. Running with in-memory fallback.');
      this.client = null;
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.client) {
      try {
        return await this.client.get(key);
      } catch (err: any) {
        this.logger.error(`Redis GET failed for key ${key}: ${err.message}`);
        this.client = null; // trigger fallback
      }
    }
    return this.fallbackStore.get(key) ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | boolean> {
    if (this.client) {
      try {
        if (ttlSeconds) {
          await this.client.set(key, value, 'EX', ttlSeconds);
        } else {
          await this.client.set(key, value);
        }
        return 'OK';
      } catch (err: any) {
        this.logger.error(`Redis SET failed for key ${key}: ${err.message}`);
        this.client = null;
      }
    }
    this.fallbackStore.set(key, value);
    if (ttlSeconds) {
      setTimeout(() => {
        this.fallbackStore.delete(key);
      }, ttlSeconds * 1000);
    }
    return true;
  }

  async del(key: string): Promise<number | boolean> {
    if (this.client) {
      try {
        return await this.client.del(key);
      } catch (err: any) {
        this.logger.error(`Redis DEL failed for key ${key}: ${err.message}`);
        this.client = null;
      }
    }
    return this.fallbackStore.delete(key);
  }

  // Set-if-not-exists with TTL (for distributed locking)
  async setnx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    if (this.client) {
      try {
        const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
        return result === 'OK';
      } catch (err: any) {
        this.logger.error(`Redis SETNX failed for key ${key}: ${err.message}`);
        this.client = null;
      }
    }
    if (this.fallbackStore.has(key)) {
      return false;
    }
    this.fallbackStore.set(key, value);
    setTimeout(() => {
      this.fallbackStore.delete(key);
    }, ttlSeconds * 1000);
    return true;
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }
}
