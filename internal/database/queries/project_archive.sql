UPDATE projects
SET
    is_archived = 1,
    updated_at = :updated_at
WHERE id = :id
  AND (
      workspace_id = :workspace_id
      OR workspace_id IS NULL
      OR workspace_id = ''
  )
  AND (
      (
          LOWER(
              CASE
                  WHEN INSTR(projects.id, '::') > 0 THEN SUBSTR(projects.id, INSTR(projects.id, '::') + 2)
                  ELSE projects.id
              END
          ) <> 'board'
          AND LOWER(
              CASE
                  WHEN INSTR(projects.id, '::') > 0 THEN SUBSTR(projects.id, INSTR(projects.id, '::') + 2)
                  ELSE projects.id
              END
          ) NOT LIKE 'board-%'
      )
      OR EXISTS (
          SELECT 1
          FROM board_memberships bm
          WHERE bm.workspace_id = :workspace_id
            AND bm.user_id = :user_id
            AND LOWER(bm.board_id) = LOWER(
                CASE
                    WHEN LOWER(
                        CASE
                            WHEN INSTR(projects.id, '::') > 0 THEN SUBSTR(projects.id, INSTR(projects.id, '::') + 2)
                            ELSE projects.id
                        END
                    ) = 'board' THEN 'default'
                    ELSE CASE
                        WHEN INSTR(projects.id, '::') > 0 THEN SUBSTR(projects.id, INSTR(projects.id, '::') + 2)
                        ELSE projects.id
                    END
                END
            )
      )
  );
