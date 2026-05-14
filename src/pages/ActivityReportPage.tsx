import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchTasksByDate } from '../lib/database';
import {
  formatDateFull,
  getNextDay,
  getPrevDay,
  getTodayString,
} from '../utils/dateUtils';
import { calculateStatusSummary, getEffectiveStatus } from '../utils/taskUtils';
import { getCurrentTauriWindow, loadTauriCore } from '../lib/runtimeWindow';
import type { Task, TaskStatus } from '../types';
import './ActivityReportPage.css';

type GroupKey = 'status' | 'priority' | 'snapshot';
type CopyFormat = 'plain' | 'bullet' | 'checklist';

interface ActivityItem {
  id: string;
  title: string;
  status: TaskStatus;
  depth: number;
  low_priority: boolean;
  has_snapshot: boolean;
  is_snapshot: boolean;
}

interface ActivityGroup {
  key: string;
  label: string;
  bulletClass: string;
  items: ActivityItem[];
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  completed: '완료',
  in_progress: '진행 중',
  pending: '대기',
  discarded: '폐기',
};
const STATUS_ORDER: TaskStatus[] = ['completed', 'in_progress', 'pending', 'discarded'];
const STATUS_BULLET: Record<TaskStatus, string> = {
  completed: 'done',
  in_progress: 'doing',
  pending: 'todo',
  discarded: 'discard',
};

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
function SyncIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={spinning ? 'spin' : undefined}>
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
function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 15V5a1 1 0 0 1 1-1h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function collectItems(tasks: Task[], depth = 0, out: ActivityItem[] = []): ActivityItem[] {
  for (const t of tasks) {
    out.push({
      id: t.id,
      title: t.title || '제목 없음',
      status: getEffectiveStatus(t),
      depth,
      low_priority: !!t.low_priority,
      has_snapshot: !!t.has_snapshot,
      is_snapshot: !!t.is_snapshot,
    });
    if (t.children && t.children.length > 0) {
      collectItems(t.children, depth + 1, out);
    }
  }
  return out;
}

function formatItemText(item: ActivityItem, fmt: CopyFormat): string {
  const indent = '  '.repeat(item.depth);
  switch (fmt) {
    case 'plain':
      return `${indent}${item.title}`;
    case 'bullet':
      return `${indent}- ${item.title}`;
    case 'checklist':
      return `${indent}- [${item.status === 'completed' ? 'x' : ' '}] ${item.title}`;
  }
}

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

async function hideSelf() {
  const tauriCore = await loadTauriCore();
  if (tauriCore) {
    try {
      await tauriCore.invoke('hide_activity_report');
      return;
    } catch (err) {
      console.warn('Failed to invoke hide_activity_report:', err);
    }
  }
  const w = await getCurrentTauriWindow();
  if (w) {
    try {
      await w.hide();
    } catch (err) {
      console.warn('Failed to hide activity report window:', err);
    }
  }
}

