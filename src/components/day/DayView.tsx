import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TaskList from '../tasks/TaskList';
import ScheduleSection from '../schedules/ScheduleSection';
import ScheduleModal from '../schedules/ScheduleModal';
import {
  fetchTasksByDate,
  fetchSchedulesForDateRange,
  fetchHolidays,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  uncompleteTask,
  discardTask,
  undiscardTask,
} from '../../lib/database';
import { useSyncStatus } from '../common/SyncIndicator';
import { getScheduleFromMemoryCacheSync, getTasksFromMemoryCacheSync } from '../../lib/cache';
import { getHolidaysForDate } from '../../utils/koreanHolidays';
import type { Holiday, HolidayType, Schedule, Task } from '../../types';

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
  const [tasks, setTasks] = useState<Task[]>(() => getTasksFromMemoryCacheSync(date) || []);
  const [schedules, setSchedules] = useState<Schedule[]>(() => {
    const mem = getScheduleFromMemoryCacheSync();
    return mem
      .filter((s) => s.start_date <= date && s.end_date >= date)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
  });
  const [loading, setLoading] = useState(!getTasksFromMemoryCacheSync(date));
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [userHolidays, setUserHolidays] = useState<Holiday[]>([]);
  const syncStatus = useSyncStatus();
  const previousSyncStatusRef = useRef(syncStatus);

  const holidays = useMemo(
    () => getHolidaysForDate(date, userHolidays),
    [date, userHolidays],
  );

  const loadTasks = useCallback(async () => {
    try {
      const data = await fetchTasksByDate(date);
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  const loadSchedules = useCallback(async () => {
    try {
      const data = await fetchSchedulesForDateRange(date, date);
      setSchedules(data);
    } catch (err) {
      console.error('Failed to load schedules:', err);
    }
  }, [date]);

  useEffect(() => {
    const cached = getTasksFromMemoryCacheSync(date);
    if (cached) {
      setTasks(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    void loadTasks();
    void loadSchedules();
  }, [date, loadTasks, loadSchedules]);

  useEffect(() => {
    fetchHolidays().then(setUserHolidays).catch(() => {});
  }, []);

  useEffect(() => {
    const previousStatus = previousSyncStatusRef.current;
    previousSyncStatusRef.current = syncStatus;
    if (previousStatus === 'syncing' && syncStatus === 'synced') {
      void loadTasks();
      void loadSchedules();
    }
  }, [loadTasks, loadSchedules, syncStatus]);

  const refresh = useCallback(async () => {
    await Promise.all([loadTasks(), loadSchedules()]);
    onMutate?.();
  }, [loadTasks, loadSchedules, onMutate]);

  const wrap = (fn: (id: string) => Promise<unknown>) => async (id: string) => {
    try {
      await fn(id);
      await refresh();
    } catch (err) {
      console.error('Task action failed:', err);
    }
  };

  const handleAddTask = async (title: string) => {
    try {
      await createTask({ title, created_date: date });
      await refresh();
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleAddChild = async (parentId: string, title: string) => {
    try {
      await createTask({ title, parent_id: parentId, created_date: date });
      await refresh();
    } catch (err) {
      console.error('Failed to add child task:', err);
    }
  };

  const handleUpdateSettings = async (
    id: string,
    updates: { title?: string; category_id?: string | null; low_priority?: boolean },
  ) => {
    try {
      await updateTask(id, updates);
      await refresh();
    } catch (err) {
      console.error('Failed to update task settings:', err);
    }
  };

  const handleSaveDescription = async (taskId: string, description: string) => {
    try {
      await updateTask(taskId, { description });
      await refresh();
    } catch (err) {
      console.error('Failed to save description:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 할일을 삭제하시겠습니까? 하위 할일도 모두 삭제됩니다.')) return;
    try {
      await deleteTask(id);
      await refresh();
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

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
          tasks={tasks}
          loading={loading}
          onAddTask={handleAddTask}
          onComplete={wrap(completeTask)}
          onUncomplete={wrap(uncompleteTask)}
          onDiscard={wrap(discardTask)}
          onUndiscard={wrap(undiscardTask)}
          onDelete={handleDelete}
          onUpdateSettings={handleUpdateSettings}
          onAddChild={handleAddChild}
          onSaveDescription={handleSaveDescription}
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
