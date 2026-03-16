UPDATE workspaces
SET
	plan = ?,
	trial_ends_at = NULL,
	stripe_subscription_id = NULL,
	stripe_price_id = NULL,
	updated_at = ?
WHERE id = ?
