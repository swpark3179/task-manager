import { supabase } from './supabase';
import { taskCache, calendarCache, categoryCache, scheduleCache, clearAllCaches } from './cache';
import { setSyncStatus } from '../components/common/SyncIndicator';
import { getTodayString } from '../utils/dateUtils';
import type { Task, CalendarCellData, TaskStatusSummary } from '../types';

// =============================================
// Sync Manager
// 앱 시작 시 1회 전체 동기화 후 로컬 캐시만 활용.
// 자동 동기화 주기는 설정에서 변경 가능.
// =============================================

const LAST_SYNC_KEY = 'task_manager_last_sync';
const SYNC_INTERVAL_KEY = 'task_manager_sync_interval';

// 자동 동기화 주기 옵션 (ms)
export const SYNC_INTERVAL_OPTIONS = [
  { label: '사용 안 함', value: 0 },
  { label: '1시간마다', value: 60 * 60 * 1000 },
  { label: '3시간마다', value: 3 * 60 * 60 * 1000 },
  { label: '5시간마다', value: 5 * 60 * 60 * 1000 },
  { label: '하루마다', value: 24 * 60 * 60 * 1000 },
] as const;

let autoSyncTimer: ReturnType<typeof setInterval> | null = null;

// =============================================
// Last Sync Time Helpers
// =============================================

export function getLastSyncTime(): Date | null {
  const stored = localStorage.getItem(LAST_SYNC_KEY);
  if (!stored) return null;
  const ts = parseInt(stored, 10);
  return isNaN(ts) ? null : new Date(ts);
}

function setLastSyncTime(): void {
  localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
}

export function getLastSyncLabel(): string {
  const t = getLastSyncTime();
  if (!t) return '동기화 기록 없음';
  const diff = Date.now() - t.getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  if (h < 24) return `${h}시간 전`;
  return `${d}일 전`;
}

// =============================================
// Sync Interval Settings
// =============================================

export function getSyncInterval(): number {
  const stored = localStorage.getItem(SYNC_INTERVAL_KEY);
  if (!stored) return 0;
  const v = parseInt(stored, 10);
  return isNaN(v) ? 0 : v;
}

export function setSyncInterval(ms: number): void {
  localStorage.setItem(SYNC_INTERVAL_KEY, String(ms));
}

// =============================================
// Full Sync
// =============================================

async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

/**
 * Supabase에서 모든 데이터를 가져와 IndexedDB 캐시를 갱신합니다.
 * 조회 범위: 오늘 기준 ±3개월
 */
