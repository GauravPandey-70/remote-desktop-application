import { useEffect, useRef, useState, useCallback } from 'react';
import { SignalingMessage } from '@desklink/common';

function generateMessageId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  const arr = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 16; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

const SIGNALING_URL = `ws://${window.location.hostname}:8080/ws`;

export function useSignaling(deviceId: string) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<(msg: SignalingMessage) => void>>>(new Map());

  useEffect(() => {
    const ws = new WebSocket(SIGNALING_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Signaling] Connected');
      setIsConnected(true);
      // Register device
      const registerMsg: SignalingMessage<'device:register'> = {
        type: 'device:register',
        payload: {
          deviceId,
          publicKey: 'dummy-pub-key',
          osType: 'windows',
          osVersion: navigator.userAgent,
          agentVersion: '0.1.0',
          hostname: 'browser',
        },
        messageId: generateMessageId(),
        timestamp: new Date().toISOString(),
      };
      ws.send(JSON.stringify(registerMsg));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as SignalingMessage;
        console.log('[Signaling] Received:', msg.type, msg);
        
        const typeHandlers = handlersRef.current.get(msg.type);
        if (typeHandlers) {
          typeHandlers.forEach((handler) => handler(msg));
        }
      } catch (err) {
        console.error('[Signaling] Failed to parse message', err);
      }
    };

    ws.onclose = () => {
      console.log('[Signaling] Disconnected');
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [deviceId]);

  const sendMessage = useCallback((msg: Omit<SignalingMessage, 'messageId' | 'timestamp'>) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[Signaling] Cannot send message, socket not open', msg);
      return;
    }
    const fullMsg: SignalingMessage = {
      ...msg,
      messageId: generateMessageId(),
      timestamp: new Date().toISOString(),
    } as SignalingMessage;
    
    wsRef.current.send(JSON.stringify(fullMsg));
  }, []);

  const onMessage = useCallback((type: string, handler: (msg: SignalingMessage) => void) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }
    handlersRef.current.get(type)!.add(handler);

    return () => {
      handlersRef.current.get(type)?.delete(handler);
    };
  }, []);

  return { isConnected, sendMessage, onMessage };
}
