UPDATE calendar_connections
SET
    last_sync_at = :last_sync_at,
    updated_at = :updated_at
WHERE
    id = :id
    AND user_id = :user_id
    AND workspace_id = :workspace_id
    AND is_deleted = 0;
