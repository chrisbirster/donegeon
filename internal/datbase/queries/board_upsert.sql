INSERT INTO board_states (board_id, user_id, workspace_id, state_json, updated_at)
VALUES (:board_id, :user_id, :workspace_id, :state_json, :updated_at)
ON CONFLICT(board_id, user_id, workspace_id) DO UPDATE SET
    state_json = excluded.state_json,
    updated_at = excluded.updated_at;
