-- Create Schedules table
CREATE TABLE IF NOT EXISTS schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, -- references auth.users(id)
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  estimated_time TEXT, -- e.g., "2h", "15:00", or some custom format if start_date == end_date
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on Schedules
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own schedules" ON schedules
  FOR ALL USING (auth.uid() = user_id);

-- Trigger for Schedules updated_at
CREATE TRIGGER update_schedules_updated_at
    BEFORE UPDATE ON schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
