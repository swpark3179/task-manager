import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useDayTasks } from '../hooks/useDayTasks';
import { hideDashboard, openFullApp } from '../lib/windowCommands';
import { getTodayString } from '../utils/dateUtils';
import { calculateStatusSummary, getEffectiveStatus, hasChildren } from '../utils/taskUtils';
import type { Task, TaskStatus } from '../types';
import MarkdownViewer from '../components/markdown/MarkdownViewer';
import './DashboardPage.css';

const FAVORITES_STORAGE_KEY = 'task-manager.dashboard.favorites';

type FilterKey = 'all' | 'in_progress' | 'pending' | 'completed';

const KOR_DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function formatTodayHeader(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${KOR_DAYS[d.getDay()]})`;
}

function loadFavorites(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function persistFavorites(favorites: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favorites)));
  } catch {
    // ignore
  }
}

function matchesFilter(task: Task, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  const status = getEffectiveStatus(task);
  if (status === filter) return true;
  return (task.children || []).some((c) => matchesFilter(c, filter));
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function DotIcon() {
  return (
    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="6" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9L12 3z" />
    </svg>
  );
}
function MinimizeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 14h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function ExternalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 4h6v6M20 4l-9 9M10 6H5v13h13v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TaskNode({
  task,
  depth,
  today,
  isFavorite,
  filter,
  onToggleStatus,
  onSaveTitle,
  onSaveDescription,
  onAddChild,
  onDelete,
  onToggleFavorite,
  onCreateSnapshot,
  onDeleteSnapshot,
}: {
  task: Task;
  depth: number;
  today: string;
  isFavorite: boolean;
  filter: FilterKey;
  onToggleStatus: (task: Task) => Promise<void>;
  onSaveTitle: (task: Task, title: string) => Promise<void>;
  onSaveDescription: (task: Task, description: string) => Promise<void>;
  onAddChild: (parentId: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleFavorite: (id: string) => void;
  onCreateSnapshot: (id: string) => Promise<void>;
  onDeleteSnapshot: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'detail' | 'log'>('detail');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [editingDetail, setEditingDetail] = useState(false);
  const [detailDraft, setDetailDraft] = useState(task.description ?? '');
  const [adding, setAdding] = useState(false);
  const [childInput, setChildInput] = useState('');

  useEffect(() => {
    setTitleDraft(task.title);
    setDetailDraft(task.description ?? '');
  }, [task.title, task.description]);

  const effective = getEffectiveStatus(task);
  const isDone = effective === 'completed';
  const isDoing = effective === 'in_progress';
  const isDiscarded = effective === 'discarded';
  const statusClass: 'done' | 'doing' | 'todo' | 'discarded' = isDone
    ? 'done'
    : isDiscarded
    ? 'discarded'
    : isDoing
    ? 'doing'
    : 'todo';
  const childCount = task.children?.length ?? 0;
  const doneChildren = (task.children || []).filter((c) => getEffectiveStatus(c) === 'completed').length;
  const todayMarked = !!task.has_snapshot;
  const canSnapshot = task.created_date === today && !task.is_snapshot && depth === 0;
  const childrenVisible = (task.children || []).filter((c) => matchesFilter(c, filter));

  const submitTitle = async () => {
    const trimmed = titleDraft.trim();
    setEditingTitle(false);
    if (!trimmed || trimmed === task.title) {
      setTitleDraft(task.title);
      return;
    }
    await onSaveTitle(task, trimmed);
  };

  const submitChild = async () => {
    const trimmed = childInput.trim();
    if (!trimmed) return;
    await onAddChild(task.id, trimmed);
    setChildInput('');
    setAdding(false);
    setOpen(true);
  };

  const handleSnapshotToggle = async () => {
    if (todayMarked) await onDeleteSnapshot(task.id);
    else await onCreateSnapshot(task.id);
  };

  return (
    <div className={`node node-d${depth}`} style={{ ['--depth' as string]: depth } as CSSProperties}>
      <div className={`row row-${statusClass}`}>
        <button
          type="button"
          className={`chk chk-${statusClass}`}
          onClick={() => void onToggleStatus(task)}
          disabled={hasChildren(task)}
          title={hasChildren(task) ? '하위 작업 상태로 자동 계산됩니다' : '상태 전환'}
          aria-label="상태 전환"
        >
          {isDone ? <CheckIcon /> : isDoing ? <DotIcon /> : null}
        </button>
        <button
          type="button"
          className="row-main"
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`title ${isDone ? 'title-done' : ''}`}>
            {editingTitle ? (
              <input
                autoFocus
                className="title-edit"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => void submitTitle()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') {
                    setTitleDraft(task.title);
                    setEditingTitle(false);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingTitle(true);
                }}
              >
                {task.title || '제목 없음'}
              </span>
            )}
          </span>
          <span className="row-meta">
            {todayMarked && <span className="pin">오늘</span>}
            {childCount > 0 && (
              <span className="cnt">
                {doneChildren}/{childCount}
              </span>
            )}
            <span className={`caret ${open ? 'caret-on' : ''}`}>
              <ChevronIcon />
            </span>
          </span>
        </button>
        <div className="row-actions">
          {depth === 0 && !task.is_snapshot && (
            <button
              type="button"
              className={`iconbtn iconbtn-sm ${isFavorite ? 'is-fav' : ''}`}
              onClick={() => onToggleFavorite(task.id)}
              aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
              title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
            >
              <StarIcon filled={isFavorite} />
            </button>
          )}
          {!task.is_snapshot && (
            <button
              type="button"
              className="iconbtn iconbtn-sm iconbtn-danger"
              onClick={() => {
                if (confirm(`"${task.title}" 삭제할까요?`)) void onDelete(task.id);
              }}
              aria-label="삭제"
              title="삭제"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="open">
          <div className="open-tabs">
            <button
              type="button"
              className={`otab ${view === 'detail' ? 'otab-on' : ''}`}
              onClick={() => setView('detail')}
            >
              상세
            </button>
            <button
              type="button"
              className={`otab ${view === 'log' ? 'otab-on' : ''}`}
              onClick={() => setView('log')}
            >
              진행 <span className="otab-n">{todayMarked ? 1 : 0}</span>
            </button>
            <div className="otab-sp" />
            {canSnapshot && (
              <button
                type="button"
                className={`today-btn ${todayMarked ? 'today-on' : ''}`}
                onClick={() => void handleSnapshotToggle()}
                title={todayMarked ? '오늘 진행 기록 취소' : '오늘 진행했음을 기록'}
              >
                {todayMarked ? '✓ 오늘 기록됨' : '오늘 진행 기록'}
              </button>
            )}
          </div>

          {view === 'detail' && (
            <div className="detail">
              {editingDetail ? (
                <>
                  <textarea
                    className="detail-edit"
                    value={detailDraft}
                    onChange={(e) => setDetailDraft(e.target.value)}
                    placeholder="마크다운으로 상세 내용 작성…"
                    autoFocus
                  />
                  <div className="detail-act">
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => {
                        setDetailDraft(task.description ?? '');
                        setEditingDetail(false);
                      }}
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      onClick={async () => {
                        await onSaveDescription(task, detailDraft);
                        setEditingDetail(false);
                      }}
                    >
                      저장
                    </button>
                  </div>
                </>
              ) : (
                <div onClick={() => setEditingDetail(true)}>
                  {task.description ? (
                    <div className="md">
                      <MarkdownViewer content={task.description} />
                    </div>
                  ) : (
                    <div className="md-empty">
                      <span>상세 내용 없음 — 클릭해서 마크다운으로 추가</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {view === 'log' && (
            <div className="log">
              {todayMarked ? (
                <ul className="log-list">
                  <li className="log-item">
                    <span className="log-dot" />
                    <span className="log-day">오늘</span>
                    <span className="log-date">{today}</span>
                  </li>
                </ul>
              ) : (
                <div className="md-empty">아직 오늘 진행 기록이 없어요</div>
              )}
            </div>
          )}

          {childrenVisible.length > 0 && (
            <div className="children">
              {childrenVisible.map((child) => (
                <TaskNode
                  key={child.id}
                  task={child}
                  depth={depth + 1}
                  today={today}
                  isFavorite={false}
                  filter={filter}
                  onToggleStatus={onToggleStatus}
                  onSaveTitle={onSaveTitle}
                  onSaveDescription={onSaveDescription}
                  onAddChild={onAddChild}
                  onDelete={onDelete}
                  onToggleFavorite={onToggleFavorite}
                  onCreateSnapshot={onCreateSnapshot}
                  onDeleteSnapshot={onDeleteSnapshot}
                />
              ))}
            </div>
          )}

          {!task.is_snapshot && depth < 3 && (
            <div className="add-child">
              {adding ? (
                <div className="add-child-form">
                  <input
                    autoFocus
                    className="add-child-in"
                    placeholder="하위 작업 제목"
                    value={childInput}
                    onChange={(e) => setChildInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void submitChild();
                      if (e.key === 'Escape') {
                        setAdding(false);
                        setChildInput('');
                      }
                    }}
                  />
                  <button type="button" className="btn-primary btn-sm" onClick={() => void submitChild()}>
                    추가
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => {
                      setAdding(false);
                      setChildInput('');
                    }}
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button type="button" className="add-child-btn" onClick={() => setAdding(true)}>
                  <PlusIcon /> 하위 작업
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const today = getTodayString();
  const dayTasks = useDayTasks(today);
  const [newTitle, setNewTitle] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());
  const summary = useMemo(() => calculateStatusSummary(dayTasks.tasks), [dayTasks.tasks]);
  const progressPct = summary.total ? Math.round((summary.completed / summary.total) * 100) : 0;

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

  const visibleRoots = useMemo(() => {
    const filtered = filter === 'all'
      ? dayTasks.tasks
      : dayTasks.tasks.filter((t) => matchesFilter(t, filter));
    if (favorites.size === 0) return filtered;
    const fav: Task[] = [];
    const rest: Task[] = [];
    for (const t of filtered) {
      if (favorites.has(t.id)) fav.push(t);
      else rest.push(t);
    }
    return [...fav, ...rest];
  }, [dayTasks.tasks, favorites, filter]);

  const addTask = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    await dayTasks.addTask(trimmed);
    setNewTitle('');
  };

  const toggleStatus = async (task: Task) => {
    const status: TaskStatus = getEffectiveStatus(task);
    if (status === 'completed') await dayTasks.uncomplete(task.id);
    else await dayTasks.complete(task.id);
  };

  const filterButtons: { k: FilterKey; l: string; n: number }[] = [
    { k: 'all', l: '전체', n: summary.total },
    { k: 'in_progress', l: '진행', n: summary.inProgress },
    { k: 'pending', l: '대기', n: summary.pending },
    { k: 'completed', l: '완료', n: summary.completed },
  ];

  return (
    <main className="dashboard-page">
      <div className="widget">
        <div className="hdr">
          <div className="hdr-top">
            <div className="hdr-date">
              <div className="hdr-date-main">{formatTodayHeader(today)}</div>
              <div className="hdr-date-sub">
                오늘 진행 {summary.inProgress}건 · 대기 {summary.pending}건
              </div>
            </div>
            <div className="hdr-actions">
              <button
                type="button"
                className="iconbtn"
                onClick={() => void openFullApp()}
                aria-label="전체 앱 열기"
                title="전체 앱 열기"
              >
                <ExternalIcon />
              </button>
              <button
                type="button"
                className="iconbtn"
                onClick={() => void hideDashboard()}
                aria-label="숨기기"
                title="숨기기"
              >
                <MinimizeIcon />
              </button>
            </div>
          </div>
          <div className="hdr-stats">
            <div className="stat stat-all">
              <div className="stat-val">{summary.total}</div>
              <div className="stat-lbl">전체</div>
            </div>
            <div className="stat stat-done">
              <div className="stat-val">{summary.completed}</div>
              <div className="stat-lbl">완료</div>
            </div>
            <div className="stat stat-doing">
              <div className="stat-val">{summary.inProgress}</div>
              <div className="stat-lbl">진행</div>
            </div>
            <div className="stat stat-todo">
              <div className="stat-val">{summary.pending}</div>
              <div className="stat-lbl">대기</div>
            </div>
            <div className="hdr-prog">
              <div className="hdr-prog-bar">
                <div className="hdr-prog-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="hdr-prog-txt">{progressPct}%</div>
            </div>
          </div>
        </div>

        <div className="pane">
          <form className="quick" onSubmit={addTask}>
            <input
              className="quick-in"
              placeholder="빠른 작업 추가 — 엔터로 등록"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
            <button type="submit" className="quick-btn" aria-label="추가">
              <PlusIcon />
            </button>
          </form>

          <div className="filters">
            {filterButtons.map((f) => (
              <button
                key={f.k}
                type="button"
                className={`filter ${filter === f.k ? 'filter-on' : ''}`}
                onClick={() => setFilter(f.k)}
              >
                {f.l} <span className="filter-n">{f.n}</span>
              </button>
            ))}
          </div>

          <div className="list">
            {dayTasks.loading && dayTasks.tasks.length === 0 && (
              <div className="empty">
                <div className="empty-t">불러오는 중…</div>
              </div>
            )}
            {!dayTasks.loading && visibleRoots.length === 0 && (
              <div className="empty">
                <div className="empty-t">
                  {filter === 'all' ? '작업이 없어요' : '해당 항목이 없어요'}
                </div>
                {filter === 'all' && <div className="empty-s">위에서 한 줄로 추가해보세요</div>}
              </div>
            )}
            {visibleRoots.map((task) => (
              <TaskNode
                key={task.id}
                task={task}
                depth={0}
                today={today}
                isFavorite={favorites.has(task.id)}
                filter={filter}
                onToggleStatus={toggleStatus}
                onSaveTitle={(item, title) => dayTasks.updateSettings(item.id, { title })}
                onSaveDescription={(item, value) => dayTasks.saveDescription(item.id, value)}
                onAddChild={dayTasks.addChild}
                onDelete={(id) => dayTasks.deleteTaskById(id, { confirm: false })}
                onToggleFavorite={toggleFavorite}
                onCreateSnapshot={dayTasks.createSnapshot}
                onDeleteSnapshot={dayTasks.deleteSnapshot}
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
