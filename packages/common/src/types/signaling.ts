// ============================================
// DeskLink — Signaling Message Types
// All WebSocket messages between agents, clients, and the signaling server
// ============================================

/**
 * Base message envelope. Every WebSocket message is wrapped in this structure.
 * The `type` field is used for routing; `payload` is type-specific.
 */
export interface SignalingMessage<T extends SignalingMessageType = SignalingMessageType> {
  type: T;
  payload: SignalingPayloadMap[T];
  /** Unique message ID for deduplication and correlation */
  messageId: string;
  /** ISO 8601 timestamp */
  timestamp: string;
}

// --- Message Types ---

export type SignalingMessageType =
  // Device lifecycle
  | 'device:register'
  | 'device:register:ack'
  | 'device:heartbeat'
  | 'device:heartbeat:ack'
  // Connection establishment
  | 'connection:request'
  | 'connection:request:forward'
  | 'connection:passcode:required'
  | 'connection:passcode:submit'
  | 'connection:accepted'
  | 'connection:rejected'
  | 'connection:error'
  // WebRTC signaling
  | 'webrtc:sdp:offer'
  | 'webrtc:sdp:answer'
  | 'webrtc:ice:candidate'
  | 'webrtc:ice:restart'
  // Session lifecycle
  | 'session:started'
  | 'session:ended'
  | 'session:quality:report';

// --- Payload Types ---

export interface DeviceRegisterPayload {
  deviceId: string;
  publicKey: string;
  osType: 'windows' | 'macos';
  osVersion: string;
  agentVersion: string;
  hostname: string;
}

export interface DeviceRegisterAckPayload {
  success: boolean;
  serverTime: string;
  turnCredentials?: TurnCredentials;
}

export interface DeviceHeartbeatPayload {
  deviceId: string;
  uptime: number;
}

export interface DeviceHeartbeatAckPayload {
  serverTime: string;
}

export interface ConnectionRequestPayload {
  targetDeviceId: string;
  clientDeviceId: string;
  clientPublicKey: string;
  clientDisplayName?: string;
}

export interface ConnectionRequestForwardPayload {
  sessionId: string;
  clientDeviceId: string;
  clientPublicKey: string;
  clientDisplayName?: string;
  clientIp: string;
}

export interface ConnectionPasscodeRequiredPayload {
  sessionId: string;
}

export interface ConnectionPasscodeSubmitPayload {
  sessionId: string;
  passcodeHash: string;
}

export interface ConnectionAcceptedPayload {
  sessionId: string;
  hostPublicKey: string;
  hostDeviceId: string;
  displays: DisplayInfo[];
}

export interface ConnectionRejectedPayload {
  sessionId: string;
  reason: 'denied' | 'passcode_invalid' | 'rate_limited' | 'offline' | 'access_rule_blocked';
  message?: string;
}

export interface ConnectionErrorPayload {
  sessionId?: string;
  code: string;
  message: string;
}

export interface WebRTCSdpPayload {
  sessionId: string;
  sdp: string;
  /** Encrypted SDP envelope (E2E encryption layer) */
  encryptedSdp?: string;
}

export interface WebRTCIceCandidatePayload {
  sessionId: string;
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export interface WebRTCIceRestartPayload {
  sessionId: string;
}

export interface SessionStartedPayload {
  sessionId: string;
  connectionType: 'p2p' | 'turn_relayed';
}

export interface SessionEndedPayload {
  sessionId: string;
  reason: 'user_disconnect' | 'timeout' | 'error' | 'host_shutdown';
  duration: number;
}

export interface SessionQualityReportPayload {
  sessionId: string;
  metrics: QualityMetrics;
}

// --- Supporting Types ---

export interface TurnCredentials {
  urls: string[];
  username: string;
  credential: string;
  ttl: number;
}

export interface DisplayInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  isPrimary: boolean;
  scaleFactor: number;
}

export interface QualityMetrics {
  fps: number;
  bitrate: number;
  latencyMs: number;
  packetLoss: number;
  resolution: { width: number; height: number };
  codec: string;
  connectionType: 'p2p' | 'turn_relayed';
}

// --- Payload Map (type-safe dispatch) ---

export interface SignalingPayloadMap {
  'device:register': DeviceRegisterPayload;
  'device:register:ack': DeviceRegisterAckPayload;
  'device:heartbeat': DeviceHeartbeatPayload;
  'device:heartbeat:ack': DeviceHeartbeatAckPayload;
  'connection:request': ConnectionRequestPayload;
  'connection:request:forward': ConnectionRequestForwardPayload;
  'connection:passcode:required': ConnectionPasscodeRequiredPayload;
  'connection:passcode:submit': ConnectionPasscodeSubmitPayload;
  'connection:accepted': ConnectionAcceptedPayload;
  'connection:rejected': ConnectionRejectedPayload;
  'connection:error': ConnectionErrorPayload;
  'webrtc:sdp:offer': WebRTCSdpPayload;
  'webrtc:sdp:answer': WebRTCSdpPayload;
  'webrtc:ice:candidate': WebRTCIceCandidatePayload;
  'webrtc:ice:restart': WebRTCIceRestartPayload;
  'session:started': SessionStartedPayload;
  'session:ended': SessionEndedPayload;
  'session:quality:report': SessionQualityReportPayload;
}
