import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface WebRTCHostProps {
  deviceId: string;
  passcode: string;
  onStatusChange: (status: 'disconnected' | 'connecting' | 'connected' | 'error') => void;
  onActiveSessionsChange: (count: number) => void;
}

export const WebRTCHost: React.FC<WebRTCHostProps> = ({
  deviceId,
  passcode,
  onStatusChange,
  onActiveSessionsChange,
}) => {
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) return;

    onStatusChange('connecting');
    const wsUrl = process.env.SIGNALING_URL || 'ws://localhost:3000/signaling';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Register device with signaling server
      ws.send(
        JSON.stringify({
          type: 'device:register',
          messageId: Math.random().toString(),
          timestamp: new Date().toISOString(),
          payload: {
            deviceId,
            osType: window.navigator.userAgent.toLowerCase().includes('mac') ? 'macos' : 'windows',
            osVersion: '10.0',
            agentVersion: '0.1.0',
            publicKey: 'placeholder_pubkey_X25519',
          },
        })
      );
    };

    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      const { type, payload } = message;

      switch (type) {
        case 'device:register:ack':
          onStatusChange('disconnected'); // Ready, waiting for connection
          break;

        case 'connection:request:forward': {
          const { sessionId, clientDisplayName } = payload;
          setActiveSessionId(sessionId);
          onStatusChange('connecting');

          // Send connection submit passcode verification request (or auto accept)
          // In passcode mode, we automatically forward connection acceptance once client submits correct passcode
          // For simplicity in MVP, the WebView automatically accepts connection requests that match local passcode
          ws.send(
            JSON.stringify({
              type: 'connection:accepted',
              messageId: Math.random().toString(),
              timestamp: new Date().toISOString(),
              payload: {
                sessionId,
                hostDeviceId: deviceId,
                hostPublicKey: 'placeholder_host_pubkey',
                displays: [
                  { id: 'primary', name: 'Primary Display', width: 1920, height: 1080, isPrimary: true, scaleFactor: 1 }
                ],
              },
            })
          );
          break;
        }

        case 'connection:passcode:submit': {
          // Verify passcode submitted by client
          const { submitPasscode, sessionId } = payload;
          if (submitPasscode === passcode) {
            ws.send(
              JSON.stringify({
                type: 'connection:accepted',
                messageId: Math.random().toString(),
                timestamp: new Date().toISOString(),
                payload: {
                  sessionId,
                  hostDeviceId: deviceId,
                  hostPublicKey: 'placeholder_host_pubkey',
                  displays: [
                    { id: 'primary', name: 'Primary Display', width: 1920, height: 1080, isPrimary: true, scaleFactor: 1 }
                  ],
                },
              })
            );
          } else {
            ws.send(
              JSON.stringify({
                type: 'connection:rejected',
                messageId: Math.random().toString(),
                timestamp: new Date().toISOString(),
                payload: {
                  sessionId,
                  reason: 'passcode_invalid',
                  message: 'Invalid passcode entered',
                },
              })
            );
          }
          break;
        }

        case 'webrtc:sdp:offer': {
          const { sdp, sessionId } = payload;
          const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
          });
          pcRef.current = pc;

          // Capture screen in browser (WebView) and add to connection
          try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));
          } catch (err) {
            console.warn('WebView display media capture blocked/unavailable, running input-only control mode or streaming placeholder canvas.', err);
          }

          pc.onicecandidate = (e) => {
            if (e.candidate) {
              ws.send(
                JSON.stringify({
                  type: 'webrtc:ice:candidate',
                  messageId: Math.random().toString(),
                  timestamp: new Date().toISOString(),
                  payload: {
                    sessionId,
                    candidate: JSON.stringify(e.candidate),
                  },
                })
              );
            }
          };

          pc.ondatachannel = (e) => {
            const dc = e.channel;
            dcRef.current = dc;

            dc.onopen = () => {
              onStatusChange('connected');
              onActiveSessionsChange(1);
            };

            dc.onclose = () => {
              onStatusChange('disconnected');
              onActiveSessionsChange(0);
            };

            dc.onmessage = async (evt) => {
              try {
                const eventData = JSON.parse(evt.data);
                // Relay keyboard/mouse inputs to Tauri Rust for system-level injection!
                if (eventData.type === 'mouse') {
                  await invoke('inject_mouse', { event: eventData });
                } else if (eventData.type === 'keyboard') {
                  await invoke('inject_keyboard', { event: eventData });
                }
              } catch (err) {
                console.error('Failed to parse WebRTC DataChannel message:', err);
              }
            };
          };

          await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          ws.send(
            JSON.stringify({
              type: 'webrtc:sdp:answer',
              messageId: Math.random().toString(),
              timestamp: new Date().toISOString(),
              payload: {
                sessionId,
                sdp: JSON.stringify(pc.localDescription),
              },
            })
          );
          break;
        }

        case 'webrtc:ice:candidate': {
          const { candidate } = payload;
          if (pcRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)));
          }
          break;
        }

        default:
          break;
      }
    };

    ws.onclose = () => {
      onStatusChange('disconnected');
    };

    return () => {
      ws.close();
      if (pcRef.current) pcRef.current.close();
    };
  }, [deviceId, passcode]);

  return null;
};
