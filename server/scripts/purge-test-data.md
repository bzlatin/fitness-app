# Purge Test Data (One-Time, Production)

This repo includes dev/demo seed users (e.g. `demo-user`) and other test rows that should never exist in production.

## What the purge targets

- Users with:
  - IDs in the known dev seed list (`demo-user`, `demo-lifter`, etc)
  - Emails ending in `@example.com`
- Related rows that block deleting users (non-cascading FKs), plus common demo artifacts:
  - `subscription_events`
  - `appstore_notifications`
  - `template_shares`
  - `workout_templates` (no FK to users, so we delete explicitly)
- Waitlist rows with emails ending in `@example.com`

## Runbook

1) Make sure you have the **production** `DATABASE_URL` locally (do not commit it).

2) Dry run (prints what it would delete):

```bash
cd server
DATABASE_URL='...' npm run purge:test-data
```

Note: The server bootstrap will refuse to seed demo data against Supabase/hosted DBs unless `DB_BOOTSTRAP_MODE=prod`, so keep that default for production.

3) Execute (requires explicit confirmation env var):

```bash
cd server
DATABASE_URL='...' CONFIRM_TEST_DATA_PURGE=DELETE_TEST_DATA npm run purge:test-data -- --execute
```

## Safety notes

- The script is intentionally conservative and only targets obvious demo/test patterns.
- Always run the dry run first and sanity-check the user IDs before executing.
