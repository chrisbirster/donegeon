SELECT state_json
FROM board_states
WHERE board_id = :board_id
  AND workspace_id = :workspace_id;