export default function ActivityReportPage() {
  const today = getTodayString();
  const [date, setDate] = useState<string>(today);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [group, setGroup] = useState<GroupKey>('status');
  const [fmt, setFmt] = useState<CopyFormat>('bullet');
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const data = await fetchTasksByDate(d);
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks for date:', err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  // When the window regains focus (i.e. the user re-opens it from the tray),
  // snap back to "today" so each session starts fresh.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const w = await getCurrentTauriWindow();
        if (!w || cancelled) return;
        const off = await w.onFocusChanged(({ payload }) => {
          if (payload) {
            const fresh = getTodayString();
            setDate((prev) => (prev === fresh ? prev : fresh));
          }
        });
        if (cancelled) {
          off();
        } else {
          unlisten = off;
        }
      } catch (err) {
        console.warn('Failed to subscribe to window focus events:', err);
      }
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const items = useMemo(() => collectItems(tasks), [tasks]);
  const summary = useMemo(() => calculateStatusSummary(tasks), [tasks]);

  const groups = useMemo<ActivityGroup[]>(() => {
    if (group === 'status') {
      const buckets: Record<TaskStatus, ActivityItem[]> = {
        completed: [],
        in_progress: [],
        pending: [],
        discarded: [],
      };
      for (const it of items) buckets[it.status].push(it);
      return STATUS_ORDER
        .map((s) => ({
          key: s,
          label: STATUS_LABEL[s],
          bulletClass: STATUS_BULLET[s],
          items: buckets[s],
        }))
        .filter((g) => g.items.length > 0);
    }
    if (group === 'priority') {
      const normal = items.filter((it) => !it.low_priority);
      const later = items.filter((it) => it.low_priority);
      return [
        { key: 'normal', label: '일반', bulletClass: 'priority-normal', items: normal },
        { key: 'later', label: '나중할일', bulletClass: 'priority-later', items: later },
      ].filter((g) => g.items.length > 0);
    }
    const logged = items.filter((it) => it.has_snapshot || it.is_snapshot);
    const others = items.filter((it) => !(it.has_snapshot || it.is_snapshot));
    return [
      { key: 'logged', label: '진행 기록 있음', bulletClass: 'snap-yes', items: logged },
      { key: 'others', label: '기록 없음', bulletClass: 'snap-no', items: others },
    ].filter((g) => g.items.length > 0);
  }, [items, group]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((cur) => (cur === msg ? null : cur));
    }, 1600);
  }, []);

  const copyItems = useCallback(
    async (its: ActivityItem[], label: string) => {
      if (its.length === 0) {
        showToast('복사할 항목이 없어요');
        return;
      }
      const text = its.map((it) => formatItemText(it, fmt)).join('\n');
      const ok = await copyToClipboard(text);
      showToast(ok ? `${label} ${its.length}개 복사됨` : '복사에 실패했어요');
    },
    [fmt, showToast],
  );

  const copyAll = useCallback(() => {
    const flat = groups.flatMap((g) => g.items);
    return copyItems(flat, '전체');
  }, [groups, copyItems]);

  const copySingle = useCallback(
    async (item: ActivityItem) => {
      const text = formatItemText(item, fmt);
      const ok = await copyToClipboard(text);
      showToast(ok ? '제목 복사됨' : '복사에 실패했어요');
    },
    [fmt, showToast],
  );

  const totalCount = items.length;

  return (
    <main className="activity-report-page">
      <div className="widget">
        <div className="hdr">
          <div className="hdr-top">
            <div className="hdr-titles">
              <div className="hdr-title">활동 보고서</div>
              <div className="hdr-date">{formatDateFull(date)}</div>
              <div className="hdr-sub">
                {loading ? '불러오는 중…' : `총 ${totalCount}건 · 완료 ${summary.completed} · 진행 ${summary.inProgress}`}
              </div>
            </div>
            <div className="hdr-actions">
              <button
                type="button"
                className="iconbtn"
                onClick={() => void load(date)}
                disabled={loading}
                aria-label="새로고침"
                title="새로고침"
              >
                <SyncIcon spinning={loading} />
              </button>
              <button
                type="button"
                className="iconbtn"
                onClick={() => void hideSelf()}
                aria-label="숨기기"
                title="숨기기"
              >
                <MinimizeIcon />
              </button>
            </div>
          </div>

          <div className="datenav">
            <button
              type="button"
              className="datenav-btn"
              onClick={() => setDate((d) => getPrevDay(d))}
              aria-label="이전 날짜"
              title="이전 날짜"
            >
              <ChevronLeftIcon />
            </button>
            {date !== today && (
              <button
                type="button"
                className="datenav-btn datenav-today"
                onClick={() => setDate(today)}
                title="오늘로 이동"
              >
                오늘
              </button>
            )}
            <button
              type="button"
              className="datenav-btn"
              onClick={() => setDate((d) => getNextDay(d))}
              aria-label="다음 날짜"
              title="다음 날짜"
            >
              <ChevronRightIcon />
            </button>
            <input
              type="date"
              className="datenav-input"
              value={date}
              max={today}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
              title="날짜 선택"
            />
          </div>

          <div className="stats">
            <div className="stat">
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
            <div className="stat stat-discard">
              <div className="stat-val">{summary.discarded}</div>
              <div className="stat-lbl">폐기</div>
            </div>
          </div>
        </div>

        <div className="toolbar">
          <div className="seg" role="tablist" aria-label="분류 기준">
            <span className="seg-lbl">분류</span>
            <button
              type="button"
              className={`seg-btn ${group === 'status' ? 'seg-btn-on' : ''}`}
              onClick={() => setGroup('status')}
            >
              상태별
            </button>
            <button
              type="button"
              className={`seg-btn ${group === 'priority' ? 'seg-btn-on' : ''}`}
              onClick={() => setGroup('priority')}
            >
              우선순위
            </button>
            <button
              type="button"
              className={`seg-btn ${group === 'snapshot' ? 'seg-btn-on' : ''}`}
              onClick={() => setGroup('snapshot')}
            >
              진행기록
            </button>
          </div>
          <div className="seg" role="tablist" aria-label="복사 포맷">
            <span className="seg-lbl">포맷</span>
            <button
              type="button"
              className={`seg-btn ${fmt === 'plain' ? 'seg-btn-on' : ''}`}
              onClick={() => setFmt('plain')}
              title="제목만"
            >
              제목
            </button>
            <button
              type="button"
              className={`seg-btn ${fmt === 'bullet' ? 'seg-btn-on' : ''}`}
              onClick={() => setFmt('bullet')}
              title="- 글머리"
            >
              글머리
            </button>
            <button
              type="button"
              className={`seg-btn ${fmt === 'checklist' ? 'seg-btn-on' : ''}`}
              onClick={() => setFmt('checklist')}
              title="- [x] 체크리스트"
            >
              체크리스트
            </button>
          </div>
        </div>

        <div className="body">
          {!loading && groups.length === 0 && (
            <div className="empty">
              <div className="empty-t">이 날의 활동이 없어요</div>
              <div className="empty-s">해당 날짜에 작업이 없거나 진행 기록이 비어 있어요</div>
            </div>
          )}

          {groups.map((g) => (
            <div key={g.key} className="group">
              <div className="group-hdr">
                <span className={`group-bullet ${g.bulletClass}`} />
                <span className="group-title">{g.label}</span>
                <span className="group-cnt">{g.items.length}</span>
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => void copyItems(g.items, g.label)}
                  title={`${g.label} 제목 ${g.items.length}개 복사`}
                >
                  <CopyIcon /> 복사
                </button>
              </div>
              <div className="group-body">
                {g.items.map((item) => (
                  <div
                    key={`${g.key}-${item.id}`}
                    className="item"
                    onClick={() => void copySingle(item)}
                    title="클릭해서 이 제목 복사"
                  >
                    {item.depth > 0 && (
                      <span
                        className="item-indent"
                        style={{ width: `${item.depth * 14}px` }}
                        aria-hidden="true"
                      />
                    )}
                    <span className={`item-tag ${STATUS_BULLET[item.status]}`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                    <span className={`item-title ${item.status === 'discarded' ? 'discarded' : ''}`}>
                      {item.title}
                    </span>
                    <span className="item-extras">
                      {item.has_snapshot && <span className="item-pin">기록</span>}
                      {item.low_priority && <span className="item-later">나중</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="footer">
          <div className="footer-hint">제목을 클릭하면 단건 복사돼요</div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void copyAll()}
            disabled={totalCount === 0}
            title="현재 분류의 모든 제목을 한 번에 복사"
          >
            <CopyIcon /> 전체 복사
          </button>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
