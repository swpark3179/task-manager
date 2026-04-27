import { openDB, type IDBPDatabase } from 'idb';
import type { Task, CalendarCellData, Category, Schedule } from '../types';

// =============================================
// IndexedDB Cache Module
// Stale-While-Revalidate strategy for fast initial load
// =============================================

const DB_NAME = 'task-manager-cache';
const DB_VERSION = 2;

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

const CACHE_TTL = {
  tasks: Infinity,         // 동기화 시에만 갱신 (앱 시작 / 자동 동기화)
  progressLogs: 12 * 60 * 60 * 1000, // 12 hours
  calendar: Infinity,      // 동기화 시에만 갱신
  history: 24 * 60 * 60 * 1000,      // 24 hours
  categories: Infinity,    // 동기화 시에만 갱신
  schedules: Infinity,     // 동기화 시에만 갱신
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
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories');
        }
        if (!db.objectStoreNames.contains('schedules')) {
          db.createObjectStore('schedules');
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
    const memKey = `${storeName}:${key}`;
    const memEntry = memoryCache.get(memKey);
    if (memEntry) {
      if (ttl === 0) return memEntry.data;
      if (Date.now() - memEntry.cachedAt <= ttl) return memEntry.data;
    }

    const db = await getDB();
    const entry = await db.get(storeName, key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    memoryCache.set(memKey, entry);

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
    const entry: CacheEntry<T> = {
      data,
      cachedAt: Date.now(),
    };
    const memKey = `${storeName}:${key}`;
    memoryCache.set(memKey, entry);

    const db = await getDB();
    await db.put(storeName, entry, key);
  } catch {
    // Cache write failure is non-critical
  }
}

async function invalidateCache(storeName: string, key?: string): Promise<void> {
  try {
    if (key) {
      memoryCache.delete(`${storeName}:${key}`);
    } else {
      for (const k of memoryCache.keys()) {
        if (k.startsWith(`${storeName}:`)) {
          memoryCache.delete(k);
        }
      }
    }

    const db = await getDB();
    if (key) {
      await db.delete(storeName, key);
    } else {
      await db.clear(storeName);
    }
  } catch {
    console.error('Failed to invalidate cache');
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

      const idsToRemove = collectDescendantIds(entry.data, taskId);
      idsToRemove.add(taskId);
      entry.data = entry.data.filter((t: Task) => !idsToRemove.has(t.id));

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

function collectDescendantIds(tasks: Task[], parentId: string): Set<string> {
  const ids = new Set<string>();
  const queue = [parentId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const t of tasks) {
      if (t.parent_id === current && !ids.has(t.id)) {
        ids.add(t.id);
        queue.push(t.id);
      }
    }
  }
  return ids;
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

      const idsToRemove = collectDescendantIds(entry.data, taskId);
      idsToRemove.add(taskId);
      entry.data = entry.data.filter((t: Task) => !idsToRemove.has(t.id));

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
      const idsToRemove = collectDescendantIds(tasks, taskId);
      idsToRemove.add(taskId);
      const newTasks = tasks.filter(t => !idsToRemove.has(t.id));
      await setCache('tasks', date, newTasks);
    }
  }
};


function isValidCalendarCache(data: unknown): data is CalendarCellData[] {
  if (!Array.isArray(data)) return false;
  // Empty array is considered valid (no entries yet for that month)
  if (data.length === 0) return true;
  // Reject legacy entries that predate the `tasks` field
  return data.every(
    (cell) =>
      cell != null &&
      typeof (cell as CalendarCellData).date === 'string' &&
      Array.isArray((cell as CalendarCellData).tasks),
  );
}

export const calendarCache = {
  get: async (yearMonth: string) => {
    const data = await getCached<CalendarCellData[]>('calendar', yearMonth, CACHE_TTL.calendar);
    if (data && !isValidCalendarCache(data)) {
      // Discard malformed/legacy cache so it gets refetched
      await invalidateCache('calendar', yearMonth);
      return null;
    }
    return data;
  },
  set: (yearMonth: string, data: CalendarCellData[]) =>
    setCache('calendar', yearMonth, data),
  invalidate: (yearMonth?: string) => invalidateCache('calendar', yearMonth),
};

// =============================================
// Categories Cache (단일 키 'all')
// =============================================

export const categoryCache = {
  get: () => getCached<Category[]>('categories', 'all', CACHE_TTL.categories),
  set: (data: Category[]) => setCache('categories', 'all', data),
  invalidate: () => invalidateCache('categories'),
};

// =============================================
// Schedules Cache (단일 키 'all')
// =============================================

export const scheduleCache = {
  get: () => getCached<Schedule[]>('schedules', 'all', CACHE_TTL.schedules),
  set: (data: Schedule[]) => setCache('schedules', 'all', data),
  invalidate: () => invalidateCache('schedules'),
};

// =============================================
// Clear all caches (e.g., on logout)
// =============================================

export function getScheduleFromMemoryCacheSync(): Schedule[] {
  const entry = memoryCache.get('schedules:all');
  return entry ? entry.data : [];
}

export function getCalendarFromMemoryCacheSync(yearMonth: string): CalendarCellData[] | null {
  const entry = memoryCache.get(`calendar:${yearMonth}`);
  return entry ? entry.data : null;
}

export function getTasksFromMemoryCacheSync(date: string): Task[] | null {
  const entry = memoryCache.get(`tasks:${date}`);
  return entry ? entry.data : null;
}

export async function clearAllCaches(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('tasks');
    await db.clear('progressLogs');
    await db.clear('calendar');
    await db.clear('categories');
    await db.clear('schedules');
  } catch {
    // Non-critical
  }
}
