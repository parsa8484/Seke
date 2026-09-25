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

### Computed (intrinsic) price and bubble

`mobile/src/utils/intrinsic.ts` derives what a gram *should* cost from the global ounce and the dollar, and shows the gap as حباب on the market list row and the symbol detail screen. Both formulas are the same parity: `ounce($) × usd(toman) ÷ 31.1035 × purity` — 0.0241130419 is just `0.75 / 31.1035` for 18k gold, and silver 999 uses purity 1.

The dollar leg reads market symbol **`price_dollar_rl`**, not `currency_usd`: the latter is an `Asset.assetKey` in the portfolio and does not exist in the tgju market list at all, so using it silently yields no card rather than a wrong number. Any missing or zero leg returns null and the UI renders nothing — a bubble computed against a stale or absent ounce would be worse than no bubble.

Only `geram18` and `silver_999` are wired up (`SPECS`); adding another purity is one entry with its own gram factor.

Both tabs show it. The market list looks the symbol up directly; the holdings tab cannot, because `/api/holdings` returns only `assetKey` — hence `ASSET_KEY_TO_SYMBOL` (`gold_geram18` → `geram18`, `silver_999_gram` → `silver_999`). The dashboard subscribes to the **same `["market"]` query key** as the قیمت‌ها tab rather than adding an endpoint, so when that tab has been opened the data comes from cache; a failure there just hides the bubble block. `computeIntrinsic`'s optional `marketPrice` exists for this call site: the bubble must be measured against the price rendered in the same box (the asset's own), not a second price looked up from the market list.

### Auth & roles
JWT (`backend/src/utils/jwt.ts`) + bcrypt password hashing. `User.role` (`"user"|"admin"`) and `User.isActive` gate access. `backend/src/middleware/admin.ts`'s `requireAdmin` re-reads the role from the DB on every request rather than trusting the JWT payload, so admin promotion/demotion and account deactivation take effect immediately without waiting for token expiry. `isActive: false` users are rejected at login and at `/api/auth/me` with 403.

Login accepts **either** an email or a username in a single `identifier` field — the route branches on whether it contains `@`. `User.username` is nullable (accounts predating the feature have none) and compared case-insensitively; since SQLite/Prisma has no `mode: "insensitive"`, that lookup is a parameterized `LOWER()` raw query in `auth.routes.ts`.

Every login attempt, successful or not, is written to `LoginEvent`. Recording is deliberately non-throwing — a logging failure must never block a valid login.

**Biometric quick-login.** Every successful login also writes the JWT to a second SecureStore key (`sekeh_biometric_token`) that `signOut` deliberately does *not* clear, so the login screen can offer "ورود با اثر انگشت". Consequences to keep in mind: the token stays on the device for up to its 30-day expiry after logout, and because `disableDeviceFallback: false`, the phone's own PIN/pattern also unlocks it — the same tradeoff banking apps make. Settings' logout asks whether to keep it, and `forgetDevice()` clears it. If a restored token is rejected by `/api/auth/me` (expired, or `isActive: false`), both keys are wiped and the user is sent back to password login.

### Backend request flow
`src/index.ts` wires Express + routes. Routes: `auth.routes.ts` (register/login/me, change-password, profile PATCH, login-history), `prices.routes.ts` (public asset+price list, plus `GET /:key/history` for trend charts), `market.routes.ts` (public full tgju price list + `GET /history/:symbol`), `alerts.routes.ts` (price-alert CRUD + Expo push-token registration — still server-side, and now the only place any user data lives on the server), `admin.routes.ts` (stats, user CRUD, password reset, per-user login history, asset catalog CRUD, tgju symbol picker, manual price set, manual refresh trigger — all zod-validated, all behind `requireAdmin`), `download.routes.ts` (public, mounted at the root: `/app` is an HTML landing page, `/app/download` redirects to the newest build, `/download/:file` serves it). APKs come from `DOWNLOAD_DIR` (default `backend/downloads`), which is kept **outside git** — a missing directory just yields an empty list rather than an error, and `:file` is reduced to a basename before it is opened, so `..` paths 404. Self-modification (an admin changing their own role/isActive) is explicitly blocked in the admin routes — but an admin *may* reset any password including their own.

### Holdings live on the device, not on the server

**A user's quantities and buy prices never leave their phone.** The server is an auth + market-price service; it does not know what anyone owns. Login/register/admin stay server-side, and so does the asset catalog and every price — those are public market data with nothing personal in them.

The pieces:

