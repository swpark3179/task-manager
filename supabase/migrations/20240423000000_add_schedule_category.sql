-- Add category_id to schedules
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schedules_category_id ON schedules(category_id);
