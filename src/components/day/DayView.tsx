import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TaskList from '../tasks/TaskList';
import ScheduleSection from '../schedules/ScheduleSection';
import ScheduleModal from '../schedules/ScheduleModal';
import {
  fetchSchedulesForDateRange,
  fetchHolidays,
} from '../../lib/database';
import { useSyncStatus } from '../common/SyncIndicator';
import { getScheduleFromMemoryCacheSync } from '../../lib/cache';
import { getHolidaysForDate } from '../../utils/koreanHolidays';
import type { Holiday, HolidayType, Schedule } from '../../types';
import { useDayTasks } from '../../hooks/useDayTasks';

interface DayViewProps {
  date: string;
  isToday: boolean;
  onMutate?: () => void;
}

const HOLIDAY_TYPE_LABEL: Record<HolidayType, string> = {
  holiday: '공휴일',
  anniversary: '기념일',
  birthday: '생일',
};

export default function DayView({ date, isToday, onMutate }: DayViewProps) {
  const dayTasks = useDayTasks(date);
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
    const previousStatus = previousSyncStatusRef.current;
    previousSyncStatusRef.current = syncStatus;
    if (previousStatus === 'syncing' && syncStatus === 'synced') {
      void loadSchedules();
    }
  }, [loadSchedules, syncStatus]);

  useEffect(() => {
    if (dayTasks.lastMutationId === 0) return;
    void loadSchedules();
    onMutate?.();
  }, [dayTasks.lastMutationId, loadSchedules, onMutate]);

  const refresh = useCallback(async () => {
    await Promise.all([dayTasks.refreshTasks(), loadSchedules()]);
    onMutate?.();
  }, [dayTasks, loadSchedules, onMutate]);

  return (
    <div className="day-view">
      {holidays.length > 0 && (
        <section className="today-holidays-section" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="holiday-list">
            {holidays.map((h, i) => (
              <div
                key={`${h.id}-${i}`}
                className={`holiday-list-item type-${h.type}`}
              >
                <span
                  className="holiday-list-dot"
                  aria-hidden="true"
                  style={h.color ? { background: h.color } : undefined}
                />
                <span className="holiday-list-title">{h.title}</span>
                <span className="holiday-list-type">{HOLIDAY_TYPE_LABEL[h.type]}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="today-schedules-section" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="modal-section-header" style={{ marginBottom: '8px' }}>
          <h2 className="today-section-title">일정</h2>
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
      </section>

      <section className="today-tasks-section">
        <h2 className="today-section-title" style={{ marginBottom: '8px' }}>작업</h2>
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
      </section>

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
