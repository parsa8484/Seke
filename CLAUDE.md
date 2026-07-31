# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

"دارایی من" (Sekeh) — a coin/gold/gold-fund asset tracker with live prices. The repo contains **two generations** of the project side by side:

- **Legacy static site** (root: `index.html`, `css/`, `js/`, `data/`, `config/`, `scripts/`, `.github/workflows/update-prices.yml`) — still live on GitHub Pages at https://parsa8484.github.io/Seke/. Untouched on purpose so Pages doesn't break. Docs: [WEB_LEGACY.md](./WEB_LEGACY.md).
- **Current version** — `backend/` (Node/Express/TypeScript/Prisma/SQLite API) + `mobile/` (React Native/Expo app with an admin panel built into the same app, no separate web panel). This is where active work happens.

Don't touch the legacy root files unless explicitly asked — they're a separate deployment target.

## Commands

### Backend (`backend/`)
```bash
npm install
cp .env.example .env          # set JWT_SECRET, BRSAPI_KEY
npx prisma migrate dev        # creates tables + runs prisma/seed.ts (asset catalog)
npm run dev                   # tsx watch, http://localhost:4000
npm run build && npm start    # production build
npm run make-admin -- email@example.com   # promote a registered user to admin
npx prisma studio             # inspect the SQLite DB
```
Health check: `curl http://localhost:4000/health`. No test suite or lint script currently exists in the backend.

### Mobile (`mobile/`)
```bash
npm install
cp .env.example .env          # set EXPO_PUBLIC_API_URL to your machine's LAN IP, not localhost
npx expo start                 # scan QR with Expo Go
npx expo start --android       # requires Android Studio emulator
npm run lint                   # expo lint
npx tsc --noEmit               # type-check (no dedicated script; run directly)
```
On this dev machine (~4GB RAM), Metro can OOM-crash with the default multi-worker config — `mobile/metro.config.js` pins `config.maxWorkers = 1` to work around it. Keep that in place unless the machine changes.

`EXPO_PUBLIC_API_URL` is compiled into the app at build time — it must point at the real production server before an EAS build, not a LAN IP.

## Architecture

### Data-driven asset catalog (important, spans backend + mobile)
`Asset` is a DB table (`backend/prisma/schema.prisma`), not a hardcoded enum/map. Each row has `sourceType` (`"tgju" | "brsapi" | "manual"`) and `sourceRef` (the external identifier — a tgju `data-market-row` id, or a substring of a BrsApi fund's Persian name). `backend/src/services/priceService.ts` reads these per-asset at fetch time (`fetchTgjuPrices(assets)`, `fetchBrsApiPrices(assets)`) instead of using static maps like the old `TGJU_ROW_MAP`.

This means adding a new trackable asset (e.g. silver) is a DB insert (via `prisma/seed.ts` or the admin panel's asset CRUD), not a code change — unless the price source itself is new, in which case a small fetcher needs to be added to `priceService.ts`.

tgju.org prices are Rial-denominated and must be divided by 10 to get Toman; BrsApi prices are already Toman. This conversion lives in `priceService.ts` — don't reintroduce it elsewhere.

### Auth & roles
JWT (`backend/src/utils/jwt.ts`) + bcrypt password hashing. `User.role` (`"user"|"admin"`) and `User.isActive` gate access. `backend/src/middleware/admin.ts`'s `requireAdmin` re-reads the role from the DB on every request rather than trusting the JWT payload, so admin promotion/demotion and account deactivation take effect immediately without waiting for token expiry. `isActive: false` users are rejected at login and at `/api/auth/me` with 403.

### Backend request flow
`src/index.ts` wires Express + routes. Routes: `auth.routes.ts` (register/login/me), `prices.routes.ts` (public asset+price list), `holdings.routes.ts` (authenticated per-user quantities, bulk PUT), `admin.routes.ts` (stats, user CRUD, asset catalog CRUD, manual price set, manual refresh trigger — all zod-validated, all behind `requireAdmin`). Self-modification (an admin changing their own role/isActive) is explicitly blocked in the admin routes.

### Mobile app structure (Expo Router, file-based)
```
app/
  _layout.tsx            root: React Query + Auth providers
  (auth)/                 pre-login: login.tsx, register.tsx
  (app)/                  post-login tabs
    _layout.tsx            tab bar; admin tab conditionally shown via href: isAdmin ? undefined : null
    index.tsx              holdings dashboard
    settings.tsx           profile / logout
    admin/                 admin panel, embedded in the same app/login — not a separate surface
      index.tsx             stats overview + manual price refresh
      users/index.tsx, users/[id].tsx   list/detail, role & active toggles, delete
      assets/index.tsx, assets/[id].tsx  catalog CRUD, manual price entry, active toggle, delete
src/
  api/                    axios client + per-domain API functions (auth.ts, holdings.ts, admin.ts) + shared types.ts
  context/AuthContext.tsx  token persistence via expo-secure-store; exposes `isAdmin`
  components/              shared UI (PrimaryButton has a "danger" variant for destructive actions)
  theme/colors.ts          dark + gold theme tokens
```
Server state (queries/mutations) goes through `@tanstack/react-query`; don't add ad-hoc `useEffect` fetching for anything the admin panel or dashboard already has a query for.

## Notes
- `backend/.env` holds real secrets (`JWT_SECRET`, `BRSAPI_KEY`) — gitignored, never commit it.
- BrsApi.ir may be unreachable from sandboxed dev environments (connects but hangs) — this is network-level blocking specific to some environments, not a code bug; it's expected to work from the actual VPS.
- Deployment: `backend/DEPLOY.md` describes an Ubuntu/SSH flow, but the actual production VPS is **Windows Server** (accessed via RDP), so those steps don't apply as-is — treat DEPLOY.md as a reference for *what* needs to happen (Node install, build, migrate, run persistently, expose a port), not literal commands.
- That Windows VPS already runs **another, unrelated project under PM2**. Any backend deployment there must not disturb it:
  - Don't run `pm2 delete all`, `pm2 kill`, or anything that stops/restarts *all* processes — target this app by its own PM2 name only.
  - Use a distinct PM2 process name (e.g. `sekeh-api`) and confirm the port this backend binds to (default `4000`, from `.env`) doesn't collide with the other app's port before starting it — check with `pm2 list` first.
  - Before installing/upgrading Node.js or global npm packages (pm2 itself included), check what's already installed (`node -v`, `pm2 -v`) — the other project may depend on the existing versions.
- Production APK for Cafebazaar: EAS Build, documented in `mobile/README.md`.
