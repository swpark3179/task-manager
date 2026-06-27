import { useEffect, useRef, useState } from 'react';
import { useSyncStatus } from './SyncIndicator';

// 안전 장치: 어떤 이유로든 동기화 상태가 'syncing'에 갇혀도 이 시간이 지나면
// 오버레이를 강제로 내려 화면이 영구히 잠기는 것을 막는다. performFullSync 자체의
// 타임아웃(45초)보다 넉넉히 길게 잡아 정상 동기화를 방해하지 않는다.
const SAFETY_DISMISS_MS = 60000;

// 동기화가 이 시간 넘게 지속되면 "지연" 안내와 닫기 버튼을 노출해, 느린 모바일
// 네트워크에서 사용자가 어두운 오버레이에 갇히지 않도록 한다.
const SLOW_HINT_MS = 8000;

// 실패 토스트 노출 시간.
const ERROR_TOAST_MS = 4000;

export default function SyncBlocker() {
  const status = useSyncStatus();
  const [forceHidden, setForceHidden] = useState(false);
  const [showDismiss, setShowDismiss] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const prevStatusRef = useRef(status);

  // 오버레이 표시/안전장치/지연 안내 타이머 관리
  useEffect(() => {
    if (status !== 'syncing') {
      setForceHidden(false);
      setShowDismiss(false);
      return;
    }
    const slowTimer = setTimeout(() => setShowDismiss(true), SLOW_HINT_MS);
    const safetyTimer = setTimeout(() => setForceHidden(true), SAFETY_DISMISS_MS);
    return () => {
      clearTimeout(slowTimer);
      clearTimeout(safetyTimer);
    };
  }, [status]);

  // 동기화 실패(→ 'error'/'offline') 전이를 감지해 사용자에게 토스트로 알린다.
  // 조용히 오버레이만 사라져 "왜 안 되지?" 상태가 되는 것을 막는다.
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    // 어떤 상태에서든 실패(error/offline)로 새로 진입하면 알린다. 초기 마운트 시에는
    // prev === status 이므로 발동하지 않는다.
    if (prev !== status && (status === 'error' || status === 'offline')) {
      setErrorVisible(true);
      const timer = setTimeout(() => setErrorVisible(false), ERROR_TOAST_MS);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const blockerVisible = status === 'syncing' && !forceHidden;

  if (!blockerVisible && !errorVisible) return null;

  return (
    <>
      {blockerVisible && (
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
            <span className="sync-blocker-text">
              {showDismiss ? '동기화가 지연되고 있어요' : '동기화 중...'}
            </span>
            {showDismiss && (
              <button
                type="button"
                className="sync-blocker-dismiss"
                onClick={() => setForceHidden(true)}
              >
                닫기
              </button>
            )}
          </div>
        </div>
      )}

      {errorVisible && (
        <div className="toast-container">
          <div className="toast toast-error" role="alert">
            <span>동기화에 실패했어요. 잠시 후 다시 시도해주세요.</span>
            <button
              type="button"
              className="toast-close"
              aria-label="닫기"
              onClick={() => setErrorVisible(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
