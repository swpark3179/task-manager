// =============================================
// Task Manager - TypeScript Type Definitions
// =============================================

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'discarded';

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
}


export interface Schedule {
  id: string;
  user_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  estimated_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  parent_id: string | null;
  category_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  low_priority: boolean;
  created_date: string;
  completed_at: string | null;
  discarded_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Frontend-only (not stored in DB)
  children?: Task[];
  is_snapshot?: boolean;
}


export interface DailyTaskSnapshot {
  is_snapshot?: boolean;
  id: string;
  user_id: string;
  task_id: string;
  snapshot_date: string;
  status: TaskStatus;
  created_at: string;
  title?: string;
  category_id?: string | null;
  parent_id?: string | null;
  description?: string | null;
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
  schedules: Schedule[];
  summary: TaskStatusSummary;
}

// Database operation types
export interface CreateTaskInput {
  id?: string;
  title: string;
  parent_id?: string | null;
  category_id?: string | null;
  description?: string | null;
  low_priority?: boolean;
  created_date?: string;
  sort_order?: number;
}

export interface UpdateTaskInput {
  title?: string;
  category_id?: string | null;
  description?: string | null;
  status?: TaskStatus;
  low_priority?: boolean;
  completed_at?: string | null;
  discarded_at?: string | null;
  sort_order?: number;
  created_date?: string;
}

export interface CreateScheduleInput {
  title: string;
  category_id?: string | null;
  description?: string | null;
  start_date: string;
  end_date: string;
  estimated_time?: string | null;
}

export interface UpdateScheduleInput {
  title?: string;
  category_id?: string | null;
  description?: string | null;
  start_date?: string;
  end_date?: string;
  estimated_time?: string | null;
}
