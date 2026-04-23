import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { createSchedule, updateSchedule, deleteSchedule, fetchCategories } from '../../lib/database';
import type { Schedule, Category } from '../../types';

interface ScheduleModalProps {
  startDate: string;
  endDate: string;
  schedule?: Schedule | null;
  onClose: () => void;
  onSave: () => void;
}

export default function ScheduleModal({ startDate: initialStartDate, endDate: initialEndDate, schedule, onClose, onSave }: ScheduleModalProps) {
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [title, setTitle] = useState(schedule?.title || '');
  const [description, setDescription] = useState(schedule?.description || '');
  const [estimatedTime, setEstimatedTime] = useState(schedule?.estimated_time || '');
  const [categoryId, setCategoryId] = useState<string>(schedule?.category_id || '');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setEstimatedTime(schedule.estimated_time || '');
      setCategoryId(schedule.category_id || '');
    }
  }, [schedule]);

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

    setLoading(true);
    setError(null);

    try {
      if (schedule) {
        await updateSchedule(schedule.id, {
          title: title.trim(),
          category_id: categoryId || null,
          description: description || null,
          start_date: startDate,
          end_date: endDate,
          estimated_time: isSameDay && estimatedTime.trim() ? estimatedTime.trim() : null,
        });
      } else {
        await createSchedule({
          title: title.trim(),
          category_id: categoryId || null,
          description: description || null,
          start_date: startDate,
          end_date: endDate,
          estimated_time: isSameDay && estimatedTime.trim() ? estimatedTime.trim() : null,
        });
      }
      onSave();
    } catch (err: any) {
      setError(err.message || '일정 저장에 실패했습니다.');
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
    } catch (err: any) {
      setError(err.message || '일정 삭제에 실패했습니다.');
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
              <label className="form-label">예정 시간 (선택)</label>
              <input
                type="text"
                className="form-input"
                value={estimatedTime}
                onChange={e => setEstimatedTime(e.target.value)}
                placeholder="예: 14:00 또는 2시간"
              />
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
              autoFocus
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
