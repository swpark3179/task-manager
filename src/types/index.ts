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
  // 단일 일정(start_date == end_date)일 때만 사용. 'HH:MM' or 'HH:MM:SS'.
  scheduled_time: string | null;
  // 알림이 발화될 절대 시각(ISO timestamp, UTC). null이면 알림 미설정.
  notify_at: string | null;
  // "예정 시각 N분 전" 모드일 때 표시용. null이면 절대 시각 모드.
  notify_offset_minutes: number | null;
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
  // Frontend-only: 사용자가 작업의 created_date에 직접 진행 스냅샷을 남겨두었는지 여부.
  // 상세 탭의 "오늘 진행 기록" 토글 버튼이 이 값을 기준으로 활성/비활성 상태를 보여줍니다.
  has_snapshot?: boolean;
  // Frontend-only: 상위작업이 다른 날짜에 있을 때 표시용 메타데이터.
  // 완료된 하위작업이 원래 날짜에 남았을 때, 이관된 상위작업으로 이동할 수 있는 링크를 제공합니다.
  parent_info?: {
    id: string;
    title: string;
    created_date: string;
  };
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

export type HolidayType = 'holiday' | 'anniversary' | 'birthday';

export interface Holiday {
  id: string;
  user_id: string;
  // YYYY-MM-DD. recurring_yearly=true 인 경우 month/day 만 의미가 있으며
  // 캘린더 렌더링 시 표시 중인 연도로 매년 펼쳐져 보입니다.
  date: string;
  title: string;
  type: HolidayType;
  recurring_yearly: boolean;
  color: string | null;
  created_at: string;
  updated_at: string;
  // Frontend-only: 빌트인 한국 공휴일은 DB에 저장되지 않으며 이 플래그로 구분됩니다.
  is_builtin?: boolean;
}

export interface CreateHolidayInput {
  date: string;
  title: string;
  type?: HolidayType;
  recurring_yearly?: boolean;
  color?: string | null;
}

export interface UpdateHolidayInput {
  date?: string;
  title?: string;
  type?: HolidayType;
  recurring_yearly?: boolean;
  color?: string | null;
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
  scheduled_time?: string | null;
  notify_at?: string | null;
  notify_offset_minutes?: number | null;
}

export interface UpdateScheduleInput {
  title?: string;
  category_id?: string | null;
  description?: string | null;
  start_date?: string;
  end_date?: string;
  estimated_time?: string | null;
  scheduled_time?: string | null;
  notify_at?: string | null;
  notify_offset_minutes?: number | null;
}
