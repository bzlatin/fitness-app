## iOS In-App Purchase Setup

This guide captures the remaining account-level work to finish Apple IAP for Push / Pull. Code is scaffolded; follow these steps to make it live.

### 1) App Store Connect prep

- Enroll in the Apple Developer Program ($99/year) with the team that will publish Push / Pull.
- Create the app record with bundle ID `com.pushpull.app` (matches `EXPO_PUBLIC_IOS_BUNDLE_ID`; update if you pick a different ID).
- Add two auto-renewable subscriptions in one group:
  - `pro_monthly_subscription` – $4.99/month
  - `pro_yearly_subscription` – $49.99/year
- Add a 7-day introductory free trial to both products.
- Provide the Subscription Terms URL and Privacy Policy URL inside each product’s Subscription Information card (App > Features > Subscriptions > select product > Subscription Information). Use the same polished URLs you share with App Review so the metadata matches the experience inside the app.
- Confirm both products live in the same Subscription Group and that the intro offers defined in App Store Connect mirror the ones in `mobile/ios/StoreKit/Configuration.storekit` (pricing, promo name, and 7-day trial length should align).
- Upload the StoreKit config (generated locally at `mobile/ios/StoreKit/Configuration.storekit`) for simulator testing if desired.

### 2) Keys & environment variables

Create an App Store Connect API key with **Access: App Manager**. Capture:

- `APP_STORE_KEY_ID`
- `APP_STORE_ISSUER_ID`
- `APP_STORE_PRIVATE_KEY` (copy the contents; keep it secret)
- `APP_STORE_BUNDLE_ID` (e.g., `com.pushpull.app`)
- Optional: `APP_STORE_ENV` (`Sandbox` during development, `Production` for TestFlight/Review)

Add these to `server/.env` and restart the API.

Also export `EXPO_APPLE_TEAM_ID` (or `EXPO_APPLE_DEVELOPER_TEAM_ID`) so `app.config.ts` can set `ios.teamId`. Use `eas secret` or your shell profile to surface the Team ID (found under the Apple Developer Membership page). The placeholder is already in `mobile/eas.json` under the `production` profile—swap it with your real value before building.

### 3) Client configuration

- `mobile/app.config.ts` now sets the bundle ID and StoreKit config path. If you change the bundle ID, update `EXPO_PUBLIC_IOS_BUNDLE_ID` and the App Store record to match.
- Install native deps before the next build: `npm install --prefix mobile` (installs `react-native-iap`).
- For local simulator testing, open `mobile/ios/StoreKit/Configuration.storekit` in Xcode to tweak pricing or offers.

### 4) Validation flow

- iOS purchases send `transactionId` to `POST /api/subscriptions/ios/validate-receipt`, which calls Apple’s App Store Server API and stores `apple_original_transaction_id`.
- Webhook endpoint: `POST /webhooks/appstore` ingests App Store Server Notifications to keep entitlements in sync.

### 5) QA checklist

- Build a dev client/TestFlight build on iOS.
- Test: new purchase, restore purchases on a second device, renewal in sandbox, cancel from iOS Settings, refund path (simulate via sandbox console), and verify expired subs block Pro features.
- Provide Apple reviewers a test account plus screenshots of the subscription UI and upgrade/restore flows (App Store reviewers ask for evidence of the paywall, upgrade CTA, and restore flow).

### 6) Subscription platform switching

Whenever you move a user between Stripe and Apple (for example, someone who bought a Stripe plan on Android but wants to switch to iOS), follow the documented steps in `SUBSCRIPTION_PLATFORM.md` so `subscription_platform`, `plan`, and the Apple/Stripe transaction columns stay in sync.
