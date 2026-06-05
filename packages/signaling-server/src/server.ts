// ============================================
// DeskLink — Signaling Server Entry Point
// WebSocket server for device registration, connection brokering,
// and SDP/ICE relay between host agents and client apps.
// ============================================

import 'dotenv/config';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { createLogger } from '@desklink/common';
import { ConnectionManager } from './ws/connection';
import { MessageHandler } from './ws/handler';
import { SessionManager } from './session/manager';
import { RedisAdapter } from './redis/adapter';
import { HealthCheck } from './health';

const logger = createLogger('signaling-server', {
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') ?? 'info',
});

async function main() {
  const port = parseInt(process.env.SIGNALING_PORT ?? '8080', 10);
  const host = process.env.SIGNALING_HOST ?? '0.0.0.0';

  // --- Initialize Redis ---
  const redis = new RedisAdapter({
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    logger,
  });
  await redis.connect();
  logger.info('Redis connected');

  // --- Initialize Managers ---
  const sessionManager = new SessionManager(redis, logger);
  const connectionManager = new ConnectionManager(logger);
  const messageHandler = new MessageHandler(connectionManager, sessionManager, redis, logger);

  // --- HTTP Server (for health checks + WebSocket upgrade) ---
  const httpServer = http.createServer((req, res) => {
    if (req.url === '/health') {
      HealthCheck.handle(req, res, redis);
      return;
    }
    res.writeHead(404);
    res.end('Not Found');
  });

  // --- WebSocket Server ---
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    maxPayload: 64 * 1024, // 64 KB max message size
  });

  wss.on('connection', (ws, req) => {
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      'unknown';

    connectionManager.handleNewConnection(ws, clientIp);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        messageHandler.handleMessage(ws, message, clientIp);
      } catch (err) {
        logger.warn('Invalid message received', { clientIp, error: (err as Error).message });
        ws.send(
          JSON.stringify({
            type: 'connection:error',
            payload: { code: 'INVALID_MESSAGE', message: 'Invalid JSON message' },
            messageId: 'error',
            timestamp: new Date().toISOString(),
          }),
        );
      }
    });

    ws.on('close', (code, reason) => {
      connectionManager.handleDisconnection(ws, code, reason.toString());
    });

    ws.on('error', (err) => {
      logger.error('WebSocket error', err, { clientIp });
    });
  });

  // --- Heartbeat interval (detect dead connections) ---
  const heartbeatInterval = setInterval(() => {
    connectionManager.checkHeartbeats();
  }, 30_000);

  // --- Start listening ---
  httpServer.listen(port, host, () => {
    logger.info(`Signaling server listening on ${host}:${port}`);
  });

  // --- Graceful shutdown ---
  async function shutdown(signal: string) {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    clearInterval(heartbeatInterval);

    // Stop accepting new connections
    wss.close(() => {
      logger.info('WebSocket server closed');
    });

    // Close all existing connections with a "going away" message
    connectionManager.disconnectAll(1001, 'Server shutting down');

    // Close Redis
    await redis.disconnect();
    logger.info('Redis disconnected');

    // Close HTTP server
    httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.warn('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Failed to start signaling server', err as Error);
  process.exit(1);
});
