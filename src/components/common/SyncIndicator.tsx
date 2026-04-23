import { useEffect, useState } from 'react';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

let currentStatus: SyncStatus = 'synced';
const listeners = new Set<(s: SyncStatus) => void>();

export function setSyncStatus(status: SyncStatus) {
  currentStatus = status;
  for (const listener of listeners) {
    try {
      listener(status);
    } catch {
      // ignore listener errors
    }
  }
}

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

export function subscribeSyncStatus(listener: (s: SyncStatus) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(currentStatus);
  useEffect(() => subscribeSyncStatus(setStatus), []);
  return status;
}
