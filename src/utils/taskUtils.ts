import type { Task, TaskStatus, TaskStatusSummary } from '../types';

// =============================================
// Task Status Computation Utilities
// =============================================

export function hasChildren(task: Task): boolean {
  return Array.isArray(task.children) && task.children.length > 0;
}

export function isCheckboxInteractive(task: Task): boolean {
  return !hasChildren(task);
}

// Effective status reflects the derived state from descendants.
// Parents whose stored `status` is not terminal (completed/discarded) are
// computed from their children — recursively, so deeply nested hierarchies
// are evaluated correctly.
export function getEffectiveStatus(task: Task): TaskStatus {
  if (task.status === 'completed' || task.status === 'discarded') {
    return task.status;
  }

  if (hasChildren(task)) {
    return computeParentStatus(task.children!);
  }
  return task.status;
}

export function computeParentStatus(children: Task[]): TaskStatus {
  const activeChildren = children.filter(c => getEffectiveStatus(c) !== 'discarded');

  if (activeChildren.length === 0) return 'completed';

  const allCompleted = activeChildren.every(c => getEffectiveStatus(c) === 'completed');
  if (allCompleted) return 'completed';

  const anyProgress = activeChildren.some(c => {
    const s = getEffectiveStatus(c);
    return s === 'in_progress' || s === 'completed';
  });
  if (anyProgress) return 'in_progress';

  return 'pending';
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
    // Use effective status so a parent whose children are all completed
    // is counted as completed even if its stored DB status is still 'pending'.
    switch (getEffectiveStatus(task)) {
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

  let activeCount = 0;
  let completedCount = 0;

  // Use effective status so multi-level hierarchies aggregate correctly:
  // a child that is itself a parent counts as completed when all of its
  // own descendants are completed, regardless of the child's stored status.
  for (const child of task.children!) {
    const status = getEffectiveStatus(child);
    if (status !== 'discarded') {
      activeCount++;
      if (status === 'completed') {
        completedCount++;
      }
    }
  }

  if (activeCount === 0) return 100;
  return Math.round((completedCount / activeCount) * 100);
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
  // Parents are evaluated by their children — the stored `status` of an
  // intermediate parent is unreliable, so always recurse first.
  if (hasChildren(task)) {
    return task.children!.some(child => hasIncompleteTasks(child));
  }

  return task.status === 'pending' || task.status === 'in_progress';
}



export function getLeafTasks(tasks: Task[]): Task[] {
  const result: Task[] = [];
  const traverse = (list: Task[]) => {
    for (const task of list) {
      if (task.children && task.children.length > 0) {
        traverse(task.children);
      } else {
        result.push(task);
      }
    }
  };
  traverse(tasks);
  return result;
}

export function filterTasksByStatus(tasks: Task[], status: TaskStatus): Task[] {
  const result: Task[] = [];
  for (const task of tasks) {
    if (task.children && task.children.length > 0) {
      const filteredChildren = filterTasksByStatus(task.children, status);
      if (filteredChildren.length > 0) {
        result.push({ ...task, children: filteredChildren });
      } else if (task.status === status) {
        result.push({ ...task, children: [] });
      }
    } else if (task.status === status) {
      result.push(task);
    }
  }
  return result;
}
