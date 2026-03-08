ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT;
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_rule ON tasks(recurrence_rule);
