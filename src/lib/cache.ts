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
// =============================================

export const taskCache = {
  get: (date: string) => getCached<Task[]>('tasks', date, CACHE_TTL.tasks),
  set: (date: string, tasks: Task[]) => setCache('tasks', date, tasks),
  invalidate: (date?: string) => invalidateCache('tasks', date),
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
