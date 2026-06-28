import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useDayTasks } from '../hooks/useDayTasks';
import { hideDashboard, openFullApp } from '../lib/windowCommands';
import { getCurrentTauriWindow } from '../lib/runtimeWindow';
import { getTodayString } from '../utils/dateUtils';
import {
  calculateStatusSummary,
  getEffectiveStatus,
  getLeafTasks,
  getStatusLabel,
  hasChildren,
} from '../utils/taskUtils';
import {
  createSchedule,
  deleteSchedule,
  fetchHolidays,
  fetchSchedulesForDateRange,
  fetchTasksByDate,
  forceSync,
} from '../lib/database';
import { getHolidaysForDate } from '../utils/koreanHolidays';
import type { Holiday, HolidayType, Schedule, Task, TaskStatus } from '../types';
import MarkdownViewer from '../components/markdown/MarkdownViewer';
import MarkdownEditor from '../components/markdown/MarkdownEditor';
import { openDetailWindow } from '../lib/detailWindow';
import { openCalendarWindow } from '../lib/calendarWindow';
import './DashboardPage.css';

type FilterKey = 'all' | 'active' | 'in_progress' | 'pending' | 'completed' | 'discarded';
type ViewMode = 'tree' | 'leaf';
type ParentInfo = NonNullable<Task['parent_info']>;

const KOR_DAYS = ['일', '월', '화', '수', '목', '금', '토'];

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function findTaskInTree(tasks: Task[], id: string): Task | null {
  for (const t of tasks) {
    if (t.id === id) return t;
    if (t.children?.length) {
      const found = findTaskInTree(t.children, id);
      if (found) return found;
    }
  }
  return null;
}

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

