import { useCallback, useEffect, useRef, type RefCallback } from 'react';

interface Options {
  /** 감쇠 강도 (값이 클수록 덜 늘어남, 기본 250) */
  damping?: number;
  /** 최대 늘어나는 픽셀 */
  maxPull?: number;
  /** 비활성화 여부 */
  disabled?: boolean;
}

/**
 * 모바일 풀-투-바운스(러버밴드) 효과.
 * 반환된 callback ref를 대상 엘리먼트에 연결하면 됩니다.
 *
 * - 컨테이너의 스크롤이 끝에 도달했을 때 추가로 끌어내리면 transform translateY로 살짝 따라오고,
 *   놓으면 부드럽게 0으로 복귀합니다.
 * - 스크롤이 가능한 구간 내에서는 네이티브 스크롤 그대로.
 * - 스크롤할 콘텐츠가 아예 없는(짧은) 경우에도 위/아래로 살짝 밀리는 반응감을 제공합니다.
 */
export function useRubberBandScroll<T extends HTMLElement>({
  damping = 250,
  maxPull = 80,
  disabled = false,
}: Options = {}): RefCallback<T> {
  const elRef = useRef<T | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const attach = useCallback((el: T | null) => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    elRef.current = el;
    if (!el || disabled) return;

    let startY = 0;
    let currentDelta = 0;
    let active = false;
    let directionLocked: 'pull' | 'native' | null = null;

    const reset = (animate = true) => {
      el.style.transition = animate
        ? 'transform 0.28s cubic-bezier(0.22, 0.61, 0.36, 1)'
        : '';
      el.style.transform = '';
      currentDelta = 0;
      active = false;
      directionLocked = null;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      currentDelta = 0;
      active = true;
      directionLocked = null;
      el.style.transition = '';
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active) return;
      const y = e.touches[0].clientY;
      const delta = y - startY; // > 0: 아래로 끌어내림, < 0: 위로 끌어올림

      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      const noScroll = el.scrollHeight <= el.clientHeight + 1;

      const canRubber =
        noScroll || (delta > 0 && atTop) || (delta < 0 && atBottom);

      if (directionLocked === null) {
        if (Math.abs(delta) > 5) {
          directionLocked = canRubber ? 'pull' : 'native';
        }
      } else if (directionLocked === 'native') {
        return;
      }

      if (directionLocked !== 'pull') return;

      if (e.cancelable) e.preventDefault();

      const damped = delta / (1 + Math.abs(delta) / damping);
      const clamped = Math.max(-maxPull, Math.min(maxPull, damped));
      currentDelta = clamped;
      el.style.transform = `translateY(${clamped}px)`;
    };

    const onTouchEnd = () => {
      if (!active) return;
      reset(currentDelta !== 0);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    cleanupRef.current = () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.style.transform = '';
      el.style.transition = '';
    };
  }, [damping, maxPull, disabled]);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);

  return attach;
}
