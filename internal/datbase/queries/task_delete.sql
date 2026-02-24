UPDATE tasks
SET is_deleted = 1,
    updated_at = ?
WHERE id = ?;
