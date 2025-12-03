# Subscription Platform Switching

Push / Pull tracks the source of a subscription in `users.subscription_platform` (`"stripe"`, `"apple"`, or `null`) and keeps the relevant IDs (`stripe_subscription_id`, `apple_original_transaction_id`). When a user moves between platforms (Android → iOS or vice versa) you can keep entitlements in sync by following these steps:

## Stripe → Apple (Android user moves to iOS)
1. Cancel the Stripe subscription via `/api/subscriptions/cancel` or the Stripe billing portal so the user no longer renews on Stripe. The webhook will set `plan` to `free` once the current period ends.
2. On iOS, have the user buy the Apple subscription (`pro_monthly_subscription` or `pro_yearly_subscription`). The client sends the transaction ID to `POST /api/subscriptions/ios/validate-receipt` and the server: validates against Apple, stores `apple_original_transaction_id`, sets `subscription_platform = 'apple'`, and marks the plan as `pro`.
3. Confirm `GET /api/subscriptions/status` now returns `subscriptionPlatform: 'apple'` and the migration is complete.

## Apple → Stripe (iOS user moves to Android or Web)
1. Ask the user to cancel their Apple subscription from Settings (the webhook listens for `DID_CHANGE_RENEWAL_STATUS`, `EXPIRED`, `REFUND`, etc.). Once Apple reports the cancelation, `subscription_platform` reverts to `'apple'` with `plan = 'free'`.
2. Create a new Stripe checkout session via `/api/subscriptions/create-checkout-session`. After payment, the Stripe webhook sets `subscription_platform = 'stripe'`, records `stripe_subscription_id`, and `plan` becomes `'pro'`.
3. Verify `/api/subscriptions/status` shows `subscriptionPlatform: 'stripe'` and the Stripe `currentInterval` reflects the new plan.

## Manual fixes
Sometimes transactions get out of sync (e.g., webhook retries or sandbox receipts). Run this query to double-check the platform:

```sql
SELECT id, email, plan, plan_expires_at, subscription_platform,
       stripe_subscription_id, apple_original_transaction_id
FROM users
WHERE id = $1;
```

If you need to force a change during debugging, update the relevant columns (and `updated_at`):

```sql
UPDATE users
SET plan = 'pro',
    plan_expires_at = NOW() + INTERVAL '1 month',
    subscription_platform = 'stripe',
    stripe_subscription_id = 'sub_...',
    apple_original_transaction_id = NULL,
    updated_at = NOW()
WHERE id = $1;
```

## Notes
- Never mix Apple data into `stripe_subscription_id`. Keep the source IDs separate and trust `subscription_platform` when gating features.
- Always call `GET /api/subscriptions/status` after a migration so the client gets the current `plan` + `currentInterval` before unlocking premium experiences.
