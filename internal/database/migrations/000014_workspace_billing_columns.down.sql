PRAGMA foreign_keys=OFF;

ALTER TABLE workspaces RENAME TO workspaces__with_billing;

CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO workspaces (
    id,
    name,
    plan,
    is_archived,
    created_at,
    updated_at
)
SELECT
    id,
    name,
    plan,
    is_archived,
    created_at,
    updated_at
FROM workspaces__with_billing;

DROP TABLE workspaces__with_billing;

DROP INDEX IF EXISTS idx_workspaces_stripe_customer_id;
DROP INDEX IF EXISTS idx_workspaces_stripe_subscription_id;

PRAGMA foreign_keys=ON;
