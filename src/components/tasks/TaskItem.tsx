import { useState } from 'react';
import type { Task } from '../../types';
import TaskSettingsModal from './modals/TaskSettingsModal';
import TaskCheckbox from './TaskCheckbox';
import TaskTree from './TaskTree';
import TaskDetail from './TaskDetail';
import { hasChildren, getEffectiveStatus } from '../../utils/taskUtils';
import './Tasks.css';

interface TaskItemProps {
  task: Task;

  depth?: number;
  onComplete: (id: string) => void;
  onUncomplete?: (id: string) => void;
  onDiscard: (id: string) => void;
  onUndiscard?: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateSettings: (id: string, updates: { title?: string; category_id?: string | null; low_priority?: boolean }) => void;
  onAddChild: (parentId: string, title: string) => void;
  onSaveDescription: (taskId: string, description: string) => void;
}

export default function TaskItem({
  task, depth = 0, onComplete, onUncomplete, onDiscard, onUndiscard, onDelete,
  onUpdateSettings, onAddChild, onSaveDescription
}: TaskItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const isParent = hasChildren(task);
  // For parents, the stored status is not auto-updated when children change;
  // derive the displayed state so the row visually matches its children.
  const effectiveStatus = isParent ? getEffectiveStatus(task) : task.status;
  const isCompleted = effectiveStatus === 'completed';
  const isDiscarded = effectiveStatus === 'discarded';


  return (
    <div
      className={`task-item ${isCompleted ? 'completed' : ''} ${isDiscarded ? 'discarded' : ''} ${expanded ? 'expanded' : ''}`}
      style={{ '--depth': depth } as React.CSSProperties}
    >
      <div className="task-item-main" onClick={() => setExpanded(!expanded)}>
        <TaskCheckbox
          status={effectiveStatus}
          disabled={isParent || task.is_snapshot}
          onComplete={task.is_snapshot ? () => {} : () => onComplete(task.id)}
          onUncomplete={task.is_snapshot ? undefined : (onUncomplete ? () => onUncomplete(task.id) : undefined)}
          onDiscard={task.is_snapshot ? () => {} : () => onDiscard(task.id)}
          onUndiscard={task.is_snapshot ? undefined : (onUndiscard ? () => onUndiscard(task.id) : undefined)}
        />

        <div className="task-item-content">
          <span
            className={`task-item-title ${isCompleted || isDiscarded ? 'strikethrough' : ''}`}
          >
            {task.title}
          </span>
          {task.low_priority && (
            <span style={{ fontSize: '10px', backgroundColor: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
              낮음
            </span>
          )}


        </div>

        <div className="task-item-actions" onClick={e => e.stopPropagation()}>
          <button
            className="btn btn-ghost btn-icon btn-sm task-item-expand"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            title={expanded ? '접기' : '펼치기'}
          >
            <svg
              width="14" height="14"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

                    <button
            className="btn btn-ghost btn-icon btn-sm task-item-settings"
            onClick={(e) => { e.stopPropagation(); setShowSettings(true); }}
            title="설정"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          {!task.is_snapshot && (
            <button
              className="btn btn-ghost btn-icon btn-sm task-item-delete"
              onClick={() => onDelete(task.id)}
              title="삭제"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="task-item-detail animate-fade-in-up">
          <TaskDetail
            task={task}
            onSaveDescription={onSaveDescription}
            onAddChild={onAddChild}
          >
            {isParent && (
              <TaskTree
                tasks={task.children!}
                depth={depth + 1}
                onComplete={onComplete}
                onUncomplete={onUncomplete}
                onDiscard={onDiscard}
                onUndiscard={onUndiscard}
                onDelete={onDelete}
                onUpdateSettings={onUpdateSettings}
                onAddChild={onAddChild}
                onSaveDescription={onSaveDescription}
              />
            )}
          </TaskDetail>
        </div>
      )}
      {showSettings && (
        <TaskSettingsModal
          task={task}
          onClose={() => setShowSettings(false)}
          onUpdate={onUpdateSettings}
        />
      )}
    </div>
  );
}
