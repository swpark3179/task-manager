import { TouchEvent, useState } from 'react';

interface SwipeInput {
  onSwipedLeft: () => void;
  onSwipedRight: () => void;
  /** 스와이프로 인식할 최소 가로 거리(px). 기본 50 */
  minSwipeDistance?: number;
  /** 가로 vs 세로 비율 임계값. 기본 1 (가로가 세로보다 큰 경우만) */
  horizontalRatio?: number;
}

export function useSwipe({
  onSwipedLeft,
  onSwipedRight,
  minSwipeDistance = 50,
  horizontalRatio = 1,
}: SwipeInput) {
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchEndY, setTouchEndY] = useState<number | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    setTouchEndX(null);
    setTouchEndY(null);
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const onTouchMove = (e: TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
    setTouchEndY(e.targetTouches[0].clientY);
  };

  const onTouchEnd = () => {
    if (!touchStartX || !touchEndX) return;
    if (!touchStartY || !touchEndY) return;

    const distanceX = touchStartX - touchEndX;
    const distanceY = touchStartY - touchEndY;

    if (
      Math.abs(distanceX) > Math.abs(distanceY) * horizontalRatio &&
      Math.abs(distanceX) > minSwipeDistance
    ) {
      if (distanceX > 0) {
        onSwipedLeft();
      } else {
        onSwipedRight();
      }
    }
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd
  };
}
