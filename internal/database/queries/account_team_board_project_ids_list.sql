SELECT id
FROM projects
WHERE workspace_id = ?
  AND (
    LOWER(
      CASE
        WHEN INSTR(id, '::') > 0 THEN SUBSTR(id, INSTR(id, '::') + 2)
        ELSE id
      END
    ) = 'board-team'
    OR LOWER(
      CASE
        WHEN INSTR(id, '::') > 0 THEN SUBSTR(id, INSTR(id, '::') + 2)
        ELSE id
      END
    ) LIKE 'board-team-%'
  )
ORDER BY id ASC;
