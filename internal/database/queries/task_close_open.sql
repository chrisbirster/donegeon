UPDATE tasks
SET checked = 1,
    processed_count = processed_count + 1,
    updated_at = :updated_at
WHERE id = :id
  AND user_id = :user_id
  AND workspace_id = :workspace_id
  AND is_deleted = 0
  AND checked = 0;
