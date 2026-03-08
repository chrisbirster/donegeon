ALTER TABLE tasks ADD COLUMN processed_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_tasks_processed_count ON tasks(processed_count);
