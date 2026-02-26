SELECT state_json
FROM board_states
WHERE board_id = :board_id
  AND user_id = :user_id
  AND workspace_id = :workspace_id;
