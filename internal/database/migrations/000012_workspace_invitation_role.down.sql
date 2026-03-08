PRAGMA foreign_keys=OFF;

CREATE TABLE workspace_invitations__old (
    invitation_code TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

INSERT INTO workspace_invitations__old (
    invitation_code,
    workspace_id,
    email,
    status,
    created_at,
    updated_at
)
SELECT
    invitation_code,
    workspace_id,
    email,
    status,
    created_at,
    updated_at
FROM workspace_invitations;

DROP TABLE workspace_invitations;

ALTER TABLE workspace_invitations__old RENAME TO workspace_invitations;

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace_id ON workspace_invitations(workspace_id);

PRAGMA foreign_keys=ON;
