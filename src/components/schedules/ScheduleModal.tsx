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
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px', width: '90%' }}
      >
        <h2 style={{ margin: 0 }}>{schedule ? '일정 수정' : '일정 등록'}</h2>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
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
          <span>~</span>
          <div style={{ flex: 1 }}>
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
          <div>
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

        <div>
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

        <div>
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

        <div data-color-mode="light" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label className="form-label">상세 내용 (마크다운)</label>
          <MDEditor
            value={description}
            onChange={val => setDescription(val || '')}
            height={200}
            preview="edit"
          />
        </div>

        {error && <div style={{ color: 'var(--nord11)', fontSize: '0.875rem' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
          {schedule && (
            <button className="btn btn-ghost" onClick={handleDelete} disabled={loading} style={{ color: 'var(--nord11)', marginRight: 'auto' }}>
              삭제
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>취소</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
