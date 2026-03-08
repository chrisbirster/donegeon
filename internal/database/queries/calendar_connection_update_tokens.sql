UPDATE calendar_connections
SET
    access_token = :access_token,
    refresh_token = CASE
        WHEN :refresh_token IS NULL OR :refresh_token = '' THEN refresh_token
        ELSE :refresh_token
    END,
    token_type = :token_type,
    scope = :scope,
    expires_at = :expires_at,
    updated_at = :updated_at
WHERE
    id = :id
    AND user_id = :user_id
    AND workspace_id = :workspace_id
    AND is_deleted = 0;
