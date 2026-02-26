UPDATE tasks
SET checked = 1,
    processed_count = processed_count + CASE WHEN checked = 0 THEN 1 ELSE 0 END,
    updated_at = :updated_at
WHERE id = :id
  AND user_id = :user_id
  AND workspace_id = :workspace_id
  AND is_deleted = 0;
