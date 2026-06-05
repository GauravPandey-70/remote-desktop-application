import { useState, useRef, useEffect } from 'react';
import './ConnectionScreen.css';

interface ConnectionScreenProps {
  onConnect: (sessionId: string) => void;
  localDeviceId: string;
  isSignalingConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
}

interface RecentConnection {
  deviceId: string;
  name: string;
  lastConnected: string;
  os: 'windows' | 'macos';
}

const RECENT_CONNECTIONS: RecentConnection[] = [
  { deviceId: 'DL-AB3-QW8-7N', name: 'Office Desktop', lastConnected: '2 min ago', os: 'windows' },
  { deviceId: 'DL-QW8-KN3-5P', name: "Mom's Laptop", lastConnected: 'Yesterday', os: 'macos' },
];

export function ConnectionScreen({ onConnect, localDeviceId, isSignalingConnected, isConnecting, connectionError }: ConnectionScreenProps) {
  const [remoteId, setRemoteId] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const error = connectionError || localError;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase().replace(/[^23456789A-HJ-NP-Z-]/g, '');

    // Auto-format: DL-XXX-XXX-XX
    const raw = value.replace(/^DL-?/, '').replace(/-/g, '');
    if (raw.length <= 3) {
      value = raw.length > 0 ? `DL-${raw}` : '';
    } else if (raw.length <= 6) {
      value = `DL-${raw.slice(0, 3)}-${raw.slice(3)}`;
    } else {
      value = `DL-${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6, 8)}`;
    }

    setRemoteId(value);
    setLocalError(null);
  };

  const handleConnect = async () => {
    if (remoteId.length < 13) {
      setLocalError('Please enter a complete Device ID');
      return;
    }

    setLocalError(null);

    // Trigger connection in App.tsx (which sends the session request)
    onConnect(remoteId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConnect();
    }
  };

  const handleRecentClick = (deviceId: string) => {
    setRemoteId(deviceId);
    handleConnect();
  };

  return (
    <div className="connection-screen">
      {/* Ambient background effects */}
      <div className="connection-screen__bg">
        <div className="connection-screen__orb connection-screen__orb--1" />
        <div className="connection-screen__orb connection-screen__orb--2" />
        <div className="connection-screen__orb connection-screen__orb--3" />
      </div>

      <div className="connection-screen__content animate-fade-in-up">
        {/* Header */}
        <header className="connection-screen__header">
          <div className="connection-screen__logo">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
              <rect x="2" y="6" width="32" height="22" rx="3" stroke="url(#logoGrad)" strokeWidth="2.5" fill="none" />
              <line x1="18" y1="28" x2="18" y2="32" stroke="url(#logoGrad)" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="12" y1="32" x2="24" y2="32" stroke="url(#logoGrad)" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="18" cy="17" r="4" fill="url(#logoGrad)" opacity="0.8" />
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="36" y2="36">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <h1 className="connection-screen__title">DeskLink</h1>
          </div>

          <div className="connection-screen__device-badge">
            <span className={`status-dot ${isSignalingConnected ? 'status-dot--online' : 'status-dot--offline'}`} aria-label={isSignalingConnected ? 'Online' : 'Offline'} />
            <span className="connection-screen__device-label">Your ID</span>
            <span className="connection-screen__device-id">{localDeviceId}</span>
            <button
              className="connection-screen__copy-btn"
              onClick={() => navigator.clipboard.writeText(localDeviceId)}
              title="Copy Device ID"
              aria-label="Copy Device ID to clipboard"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* Connection Card */}
        <main className="connection-screen__card glass" role="main">
          <h2 className="connection-screen__card-title">Connect to a Device</h2>
          <p className="connection-screen__card-subtitle">
            Enter the remote Device ID to start a session
          </p>

          <div className="connection-screen__input-group">
            <label htmlFor="remote-device-id" className="sr-only">
              Remote Device ID
            </label>
            <input
              ref={inputRef}
              id="remote-device-id"
              type="text"
              className="input input-lg connection-screen__input"
              placeholder="DL-___-___-__"
              value={remoteId}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              maxLength={14}
              autoComplete="off"
              spellCheck={false}
              aria-describedby={error ? 'connection-error' : undefined}
              disabled={isConnecting}
            />
            {error && (
              <p id="connection-error" className="connection-screen__error" role="alert">
                {error}
              </p>
            )}
          </div>

          <button
            id="connect-button"
            className="btn btn-primary btn-lg connection-screen__connect-btn"
            onClick={handleConnect}
            disabled={isConnecting || remoteId.length < 13}
            aria-label={isConnecting ? 'Connecting...' : 'Connect to remote device'}
          >
            {isConnecting ? (
              <>
                <span className="connection-screen__spinner" aria-hidden="true" />
                Connecting...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Connect
              </>
            )}
          </button>
        </main>

        {/* Recent Connections */}
        <section className="connection-screen__recent" aria-label="Recent connections">
          <h3 className="connection-screen__recent-title">Recent Connections</h3>
          <ul className="connection-screen__recent-list">
            {RECENT_CONNECTIONS.map((conn, idx) => (
              <li key={conn.deviceId} style={{ animationDelay: `${(idx + 1) * 80}ms` }}>
                <button
                  className="connection-screen__recent-item card card--interactive"
                  onClick={() => handleRecentClick(conn.deviceId)}
                  aria-label={`Connect to ${conn.name}, ${conn.deviceId}`}
                >
                  <span className="connection-screen__recent-icon" aria-hidden="true">
                    {conn.os === 'windows' ? '🖥️' : '💻'}
                  </span>
                  <span className="connection-screen__recent-info">
                    <span className="connection-screen__recent-name">{conn.name}</span>
                    <span className="connection-screen__recent-id">{conn.deviceId}</span>
                  </span>
                  <span className="connection-screen__recent-time">{conn.lastConnected}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
