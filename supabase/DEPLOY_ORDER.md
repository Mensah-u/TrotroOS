# Supabase production deploy order

Run these **once** in Supabase Dashboard → SQL Editor, in order. Each file is idempotent (safe to re-run).

| Step | File | Purpose |
| ---- | ---- | ------- |
| 1 | `RUN_THIS_FIRST.sql` | Base schema: profiles, trips, reservations, locations |
| 2 | `migrations/000_trotroos_complete_schema.sql` | Full schema additions |
| 3 | `migrations/004_ratings_and_demand.sql` | Ratings + demand tables |
| 4 | `migrations/005_trips_rls_fix.sql` | Trip RLS fixes |
| 5 | `migrations/006_reservation_seat_sync.sql` | Seat sync triggers |
| 6 | `FIX_baseline_rls_policies.sql` | Baseline RLS |
| 7 | `FIX_security_hardening.sql` | Device-scoped passenger access, phone hiding |
| 8 | `FIX_passenger_profiles_and_reservations.sql` | Passenger profile fixes |
| 9 | `FIX_mate_reservations.sql` | Mate reservation policies |
| 10 | `FIX_mate_depart_now.sql` | Depart-now flow |
| 11 | `FIX_mate_ride_requests.sql` | Ride request bus |
| 12 | `FIX_live_demand.sql` | Live demand queries |
| 13 | `FIX_ratings.sql` | Rating averages |
| 14 | `FIX_trip_fare.sql` | Fare columns |
| 15 | `FIX_nearby_indexes.sql` | Geo indexes for nearby queries |
| 16 | `FIX_payments_and_wallet.sql` | Payments ledger (optional) |
| 17 | `FIX_v14_features.sql` | v1.4 feature flags / columns |
| 18 | `FIX_trips_foreign_key.sql` | FK integrity |
| 19 | `migrations/007_payment_transactions.sql` | Paystack MoMo `payment_transactions` table |

## After applying

1. **Settings → API → Reload schema** (or wait ~60s).
2. Run load tests: `npm --prefix server/load-test run stress` (see `docs/SCALE_UP.md`).
3. Verify in app: passenger reserve, mate depart, GPS queue, rating submit.

## Pre-launch checklist

- [ ] Supabase **Pro** tier if expecting >200 concurrent realtime users
- [ ] Database backups + 7-day PITR enabled
- [ ] All `FIX_*.sql` files applied on production project
- [ ] `EXPO_PUBLIC_SENTRY_DSN` set in EAS production secrets
- [ ] Privacy policy live at `https://trotroos.com/privacy`
- [ ] Paystack Edge Functions deployed — see `docs/supabase/PAYMENTS.md`
