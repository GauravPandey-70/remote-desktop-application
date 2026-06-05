// ============================================
// DeskLink — WebSocket Message Handler
// Routes incoming signaling messages to appropriate handlers.
// ============================================

import { WebSocket } from 'ws';
import {
  generateMessageId,
  type Logger,
  type SignalingMessage,
  type SignalingMessageType,
} from '@desklink/common';
import type { ConnectionManager } from './connection';
import type { SessionManager } from '../session/manager';
import type { RedisAdapter } from '../redis/adapter';

const PASSCODE_RATE_LIMIT = 5; // max attempts per window
const PASSCODE_RATE_WINDOW = 60; // seconds

export class MessageHandler {
  constructor(
    private readonly connections: ConnectionManager,
    private readonly sessions: SessionManager,
    private readonly redis: RedisAdapter,
    private readonly logger: Logger,
  ) {}

  /**
   * Main message router. Dispatches by message type.
   */
  async handleMessage(ws: WebSocket, message: SignalingMessage, clientIp: string): Promise<void> {
    const { type, messageId } = message;

    this.logger.debug('Message received', { type, messageId, clientIp });

    try {
      switch (type) {
        case 'device:register':
          await this.handleDeviceRegister(ws, message as SignalingMessage<'device:register'>, clientIp);
          break;

        case 'device:heartbeat':
          await this.handleDeviceHeartbeat(ws, message as SignalingMessage<'device:heartbeat'>);
          break;

        case 'connection:request':
          await this.handleConnectionRequest(ws, message as SignalingMessage<'connection:request'>, clientIp);
          break;

        case 'connection:passcode:submit':
          await this.handlePasscodeSubmit(ws, message as SignalingMessage<'connection:passcode:submit'>, clientIp);
          break;

        case 'connection:accepted':
          await this.handleConnectionAccepted(ws, message as SignalingMessage<'connection:accepted'>);
          break;

        case 'connection:rejected':
          await this.handleConnectionRejected(ws, message as SignalingMessage<'connection:rejected'>);
          break;

        case 'webrtc:sdp:offer':
        case 'webrtc:sdp:answer':
        case 'webrtc:ice:candidate':
        case 'webrtc:ice:restart':
          await this.handleWebRTCRelay(ws, message, type);
          break;

        case 'session:started':
          await this.handleSessionStarted(ws, message as SignalingMessage<'session:started'>);
          break;

        case 'session:ended':
          await this.handleSessionEnded(ws, message as SignalingMessage<'session:ended'>);
          break;

        case 'session:quality:report':
          await this.handleQualityReport(ws, message as SignalingMessage<'session:quality:report'>);
          break;

        default:
          this.sendError(ws, 'UNKNOWN_TYPE', `Unknown message type: ${type}`);
      }
    } catch (err) {
      this.logger.error(`Error handling message type=${type}`, err as Error, { messageId });
      this.sendError(ws, 'INTERNAL_ERROR', 'An internal error occurred');
    }
  }

  // --- Device Lifecycle ---

  private async handleDeviceRegister(
    ws: WebSocket,
    message: SignalingMessage<'device:register'>,
    clientIp: string,
  ): Promise<void> {
    const { deviceId, osType, agentVersion } = message.payload;

    // Register in connection manager
    this.connections.registerDevice(ws, deviceId);

    // Store online status in Redis
    const conn = this.connections.getConnectionByWs(ws);
    if (conn) {
      await this.redis.setDeviceOnline(deviceId, conn.socketId);
    }

    // Subscribe to messages targeted at this device (for multi-instance)
    await this.redis.subscribe(`device:${deviceId}`, (msg) => {
      this.connections.sendToDevice(deviceId, JSON.parse(msg));
    });

    this.logger.info('Device registered', { deviceId, osType, agentVersion, clientIp });

    // Acknowledge
    const ack: SignalingMessage<'device:register:ack'> = {
      type: 'device:register:ack',
      payload: {
        success: true,
        serverTime: new Date().toISOString(),
        turnCredentials: {
          urls: [
            process.env.TURN_SERVER_URL ?? 'turn:localhost:3478',
            process.env.TURN_SERVER_URL?.replace('turn:', 'turns:')?.replace(':3478', ':5349') ??
              'turns:localhost:5349',
          ],
          username: process.env.TURN_SERVER_USERNAME ?? 'desklink',
          credential: process.env.TURN_SERVER_PASSWORD ?? 'desklink_turn_dev',
          ttl: 86400,
        },
      },
      messageId: generateMessageId(),
      timestamp: new Date().toISOString(),
    };
    this.connections.sendToSocket(ws, ack);
  }

