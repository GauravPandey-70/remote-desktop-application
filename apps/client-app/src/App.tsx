import React, { useState, useEffect, useRef } from 'react';

interface Device {
  deviceId: string;
  name: string;
  osType: 'windows' | 'macos';
  isOnline: boolean;
  lastSeen: string;
  publicKey: string;
}

export default function App() {
  const [token, setToken] = useState<string | null>('bypass');
  const [email, setEmail] = useState('local-user');
  const [password, setPassword] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [targetId, setTargetId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'deviceId' | 'passcode' | 'shareLink'>('deviceId');
  const [shareLink, setShareLink] = useState('');

  const handlePasscodeConnect = async () => {
    if (!passcode) return;
    setSessionState('connecting');
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/v1/auth/passcode/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to resolve passcode');
      }
      const data = await res.json();
      if (data.deviceId) {
        setTargetId(data.deviceId);
        startConnection(data.deviceId);
      } else {
        throw new Error('Device ID not found in response');
      }
    } catch (err: any) {
      alert(err.message || 'Network error connecting to backend API');
      setSessionState('error');
    }
  };

  const handleShareLinkConnect = () => {
    if (!shareLink) return;
    if (shareLink.startsWith('desklink://')) {
      try {
        const url = new URL(shareLink.replace('desklink://', 'http://'));
        const id = url.searchParams.get('id');
        const code = url.searchParams.get('passcode');
        if (id) {
          setTargetId(id);
          if (code) {
            setPasscode(code);
            startConnection(id);
          } else {
            startConnection(id);
          }
        } else {
          alert('Invalid share link: missing device ID');
        }
      } catch (err) {
        alert('Invalid share link format');
      }
    } else {
      alert('Invalid share link protocol. Must start with desklink://');
    }
  };
  
  // Connection states
  const [sessionState, setSessionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Load devices list if logged in
  useEffect(() => {
    if (token) {
      fetch(`http://${window.location.hostname}:3000/api/v1/devices`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setDevices(data);
        })
        .catch(console.error);
    }
  }, [token]);

  // Connect video element to stream
  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, sessionState]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
        localStorage.setItem('token', data.token);
      } else {
        alert(data.message || 'Login failed');
      }
    } catch (err) {
      alert('Network error connecting to backend API');
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
    setDevices([]);
  };

  const handleIdChange = (val: string) => {
    if (val.startsWith('desklink://')) {
      try {
        const url = new URL(val.replace('desklink://', 'http://'));
        const id = url.searchParams.get('id');
        const code = url.searchParams.get('passcode');
        if (id) setTargetId(id);
        if (code) {
          setPasscode(code);
          setTimeout(() => startConnection(), 100);
        }
      } catch (err) {
        setTargetId(val);
      }
    } else {
      setTargetId(val);
    }
  };

  const startConnection = (overrideTargetId?: string) => {
    const activeTargetId = overrideTargetId || targetId;
    if (!activeTargetId) return;
    setSessionState('connecting');

    // Create websocket signaling connection
    const ws = new WebSocket(`ws://${window.location.hostname}:3000/signaling`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send connection request
      ws.send(
        JSON.stringify({
          type: 'connection:request',
          messageId: Math.random().toString(),
          timestamp: new Date().toISOString(),
          payload: {
            targetDeviceId: activeTargetId,
            clientDeviceId: 'DL-CLIENT-VIEWER',
            clientPublicKey: 'placeholder_client_pubkey',
            clientDisplayName: 'Viewer Client',
          },
        })
      );
    };

    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      const { type, payload } = message;

      if (type === 'connection:rejected') {
        alert(payload.message || 'Connection rejected');
        disconnect();
      } else if (type === 'connection:request:forward' || type === 'connection:accepted') {
        // Setup RTCPeerConnection
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        pcRef.current = pc;

        // Data channel for mouse/keyboard inputs
        const dc = pc.createDataChannel('input');
        dcRef.current = dc;

        dc.onopen = () => {
          setSessionState('connected');
          setShowPasscodeModal(false);
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            ws.send(
              JSON.stringify({
                type: 'webrtc:ice:candidate',
                messageId: Math.random().toString(),
                timestamp: new Date().toISOString(),
                payload: {
                  sessionId: payload.sessionId,
                  candidate: JSON.stringify(e.candidate),
                },
              })
            );
          }
        };

        pc.ontrack = (e) => {
          setRemoteStream(e.streams[0]);
        };

        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        ws.send(
          JSON.stringify({
            type: 'webrtc:sdp:offer',
            messageId: Math.random().toString(),
            timestamp: new Date().toISOString(),
            payload: {
              sessionId: payload.sessionId,
              sdp: JSON.stringify(pc.localDescription),
            },
          })
        );
      } else if (type === 'webrtc:sdp:answer') {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(JSON.parse(payload.sdp)));
        }
      } else if (type === 'webrtc:ice:candidate') {
        if (pcRef.current) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(JSON.parse(payload.candidate)));
        }
      }
    };

    ws.onerror = () => {
      setSessionState('error');
    };
  };

  const submitPasscode = () => {
    if (wsRef.current && passcode) {
      wsRef.current.send(
        JSON.stringify({
          type: 'connection:passcode:submit',
          messageId: Math.random().toString(),
          timestamp: new Date().toISOString(),
          payload: {
            sessionId: 'placeholder_session_id',
            passcode,
          },
        })
      );
    }
  };

  const disconnect = () => {
    if (wsRef.current) wsRef.current.close();
    if (pcRef.current) pcRef.current.close();
    setSessionState('disconnected');
    setRemoteStream(null);
  };

  // Capture and stream viewport controls
  const handleMouseMove = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (dcRef.current?.readyState !== 'open') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    dcRef.current.send(
      JSON.stringify({
        type: 'mouse',
        action: 'move',
        x,
        y,
      })
    );
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (dcRef.current?.readyState !== 'open') return;
    const button = e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle';
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    dcRef.current.send(
      JSON.stringify({
        type: 'mouse',
        action: 'down',
        button,
        x,
        y,
      })
    );
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (dcRef.current?.readyState !== 'open') return;
    const button = e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle';
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    dcRef.current.send(
      JSON.stringify({
        type: 'mouse',
        action: 'up',
        button,
        x,
        y,
      })
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (dcRef.current?.readyState !== 'open') return;
    e.preventDefault();
    dcRef.current.send(
      JSON.stringify({
        type: 'keyboard',
        action: 'down',
        key: e.key,
        code: e.code,
      })
    );
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (dcRef.current?.readyState !== 'open') return;
    e.preventDefault();
    dcRef.current.send(
      JSON.stringify({
        type: 'keyboard',
        action: 'up',
        key: e.key,
        code: e.code,
      })
    );
  };

  const triggerFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  // Viewport active Remote Screen
  if (sessionState === 'connected') {
    return (
      <div style={styles.viewportContainer}>
        {/* Floating Session Toolbar */}
        <div style={styles.toolbar}>
          <span style={styles.toolbarTitle}>Connected to: {targetId}</span>
          <div style={styles.toolbarButtons}>
            <button style={styles.toolbarBtn} onClick={triggerFullscreen}>Fullscreen</button>
            <button style={{ ...styles.toolbarBtn, backgroundColor: '#EF4444' }} onClick={disconnect}>Disconnect</button>
          </div>
        </div>

        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={styles.remoteVideo}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          tabIndex={0}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>DeskLink Client</h1>

      {!token ? (
        // Login Card
        <form onSubmit={handleLogin} style={styles.card}>
          <h2 style={styles.cardTitle}>Account Login</h2>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required
            />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required
            />
          </div>
          <button type="submit" style={styles.connectBtn}>Login</button>
        </form>
      ) : (
        // Connected State Dashboard
        <div style={styles.dashboardLayout}>
          <div style={styles.leftCol}>
            {/* AnyDesk-style Connection card */}
            <div style={styles.card}>
              <div style={styles.profileHeader}>
                <span>Direct Connection Mode</span>
              </div>

              <div style={styles.tabsContainer}>
                <button
                  type="button"
                  style={{ ...styles.tabButton, ...(activeTab === 'deviceId' ? styles.activeTabButton : {}) }}
                  onClick={() => setActiveTab('deviceId')}
                >
                  Device ID
                </button>
                <button
                  type="button"
                  style={{ ...styles.tabButton, ...(activeTab === 'passcode' ? styles.activeTabButton : {}) }}
                  onClick={() => setActiveTab('passcode')}
                >
                  Passcode
                </button>
                <button
                  type="button"
                  style={{ ...styles.tabButton, ...(activeTab === 'shareLink' ? styles.activeTabButton : {}) }}
                  onClick={() => setActiveTab('shareLink')}
                >
                  Share Link
                </button>
              </div>

              {activeTab === 'deviceId' && (
                <>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Remote Device ID</label>
                    <input
                      type="text"
                      placeholder="Enter Remote 9-Digit ID"
                      value={targetId}
                      onChange={(e) => handleIdChange(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                  <button style={styles.connectBtn} onClick={() => startConnection()}>
                    {sessionState === 'connecting' ? 'Connecting...' : 'Connect'}
                  </button>
                </>
              )}

              {activeTab === 'passcode' && (
                <>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>One-Time Passcode</label>
                    <input
                      type="text"
                      placeholder="Enter 6-Digit Passcode"
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                  <button style={styles.connectBtn} onClick={handlePasscodeConnect}>
                    {sessionState === 'connecting' ? 'Connecting...' : 'Connect'}
                  </button>
                </>
              )}

              {activeTab === 'shareLink' && (
                <>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Share Link</label>
                    <input
                      type="text"
                      placeholder="Paste desklink://connect?id=...&passcode=..."
                      value={shareLink}
                      onChange={(e) => setShareLink(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                  <button style={styles.connectBtn} onClick={handleShareLinkConnect}>
                    {sessionState === 'connecting' ? 'Connecting...' : 'Connect'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div style={styles.rightCol}>
            {/* Devices list panel */}
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Devices Directory</h2>
              <div style={styles.devicesList}>
                {devices.length === 0 ? (
                  <span style={styles.noDevices}>No devices claimed under this account yet.</span>
                ) : (
                  devices.map((dev) => (
                    <div
                      key={dev.deviceId}
                      style={styles.deviceRow}
                      onClick={() => setTargetId(dev.deviceId)}
                    >
                      <div>
                        <div style={styles.deviceName}>{dev.name}</div>
                        <div style={styles.deviceIdBadge}>{dev.deviceId}</div>
                      </div>
                      <div style={styles.deviceStatus}>
                        <div style={{
                          ...styles.statusDot,
                          backgroundColor: dev.isOnline ? '#10B981' : '#64748B'
                        }} />
                        <span style={styles.statusText}>{dev.isOnline ? 'Online' : 'Offline'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Passcode Modal Overlay */}
      {showPasscodeModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3>Verification Required</h3>
            <span style={styles.modalSubtext}>Please enter the 6-digit passcode displayed on the host.</span>
            <input
              type="text"
              maxLength={6}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              style={styles.modalInput}
            />
            <div style={styles.modalButtons}>
              <button style={styles.modalCancel} onClick={() => setShowPasscodeModal(false)}>Cancel</button>
              <button style={styles.modalSubmit} onClick={submitPasscode}>Verify</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    padding: '40px 20px',
    boxSizing: 'border-box' as const,
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '24px',
    background: 'linear-gradient(to right, #3B82F6, #8B5CF6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: '12px',
    padding: '24px',
    width: '100%',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '16px',
    color: '#94A3B8',
  },
  fieldGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    color: '#94A3B8',
    textTransform: 'uppercase' as const,
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    border: '1px solid #334155',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
    outline: 'none',
  },
  connectBtn: {
    width: '100%',
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    padding: '12px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  dashboardLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.5fr',
    gap: '24px',
    width: '100%',
    maxWidth: '900px',
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  profileHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    fontSize: '13px',
    color: '#94A3B8',
  },
  logoutBtn: {
    backgroundColor: 'transparent',
    border: '1px solid #EF4444',
    color: '#EF4444',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  devicesList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    maxHeight: '300px',
    overflowY: 'auto' as const,
  },
  deviceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: '12px',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  deviceName: {
    fontSize: '14px',
    fontWeight: 'bold',
  },
  deviceIdBadge: {
    fontSize: '11px',
    color: '#64748B',
    marginTop: '2px',
  },
  deviceStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  statusText: {
    fontSize: '12px',
  },
  noDevices: {
    fontSize: '13px',
    color: '#64748B',
    textAlign: 'center' as const,
  },
  viewportContainer: {
    width: '100vw',
    height: '100vh',
    backgroundColor: '#000',
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remoteVideo: {
    maxWidth: '100%',
    maxHeight: '100%',
    width: 'auto',
    height: 'auto',
    outline: 'none',
  },
  toolbar: {
    position: 'absolute' as const,
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    backdropFilter: 'blur(8px)',
    borderRadius: '8px',
    padding: '8px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
  },
  toolbarTitle: {
    fontSize: '13px',
    color: '#E2E8F0',
  },
  toolbarButtons: {
    display: 'flex',
    gap: '8px',
  },
  toolbarBtn: {
    border: 'none',
    backgroundColor: '#334155',
    color: '#F8FAFC',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modal: {
    backgroundColor: '#1E293B',
    borderRadius: '12px',
    padding: '24px',
    width: '100%',
    maxWidth: '320px',
    textAlign: 'center' as const,
  },
  modalSubtext: {
    display: 'block',
    fontSize: '12px',
    color: '#94A3B8',
    marginBottom: '16px',
  },
  modalInput: {
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    border: '1px solid #334155',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '20px',
    fontWeight: 'bold',
    textAlign: 'center' as const,
    width: '100%',
    boxSizing: 'border-box' as const,
    letterSpacing: '0.2em',
    outline: 'none',
  },
  modalButtons: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
  },
  modalCancel: {
    flex: 1,
    backgroundColor: '#334155',
    border: 'none',
    color: '#F8FAFC',
    padding: '10px',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  modalSubmit: {
    flex: 1,
    backgroundColor: '#3B82F6',
    border: 'none',
    color: 'white',
    padding: '10px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  tabsContainer: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    borderBottom: '1px solid #334155',
    paddingBottom: '12px',
  },
  tabButton: {
    flex: 1,
    backgroundColor: '#1E293B',
    color: '#94A3B8',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13px',
    transition: 'all 0.2s',
  },
  activeTabButton: {
    backgroundColor: '#3B82F6',
    color: 'white',
    border: '1px solid #3B82F6',
  },
};
