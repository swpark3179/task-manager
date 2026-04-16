import { useState, useEffect } from 'react';
import './Common.css';

type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

export default function SyncIndicator() {
  const [status, setStatus] = useState<SyncStatus>('synced');

  useEffect(() => {
    const handleOnline = () => setStatus('synced');
    const handleOffline = () => setStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!navigator.onLine) {
      setStatus('offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Expose a global function to update sync status
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__setSyncStatus = setStatus;
    return () => {
      delete (window as unknown as Record<string, unknown>).__setSyncStatus;
    };
  }, []);

  return (
    <div className={`sync-indicator sync-${status}`} title={getStatusText(status)}>
      <span className="sync-dot" />
      <span className="sync-text">{getStatusText(status)}</span>
    </div>
  );
}

function getStatusText(status: SyncStatus): string {
  switch (status) {
    case 'synced': return '동기화 완료';
    case 'syncing': return '동기화 중...';
    case 'offline': return '오프라인';
    case 'error': return '동기화 실패';
  }
}

// Helper to update sync status from anywhere
export function setSyncStatus(status: SyncStatus) {
  const setter = (window as unknown as Record<string, unknown>).__setSyncStatus;
  if (typeof setter === 'function') {
    (setter as (s: SyncStatus) => void)(status);
  }
}
