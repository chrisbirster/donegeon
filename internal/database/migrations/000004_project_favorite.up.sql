ALTER TABLE projects ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_projects_is_favorite ON projects(is_favorite);
