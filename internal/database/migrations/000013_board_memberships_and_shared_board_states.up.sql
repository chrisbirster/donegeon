PRAGMA foreign_keys = OFF;

ALTER TABLE board_states RENAME TO board_states_old;

CREATE TABLE board_states (
    board_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (board_id, workspace_id)
);

INSERT INTO board_states (board_id, workspace_id, state_json, updated_at)
SELECT
    ranked.board_id,
    ranked.workspace_id,
    ranked.state_json,
    ranked.updated_at
FROM (
    SELECT
        board_id,
        workspace_id,
        state_json,
        updated_at,
        ROW_NUMBER() OVER (
            PARTITION BY board_id, workspace_id
            ORDER BY updated_at DESC, rowid DESC
        ) AS row_num
    FROM board_states_old
) ranked
WHERE ranked.row_num = 1;

DROP TABLE board_states_old;

DROP INDEX IF EXISTS idx_board_states_user_workspace;
CREATE INDEX IF NOT EXISTS idx_board_states_workspace ON board_states(workspace_id);
CREATE INDEX IF NOT EXISTS idx_board_states_updated_at ON board_states(updated_at);

CREATE TABLE IF NOT EXISTS board_memberships (
    board_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (board_id, workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_board_memberships_workspace_user ON board_memberships(workspace_id, user_id);
CREATE INDEX IF NOT EXISTS idx_board_memberships_workspace_board ON board_memberships(workspace_id, board_id);

WITH board_projects AS (
    SELECT
        COALESCE(NULLIF(TRIM(p.workspace_id), ''), 'W1') AS workspace_id,
        LOWER(
            CASE
                WHEN INSTR(p.id, '::') > 0 THEN SUBSTR(p.id, INSTR(p.id, '::') + 2)
                ELSE p.id
            END
        ) AS board_slug,
        COALESCE(NULLIF(TRIM(p.user_id), ''), 'U1') AS owner_user_id
    FROM projects p
    WHERE TRIM(COALESCE(p.id, '')) <> ''
),
seed_memberships AS (
    SELECT
        'default' AS board_id,
        bp.workspace_id,
        wu.user_id
    FROM board_projects bp
    JOIN workspace_users wu
        ON wu.workspace_id = bp.workspace_id
    WHERE bp.board_slug = 'board'

    UNION

    SELECT
        bp.board_slug AS board_id,
        bp.workspace_id,
        bp.owner_user_id AS user_id
    FROM board_projects bp
    WHERE bp.board_slug LIKE 'board-%'
)
INSERT INTO board_memberships (
    board_id,
    workspace_id,
    user_id,
    created_at,
    updated_at
)
SELECT
    board_id,
    workspace_id,
    user_id,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now') AS created_at,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now') AS updated_at
FROM seed_memberships
WHERE 1 = 1
ON CONFLICT(board_id, workspace_id, user_id) DO UPDATE SET
    updated_at = excluded.updated_at;

PRAGMA foreign_keys = ON;