- `mobile/src/storage/holdings.ts` — `sekeh_holdings_v1:<userId>` in AsyncStorage, `{ [assetKey]: { quantity, avgBuyPrice } }`. Entries that are 0/empty on both fields are dropped rather than stored, so a cleared field really is "not recorded".
- `mobile/src/hooks/useHoldings.ts` — two independent queries: `["assets"]` (server, `GET /api/prices`, 60s stale) and `["local-holdings", userId]` (disk, `staleTime: Infinity` because the app is the only writer). `buildHoldingsSummary` joins them into the exact `HoldingsSummary` shape the old endpoint returned, so the dashboard's render code and the alerts screen didn't have to change. Saving is `setQueryData` then a disk write, never a request.
- `mobile/src/utils/holdingsSummary.ts` and `mobile/src/utils/portfolioHistory.ts` — line-for-line ports of the math that used to run in `holdings.routes.ts`.

**How the old data got out (done 2026-09-24 — kept here because the shape of the rollout is the reusable part).** It shipped as three OTAs on `preview`, never as one. First the app started reading and writing locally while still pulling each user's server rows once on launch, merging them *under* anything already on the phone and under the old `sekeh_holdings_draft_v1:<userId>` draft (a draft meant "typed but never uploaded", so it outranked the server).

Then each install zeroed its own server rows — `PUT /api/holdings` with `quantity: 0, avgBuyPrice: null`, deliberately the existing endpoint rather than a new `DELETE`, so no backend change and no VPS deploy were needed. That wipe is what made the cutover *knowable*: with no telemetry there is otherwise no way to tell whether everyone has migrated, and the admin overview's total falling to zero was taken as the signal that the table could be dropped — **that signal was wrong, see “Temporary: holdings restore” below.** Only then did the third update remove the migration code, `holdings.routes.ts`, the `Holding` model and the three admin routes that exposed portfolios.

The reusable part: the irreversible step was gated on evidence, not on a timer — a migration flag set only after a successful pull, a read-back of what had just been written to disk, and a refusal to delete any key that wasn't present locally.

Consequences that are the point, not bugs: no sync between devices, and uninstalling loses the data. The user explicitly chose this over a backup/restore feature.

### Temporary: holdings restore (added 2026-09-24 — delete once `pendingRestores` is 0)

**What went wrong.** The `holdings` table was dropped on the strength of the admin "total value" reaching zero. That number was Σ `quantity × currentPrice ?? 0`, so it measured *value*, not *rows* (an asset with no price counted as zero), and it was not a count of installs. Five users who never opened the app between the OTAs still had non-zero rows in the pre-drop backup; when they did open it they saw every quantity at 0. Lesson for any future irreversible cutover: the go/no-go signal must be a **count of the things still pending**, and it must be checked against the raw rows once before the drop, not inferred from a derived total. Keep the backup until the count is proven.

**How they get their data back.** `backend/scripts/export-restore-holdings.ts` reads the backup (`prisma/dev.db.before-drop`, on a temp copy — the file itself is never opened) and writes `backend/restore/holdings.json` (gitignored; override with `RESTORE_DIR`), keyed by `userId`. It refuses to run if that file already exists, because after some users have restored their entry is gone and a blind re-run would bring it back; `--force` overrides. `services/restoreStore.ts` + `routes/restore.routes.ts` serve it: `GET /api/restore/holdings` returns *the caller's* items (the id comes from the JWT), `POST /api/restore/holdings/ack` deletes the caller's entry — but only if the client's `keys` cover every key in it (409 otherwise). No schema change, so no `migrate deploy`, no `prisma generate`.

On the phone, `restoreHoldingsFromServer` (`mobile/src/storage/restore.ts`) runs **inside the `["local-holdings"]` query function, before the disk read** — not after, because the dashboard fills its form once and a late restore would leave the user staring at zeros until the next launch. Order inside it: fetch → merge under what is already on the phone (local wins per key) → write → **read back from disk with `readLocalHoldingsStrict`** → only then ack. `readLocalHoldings` cannot be used for the merge: it turns a read error into `{}`, and writing that back would overwrite the user's own data. Every step is idempotent and nothing throws, so a failure just means “next launch”. One extra GET per cold start for everyone, for as long as this exists.

`readFile` in `restoreStore` throws on anything but ENOENT — a corrupt file must never be read as “empty” and then written back, or one bad byte erases every pending user.

