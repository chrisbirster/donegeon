SELECT
    state,
    user_id,
    workspace_id,
    provider,
    code_verifier,
    redirect_uri,
    expires_at,
    created_at,
    consumed_at
FROM calendar_oauth_states
WHERE
    state = :state
    AND provider = :provider
    AND user_id = :user_id
    AND workspace_id = :workspace_id
LIMIT 1;
