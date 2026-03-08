CREATE TABLE IF NOT EXISTS calendar_connections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    external_account_id TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    access_token TEXT,
    refresh_token TEXT,
    token_type TEXT,
    scope TEXT,
    expires_at TEXT,
    calendar_id TEXT NOT NULL DEFAULT 'primary',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_sync_at TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_connections_unique_account
    ON calendar_connections(user_id, workspace_id, provider, external_account_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_user_workspace
    ON calendar_connections(user_id, workspace_id, provider, is_deleted);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_updated_at
    ON calendar_connections(updated_at);

CREATE TABLE IF NOT EXISTS calendar_oauth_states (
    state TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    code_verifier TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    consumed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_calendar_oauth_states_expires
    ON calendar_oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_calendar_oauth_states_lookup
    ON calendar_oauth_states(user_id, workspace_id, provider, consumed_at);
