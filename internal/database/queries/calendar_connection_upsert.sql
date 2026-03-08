INSERT INTO calendar_connections (
    id,
    user_id,
    workspace_id,
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
    is_deleted
)
VALUES (
    :id,
    :user_id,
    :workspace_id,
    :provider,
    :external_account_id,
    :email,
    :access_token,
    :refresh_token,
    :token_type,
    :scope,
    :expires_at,
    :calendar_id,
    :created_at,
    :updated_at,
    0
)
ON CONFLICT(user_id, workspace_id, provider, external_account_id) DO UPDATE SET
    email = excluded.email,
    access_token = excluded.access_token,
    refresh_token = CASE
        WHEN excluded.refresh_token IS NULL OR excluded.refresh_token = '' THEN calendar_connections.refresh_token
        ELSE excluded.refresh_token
    END,
    token_type = excluded.token_type,
    scope = excluded.scope,
    expires_at = excluded.expires_at,
    calendar_id = excluded.calendar_id,
    is_deleted = 0,
    updated_at = excluded.updated_at;
