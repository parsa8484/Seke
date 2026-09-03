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

### Price sources: a provider chain, primary + two fallbacks (no API keys)

`backend/src/services/priceSources.ts` declares an ordered `PRICE_PROVIDERS` array; `tgjuClient.ts` is only the orchestrator (60s in-memory cache, request coalescing, health tracking, stale-snapshot fallback). Adding a source is appending one object implementing `PriceProvider`.

| # | id | what it covers | notes |
|---|----|----------------|-------|
| 1 | `tgju-ajax` | ~930 symbols, live | `https://call{1,2,3,4}.tgju.org/ajax.json` + `www` mirrors. The primary. |
| 2 | `tgju-api` | any symbol, **last daily close** | `api.tgju.org/…/summary-table-data/{symbol}` — one request *per symbol*, so it's capped at 40 (priority symbols first, then whatever the caller asked for) with concurrency 5. Same company, different infrastructure: it survives `call*` being blocked or rate-limited. |
| 3 | `milli-gold` | `geram18` only | `milli.gold/api/v1/public/milli-price/detail` — the only source with **no relation to tgju at all**. |

Two behaviours worth knowing before touching this:

- **Fallback quotes pass a deviation guard.** A non-primary quote more than 50% away from the last known price for that symbol is dropped (`rejectImplausible`). The threshold is deliberately loose: it exists to catch *unit* errors (which are off by 10× or 100×, i.e. 900%/9900%), not to second-guess real market moves. This is what makes `milli-gold` safe to use — its number is Toman per **0.01 gram**, and that ×100 factor was derived by comparing against tgju, not from documentation, so if it ever changes the guard rejects it instead of silently multiplying a user's portfolio by 100.
- **A fallback merges over the previous snapshot rather than replacing it.** `tgju-api` returns ~11–40 symbols; the other ~920 are carried forward from the last good snapshot so the "قیمت‌ها" tab doesn't empty out. `getSourceHealth()` reports `freshCount` vs `totalCount` plus per-provider status, and the admin overview renders it — previously a dead primary just silently served stale prices with nothing indicating it.

`refreshPrices()` and the market/admin routes pass the symbols *they* need down to `getMarketSnapshot(force, neededSymbols)`; without that list the per-symbol fallback has no way to know what matters for this install.

Daily history lives in `backend/src/services/tgjuHistory.ts` (split out of `tgjuClient.ts` to avoid an import cycle, since `priceSources` needs it too). `fetchTgjuDailyRows` caches the **raw** rows for 30 min and each caller applies its own unit; `fetchTgjuHistory` is the unit-applied view. Thousands of rows per symbol, **with the Jalali date already in column 7**, so trend charts work from day one instead of waiting for `PriceHistory` to accumulate.

BrsApi is **removed**. The gold funds it used to serve are tgju's `ime_fund_*` symbols (`ime_fund_kahroba`, `ime_fund_ayar`, `ime_fund_gohar`, `ime_fund_zar`, `ime_fund_mesghal`, `ime_fund_ganj`, plus silver funds). `prisma/seed.ts` migrates any leftover `sourceType: "brsapi"` row to `manual` so it surfaces in the admin panel as "missing price" rather than silently serving a stale number.

### Data-driven asset catalog (important, spans backend + mobile)
`Asset` is a DB table (`backend/prisma/schema.prisma`), not a hardcoded enum/map. Each row has `sourceType` (`"tgju" | "manual"`) and `sourceRef` (the tgju `ajax.json` key, e.g. `retail_sekee`). Adding a trackable asset is a DB insert (via `prisma/seed.ts` or the admin panel), not a code change.

Categories in use: `coin`, `gold`, `fund`, `currency`, `crypto`, `manual`. The mobile dashboard's `CATEGORY_LABELS`/`CATEGORY_ORDER` in `app/(app)/index.tsx` control grouping and display order; unknown categories now render after the known ones instead of disappearing.

**Unit handling — the one thing that breaks silently.** tgju returns three kinds of number: Rial (divide by 10 for Toman), USD (leave alone), and index points. `backend/src/services/tgjuCatalog.ts` declares the unit for every catalogued symbol **explicitly**, because a USD figure divided by 10 still looks like a plausible price. `Asset.priceUnit` can override the catalog per-asset; when null the catalog value is used, defaulting to `toman` for uncatalogued symbols. The admin asset editor offers a searchable symbol picker showing each symbol's live price, which fills `priceUnit` automatically — prefer that over typing a `sourceRef` by hand.

