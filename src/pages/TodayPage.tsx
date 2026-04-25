import { useState, useEffect, useCallback, useRef } from 'react';
import TaskList from '../components/tasks/TaskList';
import { useNavigate } from 'react-router-dom';
import { useSwipe } from '../hooks/useSwipe';
// Auth context available if needed

import {
  fetchTasksByDate, createTask, updateTask, deleteTask,
  completeTask, uncompleteTask, discardTask, undiscardTask, rolloverTasks,
  fetchSchedulesForDateRange,
} from '../lib/database';
import { getTodayString, formatDateDisplay, getPrevDay, getNextDay } from '../utils/dateUtils';
import type { Task, Schedule } from '../types';
import ScheduleSection from '../components/schedules/ScheduleSection';
import ScheduleModal from '../components/schedules/ScheduleModal';
import { useSyncStatus } from '../components/common/SyncIndicator';
import './Pages.css';

export default function TodayPage() {
  const navigate = useNavigate();
  const today = getTodayString();

  const swipeHandlers = useSwipe({
    onSwipedLeft: () => navigate(`/history/${getNextDay(today)}`),
    onSwipedRight: () => navigate(`/history/${getPrevDay(today)}`)
  });

  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const syncStatus = useSyncStatus();
  const previousSyncStatusRef = useRef(syncStatus);

  const loadTasks = useCallback(async () => {
    try {
      const data = await fetchTasksByDate(today);
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [today]);

  const loadSchedules = useCallback(async () => {
    try {
      const data = await fetchSchedulesForDateRange(today, today);
      setSchedules(data);
    } catch (err) {
      console.error('Failed to load schedules:', err);
    }
  }, [today]);

  // Initial load & daily rollover check
  useEffect(() => {
    const init = async () => {
      try {
        // Check for rollover from store
        const { Store } = await import('@tauri-apps/plugin-store');
        const store = await Store.load('settings.json');
        const lastDate = await store.get<string>('lastActiveDate');

        if (lastDate && lastDate < today) {
          // Rollover incomplete tasks
          await rolloverTasks(lastDate, today);
        }

        await store.set('lastActiveDate', today);
        await store.save();
      } catch {
        // Store may not be available in dev mode or web
      }

      await Promise.all([loadTasks(), loadSchedules()]);
    };

    init();
  }, [loadTasks, loadSchedules, today]);

  useEffect(() => {
    const previousStatus = previousSyncStatusRef.current;
    previousSyncStatusRef.current = syncStatus;

    if (previousStatus === 'syncing' && syncStatus === 'synced') {
      void Promise.all([loadTasks(), loadSchedules()]);
    }
  }, [loadTasks, loadSchedules, syncStatus]);

  const handleAddTask = async (title: string) => {
    try {
      await createTask({ title, created_date: today });
      await loadTasks();
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await completeTask(id);
      await loadTasks();
    } catch (err) {
      console.error('Failed to complete task:', err);
    }
  };


  const handleUncomplete = async (id: string) => {
    try {
      await uncompleteTask(id);
      await loadTasks();
    } catch (err) {
      console.error('Failed to uncomplete task:', err);
    }
  };

  const handleUndiscard = async (id: string) => {
    try {
      await undiscardTask(id);
      await loadTasks();
    } catch (err) {
      console.error('Failed to undiscard task:', err);
    }
  };

  const handleDiscard = async (id: string) => {
    try {
      await discardTask(id);
      await loadTasks();
    } catch (err) {
      console.error('Failed to discard task:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 할일을 삭제하시겠습니까? 하위 할일도 모두 삭제됩니다.')) return;
    try {
      await deleteTask(id);
      await loadTasks();
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };


  const handleUpdateSettings = async (id: string, updates: { title?: string; category_id?: string | null; low_priority?: boolean }) => {
    try {
      await updateTask(id, updates);
      await loadTasks();
    } catch (err) {
      console.error('Failed to update task settings:', err);
    }
  };


  const handleAddChild = async (parentId: string, title: string) => {
    try {
      await createTask({ title, parent_id: parentId, created_date: today });
      await loadTasks();
    } catch (err) {
      console.error('Failed to add child task:', err);
    }
  };

  const handleSaveDescription = async (taskId: string, description: string) => {
    try {
      await updateTask(taskId, { description });
      await loadTasks();
    } catch (err) {
      console.error('Failed to save description:', err);
    }
  };

  return (
    <div className="page today-page" {...swipeHandlers}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">오늘의 할일</h1>
          <p className="page-subtitle">{formatDateDisplay(today)}</p>
        </div>
        <div className="date-navigator" style={{ gap: '4px', marginTop: '4px' }}>
          <button className="date-navigator-btn" style={{ width: '28px', height: '28px' }} onClick={() => navigate(`/history/${getPrevDay(today)}`)} title="어제">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button className="date-navigator-btn" style={{ width: '28px', height: '28px' }} onClick={() => navigate(`/history/${getNextDay(today)}`)} title="내일">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>

      <div className="page-content">
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
            emptyText="오늘 예정된 일정이 없습니다."
          />
        </section>

        <section className="today-tasks-section">
          <h2 className="today-section-title" style={{ marginBottom: '8px' }}>작업</h2>
          <TaskList
            tasks={tasks}

            loading={loading}
            onAddTask={handleAddTask}
            onComplete={handleComplete}
            onUncomplete={handleUncomplete}
            onDiscard={handleDiscard}
            onUndiscard={handleUndiscard}
            onDelete={handleDelete}
            onUpdateSettings={handleUpdateSettings}
            onAddChild={handleAddChild}
            onSaveDescription={handleSaveDescription}
          />
        </section>
      </div>

      {showScheduleModal && (
        <ScheduleModal
          startDate={editingSchedule?.start_date ?? today}
          endDate={editingSchedule?.end_date ?? today}
          schedule={editingSchedule}
          onClose={() => {
            setShowScheduleModal(false);
            setEditingSchedule(null);
          }}
          onSave={async () => {
            await loadSchedules();
            setShowScheduleModal(false);
            setEditingSchedule(null);
          }}
        />
      )}
    </div>
  );
}
