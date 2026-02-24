SELECT COUNT(*)
FROM tasks
WHERE is_deleted = 0
  AND (:project_id IS NULL OR project_id = :project_id);
