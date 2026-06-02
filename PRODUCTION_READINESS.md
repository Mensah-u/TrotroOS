# TrotroOS v1.4.0 — Production Readiness Checklist

**Status**: 🔴 **NOT READY FOR PRODUCTION**  
**Last Updated**: 2026-06-02  
**PR**: [#1](https://github.com/Mensah-u/TrotroOS/pull/1)

---

## Executive Summary

v1.4.0 introduces critical infrastructure and feature improvements (i18n, notifications, RLS fixes, web support, Sentry monitoring), but **requires sign-off on testing, security, and CI/CD before production merge**.

**Estimated time to production**: 5–7 days with full QA and security audit.

---

## Pre-Merge Validation (Must Complete)

### 1. CI/CD Pipeline ✅ **In Progress**

**Status**: Partial — CI workflows exist but not yet validated

- [ ] All GitHub Actions pass (CI, web build, lint, tests)
- [ ] `npm run test` passes locally (Jest/Vitest)
- [ ] `npm run lint` has 0 errors
- [ ] `npm run check:release` passes (secret detection, privacy policy URL)
- [ ] No warnings in Android/iOS build logs

**Action**: 
```bash
npm ci
npm run test
npm run lint
npm run check:release
npm run build:web
```

**Owner**: QA / DevOps

---

### 2. Code Review & Approvals ✅ **CRITICAL**

**Status**: ❌ **0 approvals** — PR has no reviews

- [ ] Lead engineer reviews all 60+ changed files
- [ ] Security engineer reviews RLS policies, error handling, API key config
- [ ] At least 1 approval required before merge
- [ ] All requested changes resolved

**Scope**:
- `services/supabase.js` — RLS implementation
- `services/rideRequests.js` — Mate ride request logic
- `components/PassengerRideRequestWatcher.js` — Real-time updates
- `.github/workflows/` — CI/CD security
- `utils/supabaseErrors.js` — Error messages to users

**Owner**: Team leads

---

### 3. Test Coverage ✅ **In Progress**

**Status**: Tests added but execution status unknown

New test files added:
- `__tests__/config.test.js` — Privacy policy URL validation
- `__tests__/paymentMath.test.js` — 43 assertions (fare calculation)
- `__tests__/vehicleTypes.test.js` — 41 assertions (vehicle type logic)

- [ ] All tests pass locally: `npm run test`
- [ ] Coverage > 70% for critical paths:
  - Auth (signup, login, session recovery)
  - Payments (fare calculation, receipt generation)
  - RLS (passenger/mate data isolation)
  - Offline queue (pending requests, sync)
- [ ] No skipped tests (`test.skip`, `it.skip`)
- [ ] CI reports coverage report

**Owner**: QA

---

### 4. Offline & Connectivity ✅ **In Progress**

**Status**: New offline queue scaffolded, untested

- [ ] Offline mode: location tracking queued during poor connectivity
- [ ] Reconnect flow: pending operations flush correctly
- [ ] Stale ride requests: auto-expire after 5 minutes (commit msg: "Sync mate fares")
- [ ] Network error messages: user-friendly, not exposing stack traces
- [ ] Session timeout: handled gracefully with re-auth prompt

**Test scenarios**:
1. Start a ride, disable WiFi mid-trip → verify location queues → re-enable WiFi → location syncs
2. Passenger reserves seat, app backgrounded, loses connection → foreground app → shows cached state
3. Mate sends ride request, expires while notification is pending → request dismissed gracefully

**Owner**: QA

---

### 5. Security Audit ✅ **NOT STARTED**

**Status**: 🔴 **Not audited**

- [ ] **RLS policies**:
  - Passengers can only view their own reservations
  - Mates cannot read other mates' fares or trips
  - Mate ride requests only visible to invited passenger
  - Test via SQL directly:
    ```sql
    SELECT * FROM reservations WHERE user_id != auth.uid(); -- Should fail
    ```
- [ ] **Error messages**: No stack traces, Supabase details, or URLs leaking to users
  - Verify via `utils/supabaseErrors.js` formatters
- [ ] **API key scope**:
  - Google Maps: restricted to `com.trotro.os` package + release SHA-1
  - Supabase anon key: checked in `.env.example`, never in source
  - Sentry DSN: acceptable in public config (invalid without auth token)
- [ ] **No hardcoded secrets** in code (git history clean via earlier commits)
- [ ] **HTTPS only** for Supabase, Sentry, Google APIs
- [ ] **Session tokens**: Not stored in AsyncStorage unencrypted

**Owner**: Security engineer

---

### 6. Supabase RLS & Database ✅ **In Progress**

**Status**: Scripts provided, unclear if applied to production DB

All scripts must be run against production Supabase project:

- [ ] Run `supabase/RUN_THIS_FIRST.sql`
- [ ] Run `supabase/FIX_passenger_profiles_and_reservations.sql`
- [ ] Run `supabase/FIX_ratings.sql`
- [ ] Run `supabase/FIX_mate_depart_now.sql`
- [ ] Run `supabase/FIX_live_demand.sql`
- [ ] Run `supabase/FIX_mate_ride_requests.sql` (NEW in v1.4)
- [ ] Verify Realtime enabled on: `trips`, `reservations`, `driver_locations`, `passenger_locations`, `ratings`
- [ ] Test RLS: mate trying to view another mate's profile → denied
- [ ] Index optimization: `supabase/FIX_nearby_indexes.sql` (optional, for scale)

**Owner**: Database admin

---

### 7. Manual QA — Core Flows ✅ **NOT STARTED**

**Status**: 🔴 **Not tested**

#### Passenger Flow
- [ ] Welcome → select "Passenger" role
- [ ] Auth: sign up → OTP via email → verified
- [ ] Find Ride: browse routes, see live vehicle positions
- [ ] Reserve: select a trotro, tap "Reserve Seat" → mate invitation appears → accept
- [ ] Trip tracking: see mate's live location, ETA updates
- [ ] Rate trip: post-ride modal → submit 5-star rating

#### Mate Flow
- [ ] Welcome → select "Mate" role
- [ ] Auth: sign up → profile (vehicle, registration, fare)
- [ ] Start trip: select route, confirm vehicle capacity
- [ ] **Depart Now**: activate live trip → passengers queued → invite specific passengers to reserve
- [ ] Broadcast: GPS visible on passenger map (simulate motion in emulator)
- [ ] Dashboard: see seat availability, reservations in real-time
- [ ] Scheduled Ride (NEW): create a future-dated trip
- [ ] Safety Report (NEW): report incident post-trip

#### i18n (NEW)
- [ ] Language toggle: Settings → Language → Twi / English
- [ ] UI strings update correctly across all screens
- [ ] Persist across app restarts

#### Error Handling (NEW)
- [ ] Invalid Supabase response: no stack trace shown to user
- [ ] Network error: friendly message, retry button
- [ ] Auth error (session expired): re-auth prompt, not frozen UI

**Owner**: QA team (3–5 devices, various OS versions)

---

### 8. Notifications (NEW) ✅ **In Progress**

**Status**: `expo-notifications` plugin added, integration unclear

- [ ] Mate ride invitations trigger system alert (already in component code)
- [ ] Reservation confirmation: push notification sent
- [ ] Trip start reminder: notification at 5 min before scheduled time
- [ ] Test on Android with Expo Go and production APK
- [ ] Verify Sentry captures notification-related errors

**Owner**: QA

---

### 9. Web Platform (NEW) ✅ **Not tested**

**Status**: Web export added, no confirmation of working state

- [ ] `npm run web` builds and runs locally
- [ ] Landing page (`WebLandingScreen`) renders correctly
- [ ] "Book a Ride" button navigates to passenger app
- [ ] Interactive map (`InteractiveWebMap.web.js`) displays Google Map
- [ ] Responsive design: mobile (375px), tablet (1024px), desktop
- [ ] Deploy to staging: `npm run build:web` → static hosting (Vercel, Netlify)
- [ ] Test on Chrome, Firefox, Safari (desktop + mobile browsers)

**Owner**: Frontend QA / DevOps

---

### 10. Performance & Monitoring ✅ **In Progress**

**Status**: Sentry DSN added, not verified

- [ ] App startup time < 5 seconds (cold start)
- [ ] Tab navigation: < 500ms
- [ ] Map rendering: 60 FPS with live markers
- [ ] Memory usage: baseline ~150MB (Android)
- [ ] Sentry configured: errors auto-reported to organization
- [ ] Verify Sentry project accessible: https://sentry.io/settings/trotroos/projects/react-native/
- [ ] Release builds: source maps uploaded for meaningful stack traces

**Owner**: DevOps / Performance engineer

---

### 11. Play Store Compliance ✅ **In Progress**

**Status**: Scripts and docs provided, not yet submitted

- [ ] Privacy policy URL valid and accessible: https://trotroos.com/privacy
- [ ] Store assets generated: `npm run generate:store-assets`
  - `assets/store/icon-512.png` — ✅ present
  - `assets/store/feature.png` — ✅ present
  - 4–6 screenshots of real Kumasi routes
- [ ] All strings in store listing use English (or translated strings reviewed by team)
- [ ] No "DEBUG", logging, or placeholder UIs visible in screenshots
- [ ] Permissions declared in `app.json`:
  - Location (ACCESS_FINE_LOCATION)
  - Notifications (POST_NOTIFICATIONS, Android 13+)
- [ ] Target API level 34+ (Google Play requirement)
- [ ] No third-party libraries with known security issues
- [ ] Release build signed with keystore (production release SHA-1)

**Owner**: Product / DevOps

---

### 12. Documentation ✅ **In Progress**

**Status**: Docs exist, may need updates for v1.4

- [ ] README updated: version → 1.4.0 ✅
- [ ] New SQL fix script documented: `supabase/README.md` ✅
- [ ] AGENTS.md reviewed for new components (PassengerRideRequestWatcher, etc.)
- [ ] `docs/PLAY_STORE.md` matches current build process
- [ ] Changelog entries for v1.4: features, fixes, breaking changes (if any)
- [ ] Deployment runbook created for production release

**Owner**: Tech lead / Documentation

---

## Post-Merge Monitoring (First 48 hours)

- [ ] Sentry error rate baseline (should be < 0.5% of sessions)
- [ ] Play Store submission accepted (no policy violations)
- [ ] First 100 users: no critical crashes reported
- [ ] Realtime updates stable (no subscription disconnects)
- [ ] Payment flows (if enabled): no failed transactions
- [ ] Rollback plan: previous APK version available via Play Store

**Owner**: DevOps / Product

---

## Blockers & Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **RLS policies untested** | 🔴 Critical | Run SQL tests, verify data isolation |
| **Offline sync not validated** | 🔴 Critical | Comprehensive connectivity testing (WiFi toggle, airplane mode) |
| **No code review approval** | 🔴 Critical | Require ≥1 team lead sign-off before merge |
| **Sentry not verified** | 🟡 High | Trigger a test error, confirm receipt in Sentry dashboard |
| **Web platform untested** | 🟡 High | Test on staging before production web deploy |
| **Payment scaffolding incomplete** | 🟡 Medium | Disable in v1.4 if not ready; schedule for v1.5 |
| **i18n not tested across locales** | 🟡 Medium | Test Twi / English on real devices |

---

## Merge Decision Tree

```
┌─ All CI checks passing?
│  ├─ NO → Fix failures, retest
│  └─ YES ↓
├─ ≥1 code review approval?
│  ├─ NO → Request review
│  └─ YES ↓
├─ Security audit complete?
│  ├─ NO → Schedule audit, do not merge
│  └─ YES ↓
├─ Manual QA passed on ≥3 devices?
│  ├─ NO → File issues, fix, retest
│  └─ YES ↓
├─ RLS policies verified in production DB?
│  ├─ NO → Run scripts, test data isolation
│  └─ YES ↓
├─ Offline connectivity tested?
│  ├─ NO → Run connectivity test scenarios
│  └─ YES ↓
└─ ✅ APPROVED FOR PRODUCTION MERGE
```

---

## Sign-Off

- [ ] **QA Lead**: _____________________ Date: _______
- [ ] **Security Lead**: _____________________ Date: _______
- [ ] **Tech Lead**: _____________________ Date: _______
- [ ] **Product Lead**: _____________________ Date: _______

---

## References

- **PR**: https://github.com/Mensah-u/TrotroOS/pull/1
- **Version**: 1.4.0
- **Commits**: 6 (Dev workflow, v1.4 features, RLS fixes, mate/passenger polish)
- **Files Changed**: 60+
- **Lines Added**: ~4,000
