UPDATE workspaces
SET
	plan = ?,
	trial_ends_at = NULL,
	stripe_customer_id = ?,
	stripe_subscription_id = ?,
	stripe_price_id = ?,
	billing_email = CASE
		WHEN TRIM(COALESCE(?, '')) <> '' THEN ?
		ELSE billing_email
	END,
	updated_at = ?
WHERE id = ?
