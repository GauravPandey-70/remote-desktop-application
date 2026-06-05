// ============================================
// DeskLink — WebSocket Connection Manager
// Tracks connected devices, maps Device IDs to WebSocket instances,
// and handles heartbeat monitoring.
// ============================================

import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type { Logger } from '@desklink/common';

export interface ConnectedDevice {
  socketId: string;
  ws: WebSocket;
  deviceId: string | null; // null until device:register is received
  clientIp: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  isAlive: boolean;
}

export class ConnectionManager {
  /** socketId → ConnectedDevice */
  private connections = new Map<string, ConnectedDevice>();
  /** deviceId → socketId (for routing by Device ID) */
  private deviceIndex = new Map<string, string>();
  /** ws → socketId (for reverse lookup) */
  private wsIndex = new WeakMap<WebSocket, string>();

  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Register a new WebSocket connection (before device registration).
   */
  handleNewConnection(ws: WebSocket, clientIp: string): string {
    const socketId = uuidv4();
    const device: ConnectedDevice = {
      socketId,
      ws,
      deviceId: null,
      clientIp,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      isAlive: true,
    };

    this.connections.set(socketId, device);
    this.wsIndex.set(ws, socketId);

    // WebSocket ping/pong for connection liveness
    ws.on('pong', () => {
      const conn = this.connections.get(socketId);
      if (conn) {
        conn.isAlive = true;
        conn.lastHeartbeat = new Date();
      }
    });

    this.logger.info('New WebSocket connection', { socketId, clientIp });
    return socketId;
  }

  /**
   * Associate a Device ID with a WebSocket connection (after device:register).
   */
  registerDevice(ws: WebSocket, deviceId: string): void {
    const socketId = this.wsIndex.get(ws);
    if (!socketId) {
      this.logger.warn('registerDevice called for unknown WebSocket');
      return;
    }

    const conn = this.connections.get(socketId);
    if (!conn) return;

    // Remove old device index if this device was connected elsewhere
    const oldSocketId = this.deviceIndex.get(deviceId);
    if (oldSocketId && oldSocketId !== socketId) {
      this.logger.info('Device reconnecting, closing old connection', {
        deviceId,
        oldSocketId,
        newSocketId: socketId,
      });
      const oldConn = this.connections.get(oldSocketId);
      if (oldConn) {
        oldConn.ws.close(4001, 'Device connected from another location');
        this.connections.delete(oldSocketId);
      }
    }

    conn.deviceId = deviceId;
    this.deviceIndex.set(deviceId, socketId);
    this.logger.info('Device registered', { deviceId, socketId });
  }

  /**
   * Handle WebSocket disconnection.
   */
  handleDisconnection(ws: WebSocket, code: number, reason: string): void {
    const socketId = this.wsIndex.get(ws);
    if (!socketId) return;

    const conn = this.connections.get(socketId);
    if (conn?.deviceId) {
      this.deviceIndex.delete(conn.deviceId);
      this.logger.info('Device disconnected', {
        deviceId: conn.deviceId,
        socketId,
        code,
        reason,
      });
    }

    this.connections.delete(socketId);
  }

  /**
   * Send a message to a specific device by Device ID.
   */
  sendToDevice(deviceId: string, message: object): boolean {
    const socketId = this.deviceIndex.get(deviceId);
    if (!socketId) return false;

    const conn = this.connections.get(socketId);
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) return false;

    conn.ws.send(JSON.stringify(message));
    return true;
  }

  /**
   * Send a message to a specific WebSocket.
   */
  sendToSocket(ws: WebSocket, message: object): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Get connection info by WebSocket.
   */
  getConnectionByWs(ws: WebSocket): ConnectedDevice | undefined {
    const socketId = this.wsIndex.get(ws);
    if (!socketId) return undefined;
    return this.connections.get(socketId);
  }

  /**
   * Get connection info by Device ID.
   */
  getConnectionByDeviceId(deviceId: string): ConnectedDevice | undefined {
    const socketId = this.deviceIndex.get(deviceId);
    if (!socketId) return undefined;
    return this.connections.get(socketId);
  }

  /**
   * Check if a device is connected.
   */
  isDeviceConnected(deviceId: string): boolean {
    const socketId = this.deviceIndex.get(deviceId);
    if (!socketId) return false;
    const conn = this.connections.get(socketId);
    return conn ? conn.ws.readyState === WebSocket.OPEN : false;
  }

  /**
   * Ping all connections and terminate dead ones.
   * Called periodically by the heartbeat interval.
   */
  checkHeartbeats(): void {
    for (const [socketId, conn] of this.connections) {
      if (!conn.isAlive) {
        this.logger.warn('Terminating dead connection', {
          socketId,
          deviceId: conn.deviceId,
        });
        conn.ws.terminate();
        if (conn.deviceId) this.deviceIndex.delete(conn.deviceId);
        this.connections.delete(socketId);
        continue;
      }

      conn.isAlive = false;
      conn.ws.ping();
    }
  }

  /**
   * Disconnect all clients (for graceful shutdown).
   */
  disconnectAll(code: number, reason: string): void {
    for (const [, conn] of this.connections) {
      conn.ws.close(code, reason);
    }
    this.connections.clear();
    this.deviceIndex.clear();
  }

  /**
   * Get count of active connections.
   */
  get connectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get count of registered devices.
   */
  get registeredDeviceCount(): number {
    return this.deviceIndex.size;
  }
}
