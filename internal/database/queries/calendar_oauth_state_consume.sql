UPDATE calendar_oauth_states
SET consumed_at = :consumed_at
WHERE
    state = :state
    AND consumed_at IS NULL;