The old `"crypto-bitcoin#1"` occurrence-index hack is gone: `ajax.json` has distinct keys for the USD and Rial variants (`crypto-bitcoin` vs `crypto-bitcoin-irr`). Portfolio assets use the `-irr` keys so totals stay summable in Toman; the app derives the USD display for `crypto` assets by dividing by the `currency_usd` price.

### Auth & roles
JWT (`backend/src/utils/jwt.ts`) + bcrypt password hashing. `User.role` (`"user"|"admin"`) and `User.isActive` gate access. `backend/src/middleware/admin.ts`'s `requireAdmin` re-reads the role from the DB on every request rather than trusting the JWT payload, so admin promotion/demotion and account deactivation take effect immediately without waiting for token expiry. `isActive: false` users are rejected at login and at `/api/auth/me` with 403.

Login accepts **either** an email or a username in a single `identifier` field — the route branches on whether it contains `@`. `User.username` is nullable (accounts predating the feature have none) and compared case-insensitively; since SQLite/Prisma has no `mode: "insensitive"`, that lookup is a parameterized `LOWER()` raw query in `auth.routes.ts`.

Every login attempt, successful or not, is written to `LoginEvent`. Recording is deliberately non-throwing — a logging failure must never block a valid login.

**Biometric quick-login.** Every successful login also writes the JWT to a second SecureStore key (`sekeh_biometric_token`) that `signOut` deliberately does *not* clear, so the login screen can offer "ورود با اثر انگشت". Consequences to keep in mind: the token stays on the device for up to its 30-day expiry after logout, and because `disableDeviceFallback: false`, the phone's own PIN/pattern also unlocks it — the same tradeoff banking apps make. Settings' logout asks whether to keep it, and `forgetDevice()` clears it. If a restored token is rejected by `/api/auth/me` (expired, or `isActive: false`), both keys are wiped and the user is sent back to password login.

### Backend request flow
`src/index.ts` wires Express + routes. Routes: `auth.routes.ts` (register/login/me, change-password, profile PATCH, login-history), `prices.routes.ts` (public asset+price list, plus `GET /:key/history` for trend charts), `market.routes.ts` (public full tgju price list + `GET /history/:symbol`), `holdings.routes.ts` (authenticated per-user quantities *and buy prices*, bulk PUT, plus `GET /history` for the portfolio-value chart), `alerts.routes.ts` (price-alert CRUD + Expo push-token registration), `admin.routes.ts` (stats, user CRUD, password reset, per-user login history, asset catalog CRUD, tgju symbol picker, manual price set, manual refresh trigger — all zod-validated, all behind `requireAdmin`). Self-modification (an admin changing their own role/isActive) is explicitly blocked in the admin routes — but an admin *may* reset any password including their own.

### Profit/loss
`Holding.avgBuyPrice` is nullable on purpose: null means "not recorded" and the asset is excluded from profit math entirely. Storing 0 would mean "acquired for free" and would poison the totals, so the API and the app both coerce empty/zero input to null. The dashboard computes profit live from the in-progress form values (not the saved ones) so the user sees the result before pressing save; the server returns the same fields for the saved state.

### Portfolio value over time (`GET /api/holdings/history`)

There is **no snapshot table** and deliberately so. The endpoint multiplies the user's *current* quantities by each asset's *historical* daily close, reusing the same 30-min-cached tgju history the per-asset trend charts use. Semantics: "what would the holdings you have today have been worth back then" — not a real transaction ledger, because `Holding` stores a quantity, not a dated buy/sell history. The payoff is that a brand-new user gets a year of real curve immediately instead of waiting for a `PortfolioSnapshot` table to fill up, and it costs no migration (which matters given the `prisma generate` deploy footgun below).

The time axis is the union of every asset's trading days (symbols have different holidays), capped at the requested range. Each asset carries its last known close forward across gaps and backfills before its first data point. Assets with no history at all — manual ones, or a fetch that failed — are held flat at `currentPrice` and reported in `missingHistory` so the app can tell the user the chart is partial rather than quietly drawing a wrong line. `Asset.priceUnit` overrides the catalog unit here exactly as it does in `priceService`.

The chart reads *saved* holdings, so it's invalidated on save (`["portfolio-history"]`) and gated on `items.some(i => i.quantity > 0)` rather than on the in-progress form values.

### CSV export

Client-side only — no endpoint. `src/utils/csv.ts` builds the file from what's on screen (live form values, so it matches what the user is looking at) and `src/utils/exportFile.ts` writes it. Two non-obvious constraints:

