PRAGMA foreign_keys = OFF;

ALTER TABLE board_states RENAME TO board_states_new;

CREATE TABLE board_states (
    board_id TEXT PRIMARY KEY,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO board_states (board_id, state_json, updated_at)
SELECT board_id, state_json, updated_at
FROM board_states_new
WHERE user_id = 'U1' AND workspace_id = 'W1';

DROP TABLE board_states_new;

DROP INDEX IF EXISTS idx_board_states_user_workspace;
CREATE INDEX IF NOT EXISTS idx_board_states_updated_at ON board_states(updated_at);

DROP INDEX IF EXISTS idx_labels_user_workspace_name;
DROP INDEX IF EXISTS idx_tasks_user_workspace;
DROP INDEX IF EXISTS idx_projects_user_workspace;
DROP INDEX IF EXISTS idx_users_current_workspace_id;
DROP TABLE IF EXISTS users;

PRAGMA foreign_keys = ON;

