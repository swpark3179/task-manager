import { supabase } from './supabase';
import { taskCache, progressLogCache, calendarCache } from './cache';
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
// Tasks
// =============================================

export async function fetchTasksByDate(date: string): Promise<Task[]> {
  // Try cache first
  const cached = await taskCache.get(date);
  if (cached) {
    // Revalidate in background
    revalidateTasksByDate(date);
    return buildTaskTree(cached);
  }

  return withSyncStatus(async () => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('created_date', date)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    const tasks = data || [];

    // Fetch progress logs for these tasks
    if (tasks.length > 0) {
      const taskIds = tasks.map(t => t.id);
      const { data: logs } = await supabase
        .from('progress_logs')
        .select('*')
        .in('task_id', taskIds)
        .order('log_date', { ascending: true });

      // Attach logs to tasks
      if (logs) {
        for (const task of tasks) {
          task.progress_logs = logs.filter(l => l.task_id === task.id);
        }
      }
    }

    await taskCache.set(date, tasks);
    return buildTaskTree(tasks);
  });
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
      const taskIds = data.map(t => t.id);
      if (taskIds.length > 0) {
        const { data: logs } = await supabase
          .from('progress_logs')
          .select('*')
          .in('task_id', taskIds);
        if (logs) {
          for (const task of data) {
            task.progress_logs = logs.filter(l => l.task_id === task.id);
          }
        }
      }
      await taskCache.set(date, data);
    }
    setSyncStatus('synced');
  } catch {
    // Silent background revalidation failure
  }
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  return withSyncStatus(async () => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        title: input.title,
        parent_id: input.parent_id || null,
        description: input.description || null,
        created_date: input.created_date || getTodayString(),
        sort_order: input.sort_order || 0,
      })
      .select()
      .single();

    if (error) throw error;

    await taskCache.invalidate();
    return data;
  });
}

export async function updateTask(id: string, updates: UpdateTaskInput): Promise<Task> {
  return withSyncStatus(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await taskCache.invalidate();
    return data;
  });
}

export async function deleteTask(id: string): Promise<void> {
  return withSyncStatus(async () => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await taskCache.invalidate();
  });
}

export async function completeTask(id: string): Promise<void> {
  return withSyncStatus(async () => {
    // Fetch all progress logs for this task
    const { data: logs } = await supabase
      .from('progress_logs')
      .select('*')
      .eq('task_id', id)
      .order('log_date', { ascending: true });

    // Merge progress logs
    let mergedContent = '';
    if (logs && logs.length > 0) {
      mergedContent = logs
        .map(log => `### ${log.log_date}\n\n${log.content}`)
        .join('\n\n---\n\n');
    }

    // Update task
    const updates: UpdateTaskInput = {
      status: 'completed',
      completed_at: new Date().toISOString(),
    };

    // Append merged content to description if exists
    if (mergedContent) {
      const { data: task } = await supabase
        .from('tasks')
        .select('description')
        .eq('id', id)
        .single();

      const existingDesc = task?.description || '';
      updates.description = existingDesc
        ? `${existingDesc}\n\n---\n\n## 수행 기록\n\n${mergedContent}`
        : `## 수행 기록\n\n${mergedContent}`;
    }

    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id);

    if (error) throw error;

    await taskCache.invalidate();
  });
}

export async function discardTask(id: string): Promise<void> {
  return withSyncStatus(async () => {
    const { error } = await supabase
      .from('tasks')
      .update({
        status: 'discarded',
        discarded_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    await taskCache.invalidate();
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

export async function upsertProgressLog(input: UpsertProgressLogInput): Promise<ProgressLog> {
  return withSyncStatus(async () => {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('progress_logs')
      .upsert(
        {
          user_id: userId,
          task_id: input.task_id,
          log_date: input.log_date,
          content: input.content,
        },
        { onConflict: 'task_id,log_date' }
      )
      .select()
      .single();

    if (error) throw error;

    await progressLogCache.invalidate(input.task_id);
    await taskCache.invalidate();

    // Auto-update task status to in_progress if pending
    const { data: task } = await supabase
      .from('tasks')
      .select('status')
      .eq('id', input.task_id)
      .single();

    if (task && task.status === 'pending') {
      await supabase
        .from('tasks')
        .update({ status: 'in_progress' })
        .eq('id', input.task_id);
      await taskCache.invalidate();
    }

    return data;
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
