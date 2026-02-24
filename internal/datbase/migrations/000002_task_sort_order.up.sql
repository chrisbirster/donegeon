ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

UPDATE tasks
SET sort_order = rowid
WHERE sort_order = 0;

CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks(sort_order);
