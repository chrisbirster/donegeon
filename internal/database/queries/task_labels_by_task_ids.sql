SELECT
    tl.task_id,
    l.name
FROM task_labels tl
JOIN labels l ON l.id = tl.label_id
WHERE tl.task_id IN (?)
ORDER BY tl.created_at ASC, LOWER(l.name) ASC
