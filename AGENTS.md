# TrotroOS — Agent Guide

This document orients AI agents and contributors working on **TrotroOS**, a real-time trotro (shared minibus) app for **Kumasi, Ghana**. It captures architecture, conventions, known pitfalls, and fixes from production-readiness work through May 2026.

---

## 1. Project identity

| Item | Value |
|------|--------|
| **Product** | Passengers find/reserve seats on live routes; mates (drivers) broadcast trips and see waiting riders |
| **Stack** | Expo SDK 54 · React Native 0.81 · React Navigation 7 · Supabase (auth + Postgres + Realtime) |
| **App version** | `1.3.0` (`versionCode` 7) — see `app.json` |
| **Deep link scheme** | `trotrops://` (e.g. `trotrops://auth/callback`) |
| **Android package** | `com.trotro.os` |
| **Region / domain** | Kumasi routes, GHS fares, on-board / MoMo payment copy |

---

## 2. Workspace — read this first

**Correct repo path (use this for all commands):**

```
C:\Users\HP\Documents\TrotroOSv2
```

**Wrong path (do not use):**

```
C:\Users\HP\OneDrive - Kwame Nkrumah Uni. of Sci. and Tech\Documents\TrotroOs
```

The OneDrive folder is not the active Expo project (no valid `package.json` / Metro root). Running `npm start` there causes `ConfigError` and missing dependencies.

### Start dev server

```powershell
cd C:\Users\HP\Documents\TrotroOSv2
npm start
```

- `npm start` runs `scripts/start-dev.ps1` (frees port 8081, LAN IP, optional offline mode, QR via `scripts/show-qr.ps1`).
- `npm run qr` — reprint QR code.
- Press **`r`** in Metro after code changes.
- Offline / flaky network: `$env:EXPO_OFFLINE = "1"; npm start`

### Expo docs

Read versioned docs before changing Expo APIs: https://docs.expo.dev/versions/v54.0.0/

---

## 3. Architecture overview

```
App.js
├── WelcomeScreen          → role pick (Passenger / Mate)
├── PassengerAuthScreen    → passenger onboarding (device profile)
├── MateAuthScreen         → mate login / sign-up (Supabase Auth)
├── PassengerTab
│   ├── FindRideScreen     → route pick, live map, reserve, rate
│   └── ProfileStack       → profile, history, settings
└── MateTab
    ├── MateScreen/Dashboard → start trip, GPS, demand queue, depart
    └── MateAccountScreen
```

### Session & roles

- **`services/appRole.js`** — persisted role (`PASSENGER` | `MATE`).
- **`hooks/useAppSessionState.js`** — bootstrap phase: `loading` → `welcome` | `auth` | `app`.
- **Passengers** — identified by **device UUID** in AsyncStorage (`services/passengerProfile.js`), not Supabase Auth.
- **Mates** — Supabase Auth (`auth.users`) + `mate_profiles` row.

### Data flow (high level)

```
Passenger                          Supabase                         Mate
─────────                          ────────                         ────
pick route ──────────────────────► trips (realtime subscribe)
share GPS ───────────────────────► passenger_locations
reserve seat ────────────────────► reservations (+ passenger_profiles FK)
                                   driver_locations ◄──────────── GPS broadcast
rate trip ───────────────────────► ratings
```

### Backend

- **Client:** `services/supabase.js` — single Supabase client; all table access and RPCs.
- **Config:** `constants/config.js` — `SUPABASE_URL`, keys, optional `ETA_SERVICE_URL`, `API_BASE_URL`.
- **SQL:** `supabase/` — migrations + targeted `FIX_*.sql` scripts (run in Supabase SQL Editor).
- **Optional servers:** `server/eta-service/`, `server/api/`, `server/load-test/`.

---

## 4. Directory map (agent-relevant)

