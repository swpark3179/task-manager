import { supabase } from './supabase';
import { taskCache, calendarCache, categoryCache, scheduleCache, updateTaskInAllCaches, removeTaskFromAllCaches } from './cache';
import { v4 as uuidv4 } from 'uuid';
import { setSyncStatus } from '../components/common/SyncIndicator';
import { buildTaskTree } from '../utils/taskUtils';
import { getTodayString } from '../utils/dateUtils';
import {
  refreshScheduleNotification,
  cancelScheduleNotification,
  rescheduleDailySummariesOnly,
} from './notifications';
import type {
  Task, Category, CalendarCellData,
  CreateTaskInput, UpdateTaskInput, TaskStatusSummary,
  Schedule, CreateScheduleInput, UpdateScheduleInput
} from '../types';

// =============================================
// Database CRUD Functions
// All operations go through Supabase with cache management
// =============================================

async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

async function withSyncStatus<T>(operation: () => Promise<T>): Promise<T> {
  setSyncStatus('syncing');
  try {
    const result = await operation();
    setSyncStatus('synced');
    return result;
  } catch (err) {
    setSyncStatus('error');
    throw err;
  }
}

// =============================================
// Background Sync Helper
// =============================================

function runBackgroundSync(promiseFactory: () => Promise<void>) {
  setSyncStatus('syncing');
  promiseFactory().then(() => {
    setSyncStatus('synced');
  }).catch((err) => {
    console.error('Background sync failed:', err);
    setSyncStatus('error');
  });
}

// =============================================
// Tasks
// =============================================

export async function fetchTasksByDate(date: string): Promise<Task[]> {
  const cached = await taskCache.get(date);
  if (cached) {
    // 캐시 히트: 로컬 DB만 사용 (재검증 없음)
    return buildTaskTree(cached);
  }

  // 캐시 미스: Supabase 직접 조회 (동기화 이전 단계 또는 범위 밖 날짜)
  setSyncStatus('syncing');
  try {
    const userId = await getCurrentUserId();

    // Get tasks created on this date
    const { data: currentTasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('created_date', date)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    // Get snapshots for this date to include tasks worked on but created on another date
    const { data: snapshots } = await supabase
      .from('daily_task_snapshots')
      .select('task_id, status')
      .eq('user_id', userId)
      .eq('snapshot_date', date);

    let tasks = currentTasks || [];

    if (snapshots && snapshots.length > 0) {
      const snapshotTaskIds = snapshots.map((s: any) => s.task_id);
      const currentTaskIds = new Set(tasks.map((t: any) => t.id));

      const missingTaskIds = snapshotTaskIds.filter((id: any) => !currentTaskIds.has(id));

      if (missingTaskIds.length > 0) {
        const { data: pastTasks } = await supabase
          .from('tasks')
          .select('*')
          .in('id', missingTaskIds);

        if (pastTasks) {
          tasks = [...tasks, ...pastTasks.map((t: any) => ({ ...t, is_snapshot: true }))];
        }
      }
    }

    await taskCache.set(date, tasks);
    setSyncStatus('synced');
    return buildTaskTree(tasks);
  } catch (err) {
    setSyncStatus('error');
    throw err;
  }
}


export async function createTask(input: CreateTaskInput): Promise<Task> {
  const userId = await getCurrentUserId();
  const createdDate = input.created_date || getTodayString();
  const id = input.id || uuidv4();

  const newTask: Task = {
    id,
    user_id: userId,
    title: input.title,
    parent_id: input.parent_id || null,
    category_id: input.category_id || null,
    low_priority: input.low_priority || false,
    description: input.description || null,
    status: 'pending',
    created_date: createdDate,
    completed_at: null,
    discarded_at: null,
    sort_order: input.sort_order || 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    children: [],
    };

  // Optimistic update
  await taskCache.addTask(createdDate, newTask);
  await calendarCache.invalidate();

  runBackgroundSync(async () => {
    const { error } = await supabase
      .from('tasks')
      .insert({
        id: newTask.id,
        user_id: newTask.user_id,
        title: newTask.title,
        parent_id: newTask.parent_id,
        category_id: newTask.category_id,
        low_priority: newTask.low_priority,
        description: newTask.description,
        created_date: newTask.created_date,
        sort_order: newTask.sort_order,
      });
    if (error) throw error;
  });

  void rescheduleDailySummariesOnly().catch(console.error);
  return newTask;
}

export async function updateTask(id: string, updates: UpdateTaskInput): Promise<void> {
  // Optimistic update
  await updateTaskInAllCaches(id, updates);
  await calendarCache.invalidate();

  runBackgroundSync(async () => {
    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  });

  void rescheduleDailySummariesOnly().catch(console.error);
}

export async function deleteTask(id: string): Promise<void> {
  // Optimistic update
  await removeTaskFromAllCaches(id);
  await calendarCache.invalidate();

  runBackgroundSync(async () => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);
    if (error) throw error;
  });

  void rescheduleDailySummariesOnly().catch(console.error);
}