export async function performFullSync(): Promise<void> {
  setSyncStatus('syncing');
  try {
    const userId = await getCurrentUserId();

    // 날짜 범위: ±3개월
    const today = getTodayString();
    const d = new Date(today);
    const rangeStart = new Date(d);
    rangeStart.setMonth(rangeStart.getMonth() - 3);
    const rangeEnd = new Date(d);
    rangeEnd.setMonth(rangeEnd.getMonth() + 3);
    const startDate = rangeStart.toISOString().split('T')[0];
    const endDate = rangeEnd.toISOString().split('T')[0];

    // 캐시 초기화
    await clearAllCaches();

    // 1. Tasks 동기화 (범위 내 생성된 태스크)
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .gte('created_date', startDate)
      .lte('created_date', endDate)
      .order('created_date', { ascending: true })
      .order('sort_order', { ascending: true });

    if (tasksError) throw tasksError;

    // 날짜별로 그룹화하여 캐시에 저장
    const tasksByDate = new Map<string, Task[]>();
    for (const task of (tasks || [])) {
      const date = task.created_date;
      if (!tasksByDate.has(date)) tasksByDate.set(date, []);
      tasksByDate.get(date)!.push(task);
    }

    // 2. Snapshots 동기화
    const { data: snapshots } = await supabase
      .from('daily_task_snapshots')
      .select('*, tasks(title, category_id, parent_id)')
      .eq('user_id', userId)
      .gte('snapshot_date', startDate)
      .lte('snapshot_date', endDate);

    // 스냅샷에서 참조하는 태스크를 날짜별 캐시에 추가
    if (snapshots && snapshots.length > 0) {
      const snapshotTaskIds = [...new Set(snapshots.map((s) => s.task_id))];
      const existingTaskIds = new Set((tasks || []).map((t) => t.id));
      const missingIds = snapshotTaskIds.filter((id) => !existingTaskIds.has(id));

      let extraTasks: Task[] = [];
      if (missingIds.length > 0) {
        const { data: pastTasks } = await supabase
          .from('tasks')
          .select('*')
          .in('id', missingIds);
        extraTasks = pastTasks || [];
      }

      // 조회를 최적화하기 위해 Map 구축 (tasks가 extraTasks보다 우선순위를 가짐)
      const allTasksMap = new Map<string, Task>();
      extraTasks.forEach((t) => allTasksMap.set(t.id, t));
      (tasks || []).forEach((t) => allTasksMap.set(t.id, t));

      // 각 날짜별 버킷의 ID를 추적하기 위한 Set 맵 구축
      const bucketIdsByDate = new Map<string, Set<string>>();
      for (const [date, bucket] of tasksByDate.entries()) {
        bucketIdsByDate.set(date, new Set(bucket.map((t) => t.id)));
      }

      // 스냅샷 날짜에도 해당 태스크를 캐시에 추가 (is_snapshot 플래그)
      for (const snap of snapshots) {
        const date = snap.snapshot_date;
        if (!tasksByDate.has(date)) {
          tasksByDate.set(date, []);
          bucketIdsByDate.set(date, new Set());
        }

        const bucketIds = bucketIdsByDate.get(date)!;
        if (!bucketIds.has(snap.task_id)) {
          // 원본 태스크 찾기
          const original = allTasksMap.get(snap.task_id);
          if (original) {
            tasksByDate.get(date)!.push({ ...original, is_snapshot: true } as Task);
            bucketIds.add(snap.task_id);
          }
        }
      }
    }

    // 날짜별 캐시 저장
    for (const [date, dateTasks] of tasksByDate.entries()) {
      await taskCache.set(date, dateTasks);
    }

    // 3. Categories 동기화
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('name');
    if (catError) throw catError;
    await categoryCache.set(categories || []);

    // 4. Schedules 동기화
    const { data: schedules, error: schError } = await supabase
      .from('schedules')
      .select('*')
      .eq('user_id', userId)
      .lte('start_date', endDate)
      .gte('end_date', startDate)
      .order('start_date', { ascending: true });
    if (schError) throw schError;
    await scheduleCache.set(schedules || []);

    // 5. Calendar 데이터 구축 (tasks + snapshots + schedules → 월별 캐시)
    await buildAndCacheCalendarData(
      userId,
      tasks || [],
      snapshots || [],
      schedules || [],
      startDate,
      endDate
    );

    setLastSyncTime();
    setSyncStatus('synced');
  } catch (err) {
    console.error('[SyncManager] Full sync failed:', err);
    setSyncStatus('error');
    throw err;
  }
}

/**
 * tasks, snapshots, schedules 데이터로 월별 CalendarCellData 캐시를 구성합니다.
 */
