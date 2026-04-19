import type { Task, TaskStatus, TaskStatusSummary } from '../types';

// =============================================
// Task Status Computation Utilities
// =============================================

export function computeParentStatus(children: Task[]): TaskStatus {
  const activeChildren = children.filter(c => c.status !== 'discarded');

  if (activeChildren.length === 0) return 'completed';

  const allCompleted = activeChildren.every(c => c.status === 'completed');
  if (allCompleted) return 'completed';

  const anyProgress = activeChildren.some(
    c => c.status === 'in_progress' || c.status === 'completed'
  );
  if (anyProgress) return 'in_progress';

  return 'pending';
}

export function hasChildren(task: Task): boolean {
  return Array.isArray(task.children) && task.children.length > 0;
}

export function isCheckboxInteractive(task: Task): boolean {
  return !hasChildren(task);
}

export function getEffectiveStatus(task: Task): TaskStatus {
  if (task.status === 'completed' || task.status === 'discarded') {
    return task.status;
  }

  if (hasChildren(task)) {
    return computeParentStatus(task.children!);
  }
  return task.status;
}

export function calculateStatusSummary(tasks: Task[]): TaskStatusSummary {
  const summary: TaskStatusSummary = {
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    discarded: 0,
  };

  for (const task of tasks) {
    summary.total++;
    switch (task.status) {
      case 'completed':
        summary.completed++;
        break;
      case 'in_progress':
        summary.inProgress++;
        break;
      case 'pending':
        summary.pending++;
        break;
      case 'discarded':
        summary.discarded++;
        break;
    }
  }

  return summary;
}

export function getStatusLabel(status: TaskStatus): string {
  switch (status) {
    case 'pending': return '미수행';
    case 'in_progress': return '진행 중';
    case 'completed': return '완료';
    case 'discarded': return '폐기';
  }
}

export function getCompletionPercentage(task: Task): number {
  if (!hasChildren(task)) {
    return task.status === 'completed' ? 100 : 0;
  }

  const activeChildren = task.children!.filter(c => c.status !== 'discarded');
  if (activeChildren.length === 0) return 100;

  const completedCount = activeChildren.filter(c => c.status === 'completed').length;
  return Math.round((completedCount / activeChildren.length) * 100);
}

export function buildTaskTree(tasks: Task[]): Task[] {
  const taskMap = new Map<string, Task>();
  const roots: Task[] = [];

  // First pass: create map entries with empty children
  for (const task of tasks) {
    taskMap.set(task.id, { ...task, children: [] });
  }

  // Second pass: link children to parents
  for (const task of tasks) {
    const node = taskMap.get(task.id)!;
    if (task.parent_id && taskMap.has(task.parent_id)) {
      taskMap.get(task.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort by sort_order
  const sortTasks = (list: Task[]) => {
    list.sort((a, b) => a.sort_order - b.sort_order);
    for (const task of list) {
      if (task.children && task.children.length > 0) {
        sortTasks(task.children);
      }
    }
  };

  sortTasks(roots);
  return roots;
}

export function flattenTaskTree(tasks: Task[]): Task[] {
  const result: Task[] = [];
  const traverse = (list: Task[]) => {
    for (const task of list) {
      result.push(task);
      if (task.children && task.children.length > 0) {
        traverse(task.children);
      }
    }
  };
  traverse(tasks);
  return result;
}

export function hasIncompleteTasks(task: Task): boolean {
  if (task.status === 'pending' || task.status === 'in_progress') {
    return true;
  }

  if (task.children) {
    return task.children.some(child => hasIncompleteTasks(child));
  }

  return false;
}


