CREATE TABLE IF NOT EXISTS waitlist_signups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    source TEXT NOT NULL DEFAULT '',
    requested_plan TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
