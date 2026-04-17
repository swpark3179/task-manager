import { openDB, type IDBPDatabase } from 'idb';
import type { Task, ProgressLog, CalendarCellData } from '../types';

// =============================================
// IndexedDB Cache Module
// Stale-While-Revalidate strategy for fast initial load
// =============================================

const DB_NAME = 'task-manager-cache';
const DB_VERSION = 1;

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

const CACHE_TTL = {
  tasks: 0,               // Always revalidate
  progressLogs: 12 * 60 * 60 * 1000, // 12 hours
  calendar: 0,             // Always revalidate
  history: 24 * 60 * 60 * 1000,      // 24 hours
};

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('tasks')) {
          db.createObjectStore('tasks');
        }
        if (!db.objectStoreNames.contains('progressLogs')) {
          db.createObjectStore('progressLogs');
        }
        if (!db.objectStoreNames.contains('calendar')) {
          db.createObjectStore('calendar');
        }
      },
    });
  }
  return dbPromise;
}

// =============================================
// Generic Cache Operations
// =============================================

async function getCached<T>(
  storeName: string,
  key: string,
  ttl: number
): Promise<T | null> {
  try {
    const db = await getDB();
    const entry = await db.get(storeName, key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    // If TTL is 0, always return stale data (will be revalidated)
    if (ttl === 0) return entry.data;

    // Check if cache is expired
    const isExpired = Date.now() - entry.cachedAt > ttl;
    if (isExpired) return null;

    return entry.data;
  } catch {
    return null;
  }
}

async function setCache<T>(
  storeName: string,
  key: string,
  data: T
): Promise<void> {
  try {
    const db = await getDB();
    const entry: CacheEntry<T> = {
      data,
      cachedAt: Date.now(),
    };
    await db.put(storeName, entry, key);
  } catch {
    // Cache write failure is non-critical
  }
}

async function invalidateCache(storeName: string, key?: string): Promise<void> {
  try {
    const db = await getDB();
    if (key) {
      await db.delete(storeName, key);
    } else {
      await db.clear(storeName);
    }
  } catch {
    // Cache invalidation failure is non-critical
  }
}

// =============================================
// Domain-Specific Cache Functions

export async function updateTaskInAllCaches(taskId: string, updates: Partial<Task>): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('tasks', 'readwrite');
    let cursor = await tx.store.openCursor();

    while (cursor) {
      const entry = cursor.value;
      let modified = false;

      const newTasks = entry.data.map((t: Task) => {
        if (t.id === taskId) {
          modified = true;
          return { ...t, ...updates };
        }
        return t;
      });

      if (modified) {
        entry.data = newTasks;
        await cursor.update(entry);
      }

      cursor = await cursor.continue();
    }
    await tx.done;
  } catch (err) {
    console.error('Failed to update cache:', err);
  }
}

export async function removeTaskFromAllCaches(taskId: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('tasks', 'readwrite');
    let cursor = await tx.store.openCursor();

    while (cursor) {
      const entry = cursor.value;
      const initialLength = entry.data.length;

      entry.data = entry.data.filter((t: Task) => t.id !== taskId && t.parent_id !== taskId);

      if (entry.data.length !== initialLength) {
        await cursor.update(entry);
      }

      cursor = await cursor.continue();
    }
    await tx.done;
  } catch (err) {
    console.error('Failed to remove from cache:', err);
  }
}

export async function getTaskFromAllCaches(taskId: string): Promise<Task | null> {
  try {
    const db = await getDB();
    const tx = db.transaction('tasks', 'readonly');
    let cursor = await tx.store.openCursor();

    while (cursor) {
      const entry = cursor.value;
      const task = entry.data.find((t: Task) => t.id === taskId);
      if (task) return task;
      cursor = await cursor.continue();
    }
    return null;
  } catch {
    return null;
  }
}


export async function updateTaskInCache(taskId: string, updates: Partial<Task>): Promise<Task | null> {
  try {
    const db = await getDB();
    const tx = db.transaction('tasks', 'readwrite');
    let cursor = await tx.store.openCursor();
    let updatedTask: Task | null = null;

    while (cursor) {
      const entry = cursor.value;
      let modified = false;

      const newTasks = entry.data.map((t: Task) => {
        if (t.id === taskId) {
          modified = true;
          updatedTask = { ...t, ...updates };
          return updatedTask;
        }
        return t;
      });

      if (modified) {
        entry.data = newTasks;
        await cursor.update(entry);
        break;
      }

      cursor = await cursor.continue();
    }
    await tx.done;
    return updatedTask;
  } catch {
    return null;
  }
}

export async function removeTaskFromCache(taskId: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('tasks', 'readwrite');
    let cursor = await tx.store.openCursor();

    while (cursor) {
      const entry = cursor.value;
      const initialLength = entry.data.length;

      entry.data = entry.data.filter((t: Task) => t.id !== taskId && t.parent_id !== taskId);

      if (entry.data.length !== initialLength) {
        await cursor.update(entry);
      }

      cursor = await cursor.continue();
    }
    await tx.done;
  } catch { }
}

export async function getTaskFromCache(taskId: string): Promise<Task | null> {
  try {
    const db = await getDB();
    const tx = db.transaction('tasks', 'readonly');
    let cursor = await tx.store.openCursor();

    while (cursor) {
      const entry = cursor.value;
      const task = entry.data.find((t: Task) => t.id === taskId);
      if (task) return task;
      cursor = await cursor.continue();
    }
    return null;
  } catch {
    return null;
  }
}

// =============================================


export const taskCache = {
  get: (date: string) => getCached<Task[]>('tasks', date, CACHE_TTL.tasks),
  set: (date: string, tasks: Task[]) => setCache('tasks', date, tasks),
  invalidate: (date?: string) => invalidateCache('tasks', date),
  updateTask: async (date: string, taskId: string, updates: Partial<Task>) => {
    const tasks = await getCached<Task[]>('tasks', date, 0);
    if (tasks) {
      const newTasks = tasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
      await setCache('tasks', date, newTasks);
    }
  },
  addTask: async (date: string, task: Task) => {
    const tasks = await getCached<Task[]>('tasks', date, 0);
    if (tasks) {
      await setCache('tasks', date, [...tasks, task]);
    } else {
      await setCache('tasks', date, [task]);
    }
  },
  removeTask: async (date: string, taskId: string) => {
    const tasks = await getCached<Task[]>('tasks', date, 0);
    if (tasks) {
      const newTasks = tasks.filter(t => t.id !== taskId && t.parent_id !== taskId);
      await setCache('tasks', date, newTasks);
    }
  }
};

export const progressLogCache = {
  get: (taskId: string) =>
    getCached<ProgressLog[]>('progressLogs', taskId, CACHE_TTL.progressLogs),
  set: (taskId: string, logs: ProgressLog[]) =>
    setCache('progressLogs', taskId, logs),
  invalidate: (taskId?: string) => invalidateCache('progressLogs', taskId),
};

export const calendarCache = {
  get: (yearMonth: string) =>
    getCached<CalendarCellData[]>('calendar', yearMonth, CACHE_TTL.calendar),
  set: (yearMonth: string, data: CalendarCellData[]) =>
    setCache('calendar', yearMonth, data),
  invalidate: (yearMonth?: string) => invalidateCache('calendar', yearMonth),
};

// Clear all caches (e.g., on logout)
export async function clearAllCaches(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('tasks');
    await db.clear('progressLogs');
    await db.clear('calendar');
  } catch {
    // Non-critical
  }
}
