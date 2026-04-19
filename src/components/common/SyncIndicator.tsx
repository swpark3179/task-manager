type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

// Helper to update sync status from anywhere
export function setSyncStatus(status: SyncStatus) {
  const setter = (window as unknown as Record<string, unknown>).__setSyncStatus;
  if (typeof setter === 'function') {
    (setter as (s: SyncStatus) => void)(status);
  }
}
