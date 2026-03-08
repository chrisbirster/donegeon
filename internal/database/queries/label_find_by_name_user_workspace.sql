SELECT
    id
FROM labels
WHERE LOWER(name) = LOWER(?)
  AND user_id = ?
  AND workspace_id = ?
LIMIT 1;
