SELECT id, email, name_hint, code_hash, code_length, expires_at, consumed_at, attempt_count
FROM auth_login_challenges
WHERE id = ?
LIMIT 1
