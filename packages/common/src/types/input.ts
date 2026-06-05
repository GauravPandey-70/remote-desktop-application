// ============================================
// DeskLink — Input Event Types
// Normalized mouse/keyboard events for cross-platform remote control
// ============================================

/**
 * All input events sent from Client → Host via RTCDataChannel.
 * Coordinates are normalized to [0, 1] range relative to the host display.
 */
export type InputEvent =
  | MouseMoveEvent
  | MouseButtonEvent
  | MouseScrollEvent
  | KeyboardEvent
  | ClipboardEvent;

export interface MouseMoveEvent {
  type: 'mouse:move';
  /** Normalized X position [0, 1] relative to display */
  x: number;
  /** Normalized Y position [0, 1] relative to display */
  y: number;
  /** Target display ID (for multi-monitor) */
  displayId: string;
  timestamp: number;
}

export type MouseButton = 'left' | 'right' | 'middle' | 'back' | 'forward';
export type ButtonAction = 'down' | 'up' | 'click' | 'dblclick';

export interface MouseButtonEvent {
  type: 'mouse:button';
  button: MouseButton;
  action: ButtonAction;
  x: number;
  y: number;
  displayId: string;
  timestamp: number;
}

export interface MouseScrollEvent {
  type: 'mouse:scroll';
  deltaX: number;
  deltaY: number;
  x: number;
  y: number;
  displayId: string;
  timestamp: number;
}

export type KeyAction = 'down' | 'up';

export interface ModifierState {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

/**
 * Keyboard events use USB HID key codes for cross-platform normalization.
 * The `code` field matches the W3C KeyboardEvent.code standard.
 * Example: 'KeyA', 'Space', 'ArrowUp', 'ControlLeft'
 */
export interface KeyboardEvent {
  type: 'keyboard';
  /** W3C KeyboardEvent.code (USB HID mapped) */
  code: string;
  /** The character produced, if any */
  key: string;
  action: KeyAction;
  modifiers: ModifierState;
  timestamp: number;
}

export interface ClipboardEvent {
  type: 'clipboard';
  action: 'copy' | 'paste';
  /** Text content. Images are base64-encoded. */
  content: string;
  contentType: 'text/plain' | 'image/png';
  timestamp: number;
}

/**
 * Data channel message wrapper for input events.
 * Includes sequence number for ordering and deduplication.
 */
export interface InputChannelMessage {
  seq: number;
  events: InputEvent[];
}
