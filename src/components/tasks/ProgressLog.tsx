import { useState } from 'react';
import type { Task } from '../../types';
import MarkdownEditor from '../markdown/MarkdownEditor';
import MarkdownViewer from '../markdown/MarkdownViewer';
import { formatShortDate } from '../../utils/dateUtils';
import './Tasks.css';

interface ProgressLogProps {
  task: Task;
  today: string;
  onSave: (taskId: string, date: string, content: string) => void;
  readOnly?: boolean;
}

export default function ProgressLog({ task, today, onSave, readOnly }: ProgressLogProps) {
  const logs = task.progress_logs || [];
  const logDates = logs.map(l => l.log_date);

  // Add today if not in logs and not read-only
  if (!readOnly && !logDates.includes(today)) {
    logDates.push(today);
  }

  // Sort dates
  logDates.sort();

  const [activeDate, setActiveDate] = useState(today);
  const activeLog = logs.find(l => l.log_date === activeDate);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(activeLog?.content || '');

  const handleDateChange = (date: string) => {
    setActiveDate(date);
    const log = logs.find(l => l.log_date === date);
    setDraft(log?.content || '');
    setEditing(false);
  };

  const handleSave = () => {
    if (draft.trim()) {
      onSave(task.id, activeDate, draft.trim());
    }
    setEditing(false);
  };

  return (
    <div className="progress-log">
      {logDates.length > 0 && (
        <div className="progress-log-dates">
          {logDates.map(date => (
            <button
              key={date}
              className={`progress-log-date-tab ${date === activeDate ? 'active' : ''} ${date === today ? 'today' : ''}`}
              onClick={() => handleDateChange(date)}
            >
              {formatShortDate(date)}
              {date === today && <span className="progress-log-today-dot" />}
            </button>
          ))}
        </div>
      )}

      <div className="progress-log-content">
        {editing ? (
          <div className="progress-log-editor">
            <MarkdownEditor
              value={draft}
              onChange={setDraft}
              height={160}
            />
            <div className="progress-log-editor-actions">
              <button className="btn btn-primary btn-sm" onClick={handleSave}>
                저장
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setDraft(activeLog?.content || '');
                  setEditing(false);
                }}
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`progress-log-view ${!readOnly ? 'editable' : ''}`}
            onClick={() => {
              if (!readOnly && activeDate === today) {
                setEditing(true);
              }
            }}
          >
            {activeLog?.content ? (
              <MarkdownViewer content={activeLog.content} />
            ) : (
              <p className="progress-log-placeholder">
                {readOnly
                  ? '수행내용 없음'
                  : activeDate === today
                    ? '클릭하여 오늘 수행한 내용을 작성하세요...'
                    : '이 날짜의 수행내용이 없습니다.'
                }
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
