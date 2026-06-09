import { useState, useMemo, useEffect } from 'react';
import { ConnectionScreen } from './components/ConnectionScreen';
import { RemoteViewport } from './components/RemoteViewport';
import { useSignaling } from './hooks/useSignaling';
import { useWebRTC } from './hooks/useWebRTC';

export type AppView = 'connect' | 'session';

export function App() {
  const [view, setView] = useState<AppView>('connect');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const localDeviceId = useMemo(() => {
    const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let random = '';
    for (let i = 0; i < 9; i++) {
      random += charset[Math.floor(Math.random() * charset.length)];
    }
    return `DL-${random.slice(0, 3)}-${random.slice(3, 6)}-${random.slice(6, 9)}`;
  }, []);

  const { isConnected, sendMessage, onMessage } = useSignaling(localDeviceId);

  const { state: webrtcState, sendInput } = useWebRTC(
    sessionId || '',
    isHost,
    [],
    sendMessage,
    onMessage
  );

  useEffect(() => {
    const unsubReq = onMessage('connection:request:forward', (msg: any) => {
      console.log('Incoming connection request from', msg.payload.clientDeviceId);
      
      // Auto-accept the connection for instant one-click testing
      setSessionId(msg.payload.sessionId);
      setIsHost(true);
      setView('session');
      sendMessage({
        type: 'connection:accepted',
        payload: {
          sessionId: msg.payload.sessionId,
          hostDeviceId: localDeviceId,
        }
      } as any);
    });

    const unsubAcc = onMessage('connection:accepted', (msg: any) => {
      console.log('Connection accepted, session:', msg.payload.sessionId);
      setSessionId(msg.payload.sessionId);
      setIsHost(false);
      setIsConnecting(false);
      setView('session');
    });

    const unsubRej = onMessage('connection:rejected', (msg: any) => {
      console.log('Connection rejected:', msg.payload.reason);
      setConnectionError(msg.payload.message || msg.payload.reason || 'Connection rejected');
      setIsConnecting(false);
    });

    return () => {
      unsubReq();
      unsubAcc();
      unsubRej();
    };
  }, [onMessage, localDeviceId, sendMessage]);

  const handleConnect = (remoteId: string) => {
    setIsConnecting(true);
    setConnectionError(null);
    
    // Tell the signaling server to alert the remote host
    sendMessage({
      type: 'connection:request',
      payload: {
        targetDeviceId: remoteId,
        clientDeviceId: localDeviceId,
        clientPublicKey: 'dummy-pub',
        clientDisplayName: 'Browser Test',
      }
    } as any);
  };

  const handleDisconnect = () => {
    setSessionId(null);
    setView('connect');
    window.location.reload(); // Quick reset for POC
  };

  return (
    <div className="app-root" style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {view === 'connect' && (
        <ConnectionScreen 
          onConnect={handleConnect} 
          localDeviceId={localDeviceId} 
          isSignalingConnected={isConnected} 
          isConnecting={isConnecting}
          connectionError={connectionError}
        />
      )}
      {view === 'session' && sessionId && (
        <RemoteViewport
          sessionId={sessionId}
          remoteStream={webrtcState.remoteStream}
          onDisconnect={handleDisconnect}
          sendInput={sendInput}
        />
      )}
    </div>
  );
}
