CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    show_onboarding INTEGER NOT NULL DEFAULT 1,
    current_workspace_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (current_workspace_id) REFERENCES workspaces(id)
);

CREATE INDEX IF NOT EXISTS idx_users_current_workspace_id ON users(current_workspace_id);

ALTER TABLE projects ADD COLUMN user_id TEXT NOT NULL DEFAULT 'U1';

ALTER TABLE tasks ADD COLUMN user_id TEXT NOT NULL DEFAULT 'U1';
ALTER TABLE tasks ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'W1';

ALTER TABLE labels ADD COLUMN user_id TEXT NOT NULL DEFAULT 'U1';
ALTER TABLE labels ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'W1';

CREATE INDEX IF NOT EXISTS idx_projects_user_workspace ON projects(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_workspace ON tasks(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_labels_user_workspace_name ON labels(user_id, workspace_id, name);

INSERT INTO workspaces (id, name, plan, is_archived, created_at, updated_at)
VALUES ('W1', 'Default Workspace', 'free', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(id) DO NOTHING;

INSERT INTO users (id, email, name, show_onboarding, current_workspace_id, created_at, updated_at)
VALUES (
    'U1',
    'owner@example.com',
    'Owner',
    0,
    'W1',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
ON CONFLICT(id) DO UPDATE SET
    email = excluded.email,
    name = excluded.name,
    show_onboarding = 0,
    current_workspace_id = excluded.current_workspace_id,
    updated_at = excluded.updated_at;

INSERT INTO workspace_users (workspace_id, user_id, email, name, role, created_at)
VALUES ('W1', 'U1', 'owner@example.com', 'Owner', 'owner', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(workspace_id, user_id) DO UPDATE SET
    email = excluded.email,
    name = excluded.name,
    role = excluded.role;

UPDATE projects
SET
    workspace_id = COALESCE(NULLIF(workspace_id, ''), 'W1'),
    user_id = COALESCE(NULLIF(user_id, ''), 'U1');

UPDATE tasks
SET
    workspace_id = COALESCE(NULLIF(workspace_id, ''), 'W1'),
    user_id = COALESCE(NULLIF(user_id, ''), 'U1');

UPDATE labels
SET
    workspace_id = COALESCE(NULLIF(workspace_id, ''), 'W1'),
    user_id = COALESCE(NULLIF(user_id, ''), 'U1');

PRAGMA foreign_keys = OFF;

ALTER TABLE board_states RENAME TO board_states_old;

CREATE TABLE board_states (
    board_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (board_id, user_id, workspace_id)
);

INSERT INTO board_states (board_id, user_id, workspace_id, state_json, updated_at)
SELECT board_id, 'U1', 'W1', state_json, updated_at
FROM board_states_old;

DROP TABLE board_states_old;

CREATE INDEX IF NOT EXISTS idx_board_states_updated_at ON board_states(updated_at);
CREATE INDEX IF NOT EXISTS idx_board_states_user_workspace ON board_states(user_id, workspace_id);

PRAGMA foreign_keys = ON;
