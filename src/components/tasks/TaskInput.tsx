import { useState, useRef, type KeyboardEvent } from 'react';
import './Tasks.css';

interface TaskInputProps {
  onAdd: (title: string) => void;
  parentId?: string;
  placeholder?: string;
}

export default function TaskInput({ onAdd, parentId, placeholder }: TaskInputProps) {
  const [title, setTitle] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setTitle('');
      inputRef.current?.blur();
    }
  };

  return (
    <div className={`task-input-container ${focused ? 'focused' : ''} ${parentId ? 'task-input-child' : ''}`}>
      <span className="task-input-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </span>
      <input
        ref={inputRef}
        type="text"
        className="task-input"
        placeholder={placeholder || '새 할일을 입력하세요...'}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {title.trim() && (
        <button
          type="button"
          className="btn btn-primary btn-sm task-input-btn"
          onClick={handleSubmit}
        >
          추가
        </button>
      )}
    </div>
  );
}
