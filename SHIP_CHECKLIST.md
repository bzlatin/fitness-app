# Ship Checklist (Production + App Store)

This is a practical “go/no-go” checklist for shipping **Push / Pull** to production (Render backend) and submitting the **Expo (EAS)** iOS build to the App Store.

---

## 0) Quick “Go / No‑Go” Gates

- [x] **No dev auth bypass in production**: `ALLOW_DEV_AUTH_BYPASS` is **not** set on Render (not present in the env list you shared).
- [x] **DB seed data disabled**: `NODE_ENV=production` and `DB_BOOTSTRAP_MODE=prod` (verify values on Render).
- [ ] **App Store webhooks are verified**: App Store Server Notifications are cryptographically verified (see section 2.4).
- [x] **TLS is verified**: database connections do not rely on `sslmode=no-verify` / `rejectUnauthorized: false` for production.
- [x] **Auth0 issuer/audience present**: `AUTH0_DOMAIN` + `AUTH0_AUDIENCE` are set on Render (verify values match production).
- [ ] **Upgrade + restore works**: purchase → unlock Pro, restore purchases, refund/expire/renew paths.

---

## 1) Backend (Render) Deploy Checklist

### 1.1 Build + runtime

- [x] Render service uses the correct start command for the server package (e.g. `npm install --prefix server && npm run build --prefix server && npm start --prefix server`).
- [x] Render build installs TypeScript declaration deps needed to compile (`@types/express`, `@types/pg`).
- [x] `NODE_ENV=production` is set on Render (key exists; verify value).
- [x] Health check returns OK: `GET /health` returns `{ "status": "ok" }`.

### 1.2 Database + migrations

- [ ] `DATABASE_URL` points to the correct production DB.
- [ ] Migrations run successfully on boot (server runs `initDb()`).
- [ ] `DB_BOOTSTRAP_MODE=prod` (recommended) to guarantee no seed/demo data is inserted (key exists; verify value).
- [ ] Verify critical tables exist and queries work for:
  - [ ] templates CRUD
  - [ ] sessions save + history fetch
  - [ ] social feed + follows/squads

### 1.3 Auth0 (API protection)

- [ ] Server Auth0 env vars are set (see section 2.1).
- [ ] Confirm a valid production token can hit `/api/social/me`.
- [ ] Confirm missing/invalid token gets `401` across protected routes.

### 1.4 CORS + proxy

- [ ] `TRUST_PROXY=1` (recommended on Render) so IP-based rate limits and `req.ip` work correctly behind the proxy (missing from your Render env list).
- [ ] `CORS_ALLOWED_ORIGINS` includes your web origins (if any) and is not overly broad (missing from your Render env list).

### 1.5 Rate limits + abuse controls

- [x] AI endpoints rate limit as expected (429 on abuse).
- [x] Waitlist + feedback rate limits work.

### 1.6 Storage / uploads (optional features)

- [x] If custom exercise images are enabled in your UI, Cloudinary env vars are configured (Cloudinary keys present on Render; verify uploads end-to-end).

---

## 2) Render Environment Variables (Exact List)

This list is derived from actual `process.env.*` usage in `server/src/`.

### 2.0 Your current Render env (from what you shared)

**Present**

- [x] `DATABASE_URL`
- [x] `AUTH0_DOMAIN`
- [x] `AUTH0_AUDIENCE`
- [x] `OPENAI_API_KEY`
- [x] `CLOUDINARY_CLOUD_NAME`
- [x] `CLOUDINARY_API_KEY`
- [x] `CLOUDINARY_API_SECRET`
- [x] `APP_STORE_ISSUER_ID`
- [x] `APP_STORE_KEY_ID`
- [x] `APP_STORE_PRIVATE_KEY`
- [x] `APP_STORE_BUNDLE_ID`
- [x] `APP_STORE_ENV` (verify value is `Production` for live)
- [x] `APP_STORE_VERIFY_NOTIFICATIONS` (verify value is `true`)
- [x] `APP_STORE_APP_APPLE_ID` (verify it matches the numeric “Apple ID” in App Store Connect)
- [x] `NODE_ENV` (verify value is `production`)
- [x] `DB_BOOTSTRAP_MODE` (verify value is `prod`)
- [x] `PORT`

**Not used by the current server code**

- [ ] `APPSTORE_WEBHOOK_SECRET` (safe to remove; your webhook is secured via JWS verification)
- [ ] `NODE_OPTIONS` (fine to keep if you need it operationally)

**Missing (recommended / commonly needed)**

