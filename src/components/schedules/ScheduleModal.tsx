import { useState, useEffect, useMemo } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { createSchedule, updateSchedule, deleteSchedule, fetchCategories } from '../../lib/database';
import {
  computeNotifyAtFromOffset,
  isoToLocalDateTimeValue,
  localDateTimeToIso,
} from '../../lib/notifications';
import type { Schedule, Category } from '../../types';

interface ScheduleModalProps {
  startDate: string;
  endDate: string;
  schedule?: Schedule | null;
  onClose: () => void;
  onSave: () => void;
}

type NotifyMode = 'absolute' | 'offset';

const OFFSET_OPTIONS: { value: number; label: string }[] = [
  { value: 5, label: '5분 전' },
  { value: 10, label: '10분 전' },
  { value: 15, label: '15분 전' },
  { value: 30, label: '30분 전' },
  { value: 60, label: '1시간 전' },
  { value: 120, label: '2시간 전' },
];

function defaultNotifyAtForDate(date: string): string {
  const d = new Date(date);
  d.setHours(9, 0, 0, 0);
  return isoToLocalDateTimeValue(d.toISOString());
}

function normalizeTime(hhmmOrHHmmss: string | null): string {
  if (!hhmmOrHHmmss) return '';
  const parts = hhmmOrHHmmss.split(':');
  if (parts.length < 2) return '';
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function ScheduleModal({ startDate: initialStartDate, endDate: initialEndDate, schedule, onClose, onSave }: ScheduleModalProps) {
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [title, setTitle] = useState(schedule?.title || '');
  const [description, setDescription] = useState(schedule?.description || '');
  const [categoryId, setCategoryId] = useState<string>(schedule?.category_id || '');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 예정 시간(단일 일정 전용)
  const initialScheduledTime = normalizeTime(schedule?.scheduled_time ?? null);
  const [scheduledTimeEnabled, setScheduledTimeEnabled] = useState<boolean>(!!initialScheduledTime);
  const [scheduledTime, setScheduledTime] = useState<string>(initialScheduledTime);

  // 알림 설정
  const initialNotifyEnabled = !!schedule?.notify_at;
  const initialNotifyMode: NotifyMode = schedule?.notify_offset_minutes != null ? 'offset' : 'absolute';
  const [notifyEnabled, setNotifyEnabled] = useState<boolean>(initialNotifyEnabled);
  const [notifyMode, setNotifyMode] = useState<NotifyMode>(initialNotifyMode);
  const [notifyAtLocal, setNotifyAtLocal] = useState<string>(
    schedule?.notify_at ? isoToLocalDateTimeValue(schedule.notify_at) : defaultNotifyAtForDate(initialStartDate)
  );
  const [notifyOffset, setNotifyOffset] = useState<number>(schedule?.notify_offset_minutes ?? 10);

  const isSameDay = startDate === endDate;

  useEffect(() => {
    fetchCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    if (schedule) {
      setStartDate(schedule.start_date);
      setEndDate(schedule.end_date);
      setTitle(schedule.title);
      setDescription(schedule.description || '');
      setCategoryId(schedule.category_id || '');
      const t = normalizeTime(schedule.scheduled_time ?? null);
      setScheduledTimeEnabled(!!t);
      setScheduledTime(t);
      setNotifyEnabled(!!schedule.notify_at);
      setNotifyMode(schedule.notify_offset_minutes != null ? 'offset' : 'absolute');
      if (schedule.notify_at) setNotifyAtLocal(isoToLocalDateTimeValue(schedule.notify_at));
      if (schedule.notify_offset_minutes != null) setNotifyOffset(schedule.notify_offset_minutes);
    }
  }, [schedule]);

  // 다중일 일정으로 바뀌면 예정 시간/오프셋 모드는 무효화
  useEffect(() => {
    if (!isSameDay) {
      if (scheduledTimeEnabled) setScheduledTimeEnabled(false);
      if (notifyMode === 'offset') setNotifyMode('absolute');
    }
  }, [isSameDay, scheduledTimeEnabled, notifyMode]);

  // 예정시간이 꺼지면 N분 전 모드 사용 불가 → 절대 시각 모드로 전환
  useEffect(() => {
    if (!scheduledTimeEnabled && notifyMode === 'offset') setNotifyMode('absolute');
  }, [scheduledTimeEnabled, notifyMode]);

  const computedNotifyAtIso = useMemo<string | null>(() => {
    if (!notifyEnabled) return null;
    if (notifyMode === 'absolute') {
      if (!notifyAtLocal) return null;
      return localDateTimeToIso(notifyAtLocal);
    }
    if (!isSameDay || !scheduledTimeEnabled || !scheduledTime) return null;
    return computeNotifyAtFromOffset(startDate, scheduledTime, notifyOffset);
  }, [notifyEnabled, notifyMode, notifyAtLocal, isSameDay, scheduledTimeEnabled, scheduledTime, notifyOffset, startDate]);

  const notifyIsPast = useMemo(() => {
    if (!computedNotifyAtIso) return false;
    return new Date(computedNotifyAtIso).getTime() <= Date.now();
  }, [computedNotifyAtIso]);

  const handleSave = async () => {
    if (!title.trim()) {
      setError('일정 제목을 입력해주세요.');
      return;
    }
    if (!startDate) {
      setError('시작일을 입력해주세요.');
      return;
    }
    if (!endDate) {
      setError('종료일을 입력해주세요.');
      return;
    }
    if (endDate < startDate) {
      setError('종료일은 시작일과 같거나 이후여야 합니다.');
      return;
    }
    if (notifyEnabled && notifyMode === 'offset' && (!isSameDay || !scheduledTimeEnabled || !scheduledTime)) {
      setError('"N분 전" 알림은 단일 일정 + 예정 시간이 설정된 경우에만 사용할 수 있습니다.');
      return;
    }

    setLoading(true);
    setError(null);

    const finalScheduledTime = isSameDay && scheduledTimeEnabled && scheduledTime ? `${scheduledTime}:00` : null;
    const finalNotifyAt = notifyEnabled ? computedNotifyAtIso : null;
    const finalNotifyOffset = notifyEnabled && notifyMode === 'offset' ? notifyOffset : null;

    try {
      if (schedule) {
        await updateSchedule(schedule.id, {
          title: title.trim(),
          category_id: categoryId || null,
          description: description || null,
          start_date: startDate,
          end_date: endDate,
          estimated_time: null,
          scheduled_time: finalScheduledTime,
          notify_at: finalNotifyAt,
          notify_offset_minutes: finalNotifyOffset,
        });
      } else {
        await createSchedule({
          title: title.trim(),
          category_id: categoryId || null,
          description: description || null,
          start_date: startDate,
          end_date: endDate,
          estimated_time: null,
          scheduled_time: finalScheduledTime,
          notify_at: finalNotifyAt,
          notify_offset_minutes: finalNotifyOffset,
        });
      }
      onSave();
    } catch (err) {
      setError(getErrorMessage(err, '일정 저장에 실패했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!schedule || !window.confirm('이 일정을 삭제하시겠습니까?')) return;
    setLoading(true);
    try {
      await deleteSchedule(schedule.id);
      onSave();
    } catch (err) {
      setError(getErrorMessage(err, '일정 삭제에 실패했습니다.'));
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay schedule-modal-overlay" onClick={onClose}>
      <div
        className="modal-content schedule-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="schedule-modal-header">
          <h2 className="schedule-modal-title">{schedule ? '일정 수정' : '일정 등록'}</h2>
          <button
            type="button"
            className="schedule-modal-close"
            onClick={onClose}
            aria-label="닫기"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="schedule-modal-body">
          <div className="schedule-modal-row">
            <div className="schedule-modal-field">
              <label className="form-label">시작일 *</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                required
                onChange={e => {
                  setStartDate(e.target.value);
                  if (e.target.value && endDate && e.target.value > endDate) setEndDate(e.target.value);
                }}
                disabled={!!schedule}
              />
            </div>
            <span className="schedule-modal-row-sep" aria-hidden="true">~</span>
            <div className="schedule-modal-field">
              <label className="form-label">종료일 *</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                required
                min={startDate || undefined}
                onChange={e => {
                  setEndDate(e.target.value);
                  if (e.target.value && startDate && e.target.value < startDate) setStartDate(e.target.value);
                }}
              />
            </div>
          </div>

          {isSameDay && (
            <div className="schedule-modal-field">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={scheduledTimeEnabled}
                  onChange={e => setScheduledTimeEnabled(e.target.checked)}
                />
                예정 시간
              </label>
              {scheduledTimeEnabled && (
                <input
                  type="time"
                  className="form-input"
                  value={scheduledTime}
                  onChange={e => setScheduledTime(e.target.value)}
                  style={{ marginTop: 6 }}
                />
              )}
            </div>
          )}

          <div className="schedule-modal-field">
            <label className="form-label">제목 *</label>
            <input
              type="text"
              className="form-input"
              value={title}
              required
              onChange={e => setTitle(e.target.value)}
              placeholder="일정 제목을 입력하세요"
            />
          </div>

          <div className="schedule-modal-field">
            <label className="form-label">카테고리</label>
            <select
              className="form-input"
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
            >
              <option value="">(선택 안함)</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* 알림 */}
          <div className="schedule-modal-field">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={notifyEnabled}
                onChange={e => setNotifyEnabled(e.target.checked)}
              />
              알림 설정
            </label>
            {notifyEnabled && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}>
                    <input
                      type="radio"
                      name="notify-mode"
                      checked={notifyMode === 'absolute'}
                      onChange={() => setNotifyMode('absolute')}
                    />
                    특정 시각
                  </label>
                  <label
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem',
                      opacity: isSameDay && scheduledTimeEnabled && scheduledTime ? 1 : 0.5,
                    }}
                  >
                    <input
                      type="radio"
                      name="notify-mode"
                      checked={notifyMode === 'offset'}
                      disabled={!isSameDay || !scheduledTimeEnabled || !scheduledTime}
                      onChange={() => setNotifyMode('offset')}
                    />
                    예정 시간 N분 전
                  </label>
                </div>

                {notifyMode === 'absolute' ? (
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={notifyAtLocal}
                    onChange={e => setNotifyAtLocal(e.target.value)}
                  />
                ) : (
                  <select
                    className="form-input"
                    value={notifyOffset}
                    onChange={e => setNotifyOffset(parseInt(e.target.value, 10))}
                  >
                    {OFFSET_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}

                {notifyIsPast && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-warning, #c98300)' }}>
                    선택한 알림 시각이 이미 지났습니다. 저장은 가능하지만 알림은 표시되지 않습니다.
                  </div>
                )}

                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  iOS 에서는 앱이 화면에 켜져 있는 동안 알림이 표시되지 않을 수 있습니다. 알림 시각 직전에는 다른 앱으로 전환하거나 화면을 잠가 두세요.
                </div>
              </div>
            )}
          </div>

          <div className="schedule-modal-field" data-color-mode="light">
            <label className="form-label">상세 내용 (마크다운)</label>
            <MDEditor
              value={description}
              onChange={val => setDescription(val || '')}
              height={200}
              preview="edit"
            />
          </div>

          {error && <div className="schedule-modal-error">{error}</div>}
        </div>

        <div className="schedule-modal-footer">
          {schedule && (
            <button
              type="button"
              className="btn btn-ghost schedule-modal-delete"
              onClick={handleDelete}
              disabled={loading}
            >
              삭제
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={loading}
          >
            취소
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
