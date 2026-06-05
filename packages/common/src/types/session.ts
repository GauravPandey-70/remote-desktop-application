// ============================================
// DeskLink — Session Types
// Session state machine and related data structures
// ============================================

export type SessionStatus = 'connecting' | 'active' | 'disconnected' | 'failed';

export type ConnectionType = 'p2p' | 'turn_relayed';

export type DisconnectReason = 'user_disconnect' | 'timeout' | 'error' | 'host_shutdown';

export interface Session {
  id: string;
  hostDeviceId: string;
  clientDeviceId: string;
  initiatedBy: string | null;
  connectionType: ConnectionType | null;
  hostIp: string | null;
  clientIp: string | null;
  status: SessionStatus;
  qualityMetrics: import('./signaling').QualityMetrics | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
}

export type SessionEventType =
  | 'connecting'
  | 'connected'
  | 'ice_restart'
  | 'quality_change'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export interface SessionEvent {
  id: string;
  sessionId: string;
  eventType: SessionEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

/**
 * Reconnection state machine states
 */
export type ReconnectState =
  | 'connected'
  | 'ice_restarting'
  | 'full_reconnecting'
  | 'disconnected';

export interface ReconnectConfig {
  /** Max ICE restart attempts before full reconnect */
  maxIceRestartAttempts: number;
  /** Max full reconnect attempts before giving up */
  maxFullReconnectAttempts: number;
  /** Base delay for ICE restart backoff (ms) */
  iceRestartBaseDelay: number;
  /** Base delay for full reconnect backoff (ms) */
  fullReconnectBaseDelay: number;
}

export const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  maxIceRestartAttempts: 3,
  maxFullReconnectAttempts: 3,
  iceRestartBaseDelay: 1000,
  fullReconnectBaseDelay: 2000,
};
