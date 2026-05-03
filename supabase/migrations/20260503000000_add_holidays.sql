-- Custom holidays / anniversaries / birthdays
-- - date: YYYY-MM-DD. recurring_yearly=true 인 경우 month/day 만 의미가 있으며
--   매년 같은 날에 반복 표시됩니다.
-- - type: 'holiday' | 'anniversary' | 'birthday' (단순 분류 / 색상 구분용).
-- - color: 사용자가 지정한 색상 (null 이면 type 기본 색상 사용).
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'holiday'
    CHECK (type IN ('holiday','anniversary','birthday')),
  recurring_yearly BOOLEAN NOT NULL DEFAULT TRUE,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holidays_user_id ON holidays(user_id);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own holidays" ON holidays
  FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER holidays_updated_at
  BEFORE UPDATE ON holidays
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
