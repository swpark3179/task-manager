import { useState, useEffect, useCallback } from 'react';
import TaskList from '../components/tasks/TaskList';
// Auth context available if needed

import {
  fetchTasksByDate, createTask, updateTask, deleteTask,
  completeTask, discardTask, upsertProgressLog, rolloverTasks
} from '../lib/database';
import { getTodayString, formatDateDisplay } from '../utils/dateUtils';
import type { Task } from '../types';
import './Pages.css';

export default function TodayPage() {

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const today = getTodayString();

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

      await loadTasks();
    };

    init();
  }, [loadTasks, today]);

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

  const handleUpdate = async (id: string, title: string) => {
    try {
      await updateTask(id, { title });
      await loadTasks();
    } catch (err) {
      console.error('Failed to update task:', err);
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

  const handleSaveProgress = async (taskId: string, date: string, content: string) => {
    try {
      await upsertProgressLog({ task_id: taskId, log_date: date, content });
      await loadTasks();
    } catch (err) {
      console.error('Failed to save progress:', err);
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
    <div className="page today-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">오늘의 할일</h1>
          <p className="page-subtitle">{formatDateDisplay(today)}</p>
        </div>
      </div>

      <div className="page-content">
        <TaskList
          tasks={tasks}
          today={today}
          loading={loading}
          onAddTask={handleAddTask}
          onComplete={handleComplete}
          onDiscard={handleDiscard}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          onAddChild={handleAddChild}
          onSaveProgress={handleSaveProgress}
          onSaveDescription={handleSaveDescription}
        />
      </div>
    </div>
  );
}