async function buildAndCacheCalendarData(
  userId: string,
  tasks: Task[],
  snapshots: any[],
  schedules: any[],
  startDate: string,
  endDate: string
): Promise<void> {
  // 관련 연월(YYYY-MM) 목록 계산
  const start = new Date(startDate);
  const end = new Date(endDate);
  const months = new Set<string>();
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    months.add(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
    cur.setMonth(cur.getMonth() + 1);
  }

  for (const yearMonth of months) {
    const [y, m] = yearMonth.split('-').map(Number);
    const mStart = `${yearMonth}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const mEnd = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

    const dateMap = new Map<string, CalendarCellData>();
    const taskIdsByDate = new Map<string, Set<string>>();

    // 스냅샷 처리
    for (const snap of snapshots) {
      if (snap.snapshot_date < mStart || snap.snapshot_date > mEnd) continue;
      const date = snap.snapshot_date;
      if (!dateMap.has(date)) {
        dateMap.set(date, { date, tasks: [], schedules: [], summary: emptySummary() });
        taskIdsByDate.set(date, new Set());
      }
      dateMap.get(date)!.tasks.push({
        ...snap,
        title: (snap as any).tasks?.title || '',
        category_id: (snap as any).tasks?.category_id || null,
        parent_id: (snap as any).tasks?.parent_id || null,
        is_snapshot: true,
      });
      taskIdsByDate.get(date)!.add(snap.task_id);
    }

    // 현재 태스크 처리
    for (const task of tasks) {
      const date = task.created_date;
      if (date < mStart || date > mEnd) continue;
      if (!dateMap.has(date)) {
        dateMap.set(date, { date, tasks: [], schedules: [], summary: emptySummary() });
        taskIdsByDate.set(date, new Set());
      }
      const cell = dateMap.get(date)!;
      const taskIds = taskIdsByDate.get(date)!;
      if (!taskIds.has(task.id)) {
        cell.tasks.push({
          id: task.id,
          user_id: userId,
          task_id: task.id,
          snapshot_date: date,
          status: task.status,
          created_at: task.created_at,
          title: task.title,
          category_id: task.category_id,
          parent_id: task.parent_id,
        });
        taskIds.add(task.id);
      }
    }

    // 스케줄 처리
    for (const schedule of schedules) {
      const sDate = new Date(schedule.start_date);
      const eDate = new Date(schedule.end_date);
      const mStartD = new Date(mStart);
      const mEndD = new Date(mEnd);
      let current = sDate < mStartD ? new Date(mStartD) : new Date(sDate);
      const endD = eDate > mEndD ? new Date(mEndD) : new Date(eDate);

      while (current <= endD) {
        const dateStr = current.toISOString().split('T')[0];
        if (!dateMap.has(dateStr)) {
          dateMap.set(dateStr, { date: dateStr, tasks: [], schedules: [], summary: emptySummary() });
        }
        const cell = dateMap.get(dateStr)!;
        if (!cell.schedules) cell.schedules = [];
        cell.schedules.push(schedule);
        current.setDate(current.getDate() + 1);
      }
    }

    // Summary 계산
    const result = Array.from(dateMap.values());
    for (const cell of result) {
      const summary: TaskStatusSummary = emptySummary();
      for (const t of cell.tasks) {
        summary.total++;
        switch (t.status) {
          case 'completed': summary.completed++; break;
          case 'in_progress': summary.inProgress++; break;
          case 'pending': summary.pending++; break;
          case 'discarded': summary.discarded++; break;
        }
      }
      cell.summary = summary;
    }

    await calendarCache.set(yearMonth, result);
  }
}

function emptySummary(): TaskStatusSummary {
  return { total: 0, completed: 0, inProgress: 0, pending: 0, discarded: 0 };
}

// =============================================
// Auto Sync Timer
// =============================================

export function startAutoSync(): void {
  stopAutoSync();
  const interval = getSyncInterval();
  if (interval <= 0) return;

  autoSyncTimer = setInterval(async () => {
    console.log('[SyncManager] Auto sync triggered');
    try {
      await performFullSync();
    } catch {
      // silent
    }
  }, interval);

  console.log(`[SyncManager] Auto sync started: every ${interval / 60000} minutes`);
}

export function stopAutoSync(): void {
  if (autoSyncTimer !== null) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
    console.log('[SyncManager] Auto sync stopped');
  }
}

/**
 * 자동 동기화 주기를 변경하고 타이머를 재시작합니다.
 */
export function updateAutoSync(intervalMs: number): void {
  setSyncInterval(intervalMs);
  startAutoSync();
}

// =============================================
// Conditional Sync on App Start
// 마지막 동기화 이후 설정된 주기가 지났으면 재동기화
// =============================================

export async function syncIfNeeded(): Promise<void> {
  const lastSync = getLastSyncTime();
  const interval = getSyncInterval();

  if (!lastSync) {
    // 동기화 이력 없음 → 최초 동기화
    await performFullSync();
    return;
  }

  if (interval > 0) {
    const elapsed = Date.now() - lastSync.getTime();
    if (elapsed >= interval) {
      await performFullSync();
    }
  }
  // interval === 0 (사용 안 함)이면 앱 시작 시에만 동기화
}