  private async handleDeviceHeartbeat(
    ws: WebSocket,
    message: SignalingMessage<'device:heartbeat'>,
  ): Promise<void> {
    const { deviceId } = message.payload;
    await this.redis.refreshDeviceHeartbeat(deviceId);

    const ack: SignalingMessage<'device:heartbeat:ack'> = {
      type: 'device:heartbeat:ack',
      payload: { serverTime: new Date().toISOString() },
      messageId: generateMessageId(),
      timestamp: new Date().toISOString(),
    };
    this.connections.sendToSocket(ws, ack);
  }

  // --- Connection Establishment ---

  private async handleConnectionRequest(
    ws: WebSocket,
    message: SignalingMessage<'connection:request'>,
    clientIp: string,
  ): Promise<void> {
    const { targetDeviceId, clientDeviceId, clientPublicKey, clientDisplayName } = message.payload;

    // Check if target device is online
    if (!this.connections.isDeviceConnected(targetDeviceId)) {
      // Check Redis in case device is on another signaling instance
      const isOnline = await this.redis.isDeviceOnline(targetDeviceId);
      if (!isOnline) {
        this.sendConnectionRejected(ws, '', 'offline', 'Target device is not online');
        return;
      }
    }

    // Create session
    const sessionId = await this.sessions.createSession({
      hostDeviceId: targetDeviceId,
      clientDeviceId,
      clientIp,
    });

    // Forward connection request to host
    const forward: SignalingMessage<'connection:request:forward'> = {
      type: 'connection:request:forward',
      payload: {
        sessionId,
        clientDeviceId,
        clientPublicKey,
        clientDisplayName,
        clientIp,
      },
      messageId: generateMessageId(),
      timestamp: new Date().toISOString(),
    };

    const delivered = this.connections.sendToDevice(targetDeviceId, forward);
    if (!delivered) {
      // Try via Redis pub/sub (device might be on another instance)
      await this.redis.publish(`device:${targetDeviceId}`, JSON.stringify(forward));
    }

    this.logger.info('Connection request forwarded', {
      sessionId,
      from: clientDeviceId,
      to: targetDeviceId,
    });
  }

  private async handlePasscodeSubmit(
    ws: WebSocket,
    message: SignalingMessage<'connection:passcode:submit'>,
    clientIp: string,
  ): Promise<void> {
    const { sessionId } = message.payload;

    // Rate limiting
    const rateLimitKey = `passcode:${clientIp}`;
    const attempts = await this.redis.incrementRateLimit(rateLimitKey, PASSCODE_RATE_WINDOW);
    if (attempts > PASSCODE_RATE_LIMIT) {
      this.sendConnectionRejected(ws, sessionId, 'rate_limited', 'Too many attempts. Try again later.');
      this.logger.warn('Passcode rate limit exceeded', { clientIp, attempts });
      return;
    }

    // Get session to find host
    const session = await this.sessions.getSession(sessionId);
    if (!session) {
      this.sendError(ws, 'SESSION_NOT_FOUND', 'Session not found');
      return;
    }

    // Forward passcode to host for verification
    const verifyMsg: SignalingMessage<'connection:passcode:submit'> = {
      ...message,
      messageId: generateMessageId(),
      timestamp: new Date().toISOString(),
    };

    const delivered = this.connections.sendToDevice(session.hostDeviceId, verifyMsg);
    if (!delivered) {
      await this.redis.publish(`device:${session.hostDeviceId}`, JSON.stringify(verifyMsg));
    }
  }

  private async handleConnectionAccepted(
    ws: WebSocket,
    message: SignalingMessage<'connection:accepted'>,
  ): Promise<void> {
    const { sessionId, hostDeviceId } = message.payload;

    const session = await this.sessions.getSession(sessionId);
    if (!session) {
      this.sendError(ws, 'SESSION_NOT_FOUND', 'Session not found');
      return;
    }

    await this.sessions.updateSession(sessionId, { status: 'connecting' });

    // Forward acceptance to client
    const delivered = this.connections.sendToDevice(session.clientDeviceId, message);
    if (!delivered) {
      await this.redis.publish(`device:${session.clientDeviceId}`, JSON.stringify(message));
    }

    this.logger.info('Connection accepted', { sessionId, hostDeviceId });
  }

