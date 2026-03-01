UPDATE projects
SET
    is_archived = 1,
    updated_at = :updated_at
WHERE id = :id
  AND user_id = :user_id
  AND (
      workspace_id = :workspace_id
      OR workspace_id IS NULL
      OR workspace_id = ''
  );
