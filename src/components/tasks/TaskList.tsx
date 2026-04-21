import type { Task } from '../../types';
import TaskTree from './TaskTree';
import TaskInput from './TaskInput';
import { calculateStatusSummary, getLeafTasks } from '../../utils/taskUtils';
import { useState, useMemo } from 'react';
import './Tasks.css';

interface TaskListProps {
  tasks: Task[];

  loading: boolean;
  onAddTask: (title: string) => void;
  onComplete: (id: string) => void;
  onUncomplete?: (id: string) => void;
  onDiscard: (id: string) => void;
  onUndiscard?: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateSettings: (id: string, updates: { title?: string; category_id?: string | null; low_priority?: boolean }) => void;
  onAddChild: (parentId: string, title: string) => void;
  onSaveDescription: (taskId: string, description: string) => void;
  isHistory?: boolean;
}

export default function TaskList({
  tasks, loading, onAddTask, onComplete, onUncomplete, onDiscard, onUndiscard,
  onDelete, onUpdateSettings, onAddChild, onSaveDescription, isHistory
}: TaskListProps) {
  const [viewMode, setViewMode] = useState<'tree' | 'leaf'>('tree');
  const summary = useMemo(() => calculateStatusSummary(tasks), [tasks]);

  const displayTasks = useMemo(() => viewMode === 'tree' ? tasks : getLeafTasks(tasks), [viewMode, tasks]);

  const normalTasks = useMemo(() => displayTasks.filter(t => !t.low_priority), [displayTasks]);
  const lowPriorityTasks = useMemo(() => displayTasks.filter(t => t.low_priority), [displayTasks]);

  const [showLowPriority, setShowLowPriority] = useState(false);


  return (
    <div className="task-list">
      {/* Summary bar */}
      {tasks.length > 0 && (
        <div className="task-list-summary" style={{ marginBottom: 'var(--space-md)' }}>
          <span className="task-list-count badge badge-completed">
            완료 {summary.completed}
          </span>
          {summary.inProgress > 0 && (
            <span className="task-list-count badge badge-in-progress">
              진행 {summary.inProgress}
            </span>
          )}
          <span className="task-list-count badge badge-pending">
            대기 {summary.pending}
          </span>
          {summary.discarded > 0 && (
            <span className="task-list-count badge badge-discarded">
              폐기 {summary.discarded}
            </span>
          )}

          <div style={{ flex: 1 }} />
          <div className="view-mode-toggle" style={{ display: 'flex', gap: '4px', marginRight: 'var(--space-md)' }}>
            <button
              className={`btn btn-sm ${viewMode === 'tree' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('tree')}
              title="트리 뷰"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'leaf' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('leaf')}
              title="리스트 뷰"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
          </div>
          <div className="progress-bar" style={{ width: '120px' }}>

            <div
              className={`progress-bar-fill ${summary.completed === summary.total - summary.discarded ? 'completed' : 'in-progress'}`}
              style={{
                width: `${summary.total - summary.discarded > 0
                  ? (summary.completed / (summary.total - summary.discarded)) * 100
                  : 0}%`
              }}
            />
          </div>
        </div>
      )}

      {/* Add task input */}
      {!isHistory && <TaskInput onAdd={onAddTask} />}

      <div style={{ height: 'var(--space-md)' }} />

      {/* Loading state */}
      {loading && tasks.length === 0 && (
        <div className="loading-container">
          <div className="loading-spinner" />
        </div>
      )}

      {/* Empty state */}
      {!loading && tasks.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <p className="empty-state-title">등록된 할일이 없습니다</p>
          <p className="empty-state-desc">위의 입력란에 할일을 입력하고 Enter를 눌러 추가하세요</p>
        </div>
      )}

      {/* Task tree */}
      {tasks.length > 0 && (
        <>
          <TaskTree
            tasks={normalTasks}
            onComplete={onComplete}
            onUncomplete={onUncomplete}
            onDiscard={onDiscard}
            onUndiscard={onUndiscard}
            onDelete={onDelete}
            onUpdateSettings={onUpdateSettings}
            onAddChild={onAddChild}
            onSaveDescription={onSaveDescription}
            showAddInput={false}
          />

          {lowPriorityTasks.length > 0 && (
            <div className="low-priority-section" style={{ marginTop: '16px' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowLowPriority(!showLowPriority)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: '4px' }}
              >
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  낮은 우선순위 할일 ({lowPriorityTasks.length})
                </span>
                <svg
                  width="14" height="14"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: showLowPriority ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-muted)' }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showLowPriority && (
                <div style={{ marginTop: '8px' }}>
                  <TaskTree
                    tasks={lowPriorityTasks}
                    onComplete={onComplete}
                    onUncomplete={onUncomplete}
                    onDiscard={onDiscard}
                    onUndiscard={onUndiscard}
                    onDelete={onDelete}
                    onUpdateSettings={onUpdateSettings}
                    onAddChild={onAddChild}
                    onSaveDescription={onSaveDescription}
                    showAddInput={false}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
