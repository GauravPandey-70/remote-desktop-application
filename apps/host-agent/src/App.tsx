import React, { useEffect, useState } from 'react';
import { WebRTCHost } from './WebRTCHost';

const invoke = async <T,>(cmd: string, args?: any): Promise<T> => {
  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
    const core = await import('@tauri-apps/api/core');
    return core.invoke<T>(cmd, args);
  }
  throw new Error('Tauri environment not detected');
};

const App: React.FC = () => {
  const [deviceId, setDeviceId] = useState<string>('DL-000-000-000');
  const [passcode, setPasscode] = useState<string>('------');
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [activeSessions, setActiveSessions] = useState<number>(0);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  useEffect(() => {
    // Fetch or generate persistent Device ID on load
    invoke<string>('get_device_id')
      .then((id) => setDeviceId(id))
      .catch((err) => {
        console.warn('Tauri not detected, generating mock Device ID:', err);
        // Generate a random testing ID matching format DL-XXX-XXX-XXX
        const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        let random = '';
        for (let i = 0; i < 9; i++) {
          random += charset[Math.floor(Math.random() * charset.length)];
        }
        setDeviceId(`DL-${random.slice(0, 3)}-${random.slice(3, 6)}-${random.slice(6, 9)}`);
      });

    // Request initial rotating passcode
    rotatePasscode();
  }, []);

  const rotatePasscode = () => {
    // Generate a random 6-digit passcode
    const newPasscode = Math.floor(100000 + Math.random() * 900000).toString();
    setPasscode(newPasscode);
    setCopiedId(false);
    setCopiedLink(false);
  };

  const copyToClipboard = (text: string, type: 'id' | 'link') => {
    const setCopiedState = type === 'id' ? setCopiedId : setCopiedLink;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopiedState(true);
          setTimeout(() => setCopiedState(false), 2000);
        })
        .catch((err) => {
          console.error('Failed to copy:', err);
          fallbackCopy(text, type);
        });
    } else {
      fallbackCopy(text, type);
    }
  };

  const fallbackCopy = (text: string, type: 'id' | 'link') => {
    const setCopiedState = type === 'id' ? setCopiedId : setCopiedLink;
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setCopiedState(true);
      setTimeout(() => setCopiedState(false), 2000);
    } catch (err) {
      console.error('Fallback copy failed:', err);
    }
    document.body.removeChild(textArea);
  };

  const statusColors = {
    disconnected: '#10B981', // green
    connecting: '#F59E0B', // amber
    connected: '#3B82F6', // blue
    error: '#EF4444', // red
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>DeskLink Host Agent</h1>
      
      <div style={styles.statusContainer}>
        <div style={{ ...styles.statusDot, backgroundColor: statusColors[status] }} />
        <span style={styles.statusText}>
          {status === 'disconnected' && 'Online & Ready'}
          {status === 'connecting' && 'Incoming Connection Request...'}
          {status === 'connected' && `Active Control Session (${activeSessions})`}
          {status === 'error' && 'Connection Error'}
        </span>
      </div>

      <div style={styles.card}>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Your Device ID</label>
          <div style={styles.idDisplay}>
            <span>{deviceId}</span>
            <button style={styles.copyBtn} onClick={() => copyToClipboard(deviceId, 'id')}>
              {copiedId ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>One-Time Passcode</label>
          <div style={styles.passcodeDisplay}>
            <span style={styles.passcodeVal}>{passcode}</span>
            <button style={styles.rotateBtn} onClick={rotatePasscode}>
              Rotate
            </button>
          </div>
          <span style={styles.subtext}>Share this ID and Passcode with the client to grant control.</span>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>One-Click Share Link</label>
          <div style={styles.passcodeDisplay}>
            <span style={{ ...styles.passcodeVal, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
              {`desklink://connect?id=${deviceId}&passcode=${passcode}`}
            </span>
            <button style={styles.copyBtn} onClick={() => copyToClipboard(`desklink://connect?id=${deviceId}&passcode=${passcode}`, 'link')}>
              {copiedLink ? 'Copied' : 'Link'}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden WebRTC core that handles connections */}
      {deviceId && (
        <WebRTCHost
          deviceId={deviceId}
          passcode={passcode}
          onStatusChange={setStatus}
          onActiveSessionsChange={setActiveSessions}
        />
      )}
    </div>
  );
};

const styles = {
  container: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#0F172A', // slate 900
    color: '#F8FAFC', // slate 50
    height: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: '20px',
    boxSizing: 'border-box' as const,
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '10px',
    background: 'linear-gradient(to right, #3B82F6, #8B5CF6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  statusContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '24px',
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  statusText: {
    fontSize: '14px',
    color: '#94A3B8', // slate 400
  },
  card: {
    backgroundColor: '#1E293B', // slate 800
    borderRadius: '12px',
    padding: '24px',
    width: '100%',
    maxWidth: '360px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  },
  fieldGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    color: '#94A3B8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '8px',
  },
  idDisplay: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '18px',
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  passcodeDisplay: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: '12px',
    borderRadius: '8px',
  },
  passcodeVal: {
    fontSize: '20px',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#3B82F6',
    letterSpacing: '0.05em',
  },
  copyBtn: {
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  rotateBtn: {
    backgroundColor: '#334155',
    color: '#F8FAFC',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  subtext: {
    display: 'block',
    fontSize: '11px',
    color: '#64748B',
    marginTop: '6px',
    lineHeight: '1.4',
  },
};

export default App;
