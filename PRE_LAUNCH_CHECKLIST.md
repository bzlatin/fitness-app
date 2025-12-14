# Pre-Launch Checklist (Execution Plan)

This document turns the `ROADMAP.md` “🚀 MVP Launch Readiness” checklist into a concrete, repo-specific set of tasks with owners/validation steps.

## Launch Gate (Definition of Done)

You’re “ready to launch” when:

- Production API can boot against the production database without running any dev seed or destructive data resets.
- Auth cannot be bypassed in production (no “dev auth bypass” paths).
- High-risk endpoints (AI generation, payments/subscriptions, waitlist/signup) have rate limits and basic abuse protection.
- Logs are free of secrets and user PII; debug logs are gated behind environment flags.
- Permission/authz smoke tests pass (no cross-user data leakage).
- Web presence includes privacy/terms/support and the links are wired in-app.

## 1) Logging + PII Cleanup (Server + Mobile)

**Why**: Your roadmap explicitly calls out “strip debug/PII before release”.

### Server

- [x] Replace ad-hoc `console.log`/`console.error` with a minimal logger utility that:
  - [x] Uses log levels (`debug`, `info`, `warn`, `error`)
  - [x] Defaults to `info` in production (via `NODE_ENV`)
  - [x] Redacts common sensitive fields (`authorization`, `cookie`, `email`, `pushToken`, `accessToken`, `refreshToken`)
- [x] Audit and gate noisy logs in:
  - [x] `server/src/routes/ai.ts` (userId + request metadata)
  - [x] `server/src/services/ai/OpenAIProvider.ts` (generation logs)
  - [x] Cron job logging in `server/src/index.ts`

### Mobile

- [x] Remove or gate startup/env logging in `mobile/App.tsx` (currently logs env presence).
- [x] Stop logging push tokens in `mobile/src/services/notifications.ts` (tokens are sensitive identifiers).
- [x] Gate API base URL logging in `mobile/src/api/client.ts`.

**Validation**

- [x] Run app + server locally and confirm logs remain useful in dev.
- [x] Confirm `NODE_ENV=production` suppresses `debug` logs.

## 2) Database: Stop Auto-Seeding + Add Real Migrations

**Why**: Launch requires production-safe schema management and no demo/test data.

### Immediate must-fix

- [x] `server/src/db.ts` no longer always runs:
  - [x] `seedExercisesFromJson()` (includes `DELETE FROM exercises`)
  - [x] Inserts demo users/squads/statuses/shares
- [x] Production boot path is now non-destructive by default.

### Plan

- [x] Introduce an explicit “DB bootstrap mode”:
  - [x] `DB_BOOTSTRAP_MODE=dev|prod` (defaults to `prod` when `NODE_ENV=production`, otherwise `dev`)
  - [x] `dev`: apply migrations + seed demo/exercises
  - [x] `prod`: apply migrations only (no deletes, no demo seed)
- [x] Replace “`initDb()` does everything” with a simple migrations approach:
  - [x] `server/sql/migrations/` folder with numbered files
  - [x] Tiny migration runner that records applied migrations in a `schema_migrations` table

**Validation**

- [x] Start server pointed at an empty DB in `dev` mode → tables created + seeds loaded.
- [x] Start server pointed at production DB in `prod` mode → no seed data changes, no destructive deletes.

## 3) Security Hardening

**Why**: Roadmap calls for input validation, SQLi prevention, authz checks, dependency audit.

### Server basics

- [x] Add security headers (`helmet`).
- [x] Tighten CORS (no longer `cors()` open by default):
  - [x] Allow only your app domains (via `CORS_ALLOWED_ORIGINS`) + local dev hosts by default in dev
  - [x] Allow `Authorization` header explicitly
- [x] Add request size limits per-route where appropriate (AI / uploads).
- [x] Add input validation for high-risk endpoints (Zod):
  - [x] `POST /api/ai/generate-workout` (+ `POST /api/ai/swap-exercise`)
  - [x] subscription endpoints (`/create-checkout-session`, `/switch`, `/billing-portal`, `/ios/validate-receipt`)
  - [x] user-generated text fields (profile bio + comments + feedback)

### Auth bypass safety

- `ALLOW_DEV_AUTH_BYPASS` exists in `server/src/middleware/auth.ts`.
- [x] Add an explicit guard: bypass only when `NODE_ENV !== 'production'` (even if env var is mistakenly set).

**Validation**

- [x] Verify invalid inputs return 400 with clear messages.
- [x] Verify cross-user access attempts return 403/404 as appropriate.

## 4) Rate Limiting (Consistent + Production-Grade)

**Why**: Current AI rate limit is in-memory; it resets on deploy and doesn’t cover other endpoints.

### Plan

- [x] Add `express-rate-limit` (and optionally `rate-limit-redis` later).
- [x] Apply limits for:
  - [x] AI generation + exercise swap
  - [x] subscription/payment endpoints
  - [x] waitlist endpoint
  - [x] feedback/report endpoints (spam prevention)

**Validation**

- [x] Verify 429 responses and that limits are keyed per user (or per IP when unauthenticated).

## 5) Production Data Hygiene

**Why**: Roadmap requires removing mock/beta users and test data.

- [x] Ensure production deploy path never inserts demo accounts.
- [x] Add a one-time script/runbook for purging test rows (if any already exist in prod).
- [x] Confirm indexes are present for high-traffic queries (feed, templates, sessions, follows, notifications).

## 6) Auth/Permissions Smoke Tests (Manual)

Create two test accounts and verify:

- Templates/sessions are isolated per user.
- Social actions respect visibility rules.
- Squad join via invite link only affects the intended squad.
- Subscriptions status cannot be spoofed by client-only flags.

## 7) Web + App Store Readiness

- [x] Add missing `web/src/app/support/page.tsx` per roadmap.
- [x] Confirm privacy/terms URLs used in-app are correct for production.
- [x] Prepare store listing assets (screenshots, descriptions, keywords).

## Payments Decision: IAP-Only (Complete)

### Reality check (policy)

If you sell **digital features/content** inside an iOS/Android app (like “Pro”), you generally must use:

- **iOS**: Apple In-App Purchase (StoreKit)
- **Android**: Google Play Billing

Using **Stripe** for that in-app upgrade flow is typically not allowed by App Store / Play policies.

### Current decision

- The app uses **Apple In-App Purchase (StoreKit)** for Pro upgrades.
- All Stripe client/server codepaths have been removed from this repo.
- Android subscriptions are not wired up yet (Google Play Billing validation requires server-side verification).