| Path | Purpose |
|------|---------|
| `screens/FindRideScreen.js` | Main passenger hub — routes, map, list, reserve, rating |
| `screens/mate/Dashboard.js` | Mate live dashboard + map |
| `screens/WelcomeScreen.js` | Role selection |
| `components/passenger/` | `LiveRouteMap`, `RouteRideCard`, `RideDetailsSheet`, `RouteResultsHeader` |
| `components/RoutePlanner.js` | From/To picker + quick routes |
| `components/RatingModal.js` | Post-trip rating UI |
| `components/SafeMapView.js` | MapView wrapper (`collapsable={false}`) |
| `components/BrandHeader.js` | Shared screen header |
| `constants/routes.js` | Kumasi routes, fares, places |
| `constants/problemSolution.js` | Problem-first UX copy |
| `constants/layout.js` | `SCREEN_GUTTER`, tab bar clearance |
| `constants/theme.js` | Colors, gradients, radii |
| `hooks/usePassengerLocationSync.js` | Adaptive GPS + passenger_locations upsert |
| `hooks/useSupabaseChannel.js` | Realtime subscription helper |
| `services/authDeepLink.js` | Email confirm / magic-link → session |
| `services/supabase.js` | All DB operations |
| `supabase/FIX_*.sql` | One-shot DB repairs (see §6) |
| `scripts/start-dev.ps1` | Dev startup + QR |

---

## 5. Product flows (what to preserve)

### Passenger — Find Ride

1. Pick **From → To** (`RoutePlanner`).
2. See **live map** + ride cards (`LiveRouteMap`, `RouteRideCard`).
3. **Choose** a ride → **Reserve** (10-minute hold).
4. Track reserved mate on map; optional **queue** when no live trotros.
5. After trip ends → **RatingModal** (1–5 stars).

**UX rules (recent alignment work):**

- Use **`SCREEN_GUTTER` (20px)** for horizontal padding — header, map, list, profile.
- When route results show: hide route planner; route shown in `RouteResultsHeader` (tap pencil to change route).
- Do **not** stack duplicate banners (problem banner + results header + header subtitle for same route).
- **`MapView` must stay outside `FlatList`** on Android (see §7).

### Mate — Dashboard

1. Sign up / log in (email; confirmation via deep link).
2. Start trip → GPS → **Depart Now**.
3. See **passenger_locations** demand on route.
4. Passengers onboard; trip completes → removed from active trips.

### Auth (mate)

- Sign-up uses `emailRedirectTo: Linking.createURL('auth/callback')`.
- **`hooks/useAppSessionState.js`** listens to `onAuthStateChange` + `subscribeToAuthUrls`.
- **Supabase Dashboard → Auth → URL Configuration** must include:
  - `trotrops://auth/callback`
  - Expo Go dev URL if testing: `exp://<LAN-IP>:8081/--/auth/callback`

---

## 6. Supabase setup & FIX scripts

**Initial setup:** run `supabase/RUN_THIS_FIRST.sql` in SQL Editor, then reload schema.

**Run these when you see the corresponding error:**

| Script | When to run |
|--------|-------------|
| `FIX_passenger_profiles_and_reservations.sql` | `reservations_passenger_id_fkey`, booking fails, passenger profile missing |
| `FIX_ratings.sql` | `Could not find the table 'public.ratings' in the schema cache` |
| `FIX_mate_depart_now.sql` | Mate can't start/depart trip, permission denied |
| `FIX_live_demand.sql` | No waiting passengers on mate dashboard / queue empty |
| `FIX_nearby_indexes.sql` | Slow bbox queries at scale |
| `FIX_trips_foreign_key.sql` | Trip FK errors |
| `FIX_payments_and_wallet.sql` | Payment / wallet tables missing |

After any SQL change: `notify pgrst, 'reload schema'` (included in FIX scripts) and press **`r`** in Metro.

### Core tables

| Table | Key idea |
|-------|----------|
| `passenger_profiles` | PK = `device_id` (text UUID) — **not** `auth.users` |
| `reservations` | `passenger_id` → `passenger_profiles.device_id` |
| `trips` | Active mate trips |
| `driver_locations` | Mate GPS |
| `passenger_locations` | Waiting / active passenger GPS + `queued_route` |
| `ratings` | Post-trip stars; unique `(trip_id, passenger_device_id)` |
| `mate_profiles` | Linked to `auth.users.id` |

