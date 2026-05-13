import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TaskList from '../tasks/TaskList';
import ScheduleSection from '../schedules/ScheduleSection';
import ScheduleModal from '../schedules/ScheduleModal';
import {
  fetchHolidays,
  fetchSchedulesForDateRange,
} from '../../lib/database';
import { useSyncStatus } from '../common/SyncIndicator';
import { getScheduleFromMemoryCacheSync } from '../../lib/cache';
import { getHolidaysForDate } from '../../utils/koreanHolidays';
import { useDayTasks } from '../../hooks/useDayTasks';
import { calculateStatusSummary } from '../../utils/taskUtils';
import { getTodayString } from '../../utils/dateUtils';
import type { Holiday, HolidayType, Schedule, TaskStatusSummary } from '../../types';

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const HOLIDAY_TYPE_LABEL: Record<HolidayType, string> = {
  holiday: '공휴일',
  anniversary: '기념일',
  birthday: '생일',
};

const KOR_DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const EVENT_DAYS_AHEAD = 10;
const SCHEDULE_DAYS_AHEAD = 14;

function formatDayLabel(iso: string, today: string): string {
  const d = new Date(iso + 'T00:00:00');
  const tomorrow = addDaysIso(today, 1);
  if (iso === today) return '오늘';
  if (iso === tomorrow) return '내일';
  return `${d.getMonth() + 1}/${d.getDate()} (${KOR_DAYS[d.getDay()]})`;
}

type TabKey = 'tasks' | 'schedules' | 'events' | 'later';

interface TodayTabsProps {
  date: string;
  isToday: boolean;
  onSummaryChange?: (summary: TaskStatusSummary) => void;
  onMutate?: () => void;
}

interface UpcomingEvent {
  date: string;
  title: string;
  type: HolidayType;
}

