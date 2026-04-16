import type { Task, ProgressLog } from '../types';
import { getStatusLabel } from './taskUtils';
import { formatDateFull } from './dateUtils';

// =============================================
// Data Export Utilities
// Exports all data as human-readable Markdown
// =============================================

interface ExportData {
  tasks: Task[];
  progressLogs: ProgressLog[];
  userEmail: string;
}

/**
 * Generate a full Markdown export of all tasks and progress logs.
 */
export function generateMarkdownExport(data: ExportData): string {
  const { tasks, progressLogs, userEmail } = data;
  const now = new Date().toLocaleString('ko-KR');

  const lines: string[] = [];
  lines.push('# 업무 관리 데이터 내보내기');
  lines.push(`> 사용자: ${userEmail}`);
  lines.push(`> 내보내기 일시: ${now}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Group tasks by date
  const tasksByDate = new Map<string, Task[]>();
  for (const task of tasks) {
    const date = task.created_date;
    if (!tasksByDate.has(date)) {
      tasksByDate.set(date, []);
    }
    tasksByDate.get(date)!.push(task);
  }

  // Create progress log lookup
  const logsByTaskId = new Map<string, ProgressLog[]>();
  for (const log of progressLogs) {
    if (!logsByTaskId.has(log.task_id)) {
      logsByTaskId.set(log.task_id, []);
    }
    logsByTaskId.get(log.task_id)!.push(log);
  }

  // Sort dates descending
  const sortedDates = Array.from(tasksByDate.keys()).sort((a, b) => b.localeCompare(a));

  for (const date of sortedDates) {
    lines.push(`## ${formatDateFull(date)}`);
    lines.push('');

    const dateTasks = tasksByDate.get(date)!;
    // Only root tasks
    const rootTasks = dateTasks.filter(t => !t.parent_id);

    for (const task of rootTasks) {
      renderTaskExport(task, dateTasks, logsByTaskId, lines, 0);
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

function renderTaskExport(
  task: Task,
  allTasks: Task[],
  logsByTaskId: Map<string, ProgressLog[]>,
  lines: string[],
  depth: number
): void {
  const prefix = depth === 0 ? '###' : '####';
  const icon = getStatusIcon(task.status);
  const indent = '  '.repeat(depth);

  if (depth === 0) {
    lines.push(`${prefix} ${icon} ${task.title}`);
  } else {
    lines.push(`${indent}- ${icon} ${task.title}`);
  }

  lines.push(`${indent}- **상태**: ${getStatusLabel(task.status)}${task.completed_at ? ` (${task.completed_at})` : ''}`);

  if (task.description) {
    lines.push(`${indent}- **세부 내용**:`);
    lines.push(`${indent}  ${task.description.replace(/\n/g, `\n${indent}  `)}`);
  }

  // Progress logs
  const logs = logsByTaskId.get(task.id);
  if (logs && logs.length > 0) {
    lines.push(`${indent}- **수행 기록**:`);
    const sortedLogs = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date));
    for (const log of sortedLogs) {
      lines.push(`${indent}  - [${log.log_date}] ${log.content.split('\n')[0]}`);
    }
  }

  // Children
  const children = allTasks.filter(t => t.parent_id === task.id);
  if (children.length > 0) {
    lines.push(`${indent}- **하위 작업**:`);
    for (const child of children) {
      renderTaskExport(child, allTasks, logsByTaskId, lines, depth + 1);
    }
  }

  lines.push('');
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'completed': return '☑';
    case 'discarded': return '☒';
    case 'in_progress': return '◐';
    default: return '☐';
  }
}
