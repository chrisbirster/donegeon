SELECT COUNT(*)
FROM tasks
WHERE user_id = :user_id
  AND workspace_id = :workspace_id
  AND is_deleted = 0
  AND (:project_id IS NULL OR project_id = :project_id);