**Rollout order** (each step is safe on its own): deploy backend → run the export script on the VPS → confirm `GET /api/restore/holdings` returns the items for a known token → publish the OTA. The admin overview shows “در انتظار بازیابی دارایی” only while `pendingRestores > 0` (counts users who still exist and are active). Wait ~3 weeks, then check the count: for anyone left, contact them (or accept the loss), then **remove** `restore.routes.ts`, `restoreStore.ts`, the export script, the `/api/restore` mount, the `pendingRestores` stat and box, `mobile/src/api/restore.ts`, `mobile/src/storage/restore.ts`, the call in `useHoldings`, `readLocalHoldingsStrict` if nothing else uses it, and finally delete `restore/holdings.json` and `prisma/dev.db.before-drop` on the VPS.

### Profit/loss
`avgBuyPrice` is nullable on purpose: null means "not recorded" and the asset is excluded from profit math entirely. Storing 0 would mean "acquired for free" and would poison the totals, so the storage layer and the form both coerce empty/zero input to null. The dashboard computes profit live from the in-progress form values (not the saved ones) so the user sees the result before it settles.

### Auto-save on the dashboard

Quantities and buy prices save themselves — the "ذخیره و محاسبه" button is only a manual trigger, kept because users expect it. Saving is now a local write, so the machinery that used to guard the network round-trip (`editVersionRef`, `savingRef`/`pendingRef`, the separate draft layer) is gone: there is no in-flight window for a keystroke to race against.

What remains: `AUTOSAVE_DELAY` (800ms of typing silence) before the commit, plus a forced flush on `AppState` leaving `active` and on screen unmount. The delay is there to keep every keystroke from re-running the portfolio-history chart, not to batch requests. `flushSave` reads the form from `formRef`, not from state — a timer or an `AppState` listener holds a stale closure and would otherwise write the values from whenever it was registered. `hydratedRef` fills the form from saved values exactly once; a price refetch must not overwrite what the user is typing.

### Portfolio value over time (computed on the phone)

There is **no snapshot table** and deliberately so. `buildPortfolioHistory` multiplies the user's *current* quantities by each asset's *historical* daily close. Semantics: "what would the holdings you have today have been worth back then" — not a real transaction ledger, because storage keeps a quantity, not a dated buy/sell history. The payoff is that a brand-new user gets a year of real curve immediately instead of waiting for snapshots to accumulate.

