import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchTasksByDate,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  uncompleteTask,
  discardTask,
  undiscardTask,
  createTaskSnapshot,
  deleteTaskSnapshot,
} from '../lib/database';
import { getTasksFromMemoryCacheSync, invalidateMemoryCacheEntry } from '../lib/cache';
import { useSyncStatus } from '../components/common/SyncIndicator';
import type { Task } from '../types';

// Cross-window task mutation channel. Tauri webviews share IndexedDB but each
// keeps its own in-memory cache, so a save in the detail popup leaves the
// dashboard's React state stale. We broadcast a notice and refresh in peers.
const TASK_CHANNEL_NAME = 'task-manager:tasks';
const SENDER_ID = (() => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
})();

interface TaskMutationMessage {
  type: 'tasks-mutated';
  date: string;
  senderId: string;
}

function getTaskChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(TASK_CHANNEL_NAME);
  } catch {
    return null;
  }
}

export interface UseDayTasksResult {
  tasks: Task[];
  loading: boolean;
  lastMutationId: number;
  refreshTasks: () => Promise<void>;
  addTask: (title: string) => Promise<void>;
  addChild: (parentId: string, title: string) => Promise<void>;
  updateSettings: (
    id: string,
    updates: { title?: string; category_id?: string | null; low_priority?: boolean },
  ) => Promise<void>;
  saveDescription: (taskId: string, description: string) => Promise<void>;
  createSnapshot: (taskId: string) => Promise<void>;
  deleteSnapshot: (taskId: string) => Promise<void>;
  deleteTaskById: (id: string, options?: { confirm?: boolean }) => Promise<void>;
  complete: (id: string) => Promise<void>;
  uncomplete: (id: string) => Promise<void>;
  discard: (id: string) => Promise<void>;
  undiscard: (id: string) => Promise<void>;
}

export function useDayTasks(date: string): UseDayTasksResult {
  const [tasks, setTasks] = useState<Task[]>(() => getTasksFromMemoryCacheSync(date) || []);
  const [loading, setLoading] = useState(!getTasksFromMemoryCacheSync(date));
  const [lastMutationId, setLastMutationId] = useState(0);
  const syncStatus = useSyncStatus();
  const previousSyncStatusRef = useRef(syncStatus);

  const refreshTasks = useCallback(async () => {
    try {
      const data = await fetchTasksByDate(date);
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    const cached = getTasksFromMemoryCacheSync(date);
    if (cached) {
      setTasks(cached);
      setLoading(false);
    } else {
      setTasks([]);
      setLoading(true);
    }
    void refreshTasks();
  }, [date, refreshTasks]);

  useEffect(() => {
    const previousStatus = previousSyncStatusRef.current;
    previousSyncStatusRef.current = syncStatus;
    if (previousStatus === 'syncing' && syncStatus === 'synced') {
      void refreshTasks();
    }
  }, [refreshTasks, syncStatus]);

  // Listen for mutations from sibling windows (e.g. detail popup saving while
  // the dashboard is showing the same date) and re-pull from IndexedDB.
  useEffect(() => {
    const channel = getTaskChannel();
    if (!channel) return;
    const onMessage = (event: MessageEvent<TaskMutationMessage>) => {
      const msg = event.data;
      if (!msg || msg.type !== 'tasks-mutated') return;
      if (msg.senderId === SENDER_ID) return;
      if (msg.date !== date) return;
      invalidateMemoryCacheEntry('tasks', date);
      void refreshTasks();
    };
    channel.addEventListener('message', onMessage);
    return () => {
      channel.removeEventListener('message', onMessage);
      channel.close();
    };
  }, [date, refreshTasks]);

  const mutate = useCallback(async (action: () => Promise<unknown>, errorMessage: string) => {
    try {
      await action();
      await refreshTasks();
      setLastMutationId((value) => value + 1);
      const channel = getTaskChannel();
      if (channel) {
        try {
          const message: TaskMutationMessage = {
            type: 'tasks-mutated',
            date,
            senderId: SENDER_ID,
          };
          channel.postMessage(message);
        } catch (broadcastErr) {
          console.warn('Failed to broadcast task mutation:', broadcastErr);
        } finally {
          channel.close();
        }
      }
    } catch (err) {
      console.error(errorMessage, err);
    }
  }, [date, refreshTasks]);

  const addTask = useCallback(async (title: string) => {
    await mutate(() => createTask({ title, created_date: date }), 'Failed to create task:');
  }, [date, mutate]);

  const addChild = useCallback(async (parentId: string, title: string) => {
    await mutate(
      () => createTask({ title, parent_id: parentId, created_date: date }),
      'Failed to add child task:',
    );
  }, [date, mutate]);

  const updateSettings = useCallback(async (
    id: string,
    updates: { title?: string; category_id?: string | null; low_priority?: boolean },
  ) => {
    await mutate(() => updateTask(id, updates), 'Failed to update task settings:');
  }, [mutate]);

  const saveDescription = useCallback(async (taskId: string, description: string) => {
    await mutate(() => updateTask(taskId, { description }), 'Failed to save description:');
  }, [mutate]);

  const createSnapshot = useCallback(async (taskId: string) => {
    await mutate(() => createTaskSnapshot(taskId, date), 'Failed to create task snapshot:');
  }, [date, mutate]);

  const deleteSnapshot = useCallback(async (taskId: string) => {
    await mutate(() => deleteTaskSnapshot(taskId, date), 'Failed to delete task snapshot:');
  }, [date, mutate]);

  const deleteTaskById = useCallback(async (id: string, options: { confirm?: boolean } = {}) => {
    if (options.confirm !== false && !confirm('이 작업을 삭제하시겠습니까? 하위 작업도 모두 삭제됩니다.')) {
      return;
    }
    await mutate(() => deleteTask(id), 'Failed to delete task:');
  }, [mutate]);

  const complete = useCallback(async (id: string) => {
    await mutate(() => completeTask(id), 'Task action failed:');
  }, [mutate]);

  const uncomplete = useCallback(async (id: string) => {
    await mutate(() => uncompleteTask(id), 'Task action failed:');
  }, [mutate]);

  const discard = useCallback(async (id: string) => {
    await mutate(() => discardTask(id), 'Task action failed:');
  }, [mutate]);

  const undiscard = useCallback(async (id: string) => {
    await mutate(() => undiscardTask(id), 'Task action failed:');
  }, [mutate]);

  return {
    tasks,
    loading,
    lastMutationId,
    refreshTasks,
    addTask,
    addChild,
    updateSettings,
    saveDescription,
    createSnapshot,
    deleteSnapshot,
    deleteTaskById,
    complete,
    uncomplete,
    discard,
    undiscard,
  };
}
