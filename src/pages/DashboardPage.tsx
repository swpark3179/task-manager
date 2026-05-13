import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useDayTasks } from '../hooks/useDayTasks';
import { hideDashboard, openFullApp } from '../lib/windowCommands';
import { getCurrentTauriWindow } from '../lib/runtimeWindow';
import { getTodayString } from '../utils/dateUtils';
import { calculateStatusSummary, getEffectiveStatus, hasChildren } from '../utils/taskUtils';
import {
  createSchedule,
  deleteSchedule,
  fetchHolidays,
  fetchSchedulesForDateRange,
  forceSync,
} from '../lib/database';
import { getHolidaysForDate } from '../utils/koreanHolidays';
import type { Holiday, HolidayType, Schedule, Task, TaskStatus } from '../types';
import MarkdownViewer from '../components/markdown/MarkdownViewer';
import { openDetailWindow } from '../lib/detailWindow';
import './DashboardPage.css';

const FAVORITES_STORAGE_KEY = 'task-manager.dashboard.favorites';

type FilterKey = 'all' | 'in_progress' | 'pending' | 'completed' | 'discarded';

const KOR_DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function formatTodayHeader(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${KOR_DAYS[d.getDay()]})`;
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function isSameDayIso(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

function formatDayLabel(iso: string, today: string): string {
  const d = new Date(iso + 'T00:00:00');
  const tomorrow = addDaysIso(today, 1);
  if (iso === today) return '오늘';
  if (iso === tomorrow) return '내일';
  return `${d.getMonth() + 1}/${d.getDate()} (${KOR_DAYS[d.getDay()]})`;
}

function formatScheduleTime(time: string | null): string {
  if (!time) return '종일';
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h)) return time;
  const ap = h >= 12 ? '오후' : '오전';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${ap} ${hh}:${String(Number.isNaN(m) ? 0 : m).padStart(2, '0')}`;
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

const STATUS_ORDER: Record<TaskStatus, number> = {
  pending: 0,
  in_progress: 1,
  completed: 2,
  discarded: 3,
};

function sortTasksByStatus(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) => STATUS_ORDER[getEffectiveStatus(a)] - STATUS_ORDER[getEffectiveStatus(b)],
  );
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
function DiscardIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function UndoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 14l-4-4 4-4 M5 10h9a5 5 0 0 1 0 10h-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function XmarkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12 M18 6L6 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
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
function ExpandIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 14v6h6 M20 10V4h-6 M20 4l-7 7 M4 20l7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
function SyncIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={spinning ? 'spin' : undefined}
    >
      <path
        d="M21 12a9 9 0 0 1-15.5 6.3M3 12a9 9 0 0 1 15.5-6.3M21 4v5h-5M3 20v-5h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
  onOpenDetailPopup,
  onDiscard,
  onUndiscard,
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
  onOpenDetailPopup: (task: Task) => void;
  onDiscard: (id: string) => Promise<void>;
  onUndiscard: (id: string) => Promise<void>;
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
  const childrenVisible = sortTasksByStatus(
    (task.children || []).filter((c) => matchesFilter(c, filter)),
  );

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
          {isDone ? <CheckIcon /> : isDoing ? <DotIcon /> : isDiscarded ? <XmarkIcon /> : null}
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
          {!task.is_snapshot && !hasChildren(task) && (
            isDiscarded ? (
              <button
                type="button"
                className="iconbtn iconbtn-sm"
                onClick={() => void onUndiscard(task.id)}
                aria-label="폐기 해제"
                title="폐기 해제"
              >
                <UndoIcon />
              </button>
            ) : (
              <button
                type="button"
                className="iconbtn iconbtn-sm"
                onClick={() => void onDiscard(task.id)}
                aria-label="폐기"
                title="폐기 처리"
              >
                <DiscardIcon />
              </button>
            )
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
                <div className="detail-wrap">
                  <button
                    type="button"
                    className="iconbtn iconbtn-sm detail-expand"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDetailPopup(task);
                    }}
                    aria-label="상세 팝업 열기"
                    title="상세 팝업 열기"
                  >
                    <ExpandIcon />
                  </button>
                  <div
                    className="detail-brief"
                    onClick={() => onOpenDetailPopup(task)}
                    title="클릭해서 상세 보기"
                  >
                    {task.description && task.description.trim() ? (
                      <div className="md md-brief">
                        <MarkdownViewer content={task.description} />
                      </div>
                    ) : (
                      <div className="md-empty">
                        <span>상세 내용 없음 — 클릭해서 추가</span>
                      </div>
                    )}
                  </div>
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
                  onOpenDetailPopup={onOpenDetailPopup}
                  onDiscard={onDiscard}
                  onUndiscard={onUndiscard}
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

