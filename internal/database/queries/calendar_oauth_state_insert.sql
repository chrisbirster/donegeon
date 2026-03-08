INSERT INTO calendar_oauth_states (
    state,
    user_id,
    workspace_id,
    provider,
    code_verifier,
    redirect_uri,
    expires_at,
    created_at,
    consumed_at
)
VALUES (
    :state,
    :user_id,
    :workspace_id,
    :provider,
    :code_verifier,
    :redirect_uri,
    :expires_at,
    :created_at,
    NULL
);
