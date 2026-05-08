import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useDayTasks } from '../hooks/useDayTasks';
import { hideDashboard, openFullApp } from '../lib/windowCommands';
import { getTodayString, formatDateDisplay } from '../utils/dateUtils';
import { calculateStatusSummary, getEffectiveStatus, hasChildren } from '../utils/taskUtils';
import type { Task } from '../types';
import './DashboardPage.css';

function TaskEditor({
  task,
  depth = 0,
  onToggleComplete,
  onSaveTitle,
  onSaveDescription,
  onAddChild,
  onDelete,
}: {
  task: Task;
  depth?: number;
  onToggleComplete: (task: Task) => Promise<void>;
  onSaveTitle: (task: Task, title: string) => Promise<void>;
  onSaveDescription: (task: Task, description: string) => Promise<void>;
  onAddChild: (parentId: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [childTitle, setChildTitle] = useState('');
  const effectiveStatus = getEffectiveStatus(task);
  const isCompleted = effectiveStatus === 'completed';
  const isDiscarded = effectiveStatus === 'discarded';
  const childCount = task.children?.length ?? 0;

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? '');
  }, [task.description, task.title]);

  const saveTitle = async () => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === task.title) return;
    await onSaveTitle(task, trimmed);
  };

  const saveDescription = async () => {
    if (description === (task.description ?? '')) return;
    await onSaveDescription(task, description);
  };

  const addChild = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = childTitle.trim();
    if (!trimmed) return;
    await onAddChild(task.id, trimmed);
    setChildTitle('');
    setExpanded(true);
  };

  return (
    <li className={`dashboard-task ${isCompleted ? 'is-completed' : ''} ${isDiscarded ? 'is-discarded' : ''}`} style={{ '--depth': depth } as CSSProperties}>
      <div className="dashboard-task-row">
        <button
          type="button"
          className={`dashboard-check ${isCompleted ? 'checked' : ''}`}
          onClick={() => void onToggleComplete(task)}
          aria-label={isCompleted ? '완료 취소' : '완료'}
          disabled={hasChildren(task)}
          title={hasChildren(task) ? '하위 작업이 있는 작업은 하위 작업 상태로 계산됩니다.' : undefined}
        >
          {isCompleted ? '✓' : ''}
        </button>
        <input
          className="dashboard-title-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => void saveTitle()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          aria-label="작업 제목"
        />
        <button
          type="button"
          className="dashboard-icon-button"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? '접기' : '펼치기'}
        >
          {expanded ? '⌃' : childCount > 0 ? `⌄ ${childCount}` : '⌄'}
        </button>
      </div>

      {expanded && (
        <div className="dashboard-task-detail">
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => void saveDescription()}
            placeholder="설명"
            rows={2}
          />
          <form className="dashboard-child-form" onSubmit={addChild}>
            <input
              value={childTitle}
              onChange={(event) => setChildTitle(event.target.value)}
              placeholder="하위 작업 추가"
            />
            <button type="submit" className="btn btn-secondary btn-sm">추가</button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void onDelete(task.id)}
              disabled={task.is_snapshot}
            >
              삭제
            </button>
          </form>
          {childCount > 0 && (
            <ul className="dashboard-task-children">
              {task.children!.map((child) => (
                <TaskEditor
                  key={child.id}
                  task={child}
                  depth={depth + 1}
                  onToggleComplete={onToggleComplete}
                  onSaveTitle={onSaveTitle}
                  onSaveDescription={onSaveDescription}
                  onAddChild={onAddChild}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

export default function DashboardPage() {
  const today = getTodayString();
  const dayTasks = useDayTasks(today);
  const [newTitle, setNewTitle] = useState('');
  const summary = useMemo(() => calculateStatusSummary(dayTasks.tasks), [dayTasks.tasks]);

  const addTask = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    await dayTasks.addTask(trimmed);
    setNewTitle('');
  };

  const toggleComplete = async (task: Task) => {
    const status = getEffectiveStatus(task);
    if (status === 'completed') {
      await dayTasks.uncomplete(task.id);
    } else {
      await dayTasks.complete(task.id);
    }
  };

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">Today</p>
          <h1>작업 대시보드</h1>
          <p>{formatDateDisplay(today)}</p>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void openFullApp()}>
            전체 앱 열기
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void hideDashboard()}>
            숨기기
          </button>
        </div>
      </header>

      <section className="dashboard-summary" aria-label="오늘 작업 요약">
        <span>전체 {summary.total}</span>
        <span>완료 {summary.completed}</span>
        <span>진행 {summary.inProgress}</span>
        <span>대기 {summary.pending}</span>
      </section>

      <form className="dashboard-quick-add" onSubmit={addTask}>
        <input
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder="빠른 작업 추가"
          autoFocus
        />
        <button type="submit" className="btn btn-primary btn-sm">추가</button>
      </form>

      <section className="dashboard-task-list" aria-label="오늘 작업">
        {dayTasks.loading && dayTasks.tasks.length === 0 && (
          <div className="dashboard-empty">불러오는 중...</div>
        )}
        {!dayTasks.loading && dayTasks.tasks.length === 0 && (
          <div className="dashboard-empty">오늘 작업이 없습니다.</div>
        )}
        {dayTasks.tasks.length > 0 && (
          <ul>
            {dayTasks.tasks.map((task) => (
              <TaskEditor
                key={task.id}
                task={task}
                onToggleComplete={toggleComplete}
                onSaveTitle={(item, title) => dayTasks.updateSettings(item.id, { title })}
                onSaveDescription={(item, value) => dayTasks.saveDescription(item.id, value)}
                onAddChild={dayTasks.addChild}
                onDelete={(id) => dayTasks.deleteTaskById(id, { confirm: false })}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

