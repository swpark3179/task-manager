-- =============================================
-- Task Manager - Supabase Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- 할일 테이블 (트리 구조 지원)
-- =============================================
CREATE TABLE tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES tasks(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','in_progress','completed','discarded')),
  created_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at  TIMESTAMPTZ,
  discarded_at  TIMESTAMPTZ,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX idx_tasks_created_date ON tasks(created_date);
CREATE INDEX idx_tasks_status ON tasks(status);

-- =============================================
-- 수행내용 로그 (날짜별 작업 기록)
-- =============================================
CREATE TABLE progress_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  log_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, log_date)
);

CREATE INDEX idx_progress_logs_user_id ON progress_logs(user_id);
CREATE INDEX idx_progress_logs_task_id ON progress_logs(task_id);
CREATE INDEX idx_progress_logs_log_date ON progress_logs(log_date);

-- =============================================
-- 일자별 할일 스냅샷 (이관 기록 & 히스토리)
-- =============================================
CREATE TABLE daily_task_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  status        TEXT NOT NULL
                CHECK (status IN ('pending','in_progress','completed','discarded')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, snapshot_date)
);

CREATE INDEX idx_snapshots_user_id ON daily_task_snapshots(user_id);
CREATE INDEX idx_snapshots_date ON daily_task_snapshots(snapshot_date);
CREATE INDEX idx_snapshots_task ON daily_task_snapshots(task_id);

-- =============================================
-- Row Level Security (RLS)
-- =============================================

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_task_snapshots ENABLE ROW LEVEL SECURITY;

-- tasks RLS
CREATE POLICY "Users can view own tasks"
  ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own tasks"
  ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks"
  ON tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks"
  ON tasks FOR DELETE USING (auth.uid() = user_id);

-- progress_logs RLS
CREATE POLICY "Users can view own progress logs"
  ON progress_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own progress logs"
  ON progress_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress logs"
  ON progress_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own progress logs"
  ON progress_logs FOR DELETE USING (auth.uid() = user_id);

-- daily_task_snapshots RLS
CREATE POLICY "Users can view own snapshots"
  ON daily_task_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own snapshots"
  ON daily_task_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================
-- updated_at 자동 갱신 트리거
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER progress_logs_updated_at
  BEFORE UPDATE ON progress_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
