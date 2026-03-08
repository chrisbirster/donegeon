INSERT OR IGNORE INTO task_labels (
    task_id,
    label_id,
    created_at
) VALUES (
    ?,
    ?,
    ?
);
