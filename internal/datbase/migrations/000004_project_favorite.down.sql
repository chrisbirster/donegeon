PRAGMA foreign_keys = OFF;

CREATE TABLE projects_tmp (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_inbox_project INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    workspace_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO projects_tmp (
    id,
    name,
    is_inbox_project,
    is_archived,
    workspace_id,
    created_at,
    updated_at
)
SELECT
    id,
    name,
    is_inbox_project,
    is_archived,
    workspace_id,
    created_at,
    updated_at
FROM projects;

DROP TABLE projects;
ALTER TABLE projects_tmp RENAME TO projects;

PRAGMA foreign_keys = ON;