export async function uncompleteTask(id: string): Promise<void> {
  return withSyncStatus(async () => {
    // Update task
    const updates: UpdateTaskInput = {
      status: 'pending',
      completed_at: null,
    };

    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id);

    if (error) throw error;

    await taskCache.invalidate();
  });
}

export async function completeTask(id: string): Promise<void> {
  const now = new Date().toISOString();

  // Optimistic update
  await updateTaskInAllCaches(id, {
    status: 'completed',
    completed_at: now
  });
  await calendarCache.invalidate();

  runBackgroundSync(async () => {
    const updates: UpdateTaskInput = {
      status: 'completed',
      completed_at: now,
    };
    const { error } = await supabase.from('tasks').update(updates).eq('id', id);
    if (error) throw error;
  });
}

export async function undiscardTask(id: string): Promise<void> {
  // Optimistic update
  await updateTaskInAllCaches(id, {
    status: 'pending',
    discarded_at: null
  });
  await calendarCache.invalidate();

  runBackgroundSync(async () => {
    const { error } = await supabase
      .from('tasks')
      .update({
        status: 'pending',
        discarded_at: null,
      })
      .eq('id', id);

    if (error) throw error;
  });
}

export async function discardTask(id: string): Promise<void> {
  const now = new Date().toISOString();
  // Optimistic update
  await updateTaskInAllCaches(id, {
    status: 'discarded',
    discarded_at: now
  });
  await calendarCache.invalidate();

  runBackgroundSync(async () => {
    const { error } = await supabase
      .from('tasks')
      .update({
        status: 'discarded',
        discarded_at: now,
      })
      .eq('id', id);

    if (error) throw error;
  });
}

// =============================================
// Progress Logs
// =============================================


// =============================================
// Daily Rollover
// =============================================

