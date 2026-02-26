INSERT OR IGNORE INTO projects (
    id,
    name,
    is_inbox_project,
    is_archived,
    is_favorite,
    workspace_id,
    created_at,
    updated_at
) VALUES (
    'board',
    'board',
    0,
    0,
    0,
    NULL,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

INSERT OR IGNORE INTO projects (
    id,
    name,
    is_inbox_project,
    is_archived,
    is_favorite,
    workspace_id,
    created_at,
    updated_at
) VALUES (
    'inbox',
    'inbox',
    1,
    0,
    0,
    NULL,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

UPDATE projects
SET
    is_inbox_project = 1,
    is_archived = 0,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'inbox';
