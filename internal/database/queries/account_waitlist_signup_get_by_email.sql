SELECT
    id,
    name,
    email,
    source,
    requested_plan,
    created_at,
    updated_at
FROM waitlist_signups
WHERE email = ?
LIMIT 1;
