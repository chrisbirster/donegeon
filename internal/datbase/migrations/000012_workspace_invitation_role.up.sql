ALTER TABLE workspace_invitations
ADD COLUMN role TEXT NOT NULL DEFAULT 'editor';

UPDATE workspace_invitations
SET role = 'editor'
WHERE TRIM(COALESCE(role, '')) = ''
   OR LOWER(TRIM(role)) = 'member';
