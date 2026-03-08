PRAGMA foreign_keys = OFF;

ALTER TABLE board_states RENAME TO board_states_new;

CREATE TABLE board_states (
    board_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (board_id, user_id, workspace_id)
);

INSERT INTO board_states (board_id, user_id, workspace_id, state_json, updated_at)
SELECT
    s.board_id,
    COALESCE(
        (
            SELECT bm.user_id
            FROM board_memberships bm
            WHERE bm.workspace_id = s.workspace_id
              AND LOWER(bm.board_id) = LOWER(s.board_id)
            ORDER BY bm.updated_at DESC, bm.created_at DESC, bm.user_id ASC
            LIMIT 1
        ),
        'U1'
    ) AS user_id,
    s.workspace_id,
    s.state_json,
    s.updated_at
FROM board_states_new s;

DROP TABLE board_states_new;

DROP INDEX IF EXISTS idx_board_states_workspace;
CREATE INDEX IF NOT EXISTS idx_board_states_updated_at ON board_states(updated_at);
CREATE INDEX IF NOT EXISTS idx_board_states_user_workspace ON board_states(user_id, workspace_id);

DROP TABLE IF EXISTS board_memberships;

PRAGMA foreign_keys = ON;