function ScheduleCard({
  sched,
  today,
  onDelete,
}: {
  sched: Schedule;
  today: string;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const sameDayEnd = isSameDayIso(sched.start_date, sched.end_date);
  const timeMain = formatScheduleTime(sched.scheduled_time);
  const timeSub = sameDayEnd
    ? sched.scheduled_time
      ? ''
      : ''
    : `~ ${formatDayLabel(sched.end_date, today)}`;
  return (
    <div className="sch-card">
      <button type="button" className="sch-card-top" onClick={() => setOpen((v) => !v)}>
        <div className="sch-card-time">
          <div className="sch-card-t1">{timeMain}</div>
          {timeSub && <div className="sch-card-t2">{timeSub}</div>}
        </div>
        <div className="sch-card-body">
          <div className="sch-card-title">{sched.title}</div>
          {!open && sched.description && (
            <div className="sch-card-prev">{sched.description.split('\n')[0]}</div>
          )}
        </div>
        <span className={`caret ${open ? 'caret-on' : ''}`}>
          <ChevronIcon />
        </span>
      </button>
      {open && (
        <div className="sch-card-open">
          {sched.description && <div className="sch-card-detail">{sched.description}</div>}
          <div className="sch-card-act">
            <button
              type="button"
              className="btn-ghost btn-sm btn-danger"
              onClick={() => {
                if (confirm(`"${sched.title}" 삭제할까요?`)) onDelete(sched.id);
              }}
            >
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SchedulesPane({ today, reloadKey = 0 }: { today: string; reloadKey?: number }) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    title: '',
    start_date: today,
    end_date: today,
    scheduled_time: '09:00',
    description: '',
  });

  const rangeEnd = useMemo(() => addDaysIso(today, 14), [today]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSchedulesForDateRange(today, rangeEnd);
      setSchedules(data);
    } catch (err) {
      console.error('Failed to load schedules:', err);
    } finally {
      setLoading(false);
    }
  }, [today, rangeEnd]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const grouped = useMemo(() => {
    const g: Record<string, Schedule[]> = {};
    [...schedules]
      .sort((a, b) => {
        const da = a.start_date.localeCompare(b.start_date);
        if (da !== 0) return da;
        return (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? '');
      })
      .forEach((s) => {
        const day = s.start_date;
        (g[day] = g[day] || []).push(s);
      });
    return g;
  }, [schedules]);

  const submit = async () => {
    if (!draft.title.trim()) return;
    try {
      await createSchedule({
        title: draft.title.trim(),
        start_date: draft.start_date,
        end_date: draft.end_date || draft.start_date,
        scheduled_time: draft.scheduled_time || null,
        description: draft.description || null,
      });
      setDraft({
        title: '',
        start_date: today,
        end_date: today,
        scheduled_time: '09:00',
        description: '',
      });
      setAdding(false);
      await load();
    } catch (err) {
      console.error('Failed to add schedule:', err);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteSchedule(id);
      await load();
    } catch (err) {
      console.error('Failed to delete schedule:', err);
    }
  };

  return (
    <div className="pane">
      <div className="sch-head">
        <div className="sch-head-l">예정된 일정</div>
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={() => setAdding((v) => !v)}
        >
          {adding ? '취소' : '+ 일정 추가'}
        </button>
      </div>

      {adding && (
        <div className="sch-form">
          <input
            className="sch-in"
            placeholder="일정 제목"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            autoFocus
          />
          <div className="sch-row">
            <label className="sch-lbl">날짜</label>
            <input
              type="date"
              className="sch-in sch-in-dt"
              value={draft.start_date}
              onChange={(e) => setDraft({ ...draft, start_date: e.target.value, end_date: e.target.value })}
            />
          </div>
          <div className="sch-row">
            <label className="sch-lbl">시각</label>
            <input
              type="time"
              className="sch-in sch-in-dt"
              value={draft.scheduled_time}
              onChange={(e) => setDraft({ ...draft, scheduled_time: e.target.value })}
            />
          </div>
          <textarea
            className="sch-in sch-ta"
            placeholder="세부 내용"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
          <div className="sch-act">
            <button type="button" className="btn-primary" onClick={() => void submit()}>
              저장
            </button>
          </div>
        </div>
      )}

      <div className="sch-list">
        {loading && schedules.length === 0 && (
          <div className="empty">
            <div className="empty-t">불러오는 중…</div>
          </div>
        )}
        {!loading && schedules.length === 0 && (
          <div className="empty">
            <div className="empty-t">일정이 없어요</div>
            <div className="empty-s">'+ 일정 추가'로 등록해보세요</div>
          </div>
        )}
        {Object.entries(grouped).map(([day, items]) => (
          <div key={day} className="sch-group">
            <div className="sch-day">
              <span className="sch-day-l">{formatDayLabel(day, today)}</span>
              <span className="sch-day-d">{day}</span>
              <span className="sch-day-n">{items.length}건</span>
            </div>
            {items.map((s) => (
              <ScheduleCard key={s.id} sched={s} today={today} onDelete={(id) => void remove(id)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const HOLIDAY_TYPE_LABEL: Record<HolidayType, string> = {
  holiday: '공휴일',
  anniversary: '기념일',
  birthday: '생일',
};

interface UpcomingEvent {
  date: string;
  title: string;
  type: HolidayType;
}

function EventsPane({ today, reloadKey = 0 }: { today: string; reloadKey?: number }) {
  const [userHolidays, setUserHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchHolidays()
      .then((data) => {
        if (!cancelled) setUserHolidays(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const events = useMemo<UpcomingEvent[]>(() => {
    const out: UpcomingEvent[] = [];
    for (let i = 0; i <= 10; i++) {
      const d = addDaysIso(today, i);
      for (const h of getHolidaysForDate(d, userHolidays)) {
        out.push({ date: d, title: h.title, type: h.type });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [today, userHolidays]);

  return (
    <div className="pane">
      <div className="sch-head">
        <div className="sch-head-l">다가오는 이벤트 (10일 이내)</div>
      </div>
      <div className="sch-list">
        {loading && events.length === 0 && (
          <div className="empty">
            <div className="empty-t">불러오는 중…</div>
          </div>
        )}
        {!loading && events.length === 0 && (
          <div className="empty">
            <div className="empty-t">이벤트가 없어요</div>
            <div className="empty-s">10일 이내에 공휴일/기념일/생일이 없습니다</div>
          </div>
        )}
        {events.map((ev, i) => (
          <div key={`${ev.date}-${i}`} className={`ev-card ev-type-${ev.type}`}>
            <div className="ev-date">
              <div className="ev-date-l">{formatDayLabel(ev.date, today)}</div>
              <div className="ev-date-d">{ev.date}</div>
            </div>
            <div className="ev-body">
              <div className="ev-title">{ev.title}</div>
              <div className="ev-type">{HOLIDAY_TYPE_LABEL[ev.type]}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const today = getTodayString();
  const dayTasks = useDayTasks(today);
  const [newTitle, setNewTitle] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [tab, setTab] = useState<'tasks' | 'schedules' | 'events'>('tasks');
  const [scheduleCount, setScheduleCount] = useState<number | null>(null);
  const [eventCount, setEventCount] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());
  const [syncing, setSyncing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const rangeEnd = addDaysIso(today, 14);
    fetchSchedulesForDateRange(today, rangeEnd)
      .then((data) => {
        if (!cancelled) setScheduleCount(data.length);
      })
      .catch(() => {});
    fetchHolidays()
      .then((userHolidays) => {
        if (cancelled) return;
        let n = 0;
        for (let i = 0; i <= 10; i++) {
          n += getHolidaysForDate(addDaysIso(today, i), userHolidays).length;
        }
        setEventCount(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [today, reloadKey]);
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
    const fav: Task[] = [];
    const rest: Task[] = [];
    for (const t of filtered) {
      if (favorites.has(t.id)) fav.push(t);
      else rest.push(t);
    }
    return [...sortTasksByStatus(fav), ...sortTasksByStatus(rest)];
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
    { k: 'discarded', l: '폐기', n: summary.discarded },
  ];

  const startTopResize = useCallback(async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const w = await getCurrentTauriWindow();
    if (!w) return;
    try {
      const dpiMod = await import('@tauri-apps/api/dpi');
      const { PhysicalPosition, PhysicalSize } = dpiMod;
      const startScreenY = e.screenY;
      const [startPos, startSize, scaleFactor] = await Promise.all([
        w.outerPosition(),
        w.outerSize(),
        w.scaleFactor(),
      ]);
      const minHeightPhysical = Math.round(320 * scaleFactor);
      let pending = false;
      let latestDy = 0;

      const apply = async () => {
        if (pending) return;
        pending = true;
        const dyPhysical = Math.round(latestDy * scaleFactor);
        let newHeight = startSize.height - dyPhysical;
        let newY = startPos.y + dyPhysical;
        if (newHeight < minHeightPhysical) {
          newHeight = minHeightPhysical;
          newY = startPos.y + (startSize.height - minHeightPhysical);
        }
        try {
          await w.setSize(new PhysicalSize(startSize.width, newHeight));
          await w.setPosition(new PhysicalPosition(startPos.x, newY));
        } catch (err) {
          console.warn('Resize update failed:', err);
        } finally {
          pending = false;
        }
      };

      const onMove = (ev: MouseEvent) => {
        latestDy = ev.screenY - startScreenY;
        void apply();
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    } catch (err) {
      console.warn('Failed to start top resize:', err);
    }
  }, []);

  const handleSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await forceSync();
      await dayTasks.refreshTasks();
      const rangeEnd = addDaysIso(today, 14);
      try {
        const data = await fetchSchedulesForDateRange(today, rangeEnd);
        setScheduleCount(data.length);
      } catch {
        // ignore
      }
      setReloadKey((v) => v + 1);
    } catch (err) {
      console.error('Failed to sync:', err);
    } finally {
      setSyncing(false);
    }
  }, [syncing, dayTasks, today]);

  return (
    <main className="dashboard-page">
      <div
        className="resize-top"
        onMouseDown={(e) => void startTopResize(e)}
        aria-hidden="true"
      />
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
                onClick={() => void handleSync()}
                disabled={syncing}
                aria-label="동기화"
                title={syncing ? '동기화 중…' : '서버와 동기화'}
              >
                <SyncIcon spinning={syncing} />
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

        <div className="tabbar">
          <button
            type="button"
            className={`tab ${tab === 'tasks' ? 'tab-on' : ''}`}
            onClick={() => setTab('tasks')}
          >
            작업 <span className="tab-cnt">{summary.total}</span>
          </button>
          <button
            type="button"
            className={`tab ${tab === 'schedules' ? 'tab-on' : ''}`}
            onClick={() => setTab('schedules')}
          >
            일정 {scheduleCount !== null && <span className="tab-cnt">{scheduleCount}</span>}
          </button>
          <button
            type="button"
            className={`tab ${tab === 'events' ? 'tab-on' : ''}`}
            onClick={() => setTab('events')}
          >
            이벤트 {eventCount !== null && <span className="tab-cnt">{eventCount}</span>}
          </button>
        </div>

        {tab === 'schedules' ? (
          <SchedulesPane today={today} reloadKey={reloadKey} />
        ) : tab === 'events' ? (
          <EventsPane today={today} reloadKey={reloadKey} />
        ) : (
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
                onOpenDetailPopup={(t) => void openDetailWindow(t.id, today)}
                onDiscard={dayTasks.discard}
                onUndiscard={dayTasks.undiscard}
              />
            ))}
          </div>
        </div>
        )}
      </div>
    </main>
  );
}
