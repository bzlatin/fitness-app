# Push / Pull

Push / Pull is a two-part fitness tracker built with Expo + React Native on the client and an Express + PostgreSQL API on the backend. The mobile app lets lifters authenticate with Auth0, create and organize push/pull/legs (or fully custom) workout templates, start guided sessions, and review prior workouts. The API keeps per-user data safe, seeds curated exercise metadata, and persists templates and sessions.

## Tech Stack

- **Mobile:** Expo SDK 54, React Native 0.81, React Navigation 6, React Query, NativeWind, Expo Auth Session, Secure Store.
- **Server:** Express 4 + TypeScript, Postgres via `pg`, Auth0 JWT middleware, `ts-node-dev` for local dev.
- **Auth:** Auth0 (or any OIDC provider that can issue RS256 access tokens).

## Project Layout

- `mobile/` &mdash; Expo app (screens, navigation, hooks, Auth context, etc.).
- `server/` &mdash; Express API (routes for exercises, templates, sessions, Postgres migrations).

## Prerequisites

- Node.js 18+ and npm.
- PostgreSQL 14+ (a local instance or hosted service).
- An Auth0 tenant (or equivalent) with a SPA application + API configured.
- Expo CLI (`npm install -g expo-cli`) and an emulator or the Expo Go app to run the client.

The server boots `initDb()` on startup, so pointing `DATABASE_URL` to an empty database is fine; required tables are created automatically.

## Install Dependencies

```bash
npm install --prefix server
npm install --prefix mobile
```

## Running the API

```bash
cd server
npm run dev        # Watches TypeScript via ts-node-dev

# or build + serve
npm run build
npm start
```

Available routes (all prefixed by `/api`):

- `GET /health` &mdash; health check (no auth).
- `GET /exercises` &mdash; public list of reference exercises.
- `GET/POST/PATCH /templates` and `GET/POST /sessions` &mdash; require a valid Auth0 RS256 access token; middleware will upsert the user record automatically.

## Running the Mobile App

```bash
cd mobile
npm run start      # Starts Expo
npm run ios        # Expo + iOS simulator
npm run android    # Expo + Android emulator
```

When developing on a physical device, ensure `EXPO_PUBLIC_API_URL` uses your computer’s LAN IP (e.g., `http://192.168.1.10:4000/api`) so the app can reach the API.

## Useful Scripts

| Location | Script                            | Description                        |
| -------- | --------------------------------- | ---------------------------------- |
| `server` | `npm run dev`                     | Run the API with hot reload.       |
| `server` | `npm run build`                   | Compile TypeScript to `dist/`.     |
| `server` | `npm start`                       | Run the compiled API.              |
| `mobile` | `npm run start`                   | Launch Expo Dev Tools.             |
| `mobile` | `npm run ios` / `npm run android` | Open Expo directly in a simulator. |

## Testing the Flow

1. Start Postgres and ensure the `DATABASE_URL` database exists.
2. Start the API (`npm run dev` in `server/`). You should see `Push / Pull API running on http://localhost:4000`.
3. Start Expo in `mobile/` and scan the QR code (or run a simulator).
4. Log in via Auth0; tokens are stored securely with `expo-secure-store`.
5. Build/edit a template, then start a workout session to hit the API.

## Making `main` the Default Branch

1. Create and push the `main` branch (if you have not already):
   ```bash
   git checkout -b main
   git push -u origin main
   ```
2. In GitHub/GitLab, open the repository settings → _Branches_ (GitHub) or _Repository → Default branch_ (GitLab) and switch the default branch to `main`.
3. Optionally delete old remote branches (`git push origin :old-branch-name`) and update any CI/CD rules that referenced the previous default.