- [x] `TRUST_PROXY=1`
- [x] `PUBLIC_APP_URL=https://push-pull.app` (used for template share links)
- [x] `CORS_ALLOWED_ORIGINS=https://push-pull.app,https://www.push-pull.app` (only if you have a web origin hitting the API)
- [x] `LOG_LEVEL=info`

### 2.1 Required (backend cannot start without these)

- `DATABASE_URL`
- `AUTH0_DOMAIN`
- `AUTH0_AUDIENCE`

### 2.2 Required if you ship AI workout generation

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional; defaults in code)
- `AI_PROVIDER` (optional; defaults in code)

### 2.3 Required if you ship image uploads (custom exercises)

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_ENABLE_MODERATION` (optional)

### 2.4 Required if you ship Apple IAP + server-side validation/webhooks

**App Store Server API credentials (already required for validation/status):**

- `APP_STORE_ISSUER_ID`
- `APP_STORE_KEY_ID`
- `APP_STORE_PRIVATE_KEY`
- `APP_STORE_BUNDLE_ID` (or `APP_STORE_BUNDLE_IDENTIFIER`)
- `APP_STORE_ENV` (`Production` for live)

**New / important for production security (App Store Server Notifications verification):**

- `APP_STORE_VERIFY_NOTIFICATIONS=true`
- `APP_STORE_APP_APPLE_ID=<your App Store appAppleId>` (required for Production verification)

**Optional controls:**

- `APP_STORE_ENABLE_ONLINE_VERIFICATION=true` (defaults to true in production; enables OCSP checks)
- `APP_STORE_ROOT_CA_PEM` (optional; provide PEM content via env instead of using the bundled `dist/certs/apple-root-cas.pem`)
- `APP_STORE_ROOT_CA_PEM_PATH` (optional; override cert path if your deployment layout differs)

### 2.5 Recommended operational settings

- `PUBLIC_APP_URL=https://push-pull.app` (used for share links)
- `TRUST_PROXY=1` (recommended on Render)
- `CORS_ALLOWED_ORIGINS=https://push-pull.app,https://www.push-pull.app` (adjust to your actual web origins)
- `LOG_LEVEL=info`

### 2.6 Must be **unset** in production

- `ALLOW_DEV_AUTH_BYPASS` (dev-only auth bypass)
- `DEV_USER_ID` (dev-only; irrelevant in prod)
- `DB_BOOTSTRAP_MODE=dev` (must never be dev in prod)

---

## 3) Mobile (EAS) Build Checklist

### 3.1 Auth0 + deep links

- [ ] Auth0 iOS callback URLs include your scheme (`push-pull://redirect`) and any universal link callbacks you use.
- [ ] Apple “Login with Apple” is enabled in Auth0 and working on a real device/TestFlight build (not just simulator).
- [ ] If you support Google, confirm the correct provider config for iOS.

### 3.2 API base URL

- [ ] `EXPO_PUBLIC_API_URL` points to production (`https://push-pull.onrender.com/api` or your custom domain).

### 3.3 App Store purchase flow

- [x] Products exist in App Store Connect and match your expected product IDs.
- [x] Purchase unlocks Pro features immediately.
- [] Restore purchases works and updates Pro state.

### 3.4 Permissions + privacy strings

- [x] Verify `NSHealthShareUsageDescription` and `NSHealthUpdateUsageDescription` are accurate and required for your HealthKit usage.
- [x] Verify your privacy policy URL is live and matches what the app does (tracking, purchase, analytics, etc.).

---

## 4) App Store Submission Checklist

### 4.1 App metadata

- [ ] App name, subtitle, keywords, and description are final.
- [ ] Support URL, privacy policy URL, and terms URL are live.
- [ ] “Delete account” flow exists and is accessible (your API has account deletion; verify the UI path).

### 4.2 Screenshots + review notes

- [ ] Screenshots for required device sizes.
- [ ] Review notes include:
  - [ ] how to sign in (email/Apple/Google)
  - [ ] any test account credentials if applicable
  - [ ] where to find subscriptions/restore

### 4.3 Compliance

- [ ] Export compliance (encryption) is correct (`ITSAppUsesNonExemptEncryption` already set to false).
- [ ] Health data disclosures are correct (if you read/write Apple Health data).

---

## 5) Final Manual Smoke Test (Recommended)

Run this exact sequence on a clean install (TestFlight build):

- [ ] Launch → onboarding → sign in with Apple
- [ ] Create a template → start session → save session
- [ ] View history + calendar
- [ ] Share a template via link → open link → preview → copy into account
- [ ] Start Pro trial/purchase → AI generate workout → verify locked/unlocked behavior
- [ ] Restore purchases after reinstall
- [ ] Submit feedback