- **The file needs a UTF-8 BOM and Latin digits.** Without the BOM, Excel on Windows reads it in the system codepage and every Persian label turns to mojibake. And every number must bypass the app's usual Persian-digit formatting — Excel does not parse `۱۲۳` as a number, so the column silently becomes text and won't sum or sort.
- **`expo-sharing` is deliberately not used.** It's a native module, so adding it would break OTA delivery for already-installed builds. `expo-file-system` was already in the binary (a transitive dependency of `expo`; now also declared explicitly in `package.json` at the same version, which installs nothing new), so Android's Storage Access Framework — user picks the folder, no storage permission needed, which matters because `app.json` blocks those permissions on purpose — works over the air. `Share.share({ message })` is the fallback for iOS and for devices where SAF fails.

### Price alerts & push
`PriceAlert` rows are evaluated inside `refreshPrices()` (`services/alertService.ts`), only against assets whose price actually changed in that cycle. A fired alert is deactivated (`isActive: false` + `triggeredAt`/`triggeredPrice`) so it doesn't re-notify every 15 minutes; re-enabling it from the app clears the fired state. Push goes through Expo's free `exp.host` service using `PushToken` rows; `DeviceNotRegistered` tickets prune dead tokens. Alert evaluation is wrapped in try/catch — a push failure must never break the price refresh.

### Mobile app structure (Expo Router, file-based)
```
app/
  _layout.tsx            root: SafeArea + React Query + Theme + Lock + Auth providers (in that order)
  (auth)/                 pre-login: login.tsx (password + biometric quick-login), register.tsx
  (app)/                  post-login tabs
    _layout.tsx            tab bar; order = order of the Tabs.Screen declarations (market first, then index);
                           admin tab conditionally shown via href: isAdmin ? undefined : null
    index.tsx              holdings dashboard: donut chart, profit/loss, portfolio-value
                           trend card, per-asset trend modal, CSV export button
    market/                "قیمت‌ها" tab — full tgju list
      index.tsx             searchable/filterable list, 5 sort modes, category section headers
      [symbol].tsx          detail: day high/low/change + line chart with range picker
    settings.tsx           profile summary, account/security links, biometric-lock switch, theme picker, logout
    security/              hidden from the tab bar via href: null; reached from settings
      profile.tsx, change-password.tsx, login-history.tsx
    alerts/                also href: null; reached from the dashboard and settings
      index.tsx             create/toggle/delete price alerts, registers the push token on mount
    admin/                 admin panel, embedded in the same app/login — not a separate surface
      index.tsx             stats overview + manual price refresh
      users/index.tsx, users/[id].tsx   list/detail, role & active toggles, password reset, login history, delete
      assets/index.tsx, assets/[id].tsx  catalog CRUD, tgju symbol picker, manual price entry, active toggle, delete
src/
  api/                    axios client + per-domain API functions (auth, holdings, market, alerts, admin) + shared types.ts
  context/AuthContext.tsx  token persistence via expo-secure-store; exposes `isAdmin`, `refreshUser`,
                           and the biometric quick-login pair (`hasRememberedSession`, `signInWithRememberedSession`)
  context/ThemeContext.tsx dark/light/system preference, persisted via AsyncStorage
  context/LockContext.tsx  biometric app lock; preference in AsyncStorage, re-locks after 60s in background;
                           `authenticate()` prompts without touching lock state (used by the login screen)
  services/notifications.ts permission + Expo push token registration
  components/              shared UI (PrimaryButton has a "danger" variant; DonutChart, LineChart, LockScreen)
  utils/jalali.ts          Gregorian→Jalali conversion + Persian formatting
  utils/csv.ts             holdings → CSV (BOM + Latin digits, see "CSV export")
  utils/exportFile.ts      saves a text file via Android SAF, Share.share fallback
  theme/colors.ts          dark + light palettes, spacing/radius/typography tokens, chart palette
```

**Dates and numbers must never go through `Intl`.** Hermes on Android ships without full ICU, so `Intl.DateTimeFormat("fa-IR")` silently returns *Gregorian* dates and `Intl.NumberFormat("fa-IR")` returns Latin digits. `src/utils/jalali.ts` does the conversion itself (the standard jalaali breaks-table algorithm — note it needs **truncating** `div`/`mod`, not `Math.floor`, or every date lands a year off), and `src/utils/format.ts` groups thousands by hand. When tgju already hands us a Jalali date string, `formatTgjuJalali*` just prettifies it rather than round-tripping.
Server state (queries/mutations) goes through `@tanstack/react-query`; don't add ad-hoc `useEffect` fetching for anything the admin panel or dashboard already has a query for.

