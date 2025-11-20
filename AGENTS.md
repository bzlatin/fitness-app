# Repository Guidelines

## Project Structure & Module Organization
The workspace is split into `mobile/` (Expo + React Native client) and `server/` (Express + PostgreSQL API). The mobile app keeps UI in `src/screens/`, routing setup in `src/navigation/`, shared UI primitives in `src/components/`, and Auth0 wiring inside `src/context/AuthContext.tsx`. The API groups HTTP handlers in `src/routes/`, shared middleware in `src/middleware/`, and database helpers in `src/db.ts` plus `src/data/` seed files. Generated bundles land in each package’s `dist/`; never edit those directly.

## Build, Test, and Development Commands
Install dependencies once per package:
```bash
npm install --prefix server
npm install --prefix mobile
```
Day-to-day commands:
- `cd server && npm run dev` – watches TypeScript via `ts-node-dev` and auto-seeds tables.
- `cd server && npm run build && npm start` – produces `dist/` then runs the compiled API.
- `cd mobile && npm run start` – launches Expo Dev Tools (add `--ios` or `--android` for simulators).
- `EXPO_PUBLIC_API_URL=http://localhost:4000/api npm run start` – example of pointing the client at your local API for manual testing.

## Coding Style & Naming Conventions
Both packages are TypeScript-first with `strict: true`; prefer typed React hooks/components over `any`. Use 2-space indentation, single quotes in `.ts/.tsx`, and keep imports ordered `react → third-party → local`. Components live in PascalCase files (`SessionHeader.tsx`), hooks follow the `useFoo.ts` pattern, and server helpers use camelCase modules inside domain folders (e.g., `routes/templatesRouter.ts`). Follow NativeWind class utilities for styling before dropping into inline styles, and keep Auth/Auth0 config isolated to the context/provider files.

## Testing Guidelines
Automated harnesses are not wired up yet, so every change should be smoke-tested manually: run `npm run dev` in `server/`, boot Expo, exercise Auth, template CRUD, and a session save. When introducing automated tests, place `*.test.ts` beside the code under `server/src/` or `mobile/src/` and use descriptive `describe()` blocks that mirror screen or route names. Target at least critical-path coverage (auth, template persistence, workout logging), and document any gaps in your pull request.

## Commit & Pull Request Guidelines
Commits in the existing history are short, imperative statements (“added auth + user table in db”), so keep that format and scope each commit by feature or layer. Pull requests should include: a summary of intent, any environment variables touched (`DATABASE_URL`, `AUTH0_*`, `EXPO_PUBLIC_*`), screenshots or screen recordings for UI shifts, and manual test notes (`server dev + iOS simulator`). Link issues when available and call out migration implications so reviewers can verify database impacts.

## Security & Configuration Tips
Do not commit credentials—use `.env` locally with `DATABASE_URL`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, and the Expo `EXPO_PUBLIC_AUTH0_*` values. When testing on a device, set `EXPO_PUBLIC_API_URL` to your LAN IP (`http://192.168.x.x:4000/api`) and confirm HTTPS requirements for Auth0 callbacks. The API validates JWTs via RS256; always keep issuer/audience pairs in sync between client and server before sharing preview builds.
