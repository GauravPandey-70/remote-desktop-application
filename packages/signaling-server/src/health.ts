// ============================================
// DeskLink — Health Check Endpoint
// Simple HTTP health check for load balancer probes.
// ============================================

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RedisAdapter } from './redis/adapter';

export class HealthCheck {
  static async handle(
    _req: IncomingMessage,
    res: ServerResponse,
    redis: RedisAdapter,
  ): Promise<void> {
    try {
      const redisOk = await redis.ping();

      const health = {
        status: redisOk ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {
          redis: redisOk ? 'ok' : 'fail',
        },
      };

      const statusCode = redisOk ? 200 : 503;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: (err as Error).message,
        }),
      );
    }
  }
}
