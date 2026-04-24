-- Add scheduled time and notification fields to schedules
-- - scheduled_time: 단일 일정(start_date == end_date)일 때 예정 시각 (HH:MM:SS)
-- - notify_at: 절대 알림 시각 (UTC TIMESTAMP). 알림이 발화될 시점.
-- - notify_offset_minutes: "예정 시각 N분 전" 모드일 때 표시용으로 저장.
--   notify_at = (start_date + scheduled_time) - notify_offset_minutes 로 계산되어 저장됨.
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS scheduled_time TIME NULL,
  ADD COLUMN IF NOT EXISTS notify_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS notify_offset_minutes INTEGER NULL;

CREATE INDEX IF NOT EXISTS idx_schedules_notify_at ON schedules(notify_at)
  WHERE notify_at IS NOT NULL;
