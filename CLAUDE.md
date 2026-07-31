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

Categories in use: `coin`, `fund`, `currency` (USD, tether), `crypto` (bitcoin), `manual`. The mobile dashboard's `CATEGORY_LABELS`/`CATEGORY_ORDER` in `app/(app)/index.tsx` control grouping and display order — a new category needs an entry there or it won't render.

tgju.org prices are Rial-denominated and must be divided by 10 to get Toman; BrsApi prices are already Toman. This conversion lives in `priceService.ts` — don't reintroduce it elsewhere.

Some tgju rows appear **twice** on the page with different denominations (`crypto-bitcoin` shows a USD figure first, then the Rial one). So a tgju `sourceRef` may carry an occurrence index: `"crypto-bitcoin#1"` means "the second matching row". Without the suffix the first match is used. Getting this wrong is silent and severe — the USD figure divided by 10 looks like a plausible number. Everything is stored in Toman so portfolio totals stay summable; the app derives the USD display for `crypto` assets by dividing by the `currency_usd` price.

### Auth & roles
JWT (`backend/src/utils/jwt.ts`) + bcrypt password hashing. `User.role` (`"user"|"admin"`) and `User.isActive` gate access. `backend/src/middleware/admin.ts`'s `requireAdmin` re-reads the role from the DB on every request rather than trusting the JWT payload, so admin promotion/demotion and account deactivation take effect immediately without waiting for token expiry. `isActive: false` users are rejected at login and at `/api/auth/me` with 403.

Login accepts **either** an email or a username in a single `identifier` field — the route branches on whether it contains `@`. `User.username` is nullable (accounts predating the feature have none) and compared case-insensitively; since SQLite/Prisma has no `mode: "insensitive"`, that lookup is a parameterized `LOWER()` raw query in `auth.routes.ts`.

Every login attempt, successful or not, is written to `LoginEvent`. Recording is deliberately non-throwing — a logging failure must never block a valid login.

### Backend request flow
`src/index.ts` wires Express + routes. Routes: `auth.routes.ts` (register/login/me, change-password, profile PATCH, login-history), `prices.routes.ts` (public asset+price list), `holdings.routes.ts` (authenticated per-user quantities, bulk PUT), `admin.routes.ts` (stats, user CRUD, password reset, per-user login history, asset catalog CRUD, manual price set, manual refresh trigger — all zod-validated, all behind `requireAdmin`). Self-modification (an admin changing their own role/isActive) is explicitly blocked in the admin routes — but an admin *may* reset any password including their own.

### Mobile app structure (Expo Router, file-based)
```
app/
  _layout.tsx            root: React Query + Theme + Auth providers (in that order)
  (auth)/                 pre-login: login.tsx, register.tsx
  (app)/                  post-login tabs
    _layout.tsx            tab bar; admin tab conditionally shown via href: isAdmin ? undefined : null
    index.tsx              holdings dashboard + donut chart of composition
    settings.tsx           profile summary, account/security links, theme picker, logout
    security/              hidden from the tab bar via href: null; reached from settings
      profile.tsx, change-password.tsx, login-history.tsx
    admin/                 admin panel, embedded in the same app/login — not a separate surface
      index.tsx             stats overview + manual price refresh
      users/index.tsx, users/[id].tsx   list/detail, role & active toggles, password reset, login history, delete
      assets/index.tsx, assets/[id].tsx  catalog CRUD, manual price entry, active toggle, delete
src/
  api/                    axios client + per-domain API functions (auth.ts, holdings.ts, admin.ts) + shared types.ts
  context/AuthContext.tsx  token persistence via expo-secure-store; exposes `isAdmin`, `refreshUser`
  context/ThemeContext.tsx dark/light/system preference, persisted via AsyncStorage
  components/              shared UI (PrimaryButton has a "danger" variant; DonutChart, LoginHistoryList)
  theme/colors.ts          dark + light palettes, spacing/radius/typography tokens, chart palette
```
Server state (queries/mutations) goes through `@tanstack/react-query`; don't add ad-hoc `useEffect` fetching for anything the admin panel or dashboard already has a query for.

