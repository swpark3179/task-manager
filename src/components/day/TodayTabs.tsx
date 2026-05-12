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
import type { Holiday, HolidayType, Schedule, TaskStatusSummary } from '../../types';

const HOLIDAY_TYPE_LABEL: Record<HolidayType, string> = {
  holiday: '공휴일',
  anniversary: '기념일',
  birthday: '생일',
};

type TabKey = 'tasks' | 'schedules';

interface TodayTabsProps {
  date: string;
  isToday: boolean;
  onSummaryChange?: (summary: TaskStatusSummary) => void;
  onMutate?: () => void;
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

  useEffect(() => {
    void loadSchedules();
  }, [date, loadSchedules]);

  useEffect(() => {
    fetchHolidays().then(setUserHolidays).catch(() => {});
  }, []);

  useEffect(() => {
    const prev = previousSyncStatusRef.current;
    previousSyncStatusRef.current = syncStatus;
    if (prev === 'syncing' && syncStatus === 'synced') void loadSchedules();
  }, [loadSchedules, syncStatus]);

  useEffect(() => {
    if (dayTasks.lastMutationId === 0) return;
    void loadSchedules();
    onMutate?.();
  }, [dayTasks.lastMutationId, loadSchedules, onMutate]);

  const summary = useMemo(() => calculateStatusSummary(dayTasks.tasks), [dayTasks.tasks]);

  useEffect(() => {
    onSummaryChange?.(summary);
  }, [summary, onSummaryChange]);

  const taskTotal = dayTasks.tasks.length;
  const scheduleTotal = schedules.length;
  const completedRatio = summary.total - summary.discarded > 0
    ? Math.round((summary.completed / (summary.total - summary.discarded)) * 100)
    : 0;

  const refresh = useCallback(async () => {
    await Promise.all([dayTasks.refreshTasks(), loadSchedules()]);
    onMutate?.();
  }, [dayTasks, loadSchedules, onMutate]);

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
            tasks={dayTasks.tasks}
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
          </div>
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
