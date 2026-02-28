DROP INDEX IF EXISTS idx_auth_sessions_revoked;
DROP INDEX IF EXISTS idx_auth_sessions_expires;
DROP INDEX IF EXISTS idx_auth_sessions_user_id;
DROP TABLE IF EXISTS auth_sessions;

DROP INDEX IF EXISTS idx_auth_login_challenges_expires;
DROP INDEX IF EXISTS idx_auth_login_challenges_email_created;
DROP TABLE IF EXISTS auth_login_challenges;
