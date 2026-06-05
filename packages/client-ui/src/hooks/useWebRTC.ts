import { useEffect, useRef, useState, useCallback } from 'react';
import { SignalingMessage } from '@desklink/common';

export interface WebRTCState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  error: string | null;
  remoteStream: MediaStream | null;
}

export interface IceServerConfig {
  urls: string[];
  username?: string;
  credential?: string;
}

export function useWebRTC(
  sessionId: string,
  isHost: boolean,
  iceServers: IceServerConfig[],
  sendMessage: (msg: Omit<SignalingMessage, 'messageId' | 'timestamp'>) => void,
  onMessage: (type: string, handler: (msg: SignalingMessage) => void) => () => void
) {
  const [state, setState] = useState<WebRTCState>({
    status: 'disconnected',
    error: null,
    remoteStream: null,
  });

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  // Reconnect management
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  const reconnectTimerRef = useRef<number | null>(null);

  const initializePeerConnection = useCallback(async (iceRestart = false) => {
    if (pcRef.current && !iceRestart) {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: iceServers.length > 0 ? iceServers : [{ urls: 'stun:stun.l.google.com:19302' }],
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
    });
    pcRef.current = pc;

    // Handle ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage({
          type: 'webrtc:ice:candidate',
          payload: {
            sessionId,
            candidate: JSON.stringify(event.candidate),
          },
        } as Omit<SignalingMessage<'webrtc:ice:candidate'>, 'messageId' | 'timestamp'>);
      }
    };

    // Monitor Connection States
    pc.onconnectionstatechange = () => {
      const connState = pc.connectionState;
      console.log(`[WebRTC] Connection State: ${connState}`);

      switch (connState) {
        case 'connected':
          setState((s) => ({ ...s, status: 'connected', error: null }));
          reconnectAttemptsRef.current = 0;
          if (reconnectTimerRef.current) {
            window.clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          break;
        case 'disconnected':
          setState((s) => ({ ...s, status: 'reconnecting' }));
          handleIceRestart();
          break;
        case 'failed':
          setState((s) => ({ ...s, status: 'error', error: 'Connection failed. Retrying...' }));
          handleFullReconnect();
          break;
        case 'closed':
          setState((s) => ({ ...s, status: 'disconnected' }));
          break;
        default:
          break;
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE Connection State: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'disconnected') {
        handleIceRestart();
      }
    };

    // Track attachments
    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote video track');
      setState((s) => ({
        ...s,
        remoteStream: event.streams[0] || new MediaStream([event.track]),
      }));
    };

    // Host vs Client Init
    if (isHost) {
      // Host creates DataChannel
      const dc = pc.createDataChannel('input', { ordered: true });
      dcRef.current = dc;
      setupDataChannel(dc);

      try {
        // Stream screen video
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30, max: 60 } },
          audio: false,
        });
        localStreamRef.current = stream;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        // Create and send SDP Offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        sendMessage({
          type: 'webrtc:sdp:offer',
          payload: {
            sessionId,
            sdp: JSON.stringify(pc.localDescription),
          },
        } as Omit<SignalingMessage<'webrtc:sdp:offer'>, 'messageId' | 'timestamp'>);
      } catch (err: any) {
        console.error('[WebRTC] Host screen capture failed:', err);
        setState((s) => ({ ...s, status: 'error', error: 'Screen recording permission denied' }));
      }
    } else {
      // Client expects DataChannel
      pc.ondatachannel = (event) => {
        dcRef.current = event.channel;
        setupDataChannel(event.channel);
      };
    }
  }, [sessionId, isHost, iceServers, sendMessage]);

  const setupDataChannel = (dc: RTCDataChannel) => {
    dc.onopen = () => {
      console.log('[WebRTC] Control DataChannel open');
      setState((s) => ({ ...s, status: 'connected' }));
    };

    dc.onclose = () => {
      console.log('[WebRTC] Control DataChannel closed');
    };

    if (isHost) {
      dc.onmessage = (event) => {
        // Handled directly inside agent WebView runtime
        console.debug('Host received input event:', event.data);
      };
    }
  };

  // ICE Restart: Quickly refresh candidates on active session
  const handleIceRestart = async () => {
    if (!pcRef.current || isHost) return;

    try {
      console.log('[WebRTC] Initiating ICE Restart...');
      const offer = await pcRef.current.createOffer({ iceRestart: true });
      await pcRef.current.setLocalDescription(offer);

      sendMessage({
        type: 'webrtc:sdp:offer',
        payload: {
          sessionId,
          sdp: JSON.stringify(pcRef.current.localDescription),
        },
      } as Omit<SignalingMessage<'webrtc:sdp:offer'>, 'messageId' | 'timestamp'>);
    } catch (err) {
      console.error('[WebRTC] ICE Restart failed:', err);
    }
  };

  // Full Reconnect: Recreate PeerConnection with Exponential Backoff
  const handleFullReconnect = () => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      setState((s) => ({ ...s, status: 'error', error: 'Failed to reconnect after multiple attempts' }));
      return;
    }

    reconnectAttemptsRef.current += 1;
    const delay = Math.pow(2, reconnectAttemptsRef.current) * 1000; // 2s, 4s, 8s
    console.log(`[WebRTC] Scheduling full reconnect attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts} in ${delay}ms`);

    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
    }

    reconnectTimerRef.current = window.setTimeout(async () => {
      try {
        await initializePeerConnection();
      } catch (err) {
        console.error('[WebRTC] Reconnection attempt failed:', err);
        handleFullReconnect();
      }
    }, delay);
  };

  useEffect(() => {
    initializePeerConnection();

    // --- Signaling Event Handlers ---
    const unsubOffer = onMessage('webrtc:sdp:offer', async (msg) => {
      const offerMsg = msg as SignalingMessage<'webrtc:sdp:offer'>;
      if (offerMsg.payload.sessionId !== sessionId) return;

      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(JSON.parse(offerMsg.payload.sdp)));
          if (!isHost) {
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);

            sendMessage({
              type: 'webrtc:sdp:answer',
              payload: {
                sessionId,
                sdp: JSON.stringify(pcRef.current.localDescription),
              },
            } as Omit<SignalingMessage<'webrtc:sdp:answer'>, 'messageId' | 'timestamp'>);
          }
        } catch (err) {
          console.error('[WebRTC] Failed handling SDP Offer:', err);
        }
      }
    });

    const unsubAnswer = onMessage('webrtc:sdp:answer', async (msg) => {
      const answerMsg = msg as SignalingMessage<'webrtc:sdp:answer'>;
      if (answerMsg.payload.sessionId !== sessionId) return;

      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(JSON.parse(answerMsg.payload.sdp)));
        } catch (err) {
          console.error('[WebRTC] Failed handling SDP Answer:', err);
        }
      }
    });

    const unsubIce = onMessage('webrtc:ice:candidate', async (msg) => {
      const iceMsg = msg as SignalingMessage<'webrtc:ice:candidate'>;
      if (iceMsg.payload.sessionId !== sessionId) return;

      if (pcRef.current) {
        try {
          const candidate = JSON.parse(iceMsg.payload.candidate);
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('[WebRTC] Failed to add ICE candidate:', err);
        }
      }
    });

    return () => {
      unsubOffer();
      unsubAnswer();
      unsubIce();
      
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }

      if (pcRef.current) {
        pcRef.current.close();
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [sessionId, isHost, initializePeerConnection, onMessage, sendMessage]);

  const sendInput = useCallback((data: string) => {
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(data);
    }
  }, []);

  return { state, sendInput };
}