export async function rolloverTasks(fromDate: string, toDate: string): Promise<number> {
  return withSyncStatus(async () => {
    const userId = await getCurrentUserId();

    // Get incomplete tasks for the fromDate
    const { data: incompleteTasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('created_date', fromDate)
      .in('status', ['pending', 'in_progress']);

    if (error) throw error;
    if (!incompleteTasks || incompleteTasks.length === 0) return 0;

    // Find root tasks that need rollover (including those with incomplete children)
    const allTaskIds = new Set(incompleteTasks.map((t: any) => t.id));

    // Also fetch completed children of incomplete parents
    const parentIds = incompleteTasks.filter((t: any) => !t.parent_id).map((t: any) => t.id);
    if (parentIds.length > 0) {
      const { data: childTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .in('parent_id', parentIds)
        .eq('created_date', fromDate);

      if (childTasks) {
        for (const child of childTasks) {
          allTaskIds.add(child.id);
        }
      }
    }

    // Create snapshots for all tasks being rolled over
    const snapshots = incompleteTasks.map((t: any) => ({
      user_id: userId,
      task_id: t.id,
      snapshot_date: fromDate,
      status: t.status,
    }));

    const idsToUpdate = Array.from(allTaskIds);
    const promises: Promise<any>[] = [];

    if (snapshots.length > 0) {
      promises.push(
        supabase
          .from('daily_task_snapshots')
          .upsert(snapshots, { onConflict: 'task_id,snapshot_date' }) as unknown as Promise<any>
      );
    }

    promises.push(
      supabase
        .from('tasks')
        .update({ created_date: toDate })
        .in('id', idsToUpdate) as unknown as Promise<any>
    );

    const results = await Promise.all(promises);
    for (const res of results) {
      if (res.error) throw res.error;
    }

    await taskCache.invalidate();
    await calendarCache.invalidate();

    return idsToUpdate.length;
  });
}

// =============================================
// Calendar Data
// =============================================

async function fetchCalendarFromRemote(year: number, month: number): Promise<CalendarCellData[]> {
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
  const userId = await getCurrentUserId();
  const startDate = `${yearMonth}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

  // Get snapshots for the month (with task title via FK)
  const { data: snapshots, error } = await supabase
    .from('daily_task_snapshots')
    .select('*, tasks(title, category_id, parent_id)')
    .eq('user_id', userId)
    .gte('snapshot_date', startDate)
    .lte('snapshot_date', endDate);

  if (error) throw error;

  // Also get current tasks that are on dates in this month
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('id, status, created_date, title, category_id, parent_id')
    .eq('user_id', userId)
    .gte('created_date', startDate)
    .lte('created_date', endDate);

  if (tasksError) throw tasksError;

  // Get schedules for this month
  const { data: schedules, error: schedulesError } = await supabase
    .from('schedules')
    .select('*')
    .eq('user_id', userId)
    .lte('start_date', endDate)
    .gte('end_date', startDate)
    .order('start_date', { ascending: true });

  if (schedulesError) throw schedulesError;


  // Build calendar data
  const dateMap = new Map<string, CalendarCellData>();

  for (const snap of (snapshots || [])) {
    if (!dateMap.has(snap.snapshot_date)) {
      dateMap.set(snap.snapshot_date, {
        date: snap.snapshot_date,
        tasks: [],
        schedules: [],
        summary: { total: 0, completed: 0, inProgress: 0, pending: 0, discarded: 0 },
      });
    }
    dateMap.get(snap.snapshot_date)!.tasks.push({
      ...snap,
      title: (snap as any).tasks?.title || '',
      category_id: (snap as any).tasks?.category_id || null,
      parent_id: (snap as any).tasks?.parent_id || null,
      is_snapshot: true,
    });
  }

  for (const task of (tasks || [])) {
    const date = task.created_date;
    if (!dateMap.has(date)) {
      dateMap.set(date, {
        date,
        tasks: [],
        schedules: [],
        summary: { total: 0, completed: 0, inProgress: 0, pending: 0, discarded: 0 },
      });
    }

    const cell = dateMap.get(date)!;
    if (!cell.tasks.some((t) => t.task_id === task.id)) {
      cell.tasks.push({
        id: task.id,
        user_id: userId,
        task_id: task.id,
        snapshot_date: date,
        status: task.status,
        created_at: '',
        title: task.title,
        category_id: task.category_id,
        parent_id: task.parent_id,
      });
    }
  }


  for (const schedule of (schedules || [])) {
    // Determine the range of dates this schedule spans within the current month
    const sDate = new Date(schedule.start_date);
    const eDate = new Date(schedule.end_date);
    const mStart = new Date(startDate);
    const mEnd = new Date(endDate);

    let current = sDate < mStart ? mStart : sDate;
    const end = eDate > mEnd ? mEnd : eDate;

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, {
          date: dateStr,
          tasks: [],
          schedules: [],
          summary: { total: 0, completed: 0, inProgress: 0, pending: 0, discarded: 0 },
        });
      }
      const cell = dateMap.get(dateStr);
      // ensure schedules array exists, may not if not initialized properly
      if (cell && !cell.schedules) cell.schedules = [];
      if (cell) cell.schedules.push(schedule);

      current.setDate(current.getDate() + 1);
    }
  }

  const result = Array.from(dateMap.values());
  for (const cell of result) {
    const summary: TaskStatusSummary = { total: 0, completed: 0, inProgress: 0, pending: 0, discarded: 0 };
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
  return result;
}

export async function fetchCalendarData(
  year: number,
  month: number,
  onRevalidated?: (data: CalendarCellData[]) => void,
): Promise<CalendarCellData[]> {
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
  const cached = await calendarCache.get(yearMonth);
  if (cached) {
    // 캐시 히트: 로컬 DB만 사용 (재검증 없음)
    // onRevalidated 콜백은 자동동기화 시 응답 포맧 호환성 용도로만 유지
    if (onRevalidated) onRevalidated(cached);
    return cached;
  }

  return withSyncStatus(() => fetchCalendarFromRemote(year, month));
}


// =============================================
// Data Export
// =============================================

export async function fetchAllDataForExport(): Promise<{
  tasks: Task[];
}> {
  return withSyncStatus(async () => {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_date', { ascending: false })
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return {
      tasks: data || [],
    };
  });
}

export async function forceSync(): Promise<void> {
  // 전체 재동기화: syncManager에 위임
  const { performFullSync } = await import('./syncManager');
  return performFullSync();
}

// =============================================

// =============================================
// Schedules
// =============================================

export async function createSchedule(input: CreateScheduleInput): Promise<Schedule> {
  const userId = await getCurrentUserId();
  const id = (input as any).id || uuidv4();
  const now = new Date().toISOString();

  const newSchedule: Schedule = {
    id,
    user_id: userId,
    title: input.title,
    category_id: input.category_id ?? null,
    description: input.description ?? null,
    start_date: input.start_date,
    end_date: input.end_date,
    estimated_time: input.estimated_time ?? null,
    scheduled_time: input.scheduled_time ?? null,
    notify_at: input.notify_at ?? null,
    notify_offset_minutes: input.notify_offset_minutes ?? null,
    created_at: now,
    updated_at: now,
  };

  // Optimistic update
  const cachedSchedules = (await scheduleCache.get()) || [];
  await scheduleCache.set([...cachedSchedules, newSchedule]);
  await calendarCache.invalidate();

  runBackgroundSync(async () => {
    const { error } = await supabase
      .from('schedules')
      .insert([{
        id: newSchedule.id,
        user_id: newSchedule.user_id,
        title: newSchedule.title,
        description: newSchedule.description,
        start_date: newSchedule.start_date,
        end_date: newSchedule.end_date,
        notify_at: newSchedule.notify_at,
      }]);
    if (error) throw error;
  });

  void refreshScheduleNotification(newSchedule).catch(console.error);
  void rescheduleDailySummariesOnly().catch(console.error);
  return newSchedule;
}

export async function updateSchedule(id: string, input: UpdateScheduleInput): Promise<Schedule> {
  // Optimistic update
  const cachedSchedules = (await scheduleCache.get()) || [];
  const existingIndex = cachedSchedules.findIndex(s => s.id === id);
  
  let updatedSchedule: Schedule;
  if (existingIndex >= 0) {
    updatedSchedule = { ...cachedSchedules[existingIndex], ...input, updated_at: new Date().toISOString() };
    cachedSchedules[existingIndex] = updatedSchedule;
    await scheduleCache.set(cachedSchedules);
  } else {
    // If not in cache (should be rare), we still need the updated item for return
    updatedSchedule = { id, user_id: await getCurrentUserId(), ...input } as Schedule; 
  }
  await calendarCache.invalidate();

  runBackgroundSync(async () => {
    const { error } = await supabase
      .from('schedules')
      .update(input)
      .eq('id', id);
    if (error) throw error;
  });

  void refreshScheduleNotification(updatedSchedule).catch(console.error);
  void rescheduleDailySummariesOnly().catch(console.error);
  return updatedSchedule;
}

export async function deleteSchedule(id: string): Promise<void> {
  // Optimistic update
  const cachedSchedules = (await scheduleCache.get()) || [];
  await scheduleCache.set(cachedSchedules.filter(s => s.id !== id));
  await calendarCache.invalidate();

  runBackgroundSync(async () => {
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id);
    if (error) throw error;
  });

  void cancelScheduleNotification(id).catch(console.error);
  void rescheduleDailySummariesOnly().catch(console.error);
}

export async function fetchSchedulesForDateRange(startDate: string, endDate: string): Promise<Schedule[]> {
    const cachedSchedules = await scheduleCache.get();
    if (cachedSchedules) {
        // 캐시 히트: 메모리에서 필터링하여 즉시 반환
        return cachedSchedules.filter(s => s.start_date <= endDate && s.end_date >= startDate).sort((a, b) => a.start_date.localeCompare(b.start_date));
    }

    // 캐시 미스: Supabase 직접 조회
    return withSyncStatus(async () => {
        const userId = await getCurrentUserId();
        const { data, error } = await supabase
            .from('schedules')
            .select('*')
            .eq('user_id', userId)
            .lte('start_date', endDate)
            .gte('end_date', startDate)
            .order('start_date', { ascending: true });

        if (error) throw error;
        return data || [];
    });
}

// =============================================
// Categories
// =============================================



export async function fetchCategories(): Promise<Category[]> {
  // 캐시 우선 조회
  const cached = await categoryCache.get();
  if (cached) return cached;

  return withSyncStatus(async () => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('name');

    if (error) throw error;
    const result = data || [];
    await categoryCache.set(result);
    return result;
  });
}

export async function createCategory(name: string, color?: string): Promise<Category> {
  return withSyncStatus(async () => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('categories')
      .insert({ user_id: userId, name, color })
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

export async function updateCategory(id: string, updates: { name?: string; color?: string }): Promise<void> {
  return withSyncStatus(async () => {
    const { error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  });
}

export async function deleteCategory(id: string): Promise<void> {
  return withSyncStatus(async () => {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  });
}
