-- Add is_favorite column to tasks for per-user task favoriting.
-- Defaults to FALSE so existing tasks remain unchanged after the migration.
ALTER TABLE tasks ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index: most rows are not favorited, so we only index the small
-- "favorite" subset to keep queries that filter by favorite cheap.
CREATE INDEX idx_tasks_is_favorite ON tasks(user_id, is_favorite) WHERE is_favorite = TRUE;
