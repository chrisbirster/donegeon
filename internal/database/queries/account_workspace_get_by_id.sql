SELECT
	id,
	name,
	plan,
	trial_ends_at,
	stripe_customer_id,
	stripe_subscription_id,
	is_archived,
	created_at,
	updated_at
FROM workspaces
WHERE id = ?
LIMIT 1;