function matchesFilter(task: Task, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  const status = getEffectiveStatus(task);
  if (filter === 'active') {
    if (status === 'pending' || status === 'in_progress') return true;
  } else if (status === filter) {
    return true;
  }
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
function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline points="15 3 21 3 21 9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function TreeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
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
  onOpenParentPopup,
  onDiscard,
  onUndiscard,
}: {
  task: Task;
  depth: number;
  today: string;
  filter: FilterKey;
  onToggleStatus: (task: Task) => Promise<void>;
  onSaveTitle: (task: Task, title: string) => Promise<void>;
  onSaveDescription: (task: Task, description: string) => Promise<void>;
  onAddChild: (parentId: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleFavorite: (id: string, value: boolean) => void;
  onCreateSnapshot: (id: string) => Promise<void>;
  onDeleteSnapshot: (id: string) => Promise<void>;
  onOpenDetailPopup: (task: Task) => void;
  onOpenParentPopup: (info: ParentInfo) => void;
  onDiscard: (id: string) => Promise<void>;
  onUndiscard: (id: string) => Promise<void>;
}) {
  const isFavorite = depth === 0 && !!task.is_favorite;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'detail' | 'log'>('detail');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [editingDetail, setEditingDetail] = useState(false);
  const [detailDraft, setDetailDraft] = useState(task.description ?? '');
  const [adding, setAdding] = useState(false);
  const [childInput, setChildInput] = useState('');
  const [titleCopied, setTitleCopied] = useState(false);

  const handleCopyTitle = async () => {
    const ok = await copyToClipboard(task.title || '');
    if (ok) {
      setTitleCopied(true);
      window.setTimeout(() => setTitleCopied(false), 1200);
    }
  };

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
    <div className={`node node-d${depth} ${isFavorite ? 'node-fav' : ''}`} style={{ ['--depth' as string]: depth } as CSSProperties}>
      <div className={`row row-${statusClass} ${isFavorite ? 'row-fav' : ''}`}>
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
        {task.parent_info && (
          <button
            type="button"
            className="parent-link"
            onClick={(e) => {
              e.stopPropagation();
              onOpenParentPopup(task.parent_info!);
            }}
            title={`상위 작업: ${task.parent_info.title} (${task.parent_info.created_date})`}
            aria-label="상위 작업 정보 보기"
          >
            <LinkIcon />
            <span className="parent-link-txt">상위</span>
          </button>
        )}
        <div className="row-actions">
          {depth === 0 && !task.is_snapshot && (
            <button
              type="button"
              className={`iconbtn iconbtn-sm ${isFavorite ? 'is-fav' : ''}`}
              onClick={() => onToggleFavorite(task.id, !isFavorite)}
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
              <button
                type="button"
                className={`detail-title ${titleCopied ? 'detail-title-copied' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleCopyTitle();
                }}
                title="클릭해서 제목 복사"
                aria-label="작업 제목 복사"
              >
                <span className="detail-title-txt">{task.title || '제목 없음'}</span>
                <span className="detail-title-hint">{titleCopied ? '복사됨!' : '복사'}</span>
              </button>
              {editingDetail ? (
                <>
                  <MarkdownEditor
                    value={detailDraft}
                    onChange={setDetailDraft}
                    height={140}
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
                  onOpenParentPopup={onOpenParentPopup}
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

function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="view-toggle" role="group" aria-label="보기 모드">
      <button
        type="button"
        className={`view-toggle-btn ${value === 'tree' ? 'on' : ''}`}
        onClick={() => onChange('tree')}
        title="트리 보기 — 상위작업부터"
        aria-label="트리 보기"
        aria-pressed={value === 'tree'}
      >
        <TreeIcon />
      </button>
      <button
        type="button"
        className={`view-toggle-btn ${value === 'leaf' ? 'on' : ''}`}
        onClick={() => onChange('leaf')}
        title="최하위 작업 기준 보기"
        aria-label="최하위 작업 보기"
        aria-pressed={value === 'leaf'}
      >
        <ListIcon />
      </button>
    </div>
  );
}

function ParentTaskPopup({
  info,
  task,
  loading,
  today,
  onClose,
  onOpenDate,
}: {
  info: ParentInfo;
  task: Task | null;
  loading: boolean;
  today: string;
  onClose: () => void;
  onOpenDate: (date: string) => void;
}) {
  const status = task ? getEffectiveStatus(task) : null;
  const childCount = task?.children?.length ?? 0;
  const doneChildren = (task?.children || []).filter(
    (c) => getEffectiveStatus(c) === 'completed',
  ).length;
  const statusClass: 'done' | 'doing' | 'todo' | 'discarded' =
    status === 'completed'
      ? 'done'
      : status === 'discarded'
      ? 'discarded'
      : status === 'in_progress'
      ? 'doing'
      : 'todo';

  return (
    <div className="parent-pop-overlay" onClick={onClose}>
      <div
        className="parent-pop"
        role="dialog"
        aria-label="상위 작업 정보"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="parent-pop-head">
          <span className="parent-pop-eyebrow">상위 작업</span>
          <button
            type="button"
            className="iconbtn iconbtn-sm"
            onClick={onClose}
            aria-label="닫기"
            title="닫기"
          >
            <XmarkIcon />
          </button>
        </div>

        <div className="parent-pop-title">{task?.title || info.title || '제목 없음'}</div>

        <div className="parent-pop-meta">
          <button
            type="button"
            className="parent-pop-date"
            onClick={() => onOpenDate(info.created_date)}
            title={`${info.created_date} 열기`}
          >
            <CalendarIcon />
            <span>{formatDayLabel(info.created_date, today)}</span>
            <span className="parent-pop-date-iso">{info.created_date}</span>
          </button>
          {status && (
            <span className={`parent-pop-status st-${statusClass}`}>
              {getStatusLabel(status)}
            </span>
          )}
          {childCount > 0 && (
            <span className="parent-pop-cnt">
              {doneChildren}/{childCount}
            </span>
          )}
        </div>

        <div className="parent-pop-body">
          {loading ? (
            <div className="md-empty">불러오는 중…</div>
          ) : task?.description && task.description.trim() ? (
            <div className="md">
              <MarkdownViewer content={task.description} />
            </div>
          ) : (
            <div className="md-empty">상세 내용 없음</div>
          )}
        </div>

        <div className="parent-pop-foot">
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={() => onOpenDate(info.created_date)}
          >
            <ExternalIcon /> 해당 날짜 열기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const today = getTodayString();
  const dayTasks = useDayTasks(today);
  const [newTitle, setNewTitle] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [tab, setTab] = useState<'tasks' | 'schedules' | 'events' | 'later'>('tasks');
  const [scheduleCount, setScheduleCount] = useState<number | null>(null);
  const [eventCount, setEventCount] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [parentPopup, setParentPopup] = useState<{
    info: ParentInfo;
    task: Task | null;
    loading: boolean;
  } | null>(null);

  const openParentPopup = useCallback(async (info: ParentInfo) => {
    setParentPopup({ info, task: null, loading: true });
    try {
      const data = await fetchTasksByDate(info.created_date);
      const found = findTaskInTree(data, info.id);
      setParentPopup((prev) =>
        prev && prev.info.id === info.id ? { info, task: found, loading: false } : prev,
      );
    } catch (err) {
      console.error('Failed to load parent task:', err);
      setParentPopup((prev) =>
        prev && prev.info.id === info.id ? { ...prev, loading: false } : prev,
      );
    }
  }, []);

  const handleOpenParentDate = useCallback(
    (date: string) => {
      void openFullApp(date === today ? '/' : `/history/${date}`);
      setParentPopup(null);
    },
    [today],
  );

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
  const mainTasks = useMemo(() => dayTasks.tasks.filter((t) => !t.low_priority), [dayTasks.tasks]);
  const laterTasks = useMemo(() => dayTasks.tasks.filter((t) => t.low_priority), [dayTasks.tasks]);
  const summary = useMemo(() => calculateStatusSummary(mainTasks), [mainTasks]);
  const progressPct = summary.total ? Math.round((summary.completed / summary.total) * 100) : 0;

  const toggleFavorite = useCallback((id: string, value: boolean) => {
    void dayTasks.setFavorite(id, value);
  }, [dayTasks]);

  // 트리 보기는 상위작업부터, 최하위 보기(leaf)는 가장 하위 작업만 평탄화해서 보여준다.
  const buildVisible = useCallback(
    (source: Task[]) => {
      const base = viewMode === 'leaf' ? getLeafTasks(source) : source;
      const filtered = filter === 'all' ? base : base.filter((t) => matchesFilter(t, filter));
      const fav: Task[] = [];
      const rest: Task[] = [];
      for (const t of filtered) {
        const status = getEffectiveStatus(t);
        const isTerminal = status === 'completed' || status === 'discarded';
        // 즐겨찾기 상단 고정은 트리 보기(최상위 작업)에서만 의미가 있다.
        if (viewMode === 'tree' && t.is_favorite && !isTerminal) fav.push(t);
        else rest.push(t);
      }
      return [...sortTasksByStatus(fav), ...sortTasksByStatus(rest)];
    },
    [viewMode, filter],
  );

  const visibleRoots = useMemo(() => buildVisible(mainTasks), [buildVisible, mainTasks]);
  const laterVisible = useMemo(() => buildVisible(laterTasks), [buildVisible, laterTasks]);

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
    { k: 'active', l: '남은 작업', n: summary.inProgress + summary.pending },
    { k: 'in_progress', l: '진행', n: summary.inProgress },
    { k: 'pending', l: '대기', n: summary.pending },
    { k: 'completed', l: '완료', n: summary.completed },
    { k: 'discarded', l: '폐기', n: summary.discarded },
  ];

  // 창 위치 이동 — 타이틀 영역(헤더)을 드래그하면 OS 창 드래그를 시작한다.
  // 버튼/입력 등 인터랙티브 요소 위에서 시작된 드래그는 무시한다.
  const startWindowDrag = useCallback(async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, a, .hdr-actions')) return;
    const w = await getCurrentTauriWindow();
    if (!w) return;
    try {
      await w.startDragging();
    } catch (err) {
      console.warn('Failed to start window drag:', err);
    }
  }, []);

  // 위젯(불투명 영역) 테두리에 맞춘 크기 조절 핸들. 투명 패딩이 아닌 흰색
  // 위젯의 가장자리에서부터 리사이즈가 시작되도록 8방향 핸들을 직접 구현한다.
  // (네이티브 리사이즈는 창 바깥쪽 투명 영역에서 동작해 인지되는 테두리와
  // 어긋나므로, tauri.conf.json 에서 resizable:false 로 끄고 여기서 처리한다.)
  const startEdgeResize = useCallback(
    (dir: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') =>
      async (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const w = await getCurrentTauriWindow();
        if (!w) return;
        try {
          const { PhysicalPosition, PhysicalSize } = await import('@tauri-apps/api/dpi');
          const startScreenX = e.screenX;
          const startScreenY = e.screenY;
          const [startPos, startSize, scaleFactor] = await Promise.all([
            w.outerPosition(),
            w.outerSize(),
            w.scaleFactor(),
          ]);
          const minWidthPhysical = Math.round(360 * scaleFactor);
          const minHeightPhysical = Math.round(320 * scaleFactor);
          const north = dir.includes('n');
          const south = dir.includes('s');
          const east = dir.includes('e');
          const west = dir.includes('w');

          let pending = false;
          let latestDx = 0;
          let latestDy = 0;

          const apply = async () => {
            if (pending) return;
            pending = true;
            const dx = Math.round(latestDx * scaleFactor);
            const dy = Math.round(latestDy * scaleFactor);

            let newWidth = startSize.width;
            let newHeight = startSize.height;
            if (east) newWidth = startSize.width + dx;
            if (west) newWidth = startSize.width - dx;
            if (south) newHeight = startSize.height + dy;
            if (north) newHeight = startSize.height - dy;
            if (newWidth < minWidthPhysical) newWidth = minWidthPhysical;
            if (newHeight < minHeightPhysical) newHeight = minHeightPhysical;

            // 좌/상단 핸들은 반대쪽을 고정해야 하므로 위치도 함께 옮긴다.
            let newX = startPos.x;
            let newY = startPos.y;
            if (west) newX = startPos.x + (startSize.width - newWidth);
            if (north) newY = startPos.y + (startSize.height - newHeight);

            try {
              await w.setSize(new PhysicalSize(newWidth, newHeight));
              if (west || north) {
                await w.setPosition(new PhysicalPosition(newX, newY));
              }
            } catch (err) {
              console.warn('Resize update failed:', err);
            } finally {
              pending = false;
            }
          };

          const onMove = (ev: MouseEvent) => {
            latestDx = ev.screenX - startScreenX;
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
          console.warn('Failed to start edge resize:', err);
        }
      },
    [],
  );

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
      <div className="widget-frame">
        <div className="rsz rsz-n" onMouseDown={startEdgeResize('n')} aria-hidden="true" />
        <div className="rsz rsz-s" onMouseDown={startEdgeResize('s')} aria-hidden="true" />
        <div className="rsz rsz-w" onMouseDown={startEdgeResize('w')} aria-hidden="true" />
        <div className="rsz rsz-e" onMouseDown={startEdgeResize('e')} aria-hidden="true" />
        <div className="rsz rsz-nw" onMouseDown={startEdgeResize('nw')} aria-hidden="true" />
        <div className="rsz rsz-ne" onMouseDown={startEdgeResize('ne')} aria-hidden="true" />
        <div className="rsz rsz-sw" onMouseDown={startEdgeResize('sw')} aria-hidden="true" />
        <div className="rsz rsz-se" onMouseDown={startEdgeResize('se')} aria-hidden="true" />
        <div className="widget">
        <div className="hdr">
          <div className="hdr-top hdr-drag" onMouseDown={(e) => void startWindowDrag(e)}>
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
                onClick={() => void openCalendarWindow()}
                aria-label="달력 팝업 열기"
                title="달력 팝업 열기 (대시보드 유지)"
              >
                <CalendarIcon />
              </button>
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
          <button
            type="button"
            className={`tab ${tab === 'later' ? 'tab-on' : ''}`}
            onClick={() => setTab('later')}
          >
            나중할일 <span className="tab-cnt">{laterTasks.length}</span>
          </button>
        </div>

        {tab === 'schedules' ? (
          <SchedulesPane today={today} reloadKey={reloadKey} />
        ) : tab === 'events' ? (
          <EventsPane today={today} reloadKey={reloadKey} />
        ) : tab === 'later' ? (
          <div className="pane">
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
              <ViewModeToggle value={viewMode} onChange={setViewMode} />
            </div>
            <div className="list">
              {dayTasks.loading && laterTasks.length === 0 && (
                <div className="empty">
                  <div className="empty-t">불러오는 중…</div>
                </div>
              )}
              {!dayTasks.loading && laterVisible.length === 0 && (
                <div className="empty">
                  <div className="empty-t">
                    {laterTasks.length === 0 ? '나중에 할 일이 없어요' : '해당 항목이 없어요'}
                  </div>
                  {laterTasks.length === 0 && (
                    <div className="empty-s">작업 설정에서 낮은 우선순위로 표시하면 여기 모입니다</div>
                  )}
                </div>
              )}
              {laterVisible.map((task) => (
                <TaskNode
                  key={task.id}
                  task={task}
                  depth={0}
                  today={today}
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
                  onOpenParentPopup={openParentPopup}
                  onDiscard={dayTasks.discard}
                  onUndiscard={dayTasks.undiscard}
                />
              ))}
            </div>
          </div>
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
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
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
                onOpenParentPopup={openParentPopup}
                onDiscard={dayTasks.discard}
                onUndiscard={dayTasks.undiscard}
              />
            ))}
          </div>
        </div>
        )}
        </div>
      </div>

      {parentPopup && (
        <ParentTaskPopup
          info={parentPopup.info}
          task={parentPopup.task}
          loading={parentPopup.loading}
          today={today}
          onClose={() => setParentPopup(null)}
          onOpenDate={handleOpenParentDate}
        />
      )}
    </main>
  );
}