**Theming**: colors are dynamic — read them from `useTheme()`, never by importing the `colors` object (that export is a dark-only compatibility shim; using it silently breaks light mode). Screens that need themed `StyleSheet`s define `const makeStyles = (colors: AppColors) => StyleSheet.create({...})` at module scope and call `const styles = makeStyles(colors)` inside the component.

Adding a route under `app/` requires Expo Router's generated types (`.expo/types/router.d.ts`) to be refreshed before `tsc --noEmit` passes; they regenerate when Metro/EAS runs.

## Notes
- `backend/.env` holds real secrets (`JWT_SECRET`, `BRSAPI_KEY`) — gitignored, never commit it.
- **BrsApi is currently broken (as of 2026-07-31), so all gold-fund prices are null.** `https://BrsApi.ir/Api/Tsetmc/AllSymbols.php` returns 404 from every network tried (the VPS, a dev machine, and the legacy site's GitHub Action) — the endpoint itself moved or was withdrawn, it is not a key or firewall problem. Fixing it means finding the current BrsApi endpoint and updating `fetchBrsApiPrices` in `priceService.ts`. Coins/currency/crypto (tgju) are unaffected.
- The legacy `scripts/fetch_prices.py` used to write the raw BrsApi URL — key included — into `data/prices.json` on error, which published the key to the public repo. That is redacted now (`redact_secrets`), but the key remains in git history, so it should be rotated at brsapi.ir.
- Deployment: `backend/DEPLOY.md` describes an Ubuntu/SSH flow, but the actual production VPS is **Windows Server** (accessed via RDP), so those steps don't apply as-is — treat DEPLOY.md as a reference for *what* needs to happen (Node install, build, migrate, run persistently, expose a port), not literal commands.
- That Windows VPS already runs **another, unrelated project under PM2**. Any backend deployment there must not disturb it:
  - Don't run `pm2 delete all`, `pm2 kill`, or anything that stops/restarts *all* processes — target this app by its own PM2 name only.
  - Use a distinct PM2 process name (e.g. `sekeh-api`) and confirm the port this backend binds to (default `4000`, from `.env`) doesn't collide with the other app's port before starting it — check with `pm2 list` first.
  - Before installing/upgrading Node.js or global npm packages (pm2 itself included), check what's already installed (`node -v`, `pm2 -v`) — the other project may depend on the existing versions.
- Production APK for Cafebazaar: EAS Build, documented in `mobile/README.md`.

## Live deployment (as of 2026-07-31)

Backend runs on a Windows VPS at `188.209.153.164:4000` (plain HTTP, no domain/TLS), checked out at `C:\apps\Seke`, under PM2 as `sekeh-api`. Update procedure:

```powershell
cd C:\apps\Seke
git checkout -- backend/package.json   # npm approve-scripts edits this; it blocks git pull
git pull
cd backend
npm install
npm run build
npx prisma migrate deploy
npx prisma db seed
pm2 restart sekeh-api                   # never `pm2 restart all` — see PM2 note above
```

Two recurring snags on that box:
- `npm approve-scripts` writes an `allowScripts` block into `backend/package.json`, which makes the next `git pull` abort. Discarding the local change (line 2 above) is safe — the already-installed `node_modules` keep working.
- `npx prisma generate` can fail with `EPERM ... query_engine-windows.dll.node` because the running PM2 process holds the DLL open. It's harmless when the engine version is unchanged (the TS client still regenerates). If a schema change really doesn't take effect, `pm2 stop sekeh-api` → `npx prisma generate` → `pm2 start sekeh-api`.

Because the API is plain HTTP, the Android app needs `usesCleartextTraffic` — configured via the `expo-build-properties` plugin in `mobile/app.json`. Don't remove it unless the server gets HTTPS.

### OTA updates (expo-updates)
`mobile/` has `expo-updates` wired to the `preview` channel, so **JS-only** changes ship with `npx eas-cli update --branch preview --message "..."` (~2 min) instead of a full build. A new native module (or any `app.json` native field such as `name`) still requires `eas build`. Critical: publishing an OTA that imports a native module absent from the installed binary will crash that install — ship the build first, or at the same time.
