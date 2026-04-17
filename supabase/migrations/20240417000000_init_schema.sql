-- Drop existing tables if they exist
DROP TABLE IF EXISTS progress_logs CASCADE;
DROP TABLE IF EXISTS daily_task_snapshots CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;

-- Type for task status
DROP TYPE IF EXISTS task_status CASCADE;
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'discarded');

-- Create Tasks table
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, -- references auth.users(id) if using supabase auth
  parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status task_status DEFAULT 'pending' NOT NULL,
  created_date DATE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  discarded_at TIMESTAMP WITH TIME ZONE,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create Progress Logs table
CREATE TABLE progress_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, -- references auth.users(id)
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(task_id, log_date)
);

-- Create Daily Task Snapshots table
CREATE TABLE daily_task_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, -- references auth.users(id)
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  status task_status NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(task_id, snapshot_date)
);

-- RLS Policies
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_task_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own tasks" ON tasks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own progress logs" ON progress_logs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own snapshots" ON daily_task_snapshots
  FOR ALL USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_progress_logs_updated_at
    BEFORE UPDATE ON progress_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
