import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Injectable, Logger } from '@nestjs/common';
import { DevicesService } from '../devices/devices.service';
import { SessionsService } from '../sessions/sessions.service';
import { v4 as uuidv4 } from 'uuid';

interface SocketConnection {
  socketId: string;
  ws: WebSocket;
  deviceId?: string;
  clientIp: string;
  connectedAt: Date;
}

@WebSocketGateway({ path: '/signaling' })
@Injectable()
export class SignalingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SignalingGateway.name);

  @WebSocketServer()
  server!: Server;

  // Track local connections
  private connections = new Map<string, SocketConnection>();
  private deviceIndex = new Map<string, string>(); // deviceId -> socketId
  private wsIndex = new Map<WebSocket, string>(); // ws -> socketId

  constructor(
    private readonly devicesService: DevicesService,
    private readonly sessionsService: SessionsService,
  ) {}

  async handleConnection(ws: WebSocket, req: any) {
    const socketId = uuidv4();
    const clientIp = req.socket.remoteAddress || 'unknown';

    const conn: SocketConnection = {
      socketId,
      ws,
      clientIp,
      connectedAt: new Date(),
    };

    this.connections.set(socketId, conn);
    this.wsIndex.set(ws, socketId);

    this.logger.log(`New connection socketId=${socketId} IP=${clientIp}`);

    ws.on('message', async (data: string) => {
      try {
        const message = JSON.parse(data);
        await this.handleMessage(ws, message, conn);
      } catch (err: any) {
        this.logger.error(`Error handling message: ${err.message}`);
        this.sendError(ws, 'BAD_MESSAGE', 'Invalid message format');
      }
    });
  }

  async handleDisconnect(ws: WebSocket) {
    const socketId = this.wsIndex.get(ws);
    if (!socketId) return;

    const conn = this.connections.get(socketId);
    if (conn) {
      if (conn.deviceId) {
        this.deviceIndex.delete(conn.deviceId);
        try {
          // Update status to offline in database
          await this.devicesService.updateOnlineStatus(conn.deviceId, false);
          this.logger.log(`Device offline: ${conn.deviceId}`);
        } catch (err: any) {
          this.logger.error(`Failed to update offline status for device ${conn.deviceId}: ${err.message}`);
        }
      }
      this.connections.delete(socketId);
    }
    this.wsIndex.delete(ws);
    this.logger.log(`Connection closed socketId=${socketId}`);
  }

  private async handleMessage(ws: WebSocket, message: any, conn: SocketConnection) {
    const { type, messageId } = message;

    switch (type) {
      case 'device:register': {
        const { deviceId, osType, osVersion, agentVersion, publicKey } = message.payload;
        conn.deviceId = deviceId;
        this.deviceIndex.set(deviceId, conn.socketId);

        try {
          // Register/Update device in database and set online
          await this.devicesService.registerDevice({
            deviceId,
            name: `${osType} Agent`,
            osType,
            osVersion: osVersion || 'unknown',
            agentVersion,
            publicKey,
          }, conn.clientIp);

          this.logger.log(`Device registered & online: ${deviceId}`);
        } catch (err: any) {
          this.logger.error(`Failed to register device in database: ${err.message}`);
        }

        this.sendToSocket(ws, {
          type: 'device:register:ack',
          messageId,
          timestamp: new Date().toISOString(),
          payload: {
            success: true,
            serverTime: new Date().toISOString(),
            turnCredentials: {
              urls: [
                process.env.TURN_SERVER_URL ?? 'turn:localhost:3478',
              ],
              username: process.env.TURN_SERVER_USERNAME ?? 'desklink',
              credential: process.env.TURN_SERVER_PASSWORD ?? 'desklink_turn_dev',
              ttl: 86400,
            },
          },
        });
        break;
      }

      case 'device:heartbeat': {
        if (conn.deviceId) {
          await this.devicesService.updateOnlineStatus(conn.deviceId, true, conn.clientIp);
        }
        this.sendToSocket(ws, {
          type: 'device:heartbeat:ack',
          messageId,
          timestamp: new Date().toISOString(),
          payload: { serverTime: new Date().toISOString() },
        });
        break;
      }

      case 'connection:request': {
        const { targetDeviceId, clientDeviceId, clientPublicKey, clientDisplayName } = message.payload;

        const targetConn = this.getConnectionByDeviceId(targetDeviceId);
        if (!targetConn) {
          this.sendConnectionRejected(ws, '', 'offline', 'Target device is offline');
          return;
        }

        try {
          // Create session in database
          const session = await this.sessionsService.createSession({
            hostDeviceId: targetDeviceId,
            clientDeviceId,
            connectionType: 'p2p',
          });

          // Forward connection request to host
          this.sendToSocket(targetConn.ws, {
            type: 'connection:request:forward',
            messageId,
            timestamp: new Date().toISOString(),
            payload: {
              sessionId: session.id,
              clientDeviceId,
              clientPublicKey,
              clientDisplayName,
              clientIp: conn.clientIp,
            },
          });
        } catch (err: any) {
          this.logger.error(`Failed to initiate session: ${err.message}`);
          this.sendError(ws, 'SESSION_FAILED', 'Could not create connection session');
        }
        break;
      }

      case 'connection:passcode:submit': {
        const { sessionId } = message.payload;
        try {
          const session = await this.sessionsService.getSessionWithEvents(sessionId);
          const targetConn = this.getConnectionByDeviceId(session.hostDevice.deviceId);
          if (targetConn) {
            this.sendToSocket(targetConn.ws, message);
          } else {
            this.sendError(ws, 'HOST_OFFLINE', 'Host device went offline');
          }
        } catch (err: any) {
          this.sendError(ws, 'SESSION_NOT_FOUND', 'Session not found');
        }
        break;
      }

      case 'connection:accepted': {
        const { sessionId } = message.payload;
        try {
          const session = await this.sessionsService.updateSession(sessionId, { status: 'connecting' });
          const clientConn = this.getConnectionByDeviceId(session.clientDevice.deviceId);
          if (clientConn) {
            this.sendToSocket(clientConn.ws, message);
          }
        } catch (err: any) {
          this.logger.error(`Error accepting connection: ${err.message}`);
        }
        break;
      }

      case 'connection:rejected': {
        const { sessionId } = message.payload;
        try {
          const session = await this.sessionsService.updateSession(sessionId, { status: 'failed' });
          const clientConn = this.getConnectionByDeviceId(session.clientDevice.deviceId);
          if (clientConn) {
            this.sendToSocket(clientConn.ws, message);
          }
        } catch (err: any) {
          this.logger.error(`Error rejecting connection: ${err.message}`);
        }
        break;
      }

      case 'webrtc:sdp:offer':
      case 'webrtc:sdp:answer':
      case 'webrtc:ice:candidate':
      case 'webrtc:ice:restart': {
        const { sessionId } = message.payload;
        try {
          const session = await this.sessionsService.getSessionWithEvents(sessionId);
          if (!conn.deviceId) return;

          const targetDeviceId = conn.deviceId === session.hostDevice.deviceId
            ? session.clientDevice.deviceId
            : session.hostDevice.deviceId;

          const targetConn = this.getConnectionByDeviceId(targetDeviceId);
          if (targetConn) {
            this.sendToSocket(targetConn.ws, message);
          }
        } catch (err: any) {
          this.logger.error(`Error relaying WebRTC signaling: ${err.message}`);
        }
        break;
      }

      case 'session:started': {
        const { sessionId, connectionType } = message.payload;
        await this.sessionsService.updateSession(sessionId, {
          status: 'active',
          connectionType,
        });
        break;
      }

      case 'session:ended': {
        const { sessionId } = message.payload;
        const session = await this.sessionsService.updateSession(sessionId, {
          status: 'disconnected',
          qualityMetrics: undefined,
        });

        // Notify the other peer
        if (conn.deviceId) {
          const targetDeviceId = conn.deviceId === session.hostDevice.deviceId
            ? session.clientDevice.deviceId
            : session.hostDevice.deviceId;
          const targetConn = this.getConnectionByDeviceId(targetDeviceId);
          if (targetConn) {
            this.sendToSocket(targetConn.ws, message);
          }
        }
        break;
      }

      case 'session:quality:report': {
        const { sessionId, metrics } = message.payload;
        await this.sessionsService.updateSession(sessionId, {
          qualityMetrics: metrics,
        });
        break;
      }

      default:
        this.sendError(ws, 'UNKNOWN_TYPE', `Unknown message type: ${type}`);
    }
  }

  private getConnectionByDeviceId(deviceId: string): SocketConnection | undefined {
    const socketId = this.deviceIndex.get(deviceId);
    if (!socketId) return undefined;
    return this.connections.get(socketId);
  }

  private sendToSocket(ws: WebSocket, message: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, code: string, errorMessage: string) {
    this.sendToSocket(ws, {
      type: 'connection:error',
      messageId: uuidv4(),
      timestamp: new Date().toISOString(),
      payload: { code, message: errorMessage },
    });
  }

  private sendConnectionRejected(ws: WebSocket, sessionId: string, reason: string, errorMessage: string) {
    this.sendToSocket(ws, {
      type: 'connection:rejected',
      messageId: uuidv4(),
      timestamp: new Date().toISOString(),
      payload: { sessionId, reason, message: errorMessage },
    });
  }
}
