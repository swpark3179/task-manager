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
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="modal-content card" onClick={e => e.stopPropagation()} style={{
        width: '90%', maxWidth: '400px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px'
      }}>
        <h3 style={{ margin: 0, fontSize: '18px' }}>할일 설정</h3>

        <div className="settings-field">
          <label className="settings-label" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>작업 이름</label>
          <input
            className="input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box' }}
            autoFocus
          />
        </div>

        <div className="settings-field">
          <label className="settings-label" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>카테고리</label>
          {loading ? (
            <div style={{ fontSize: '14px' }}>로딩 중...</div>
          ) : (
            <select
              className="input"
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            >
              <option value="">(선택 안함)</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="settings-field" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            id="lowPriorityCheck"
            checked={lowPriority}
            onChange={e => setLowPriority(e.target.checked)}
            style={{ width: '16px', height: '16px' }}
          />
          <label htmlFor="lowPriorityCheck" style={{ fontSize: '14px', cursor: 'pointer' }}>낮은 우선순위</label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
          <button className="btn btn-ghost" onClick={onClose}>취소</button>
          <button className="btn btn-primary" onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  );
}
