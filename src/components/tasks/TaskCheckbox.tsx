import { useState, useCallback, type MouseEvent, type TouchEvent } from 'react';
import type { TaskStatus } from '../../types';
import './Tasks.css';

interface TaskCheckboxProps {
  status: TaskStatus;
  disabled?: boolean;
  onComplete: () => void;
  onDiscard: () => void;
}

export default function TaskCheckbox({ status, disabled, onComplete, onDiscard }: TaskCheckboxProps) {
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (disabled || status === 'completed' || status === 'discarded') return;
    onComplete();
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || status === 'completed' || status === 'discarded') return;
    onDiscard();
  };

  // Mobile long press
  const handleTouchStart = useCallback((_e: TouchEvent) => {
    if (disabled || status === 'completed' || status === 'discarded') return;
    const timer = setTimeout(() => {
      onDiscard();
    }, 600);
    setLongPressTimer(timer);
  }, [disabled, status, onDiscard]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }, [longPressTimer]);

  return (
    <button
      className={`task-checkbox task-checkbox-${status} ${disabled ? 'disabled' : ''}`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      disabled={disabled}
      title={disabled ? '하위 작업에 의해 자동 계산됩니다' : getTooltip(status)}
      type="button"
    >
      {renderCheckIcon(status)}
    </button>
  );
}

function renderCheckIcon(status: TaskStatus) {
  switch (status) {
    case 'completed':
      return (
        <svg className="checkbox-icon animate-check" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="14" height="14" rx="3" fill="var(--status-completed)" stroke="var(--status-completed)" strokeWidth="1.5" />
          <path d="M4.5 8L7 10.5L11.5 5.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'in_progress':
      return (
        <svg className="checkbox-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="14" height="14" rx="3" fill="none" stroke="var(--status-in-progress)" strokeWidth="1.5" />
          <rect x="4" y="4" width="8" height="8" rx="1.5" fill="var(--status-in-progress)" opacity="0.5" />
        </svg>
      );
    case 'discarded':
      return (
        <svg className="checkbox-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="14" height="14" rx="3" fill="var(--status-discarded-bg)" stroke="var(--status-discarded)" strokeWidth="1.5" />
          <path d="M5 5L11 11M11 5L5 11" stroke="var(--status-discarded)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    default: // pending
      return (
        <svg className="checkbox-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="14" height="14" rx="3" fill="none" stroke="var(--nord4)" strokeWidth="1.5" />
        </svg>
      );
  }
}

function getTooltip(status: TaskStatus): string {
  switch (status) {
    case 'pending': return '클릭: 완료 / 우클릭: 폐기';
    case 'in_progress': return '클릭: 완료 / 우클릭: 폐기';
    case 'completed': return '완료됨';
    case 'discarded': return '폐기됨';
  }
}