---

## 7. Platform pitfalls

### Android MapView crash (`addViewAt`)

**Cause:** `react-native-maps` inside scroll views + animated custom markers on Android.

**Rules:**

- Never put `MapView` inside `FlatList` `ListHeaderComponent`.
- On Android: use `StaticMapDot` markers, disable clustering, defer map mount (`InteractionManager` + timeout).
- `components/SafeMapView.js` — wrapper with `collapsable={false}`.
- `app.json`: `"newArchEnabled": false`.
- Apply same pattern to **mate Dashboard** if map crashes there.

### Missing native modules

If Metro shows red screen `Unable to resolve "expo-linking"` (or similar):

```powershell
npx expo install expo-linking
```

Always install Expo packages with `npx expo install <pkg>` for SDK 54 compatibility.

### Port / QR issues

- Phone cannot scan `127.0.0.1` — use LAN URL from `npm start`.
- Use `scripts/show-qr.ps1` if CLI hides QR in non-interactive terminals.

---

## 8. UI & layout conventions

### Spacing

```javascript
// constants/layout.js
SCREEN_GUTTER = 20          // horizontal inset for cards, headers, lists
TAB_BAR_CLEARANCE           // scroll padding above floating tab bar
TAB_FOOTER_CLEARANCE        // pinned bottom CTAs (reserve bar, depart button)
```

- **Floating tab bar** geometry is defined in `App.js` (`floatingTabBar`) — keep in sync with `layout.js`.
- **Bottom sheets / modals** use safe-area bottom inset — **not** `TAB_FOOTER_CLEARANCE` (modals cover the tab bar).

### Theming

- Dark UI: `Theme.colors` in `constants/theme.js`.
- Passenger accent: orange `#F97316`; Mate accent: blue tones in theme.
- Copy follows **problem → solution** pattern in `constants/problemSolution.js`.

### Maps

- Passenger: `components/passenger/LiveRouteMap.js`
- Legend: horizontal pill at **bottom** of map (not top-left stack).
- Fullscreen map: `SafeAreaView` edges top + bottom.

---

## 9. Key APIs in `services/supabase.js`

| Function | Notes |
|----------|-------|
| `ensurePassengerProfileExists(deviceId)` | Call before `createReservation` |
| `createReservation(tripId, passengerId)` | Validates profile + inserts reservation |
| `submitRating(tripId, mateId, passengerDeviceId, stars)` | Requires `ratings` table |
| `signUpMate` / `signInMate` | Auth; redirect via `expo-linking` |
| `createTrip` / `updateTripDestination` | Mate trip lifecycle |
| `upsertDriverLocation` | Mate GPS |
| `upsertPassengerLocation` | Gracefully no-ops if table missing (schema cache) |

Passenger location table missing → run `FIX_live_demand.sql`; app may log warnings but should not hard-crash.

---

## 10. Coding guidelines for agents

1. **Minimal scope** — fix the reported issue; don't refactor unrelated files.
2. **Match existing style** — read surrounding code before adding abstractions.
3. **No commits unless asked** — user prefers explicit commit requests.
4. **Correct path** — always `C:\Users\HP\Documents\TrotroOSv2`.
5. **Supabase first** — many "app bugs" are missing tables/policies; check FIX scripts before heavy client work.
6. **Android maps** — test mental model: MapView + scroll = danger; static markers on Android.
7. **Passenger ID** — always `device_id` text UUID, never assume Supabase Auth for passengers.
8. **Don't edit markdown** the user didn't ask for (except this file when requested).
9. **Reload after dependency install** — restart Metro or press `r`.

---

## 11. Verification checklist

After meaningful changes, mentally verify:

- [ ] `npm start` bundles without import errors
- [ ] Passenger: pick route → see map + cards → reserve (no FK error)
- [ ] Mate: login → email confirm opens app (deep link) → dashboard
- [ ] Rating submit works (`FIX_ratings.sql` applied if needed)
- [ ] Android: Find Ride map does not crash on scroll
- [ ] UI: elements align to 20px gutter; no overlapping modals / tab bar