It calls `GET /api/prices/:key/history` once per owned asset (typically 3–6, all served from the server's 30-min tgju cache) instead of the one server-side call it replaced — the server can't aggregate a portfolio it no longer knows about. The unit is already applied server-side, so the client just sums.

The time axis is the union of every asset's trading days (symbols have different holidays), capped at the requested range. Each asset carries its last known close forward across gaps. Assets with no history at all — manual ones, or a fetch that failed — are held flat at `currentPrice` and reported in `missingHistory` so the app can tell the user the chart is partial rather than quietly drawing a wrong line.

The chart reads *saved* holdings: its query key carries an `assetKey:quantity` signature, so it recomputes when a quantity settles rather than on every keystroke.

### CSV export

Client-side only — no endpoint. `src/utils/csv.ts` builds the file from what's on screen (live form values, so it matches what the user is looking at) and `src/utils/exportFile.ts` writes it. Two non-obvious constraints:

- **The file needs a UTF-8 BOM and Latin digits.** Without the BOM, Excel on Windows reads it in the system codepage and every Persian label turns to mojibake. And every number must bypass the app's usual Persian-digit formatting — Excel does not parse `۱۲۳` as a number, so the column silently becomes text and won't sum or sort.
- **`expo-sharing` is deliberately not used.** It's a native module, so adding it would break OTA delivery for already-installed builds. `expo-file-system` was already in the binary (a transitive dependency of `expo`; now also declared explicitly in `package.json` at the same version, which installs nothing new), so Android's Storage Access Framework — user picks the folder, no storage permission needed, which matters because `app.json` blocks those permissions on purpose — works over the air. `Share.share({ message })` is the fallback for iOS and for devices where SAF fails.

### Price alerts & push
`PriceAlert` rows are evaluated inside `refreshPrices()` (`services/alertService.ts`), only against assets whose price actually changed in that cycle. A fired alert is deactivated (`isActive: false` + `triggeredAt`/`triggeredPrice`) so it doesn't re-notify every 15 minutes; re-enabling it from the app clears the fired state. Push goes through Expo's free `exp.host` service using `PushToken` rows; `DeviceNotRegistered` tickets prune dead tokens. Alert evaluation is wrapped in try/catch — a push failure must never break the price refresh.

**An alert fires on a *crossing*, not on the condition being true.** `refreshPrices` passes `previousPrice` alongside the new one, and only for symbols whose stored number actually differs; `hasCrossed` then requires the previous price to have been on the *other* side of the target. Without that, an alert whose target was already satisfied at creation fired on the very next refresh and pushed “reached X” for something that never happened — and the form made that the default path, because it pre-filled the target with the current price, which satisfies both `>=` and `<=`. The other half of the fix is a guard: `POST`/`PUT /api/alerts` reject a target that is already met (the message quotes the current price) and the screen checks the same thing before it sends, so an alert that could never fire cannot be created in the first place. `previousPrice: null` (an asset's first-ever price) falls back to the plain comparison.

The push payload carries `channelId: "price-alerts"`, matching `PRICE_ALERT_CHANNEL_ID` in `mobile/src/services/notifications.ts`. If those two strings drift apart, Android drops the notification into its fallback “Miscellaneous” channel and the sound/vibration/importance configured on the real channel never apply. Tapping the notification opens the alerts screen — `(app)/_layout.tsx` watches `useLastNotificationResponse()`, which covers both a cold start and a resume.

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
  api/                    axios client + per-domain API functions (auth, prices, market, alerts, admin) + shared types.ts
  storage/holdings.ts      the user's quantities/buy prices in AsyncStorage — the only copy that exists
  hooks/useHoldings.ts     joins the server catalog with local holdings into the old HoldingsSummary shape
  context/AuthContext.tsx  token persistence via expo-secure-store; exposes `isAdmin`, `refreshUser`,
                           and the biometric quick-login pair (`hasRememberedSession`, `signInWithRememberedSession`)
  context/ThemeContext.tsx dark/light/system preference, persisted via AsyncStorage
  context/LockContext.tsx  biometric app lock; preference in AsyncStorage, re-locks after 60s in background;
                           `authenticate()` prompts without touching lock state (used by the login screen)
  services/notifications.ts permission + Expo push token registration
  components/              shared UI (PrimaryButton has a "danger" variant; DonutChart, LineChart, LockScreen)
  utils/jalali.ts          Gregorian→Jalali conversion + Persian formatting
  utils/csv.ts             holdings → CSV (BOM + Latin digits, see "CSV export")
  utils/holdingsSummary.ts catalog + local holdings → totals/profit (was GET /api/holdings/summary)
  utils/portfolioHistory.ts per-asset history → portfolio curve (was GET /api/holdings/history)
  utils/exportFile.ts      saves a text file via Android SAF, Share.share fallback
  theme/colors.ts          dark + light palettes, spacing/radius/typography tokens, chart palette
```

**Dates and numbers must never go through `Intl`.** Hermes on Android ships without full ICU, so `Intl.DateTimeFormat("fa-IR")` silently returns *Gregorian* dates and `Intl.NumberFormat("fa-IR")` returns Latin digits. `src/utils/jalali.ts` does the conversion itself (the standard jalaali breaks-table algorithm — note it needs **truncating** `div`/`mod`, not `Math.floor`, or every date lands a year off), and `src/utils/format.ts` groups thousands by hand. When tgju already hands us a Jalali date string, `formatTgjuJalali*` just prettifies it rather than round-tripping.
Server state (queries/mutations) goes through `@tanstack/react-query`; don't add ad-hoc `useEffect` fetching for anything the admin panel or dashboard already has a query for.

**`useQuery`'s `data` resolves to `any` here, so `tsc` does not guard API shapes.** Removing a field from a response type in `src/api/types.ts` compiles fine at every `useQuery` call site, and the screen then renders `undefined` at runtime. Three admin screens were in exactly that state after the holdings removal and had to be found by grepping the field names. When you change an API shape, grep for every field you touched instead of trusting a clean type-check. (Calling the `src/api/*` function directly *is* checked — that is how the discrepancy was confirmed.)

**Theming**: colors are dynamic — read them from `useTheme()`, never by importing the `colors` object (that export is a dark-only compatibility shim; using it silently breaks light mode). Screens that need themed `StyleSheet`s define `const makeStyles = (colors: AppColors) => StyleSheet.create({...})` at module scope and call `const styles = makeStyles(colors)` inside the component.

Adding a route under `app/` requires Expo Router's generated types (`.expo/types/router.d.ts`) to be refreshed before `tsc --noEmit` passes; they regenerate when Metro/EAS runs.

## Notes
- **The app forces LTR on purpose.** Every screen hand-rolls right-alignment (`flexDirection: "row-reverse"`, `textAlign: "right"`) on top of an LTR layout engine. On a device whose language is Persian, Android turns `I18nManager.isRTL` on and Yoga mirrors everything, so those `row-reverse` rows render *left*-aligned and the UI breaks — a bug invisible on an English-locale dev phone. `mobile/src/utils/rtl.ts` calls `allowRTL(false)`/`forceRTL(false)` at module scope (imported first in `app/_layout.tsx`) and, because that only takes effect on the next JS start, reloads once via `Updates.reloadAsync()` when the app booted in RTL. A one-shot AsyncStorage guard (`sekeh_ltr_reload_attempted`) prevents a boot loop and clears itself on the first LTR launch. Do not "fix" a screen by flipping its `row-reverse` back to `row` — that only looks right on RTL devices and breaks everywhere else.
- **OTA updates apply on the same launch.** `mobile/src/utils/otaUpdates.ts` checks/fetches/reloads at startup, instead of expo-updates' default of applying on the *next* launch (which makes the user see one stale run). Returning from background only prefetches — no reload in the middle of a session.
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
git status --short                      # if backend/package.json is modified: git checkout -- backend/package.json
git pull
cd backend
pm2 stop sekeh-api                      # everything DB/build related happens while it is down
npx prisma migrate deploy
npx prisma generate                     # REQUIRED — see below, it does not happen on its own
npm run build
pm2 start sekeh-api                     # never `pm2 restart all` — see PM2 note above
```

`npm install` and `npx prisma db seed` are **not** unconditional steps. Diff first (`git diff <deployed sha>..HEAD -- backend/`): run `npm install` only if `backend/package.json` changed, and the seed only if `prisma/seed.ts` did. Skipping a no-op `npm install` also skips the `approve-scripts` trap below entirely. The 2026-09-24 deploy needed neither and went through clean.

`pm2 stop` comes **before** `migrate deploy`, not after. A destructive migration (`DROP TABLE`) against the SQLite file while the app holds a connection can hit `SQLITE_BUSY`; with the process down there is nothing to race, and the freed ~130 MB matters on a 4 GB box shared with sarkhati. It also satisfies the `EPERM` constraint below.

Take a copy of the DB before any destructive migration (`copy prisma\dev.db prisma\dev.db.before-drop`) — **and delete it once the deploy is proven**, or the data the migration removed is still sitting on the server in that file.

**Verify from outside the box, not from it.** `curl http://188.209.153.164:4000/health` run *on* the VPS fails with "Unable to connect" — the machine does not reach its own public IP. That failure means nothing; check from a different network.

Three recurring snags on that box:
- `npm approve-scripts` writes an `allowScripts` block into `backend/package.json`, which makes the next `git pull` abort. Discarding the local change (line 2 above) is safe — the already-installed `node_modules` keep working.
- **`npx prisma generate` must be run explicitly on every schema change.** That same `allowScripts` block suppresses Prisma's postinstall hook, and `npm install` is usually a no-op ("up to date") because backend deps rarely change — so the generated client silently stays on the old schema. Symptom: `npm run build` fails with `Property 'priceAlert' does not exist on type 'PrismaClient'` (or whatever the new model/field is) and `prisma db seed` fails with `Unknown argument`. This bit the 2026-07-31 deploy: `migrate deploy` had already applied the DB changes, so the schema was fine while the client was stale, and PM2 restarted onto the *previous* `dist/` because the build had failed.
- `npx prisma generate` fails with `EPERM ... query_engine-windows.dll.node` if the PM2 process is running and holding the DLL — hence the `pm2 stop` before it in the sequence above.

Because the API is plain HTTP, the Android app needs `usesCleartextTraffic` — configured via the `expo-build-properties` plugin in `mobile/app.json`. Don't remove it unless the server gets HTTPS.

### OTA updates (expo-updates)
`mobile/` has `expo-updates` wired to the `preview` channel, so **JS-only** changes ship with `npx eas-cli update --branch preview --message "..."` (~2 min) instead of a full build. A new native module (or any `app.json` native field such as `name`) still requires `eas build`. Critical: publishing an OTA that imports a native module absent from the installed binary will crash that install — ship the build first, or at the same time.

> As of the 1.1.0 work (alerts + biometric lock), `expo-notifications`, `expo-local-authentication` and `expo-device` were added. Those are native modules, so **1.1.0 cannot ship as an OTA** — it needs a fresh `eas build` before any further `eas update` on that channel.
