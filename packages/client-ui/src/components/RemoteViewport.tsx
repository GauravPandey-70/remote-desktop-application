import { useRef, useEffect, useState } from 'react';
import './RemoteViewport.css';

interface RemoteViewportProps {
  sessionId: string;
  remoteStream: MediaStream | null;
  onDisconnect: () => void;
  sendInput: (data: string) => void;
}

interface SessionStats {
  fps: number;
  latency: number;
  bitrate: string;
  resolution: string;
  connectionType: 'p2p' | 'turn';
}

export function RemoteViewport({ remoteStream, onDisconnect, sendInput }: RemoteViewportProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [stats] = useState<SessionStats>({
    fps: 30,
    latency: 24,
    bitrate: '2.5 Mbps',
    resolution: '1920×1080',
    connectionType: 'p2p',
  });

  // Auto-hide toolbar after 3 seconds of no mouse movement
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const handleMouseMove = () => {
      setShowToolbar(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowToolbar(false), 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    timeout = setTimeout(() => setShowToolbar(false), 3000);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);

  // Attach MediaStream to Video element
  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleInput = (e: React.MouseEvent | React.KeyboardEvent) => {
    // Basic input capture simulation
    if (e.type === 'mousemove') {
      const me = e as React.MouseEvent;
      sendInput(JSON.stringify({ type: 'mousemove', x: me.clientX, y: me.clientY }));
    }
  };

  return (
    <div className="viewport" role="application" aria-label="Remote desktop viewport">
      {/* Video (remote screen) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="viewport__canvas"
        tabIndex={0}
        aria-label="Remote desktop display"
        onMouseMove={handleInput}
        onClick={handleInput}
        onKeyDown={handleInput}
        style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
      />

      {/* Floating Toolbar */}
      <div
        className={`viewport__toolbar ${showToolbar ? 'viewport__toolbar--visible' : ''}`}
        role="toolbar"
        aria-label="Session controls"
      >
        <div className="viewport__toolbar-inner glass">
          {/* Connection status */}
          <div className="viewport__toolbar-status">
            <span className="status-dot status-dot--online" />
            <span className="viewport__toolbar-status-text">Connected</span>
            <span className="viewport__toolbar-badge">
              {stats.connectionType === 'p2p' ? '⚡ P2P' : '🔄 Relay'}
            </span>
          </div>

          {/* Divider */}
          <div className="viewport__toolbar-divider" />

          {/* Controls */}
          <div className="viewport__toolbar-controls">
            {/* Stats toggle */}
            <button
              className="viewport__toolbar-btn"
              onClick={() => setShowStats(!showStats)}
              title="Connection stats"
              aria-label="Toggle connection statistics"
              aria-pressed={showStats}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
              </svg>
            </button>

            {/* Fullscreen */}
            <button
              className="viewport__toolbar-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              aria-label={isFullscreen ? 'Exit fullscreen mode' : 'Enter fullscreen mode'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {isFullscreen ? (
                  <>
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </>
                ) : (
                  <>
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </>
                )}
              </svg>
            </button>

            {/* Disconnect */}
            <button
              id="disconnect-button"
              className="viewport__toolbar-btn viewport__toolbar-btn--danger"
              onClick={onDisconnect}
              title="Disconnect"
              aria-label="Disconnect from remote device"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18.36 6.64a9 9 0 11-12.73 0" />
                <line x1="12" y1="2" x2="12" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Stats overlay */}
      {showStats && (
        <div className="viewport__stats glass animate-fade-in" role="status" aria-live="polite">
          <div className="viewport__stats-row">
            <span className="viewport__stats-label">FPS</span>
            <span className="viewport__stats-value">{stats.fps}</span>
          </div>
          <div className="viewport__stats-row">
            <span className="viewport__stats-label">Latency</span>
            <span className="viewport__stats-value">{stats.latency}ms</span>
          </div>
          <div className="viewport__stats-row">
            <span className="viewport__stats-label">Bitrate</span>
            <span className="viewport__stats-value">{stats.bitrate}</span>
          </div>
          <div className="viewport__stats-row">
            <span className="viewport__stats-label">Resolution</span>
            <span className="viewport__stats-value">{stats.resolution}</span>
          </div>
        </div>
      )}
    </div>
  );
}
