UPDATE tasks
SET checked = 1,
    updated_at = ?
WHERE id = ? AND is_deleted = 0;