**Theming**: colors are dynamic — read them from `useTheme()`, never by importing the `colors` object (that export is a dark-only compatibility shim; using it silently breaks light mode). Screens that need themed `StyleSheet`s define `const makeStyles = (colors: AppColors) => StyleSheet.create({...})` at module scope and call `const styles = makeStyles(colors)` inside the component.

Adding a route under `app/` requires Expo Router's generated types (`.expo/types/router.d.ts`) to be refreshed before `tsc --noEmit` passes; they regenerate when Metro/EAS runs.

## Notes
- `backend/.env` holds a real secret (`JWT_SECRET`) — gitignored, never commit it. `BRSAPI_KEY` is no longer used by the current app; the legacy root site still reads it.
- **BrsApi was dropped on 2026-07-31.** `https://BrsApi.ir/Api/Tsetmc/AllSymbols.php` had started returning 404 from every network tried (the VPS, a dev machine, and the legacy site's GitHub Action) — the endpoint itself moved or was withdrawn. Rather than hunt for a replacement, gold funds moved to tgju's `ime_fund_*` symbols. Redundancy came back later as the `PRICE_PROVIDERS` chain described above rather than as a second *primary* — the lesson from BrsApi was that a single hard-coded endpoint is the fragile part, not that a second vendor is bad. Keep `tgju-ajax` first: the fallbacks are end-of-day or single-symbol and are not substitutes for it.
- The legacy `scripts/fetch_prices.py` used to write the raw BrsApi URL — key included — into `data/prices.json` on error, which published the key to the public repo. That is redacted now (`redact_secrets`), but the key remains in git history, so it should be rotated at brsapi.ir.
- **Android "unknown app / install anyway" warning.** Mitigated in `app.json` by declaring an explicit minimal `android.permissions` allowlist and `blockedPermissions` for the sensitive permissions Expo modules pull in by default (camera, mic, storage, location), plus `targetSdkVersion: 34`. A finance app requesting camera/mic is what makes Play Protect shout. `eas.json` now pins `buildType: "apk"` on `preview`/`production` so builds are signed with the stable EAS release keystore, and a `production-aab` profile exists for store submission. The residual one-time "install from unknown sources" prompt is inherent to sideloading and only disappears via Cafebazaar/Play distribution — don't chase it.
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
npx prisma migrate deploy
pm2 stop sekeh-api                      # frees query_engine-windows.dll.node
npx prisma generate                     # REQUIRED — see below, it does not happen on its own
npm run build
npx prisma db seed
pm2 start sekeh-api                     # never `pm2 restart all` — see PM2 note above
```

Three recurring snags on that box:
- `npm approve-scripts` writes an `allowScripts` block into `backend/package.json`, which makes the next `git pull` abort. Discarding the local change (line 2 above) is safe — the already-installed `node_modules` keep working.
- **`npx prisma generate` must be run explicitly on every schema change.** That same `allowScripts` block suppresses Prisma's postinstall hook, and `npm install` is usually a no-op ("up to date") because backend deps rarely change — so the generated client silently stays on the old schema. Symptom: `npm run build` fails with `Property 'priceAlert' does not exist on type 'PrismaClient'` (or whatever the new model/field is) and `prisma db seed` fails with `Unknown argument`. This bit the 2026-07-31 deploy: `migrate deploy` had already applied the DB changes, so the schema was fine while the client was stale, and PM2 restarted onto the *previous* `dist/` because the build had failed.
- `npx prisma generate` fails with `EPERM ... query_engine-windows.dll.node` if the PM2 process is running and holding the DLL — hence the `pm2 stop` before it in the sequence above.

Because the API is plain HTTP, the Android app needs `usesCleartextTraffic` — configured via the `expo-build-properties` plugin in `mobile/app.json`. Don't remove it unless the server gets HTTPS.

### OTA updates (expo-updates)
`mobile/` has `expo-updates` wired to the `preview` channel, so **JS-only** changes ship with `npx eas-cli update --branch preview --message "..."` (~2 min) instead of a full build. A new native module (or any `app.json` native field such as `name`) still requires `eas build`. Critical: publishing an OTA that imports a native module absent from the installed binary will crash that install — ship the build first, or at the same time.

> As of the 1.1.0 work (alerts + biometric lock), `expo-notifications`, `expo-local-authentication` and `expo-device` were added. Those are native modules, so **1.1.0 cannot ship as an OTA** — it needs a fresh `eas build` before any further `eas update` on that channel.
