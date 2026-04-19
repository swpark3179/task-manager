import type { Task } from '../types';
import { getStatusLabel } from './taskUtils';
import { formatDateFull } from './dateUtils';

// =============================================
// Data Export Utilities
// Exports all data as human-readable Markdown
// =============================================

interface ExportData {
  tasks: Task[];
  userEmail: string;
}

/**
 * Generate a full Markdown export of all tasks and progress logs.
 */
export function generateMarkdownExport(data: ExportData): string {
  const { tasks, userEmail } = data;
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


  // Sort dates descending
  const sortedDates = Array.from(tasksByDate.keys()).sort((a, b) => b.localeCompare(a));

  for (const date of sortedDates) {
    lines.push(`## ${formatDateFull(date)}`);
    lines.push('');

    const dateTasks = tasksByDate.get(date)!;
    // Only root tasks
    const rootTasks = dateTasks.filter(t => !t.parent_id);

    for (const task of rootTasks) {
      renderTaskExport(task, dateTasks, lines, 0);
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

function renderTaskExport(
  task: Task,
  allTasks: Task[],
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

  // Children
  const children = allTasks.filter(t => t.parent_id === task.id);
  if (children.length > 0) {
    lines.push(`${indent}- **하위 작업**:`);
    for (const child of children) {
      renderTaskExport(child, allTasks, lines, depth + 1);
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
