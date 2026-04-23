import { useSyncStatus } from './SyncIndicator';

export default function SyncBlocker() {
  const status = useSyncStatus();
  if (status !== 'syncing') return null;

  return (
    <div
      className="sync-blocker"
      role="alert"
      aria-live="assertive"
      aria-busy="true"
      onClickCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchStartCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="sync-blocker-card">
        <div className="sync-blocker-spinner" />
        <span className="sync-blocker-text">동기화 중...</span>
      </div>
    </div>
  );
}
