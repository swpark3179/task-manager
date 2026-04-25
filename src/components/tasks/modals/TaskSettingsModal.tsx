import { useState, useEffect } from 'react';
import type { Task, Category } from '../../../types';
import { fetchCategories } from '../../../lib/database';

interface TaskSettingsModalProps {
  task: Task;
  onClose: () => void;
  onUpdate: (id: string, updates: { title?: string; category_id?: string | null; low_priority?: boolean }) => void;
}

export default function TaskSettingsModal({ task, onClose, onUpdate }: TaskSettingsModalProps) {
  const [title, setTitle] = useState(task.title);
  const [categoryId, setCategoryId] = useState<string>(task.category_id || '');
  const [lowPriority, setLowPriority] = useState(task.low_priority || false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await fetchCategories();
        setCategories(data);
      } catch (err) {
        console.error('Failed to load categories', err);
      } finally {
        setLoading(false);
      }
    };
    loadCategories();
  }, []);

  const handleSave = () => {
    onUpdate(task.id, {
      title: title.trim() || task.title,
      category_id: categoryId || null,
      low_priority: lowPriority,
    });
    onClose();
  };

  return (
    <div className="modal-overlay task-settings-modal-overlay" onClick={onClose}>
      <div
        className="modal-content task-settings-modal"
        onClick={e => e.stopPropagation()}
      >
        <div className="task-settings-modal-header">
          <h3 className="task-settings-modal-title">할일 설정</h3>
          <button
            type="button"
            className="task-settings-modal-close"
            onClick={onClose}
            aria-label="닫기"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="task-settings-modal-body">
          <div className="task-settings-field">
            <label className="form-label">작업 이름</label>
            <input
              className="form-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="task-settings-field">
            <label className="form-label">카테고리</label>
            {loading ? (
              <div className="task-settings-loading">로딩 중...</div>
            ) : (
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
            )}
          </div>

          <label className="task-settings-checkbox-row" htmlFor="lowPriorityCheck">
            <input
              type="checkbox"
              id="lowPriorityCheck"
              checked={lowPriority}
              onChange={e => setLowPriority(e.target.checked)}
            />
            <span>낮은 우선순위</span>
          </label>
        </div>

        <div className="task-settings-modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>취소</button>
          <button className="btn btn-primary" onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  );
}
