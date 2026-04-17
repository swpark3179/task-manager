import { supabase } from './supabase';
import { taskCache, progressLogCache, calendarCache, updateTaskInAllCaches, removeTaskFromAllCaches, getTaskFromAllCaches } from './cache';
import { v4 as uuidv4 } from 'uuid';
import { setSyncStatus } from '../components/common/SyncIndicator';
import { buildTaskTree } from '../utils/taskUtils';
import { getTodayString } from '../utils/dateUtils';
import type {
  Task, ProgressLog, CalendarCellData,
  CreateTaskInput, UpdateTaskInput, UpsertProgressLogInput, TaskStatusSummary
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
    revalidateTasksByDate(date);
    return buildTaskTree(cached);
  }

  setSyncStatus('syncing');
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('created_date', date)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    const tasks = data || [];

    if (tasks.length > 0) {
      const taskIds = tasks.map(t => t.id);
      const { data: logs } = await supabase
        .from('progress_logs')
        .select('*')
        .in('task_id', taskIds)
        .order('log_date', { ascending: true });

      if (logs) {
        for (const task of tasks) {
          task.progress_logs = logs.filter(l => l.task_id === task.id);
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

async function revalidateTasksByDate(date: string): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('created_date', date)
      .order('sort_order', { ascending: true });

    if (data) {
      const tasks = data;
      if (tasks.length > 0) {
        const taskIds = tasks.map(t => t.id);
        const { data: logs } = await supabase
          .from('progress_logs')
          .select('*')
          .in('task_id', taskIds)
          .order('log_date', { ascending: true });

        if (logs) {
          for (const task of tasks) {
            task.progress_logs = logs.filter(l => l.task_id === task.id);
          }
        }
      }
      await taskCache.set(date, tasks);
    }
  } catch {
    // Silent
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
    description: input.description || null,
    status: 'pending',
    created_date: createdDate,
    completed_at: null,
    discarded_at: null,
    sort_order: input.sort_order || 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    children: [],
    progress_logs: []
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
        description: newTask.description,
        created_date: newTask.created_date,
        sort_order: newTask.sort_order,
      });
    if (error) throw error;
  });

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
    const { data: logs } = await supabase
      .from('progress_logs')
      .select('*')
      .eq('task_id', id)
      .order('log_date', { ascending: true });

    let mergedContent = '';
    if (logs && logs.length > 0) {
      mergedContent = logs
        .map(log => `### ${log.log_date}\n\n${log.content}`)
        .join('\n\n---\n\n');
    }

    const updates: UpdateTaskInput = {
      status: 'completed',
      completed_at: now,
    };

    if (mergedContent) {
      const { data: t } = await supabase
        .from('tasks')
        .select('description')
        .eq('id', id)
        .single();

      const existingDesc = t?.description || '';
      updates.description = existingDesc
        ? `${existingDesc}\n\n---\n\n## 수행 기록\n\n${mergedContent}`
        : `## 수행 기록\n\n${mergedContent}`;
    }

    const { error } = await supabase
      .from('tasks')
      .update(updates)
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

export async function fetchProgressLogs(taskId: string): Promise<ProgressLog[]> {
  const cached = await progressLogCache.get(taskId);
  if (cached) return cached;

  try {
    const { data, error } = await supabase
      .from('progress_logs')
      .select('*')
      .eq('task_id', taskId)
      .order('log_date', { ascending: true });

    if (error) throw error;

    const logs = data || [];
    await progressLogCache.set(taskId, logs);
    return logs;
  } catch (err) {
    throw err;
  }
}

