CREATE TABLE IF NOT EXISTS auth_login_challenges (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name_hint TEXT,
    code_hash TEXT NOT NULL,
    code_length INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    consumed_at TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TEXT,
    requested_ip TEXT,
    requested_user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_login_challenges_email_created
    ON auth_login_challenges(email, created_at);
CREATE INDEX IF NOT EXISTS idx_auth_login_challenges_expires
    ON auth_login_challenges(expires_at);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    last_seen_at TEXT,
    user_agent TEXT,
    ip_address TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id
    ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires
    ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_revoked
    ON auth_sessions(revoked_at);