  private async handleConnectionRejected(
    _ws: WebSocket,
    message: SignalingMessage<'connection:rejected'>,
  ): Promise<void> {
    const { sessionId, reason } = message.payload;

    const session = await this.sessions.getSession(sessionId);
    if (!session) return;

    await this.sessions.updateSession(sessionId, { status: 'failed' });

    // Forward rejection to client
    this.connections.sendToDevice(session.clientDeviceId, message);

    this.logger.info('Connection rejected', { sessionId, reason });
  }

  // --- WebRTC Relay ---

  private async handleWebRTCRelay(
    ws: WebSocket,
    message: SignalingMessage,
    type: SignalingMessageType,
  ): Promise<void> {
    const payload = message.payload as { sessionId: string };
    const session = await this.sessions.getSession(payload.sessionId);
    if (!session) {
      this.sendError(ws, 'SESSION_NOT_FOUND', 'Session not found');
      return;
    }

    // Determine the peer (relay to the other side)
    const sender = this.connections.getConnectionByWs(ws);
    if (!sender?.deviceId) return;

    const targetDeviceId =
      sender.deviceId === session.hostDeviceId
        ? session.clientDeviceId
        : session.hostDeviceId;

    const delivered = this.connections.sendToDevice(targetDeviceId, message);
    if (!delivered) {
      await this.redis.publish(`device:${targetDeviceId}`, JSON.stringify(message));
    }

    this.logger.debug('WebRTC message relayed', {
      type,
      sessionId: payload.sessionId,
      from: sender.deviceId,
      to: targetDeviceId,
    });
  }

  // --- Session Lifecycle ---

  private async handleSessionStarted(
    _ws: WebSocket,
    message: SignalingMessage<'session:started'>,
  ): Promise<void> {
    const { sessionId, connectionType } = message.payload;
    await this.sessions.updateSession(sessionId, {
      status: 'active',
      connectionType,
    });
    this.logger.info('Session started', { sessionId, connectionType });
  }

  private async handleSessionEnded(
    ws: WebSocket,
    message: SignalingMessage<'session:ended'>,
  ): Promise<void> {
    const { sessionId, reason, duration } = message.payload;
    await this.sessions.updateSession(sessionId, {
      status: 'disconnected',
      endedAt: new Date().toISOString(),
      durationSeconds: duration.toString(),
    });

    // Notify the other peer
    const session = await this.sessions.getSession(sessionId);
    if (session) {
      const sender = this.connections.getConnectionByWs(ws);
      if (sender?.deviceId) {
        const targetDeviceId =
          sender.deviceId === session.hostDeviceId
            ? session.clientDeviceId
            : session.hostDeviceId;
        this.connections.sendToDevice(targetDeviceId, message);
      }
    }

    this.logger.info('Session ended', { sessionId, reason, duration });
  }

  private async handleQualityReport(
    _ws: WebSocket,
    message: SignalingMessage<'session:quality:report'>,
  ): Promise<void> {
    const { sessionId, metrics } = message.payload;
    await this.sessions.updateSession(sessionId, {
      qualityMetrics: JSON.stringify(metrics),
    });
  }

  // --- Helpers ---

  private sendError(ws: WebSocket, code: string, errorMessage: string): void {
    const msg: SignalingMessage<'connection:error'> = {
      type: 'connection:error',
      payload: { code, message: errorMessage },
      messageId: generateMessageId(),
      timestamp: new Date().toISOString(),
    };
    this.connections.sendToSocket(ws, msg);
  }

  private sendConnectionRejected(
    ws: WebSocket,
    sessionId: string,
    reason: 'denied' | 'passcode_invalid' | 'rate_limited' | 'offline' | 'access_rule_blocked',
    errorMessage: string,
  ): void {
    const msg: SignalingMessage<'connection:rejected'> = {
      type: 'connection:rejected',
      payload: { sessionId, reason, message: errorMessage },
      messageId: generateMessageId(),
      timestamp: new Date().toISOString(),
    };
    this.connections.sendToSocket(ws, msg);
  }
}
