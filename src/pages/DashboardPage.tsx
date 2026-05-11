import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useDayTasks } from '../hooks/useDayTasks';
import { hideDashboard, openFullApp } from '../lib/windowCommands';
import { getTodayString, formatDateDisplay } from '../utils/dateUtils';
import { calculateStatusSummary, getEffectiveStatus, hasChildren } from '../utils/taskUtils';
import type { Task } from '../types';
import './DashboardPage.css';

const FAVORITES_STORAGE_KEY = 'task-manager.dashboard.favorites';

function loadFavorites(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set();
  }
}

function persistFavorites(favorites: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(Array.from(favorites)),
    );
  } catch {
    // ignore storage errors (quota, privacy mode)
  }
}

function TaskEditor({
  task,
  depth = 0,
  isFavorite,
  canSnapshot,
  onToggleComplete,
  onSaveTitle,
  onSaveDescription,
  onAddChild,
  onDelete,
  onToggleFavorite,
  onCreateSnapshot,
  onDeleteSnapshot,
}: {
  task: Task;
  depth?: number;
  isFavorite: boolean;
  canSnapshot: boolean;
  onToggleComplete: (task: Task) => Promise<void>;
  onSaveTitle: (task: Task, title: string) => Promise<void>;
  onSaveDescription: (task: Task, description: string) => Promise<void>;
  onAddChild: (parentId: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleFavorite: (id: string) => void;
  onCreateSnapshot: (id: string) => Promise<void>;
  onDeleteSnapshot: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [childTitle, setChildTitle] = useState('');
  const effectiveStatus = getEffectiveStatus(task);
  const isCompleted = effectiveStatus === 'completed';
  const isDiscarded = effectiveStatus === 'discarded';
  const childCount = task.children?.length ?? 0;
  const showSnapshotButton = canSnapshot && depth === 0 && !task.is_snapshot && !isCompleted && !isDiscarded;
  const showFavoriteButton = depth === 0 && !task.is_snapshot;

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? '');
  }, [task.description, task.title]);

  const saveTitle = async () => {
    setIsEditingTitle(false);
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(task.title);
      return;
    }
    if (trimmed === task.title) return;
    await onSaveTitle(task, trimmed);
  };

  const cancelTitleEdit = () => {
    setTitle(task.title);
    setIsEditingTitle(false);
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

  const handleToggleSnapshot = async () => {
    if (task.has_snapshot) {
      await onDeleteSnapshot(task.id);
    } else {
      await onCreateSnapshot(task.id);
    }
  };

  return (
    <li
      className={`dashboard-task ${isCompleted ? 'is-completed' : ''} ${isDiscarded ? 'is-discarded' : ''} ${isFavorite ? 'is-favorite' : ''}`}
      style={{ '--depth': depth } as CSSProperties}
    >
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
        {isEditingTitle ? (
          <input
            className="dashboard-title-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => void saveTitle()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              else if (event.key === 'Escape') cancelTitleEdit();
            }}
            autoFocus
            aria-label="작업 제목"
          />
        ) : (
          <span
            className={`dashboard-task-title ${task.title ? '' : 'is-empty'}`}
            onDoubleClick={() => setIsEditingTitle(true)}
            title="더블클릭하여 편집"
          >
            {task.title || '제목 없음'}
          </span>
        )}
        {showFavoriteButton && (
          <button
            type="button"
            className={`dashboard-icon-button dashboard-favorite-button ${isFavorite ? 'is-active' : ''}`}
            onClick={() => onToggleFavorite(task.id)}
            aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
            aria-pressed={isFavorite}
            title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          >
            {isFavorite ? '★' : '☆'}
          </button>
        )}
        {showSnapshotButton && (
          <button
            type="button"
            className={`dashboard-icon-button dashboard-snapshot-button ${task.has_snapshot ? 'is-active' : ''}`}
            onClick={() => void handleToggleSnapshot()}
            aria-label={task.has_snapshot ? '오늘 진행 기록 취소' : '오늘 진행 기록'}
            aria-pressed={!!task.has_snapshot}
            title={task.has_snapshot ? '오늘의 진행 기록을 취소합니다' : '오늘 진행 중임을 기록으로 남깁니다'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={task.has_snapshot ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        )}
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
                  isFavorite={false}
                  canSnapshot={canSnapshot}
                  onToggleComplete={onToggleComplete}
                  onSaveTitle={onSaveTitle}
                  onSaveDescription={onSaveDescription}
                  onAddChild={onAddChild}
                  onDelete={onDelete}
                  onToggleFavorite={onToggleFavorite}
                  onCreateSnapshot={onCreateSnapshot}
                  onDeleteSnapshot={onDeleteSnapshot}
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
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());
  const summary = useMemo(() => calculateStatusSummary(dayTasks.tasks), [dayTasks.tasks]);

  useEffect(() => {
    persistFavorites(favorites);
  }, [favorites]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const sortedTasks = useMemo(() => {
    if (favorites.size === 0) return dayTasks.tasks;
    const favored: Task[] = [];
    const rest: Task[] = [];
    for (const task of dayTasks.tasks) {
      if (favorites.has(task.id)) favored.push(task);
      else rest.push(task);
    }
    return [...favored, ...rest];
  }, [dayTasks.tasks, favorites]);

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
        <span><strong>{summary.total}</strong>전체</span>
        <span><strong>{summary.completed}</strong>완료</span>
        <span><strong>{summary.inProgress}</strong>진행</span>
        <span><strong>{summary.pending}</strong>대기</span>
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
        {sortedTasks.length > 0 && (
          <ul>
            {sortedTasks.map((task) => (
              <TaskEditor
                key={task.id}
                task={task}
                isFavorite={favorites.has(task.id)}
                canSnapshot={task.created_date === today}
                onToggleComplete={toggleComplete}
                onSaveTitle={(item, title) => dayTasks.updateSettings(item.id, { title })}
                onSaveDescription={(item, value) => dayTasks.saveDescription(item.id, value)}
                onAddChild={dayTasks.addChild}
                onDelete={(id) => dayTasks.deleteTaskById(id, { confirm: false })}
                onToggleFavorite={toggleFavorite}
                onCreateSnapshot={dayTasks.createSnapshot}
                onDeleteSnapshot={dayTasks.deleteSnapshot}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
