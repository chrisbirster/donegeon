SELECT
    id,
    provider,
    external_account_id,
    email,
    access_token,
    refresh_token,
    token_type,
    scope,
    expires_at,
    calendar_id,
    created_at,
    updated_at,
    last_sync_at
FROM calendar_connections
WHERE
    user_id = :user_id
    AND workspace_id = :workspace_id
    AND provider = :provider
    AND external_account_id = :external_account_id
    AND is_deleted = 0
LIMIT 1;
