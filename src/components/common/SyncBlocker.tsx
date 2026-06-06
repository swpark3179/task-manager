import { useEffect, useState } from 'react';
import { useSyncStatus } from './SyncIndicator';

// 안전 장치: 어떤 이유로든 동기화 상태가 'syncing'에 갇혀도 이 시간이 지나면
// 오버레이를 강제로 내려 화면이 영구히 잠기는 것을 막는다. performFullSync 자체의
// 타임아웃(45초)보다 넉넉히 길게 잡아 정상 동기화를 방해하지 않는다.
const SAFETY_DISMISS_MS = 60000;

export default function SyncBlocker() {
  const status = useSyncStatus();
  const [forceHidden, setForceHidden] = useState(false);

  useEffect(() => {
    if (status !== 'syncing') {
      setForceHidden(false);
      return;
    }
    const timer = setTimeout(() => setForceHidden(true), SAFETY_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [status]);

  if (status !== 'syncing' || forceHidden) return null;

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