export default function TodayTabs({ date, isToday, onSummaryChange, onMutate }: TodayTabsProps) {
  const dayTasks = useDayTasks(date);
  const [activeTab, setActiveTab] = useState<TabKey>('tasks');
  const [schedules, setSchedules] = useState<Schedule[]>(() => {
    const mem = getScheduleFromMemoryCacheSync();
    return mem
      .filter((s) => s.start_date <= date && s.end_date >= date)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
  });
  const [upcomingSchedules, setUpcomingSchedules] = useState<Schedule[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [userHolidays, setUserHolidays] = useState<Holiday[]>([]);
  const syncStatus = useSyncStatus();
  const previousSyncStatusRef = useRef(syncStatus);

  const holidays = useMemo(
    () => getHolidaysForDate(date, userHolidays),
    [date, userHolidays],
  );

  const loadSchedules = useCallback(async () => {
    try {
      const data = await fetchSchedulesForDateRange(date, date);
      setSchedules(data);
    } catch (err) {
      console.error('Failed to load schedules:', err);
    }
  }, [date]);

  const loadUpcomingSchedules = useCallback(async () => {
    try {
      const end = addDaysIso(date, SCHEDULE_DAYS_AHEAD);
      const data = await fetchSchedulesForDateRange(date, end);
      setUpcomingSchedules(data);
    } catch (err) {
      console.error('Failed to load upcoming schedules:', err);
    }
  }, [date]);

  useEffect(() => {
    void loadSchedules();
    void loadUpcomingSchedules();
  }, [date, loadSchedules, loadUpcomingSchedules]);

  useEffect(() => {
    fetchHolidays().then(setUserHolidays).catch(() => {});
  }, []);

  useEffect(() => {
    const prev = previousSyncStatusRef.current;
    previousSyncStatusRef.current = syncStatus;
    if (prev === 'syncing' && syncStatus === 'synced') {
      void loadSchedules();
      void loadUpcomingSchedules();
    }
  }, [loadSchedules, loadUpcomingSchedules, syncStatus]);

  useEffect(() => {
    if (dayTasks.lastMutationId === 0) return;
    void loadSchedules();
    void loadUpcomingSchedules();
    onMutate?.();
  }, [dayTasks.lastMutationId, loadSchedules, loadUpcomingSchedules, onMutate]);

  const mainTasks = useMemo(
    () => dayTasks.tasks.filter((t) => !t.low_priority),
    [dayTasks.tasks],
  );
  const laterTasks = useMemo(
    () => dayTasks.tasks.filter((t) => t.low_priority),
    [dayTasks.tasks],
  );

  const summary = useMemo(() => calculateStatusSummary(mainTasks), [mainTasks]);

  useEffect(() => {
    onSummaryChange?.(summary);
  }, [summary, onSummaryChange]);

  const events = useMemo<UpcomingEvent[]>(() => {
    const out: UpcomingEvent[] = [];
    for (let i = 0; i <= EVENT_DAYS_AHEAD; i++) {
      const d = addDaysIso(date, i);
      for (const h of getHolidaysForDate(d, userHolidays)) {
        out.push({ date: d, title: h.title, type: h.type });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [date, userHolidays]);

  const groupedUpcomingSchedules = useMemo(() => {
    const grouped: Record<string, Schedule[]> = {};
    [...upcomingSchedules]
      .sort((a, b) => {
        const da = a.start_date.localeCompare(b.start_date);
        if (da !== 0) return da;
        return (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? '');
      })
      .forEach((s) => {
        const day = s.start_date;
        (grouped[day] = grouped[day] || []).push(s);
      });
    return grouped;
  }, [upcomingSchedules]);

  const todayString = getTodayString();
  const referenceDay = isToday ? todayString : date;

  const taskTotal = mainTasks.length;
  const scheduleTotal = schedules.length;
  const eventTotal = events.length;
  const laterTotal = laterTasks.length;
  const completedRatio = summary.total - summary.discarded > 0
    ? Math.round((summary.completed / (summary.total - summary.discarded)) * 100)
    : 0;

  const refresh = useCallback(async () => {
    await Promise.all([
      dayTasks.refreshTasks(),
      loadSchedules(),
      loadUpcomingSchedules(),
    ]);
    onMutate?.();
  }, [dayTasks, loadSchedules, loadUpcomingSchedules, onMutate]);

  return (
    <div className="td-card">
      <div className="td-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'tasks'}
          className={`td-tab ${activeTab === 'tasks' ? 'is-on' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          <span className="td-tab-l">작업</span>
          <span className="td-tab-n">{taskTotal}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'schedules'}
          className={`td-tab ${activeTab === 'schedules' ? 'is-on' : ''}`}
          onClick={() => setActiveTab('schedules')}
        >
          <span className="td-tab-l">일정</span>
          <span className="td-tab-n">{scheduleTotal}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'events'}
          className={`td-tab ${activeTab === 'events' ? 'is-on' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          <span className="td-tab-l">이벤트</span>
          <span className="td-tab-n">{eventTotal}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'later'}
          className={`td-tab ${activeTab === 'later' ? 'is-on' : ''}`}
          onClick={() => setActiveTab('later')}
        >
          <span className="td-tab-l">나중에 할일</span>
          <span className="td-tab-n">{laterTotal}</span>
        </button>
        <div className="td-tabs-spacer" />
        {activeTab === 'tasks' && summary.total > 0 && (
          <span className="td-tabs-meta">
            {summary.completed}/{summary.total - summary.discarded} · {completedRatio}%
          </span>
        )}
      </div>

      {holidays.length > 0 && (
        <div className="td-holiday-strip">
          {holidays.map((h, i) => (
            <span
              key={`${h.id}-${i}`}
              className={`td-holiday-pill type-${h.type}`}
              style={h.color ? { ['--chip-color' as string]: h.color } : undefined}
            >
              <span className="td-holiday-pill-dot" />
              <span className="td-holiday-pill-title">{h.title}</span>
              <span className="td-holiday-pill-type">{HOLIDAY_TYPE_LABEL[h.type]}</span>
            </span>
          ))}
        </div>
      )}

      <div className="td-card-body">
        {activeTab === 'tasks' && (
          <TaskList
            tasks={mainTasks}
            loading={dayTasks.loading}
            onAddTask={dayTasks.addTask}
            onComplete={dayTasks.complete}
            onUncomplete={dayTasks.uncomplete}
            onDiscard={dayTasks.discard}
            onUndiscard={dayTasks.undiscard}
            onDelete={dayTasks.deleteTaskById}
            onUpdateSettings={dayTasks.updateSettings}
            onAddChild={dayTasks.addChild}
            onSaveDescription={dayTasks.saveDescription}
            onCreateSnapshot={isToday ? dayTasks.createSnapshot : undefined}
            onDeleteSnapshot={isToday ? dayTasks.deleteSnapshot : undefined}
            sortByStatus={isToday}
          />
        )}

        {activeTab === 'schedules' && (
          <div className="td-schedules">
            <div className="td-schedules-header">
              <span className="td-schedules-title">
                {schedules.length === 0 ? '등록된 일정 없음' : `${schedules.length}개의 일정`}
              </span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setEditingSchedule(null);
                  setShowScheduleModal(true);
                }}
              >
                + 일정 등록
              </button>
            </div>
            <ScheduleSection
              schedules={schedules}
              onEdit={(s) => {
                setEditingSchedule(s);
                setShowScheduleModal(true);
              }}
              emptyText={isToday ? '오늘 예정된 일정이 없습니다.' : '이 날짜에 걸쳐있는 일정이 없습니다.'}
            />
            {Object.keys(groupedUpcomingSchedules).length > 0 && (
              <div className="td-upcoming">
                <div className="td-upcoming-title">다가오는 일정 ({SCHEDULE_DAYS_AHEAD}일 이내)</div>
                {Object.entries(groupedUpcomingSchedules).map(([day, items]) => (
                  <div key={day} className="td-upcoming-group">
                    <div className="td-upcoming-day">
                      <span className="td-upcoming-day-l">{formatDayLabel(day, referenceDay)}</span>
                      <span className="td-upcoming-day-d">{day}</span>
                      <span className="td-upcoming-day-n">{items.length}건</span>
                    </div>
                    <ScheduleSection
                      schedules={items}
                      onEdit={(s) => {
                        setEditingSchedule(s);
                        setShowScheduleModal(true);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="td-events">
            <div className="td-events-title">다가오는 이벤트 ({EVENT_DAYS_AHEAD}일 이내)</div>
            {events.length === 0 ? (
              <p className="td-events-empty">
                {EVENT_DAYS_AHEAD}일 이내에 공휴일/기념일/생일이 없습니다.
              </p>
            ) : (
              <ul className="td-events-list">
                {events.map((ev, i) => (
                  <li key={`${ev.date}-${i}`} className={`td-event-card type-${ev.type}`}>
                    <div className="td-event-date">
                      <div className="td-event-date-l">{formatDayLabel(ev.date, referenceDay)}</div>
                      <div className="td-event-date-d">{ev.date}</div>
                    </div>
                    <div className="td-event-body">
                      <div className="td-event-title">{ev.title}</div>
                      <div className="td-event-type">{HOLIDAY_TYPE_LABEL[ev.type]}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'later' && (
          <TaskList
            tasks={laterTasks}
            loading={dayTasks.loading}
            onAddTask={dayTasks.addTask}
            onComplete={dayTasks.complete}
            onUncomplete={dayTasks.uncomplete}
            onDiscard={dayTasks.discard}
            onUndiscard={dayTasks.undiscard}
            onDelete={dayTasks.deleteTaskById}
            onUpdateSettings={dayTasks.updateSettings}
            onAddChild={dayTasks.addChild}
            onSaveDescription={dayTasks.saveDescription}
            onCreateSnapshot={isToday ? dayTasks.createSnapshot : undefined}
            onDeleteSnapshot={isToday ? dayTasks.deleteSnapshot : undefined}
            sortByStatus={isToday}
          />
        )}
      </div>

      {showScheduleModal && (
        <ScheduleModal
          startDate={editingSchedule?.start_date ?? date}
          endDate={editingSchedule?.end_date ?? date}
          schedule={editingSchedule}
          onClose={() => {
            setShowScheduleModal(false);
            setEditingSchedule(null);
          }}
          onSave={async () => {
            await refresh();
            setShowScheduleModal(false);
            setEditingSchedule(null);
          }}
        />
      )}
    </div>
  );
}
