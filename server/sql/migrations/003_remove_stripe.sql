-- 003_remove_stripe.sql
-- IAP-only billing: remove Stripe-specific database fields.

ALTER TABLE users
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id;

DROP TABLE IF EXISTS subscription_events;