---

## 12. Common errors → quick fixes

| Symptom | Likely fix |
|---------|------------|
| Red Metro screen, module not found | `npx expo install <package>`; restart Metro |
| `public.ratings` schema cache | Run `supabase/FIX_ratings.sql` |
| Reservation FK / passenger_id | Run `supabase/FIX_passenger_profiles_and_reservations.sql` |
| Mate stuck at login after email confirm | Add redirect URL in Supabase; check `authDeepLink.js` + `useAppSessionState` |
| Submit Rating button dead | Ensure `deviceId` loaded; check `submitRating` return `{ error }`; ratings table exists |
| Mate can't depart | `FIX_mate_depart_now.sql` |
| No queue on mate map | `FIX_live_demand.sql`; passenger taps "I'm waiting" |
| UI misaligned / overlay clutter | Use `SCREEN_GUTTER`; hide duplicate banners; modals use safe area not tab clearance |
| QR won't scan | LAN IP not localhost; run `npm run qr` |

---

## 13. Related docs

- `supabase/README.md` — backend setup summary
- `docs/STORE_LISTING.md` — Play Store copy checklist
- `server/api/README.md` — optional fare/payment API
- `server/eta-service/README.md` — optional ETA cache service
- `server/load-test/README.md` — k6 / stress scripts

---

## 14. Version & release notes

- **Expo SDK:** 54 (`expo` ~54.0.33)
- **React Native:** 0.81.5
- **Maps:** `react-native-maps` 1.20.1
- **EAS project:** `app.json` → `extra.eas.projectId`
- Build APK: `npm run build:apk` (EAS preview profile)

When bumping `versionCode` / `versionName`, update `app.json` and `constants/appInfo.js` if present.

---

---

## 15. Google Play Store readiness

### Pre-flight

```powershell
cd C:\Users\HP\Documents\TrotroOSv2
npm run check:release
npm run build:aab
```

### Implemented in app

| Item | Location |
|------|----------|
| Privacy Policy (in-app) | Profile → Privacy Policy (`screens/profile/PrivacyPolicyScreen.js`) |
| Data export / cache / deletion | Profile → Data & privacy (`screens/profile/DataPrivacyScreen.js`) |
| Foreground-only GPS | `services/locationBroadcaster.js` |
| Error boundary | `components/ErrorBoundary.js` |
| Crash monitoring hook | `services/monitoring.js` + `EXPO_PUBLIC_SENTRY_DSN` |
| Env-based config | `constants/config.js`, `.env.example` |
| Release checks | `scripts/check-release.js` |
| Production AAB script | `scripts/build-aab.ps1` |

### Manual steps before submission

1. **Host privacy policy** — publish `docs/PRIVACY_POLICY.md` to HTTPS; set `EXPO_PUBLIC_PRIVACY_POLICY_URL` in EAS secrets.
2. **Store assets** — create files in `assets/store/` (see `assets/store/README.md`).
3. **Replace app icons** — final 1024×1024 icon + adaptive layers (current grid templates are placeholders).
4. **Supabase production** — run `RUN_THIS_FIRST.sql` + all relevant `FIX_*.sql` on live project.
5. **Google Cloud** — restrict Maps API key to `com.trotro.os` + release SHA-1.
6. **Sentry (recommended)** — `npx expo install sentry-expo`, set `EXPO_PUBLIC_SENTRY_DSN`.
7. **Play Console** — Data safety form, content rating, internal → closed testing (12 testers / 14 days for new accounts).

Full checklist: `docs/PLAY_STORE.md` · Listing copy: `docs/STORE_LISTING.md`

### Listing must match app

- v1.3.0: fares paid **cash/MoMo to mate on board** — not in-app Paystack checkout.
- Location: **foreground only** — no background tracking claims.

---

*Last updated: Play Store readiness pass — legal screens, release scripts, policy alignment, foreground GPS.*