export async function upsertProgressLog(input: UpsertProgressLogInput): Promise<void> {
  const userId = await getCurrentUserId();

  // Optimistic local change (we don't strictly update task progress logs here, but we could)
  // Actually, we'll just invalidate cache and rely on background sync to eventually fix it,
  // OR we can fetch cache and update. For progress logs, it's safer to just background sync
  // and trigger a re-fetch or just background update cache.
  // Wait, the UI updates instantly if loadTasks is called.
  // Let's just do task status update optimistically if pending.

  const task = await getTaskFromAllCaches(input.task_id);
  if (task && task.status === 'pending') {
    await updateTaskInAllCaches(input.task_id, { status: 'in_progress' });
    await calendarCache.invalidate();
  }

  runBackgroundSync(async () => {
    const { error } = await supabase
      .from('progress_logs')
      .upsert(
        {
          user_id: userId,
          task_id: input.task_id,
          log_date: input.log_date,
          content: input.content,
        },
        { onConflict: 'task_id,log_date' }
      );

    if (error) throw error;
    await progressLogCache.invalidate(input.task_id);

    // Auto-update task status to in_progress if pending
    const { data: t } = await supabase
      .from('tasks')
      .select('status')
      .eq('id', input.task_id)
      .single();

    if (t && t.status === 'pending') {
      await supabase
        .from('tasks')
        .update({ status: 'in_progress' })
        .eq('id', input.task_id);
    }
  });
}

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
    const allTaskIds = new Set(incompleteTasks.map(t => t.id));

    // Also fetch completed children of incomplete parents
    const parentIds = incompleteTasks.filter(t => !t.parent_id).map(t => t.id);
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
    const snapshots = incompleteTasks.map(t => ({
      user_id: userId,
      task_id: t.id,
      snapshot_date: fromDate,
      status: t.status,
    }));

    if (snapshots.length > 0) {
      await supabase
        .from('daily_task_snapshots')
        .upsert(snapshots, { onConflict: 'task_id,snapshot_date' });
    }

    // Update created_date of all related tasks to toDate
    const idsToUpdate = Array.from(allTaskIds);
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ created_date: toDate })
      .in('id', idsToUpdate);

    if (updateError) throw updateError;

    await taskCache.invalidate();
    await calendarCache.invalidate();

    return idsToUpdate.length;
  });
}

// =============================================
// Calendar Data
// =============================================

export async function fetchCalendarData(year: number, month: number): Promise<CalendarCellData[]> {
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
  const cached = await calendarCache.get(yearMonth);
  if (cached) {
    revalidateCalendarData(year, month);
    return cached;
  }

  return withSyncStatus(async () => {
    const userId = await getCurrentUserId();
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-31`;

    // Get snapshots for the month
    const { data: snapshots, error } = await supabase
      .from('daily_task_snapshots')
      .select('*')
      .eq('user_id', userId)
      .gte('snapshot_date', startDate)
      .lte('snapshot_date', endDate);

    if (error) throw error;

    // Also get current tasks that are on dates in this month
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, status, created_date')
      .eq('user_id', userId)
      .gte('created_date', startDate)
      .lte('created_date', endDate);

    // Build calendar data
    const dateMap = new Map<string, CalendarCellData>();

    // Process snapshots
    for (const snap of (snapshots || [])) {
      if (!dateMap.has(snap.snapshot_date)) {
        dateMap.set(snap.snapshot_date, {
          date: snap.snapshot_date,
          tasks: [],
          summary: { total: 0, completed: 0, inProgress: 0, pending: 0, discarded: 0 },
        });
      }
      dateMap.get(snap.snapshot_date)!.tasks.push(snap);
    }

    // Process current tasks
    for (const task of (tasks || [])) {
      const date = task.created_date;
      if (!dateMap.has(date)) {
        dateMap.set(date, {
          date,
          tasks: [],
          summary: { total: 0, completed: 0, inProgress: 0, pending: 0, discarded: 0 },
        });
      }
      dateMap.get(date)!.tasks.push({
        id: task.id,
        user_id: userId,
        task_id: task.id,
        snapshot_date: date,
        status: task.status,
        created_at: '',
      });
    }

    // Calculate summaries
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
  });
}

async function revalidateCalendarData(year: number, month: number): Promise<void> {
  try {
    const data = await fetchCalendarData(year, month);
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    await calendarCache.set(yearMonth, data);
  } catch {
    // Silent revalidation
  }
}

// =============================================
// Data Export
// =============================================

export async function fetchAllDataForExport(): Promise<{
  tasks: Task[];
  progressLogs: ProgressLog[];
}> {
  return withSyncStatus(async () => {
    const userId = await getCurrentUserId();

    const [tasksResult, logsResult] = await Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_date', { ascending: false })
        .order('sort_order', { ascending: true }),
      supabase
        .from('progress_logs')
        .select('*')
        .eq('user_id', userId)
        .order('log_date', { ascending: true }),
    ]);

    if (tasksResult.error) throw tasksResult.error;
    if (logsResult.error) throw logsResult.error;

    return {
      tasks: tasksResult.data || [],
      progressLogs: logsResult.data || [],
    };
  });
}
