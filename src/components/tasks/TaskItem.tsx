import { useState } from 'react';
import type { Task } from '../../types';
import TaskCheckbox from './TaskCheckbox';
import TaskTree from './TaskTree';
import TaskDetail from './TaskDetail';
import { hasChildren } from '../../utils/taskUtils';
import './Tasks.css';

interface TaskItemProps {
  task: Task;

  depth?: number;
  onComplete: (id: string) => void;
  onUncomplete?: (id: string) => void;
  onDiscard: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, title: string) => void;
  onAddChild: (parentId: string, title: string) => void;
  onSaveDescription: (taskId: string, description: string) => void;
}

export default function TaskItem({
  task, depth = 0, onComplete, onUncomplete, onDiscard, onDelete,
  onUpdate, onAddChild, onSaveDescription
}: TaskItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);

  const isParent = hasChildren(task);
  const isCompleted = task.status === 'completed';
  const isDiscarded = task.status === 'discarded';


  const handleTitleSave = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== task.title) {
      onUpdate(task.id, trimmed);
    } else {
      setEditTitle(task.title);
    }
    setEditing(false);
  };

  return (
    <div
      className={`task-item ${isCompleted ? 'completed' : ''} ${isDiscarded ? 'discarded' : ''} ${expanded ? 'expanded' : ''}`}
      style={{ '--depth': depth } as React.CSSProperties}
    >
      <div className="task-item-main" onClick={() => setExpanded(!expanded)}>
        <TaskCheckbox
          status={task.status}
          disabled={isParent}
          onComplete={() => onComplete(task.id)}
          onUncomplete={onUncomplete ? () => onUncomplete(task.id) : undefined}
          onDiscard={() => onDiscard(task.id)}
        />

        <div className="task-item-content">
          {editing ? (
            <input
              className="task-item-edit-input"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={e => {
                if (e.key === 'Enter') handleTitleSave();
                if (e.key === 'Escape') { setEditTitle(task.title); setEditing(false); }
              }}
              onClick={e => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span
              className={`task-item-title ${isCompleted || isDiscarded ? 'strikethrough' : ''}`}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (!isCompleted && !isDiscarded) {
                  setEditing(true);
                }
              }}
            >
              {task.title}
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

          {!isCompleted && !isDiscarded && (
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
          />

          {isParent && (
            <TaskTree
              tasks={task.children!}

              depth={depth + 1}
              onComplete={onComplete}
              onUncomplete={onUncomplete}
              onDiscard={onDiscard}
              onDelete={onDelete}
              onUpdate={onUpdate}
              onAddChild={onAddChild}

              onSaveDescription={onSaveDescription}
            />
          )}
        </div>
      )}
    </div>
  );
}
