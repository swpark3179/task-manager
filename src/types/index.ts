// =============================================
// Task Manager - TypeScript Type Definitions
// =============================================

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'discarded';

export interface Task {
  id: string;
  user_id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  created_date: string;
  completed_at: string | null;
  discarded_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Frontend-only (not stored in DB)
  children?: Task[];
  progress_logs?: ProgressLog[];
}

export interface ProgressLog {
  id: string;
  user_id: string;
  task_id: string;
  log_date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DailyTaskSnapshot {
  id: string;
  user_id: string;
  task_id: string;
  snapshot_date: string;
  status: TaskStatus;
  created_at: string;
}

export interface ProxySettings {
  enabled: boolean;
  host: string;
  port: number;
}

export interface AppSettings {
  proxy: ProxySettings;
  lastActiveDate: string;
}

export interface TaskStatusSummary {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  discarded: number;
}

export interface CalendarCellData {
  date: string;
  tasks: DailyTaskSnapshot[];
  summary: TaskStatusSummary;
}

// Database operation types
export interface CreateTaskInput {
  title: string;
  parent_id?: string | null;
  description?: string | null;
  created_date?: string;
  sort_order?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  completed_at?: string | null;
  discarded_at?: string | null;
  sort_order?: number;
  created_date?: string;
}

export interface UpsertProgressLogInput {
  task_id: string;
  log_date: string;
  content: string;
}
