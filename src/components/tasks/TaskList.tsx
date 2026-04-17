import type { Task } from '../../types';
import TaskTree from './TaskTree';
import TaskInput from './TaskInput';
import { calculateStatusSummary } from '../../utils/taskUtils';
import './Tasks.css';

interface TaskListProps {
  tasks: Task[];
  today: string;
  loading: boolean;
  onAddTask: (title: string) => void;
  onComplete: (id: string) => void;
  onUncomplete?: (id: string) => void;
  onDiscard: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, title: string) => void;
  onAddChild: (parentId: string, title: string) => void;
  onSaveProgress: (taskId: string, date: string, content: string) => void;
  onSaveDescription: (taskId: string, description: string) => void;
}

export default function TaskList({
  tasks, today, loading, onAddTask, onComplete, onUncomplete, onDiscard,
  onDelete, onUpdate, onAddChild, onSaveProgress, onSaveDescription
}: TaskListProps) {
  const summary = calculateStatusSummary(tasks);

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
      <TaskInput onAdd={onAddTask} />

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
        <TaskTree
          tasks={tasks}
          today={today}
          onComplete={onComplete}
          onUncomplete={onUncomplete}
          onDiscard={onDiscard}
          onDelete={onDelete}
          onUpdate={onUpdate}
          onAddChild={onAddChild}
          onSaveProgress={onSaveProgress}
          onSaveDescription={onSaveDescription}
          showAddInput={false}
        />
      )}
    </div>
  );
}
